"""Publish the tested permission fixes with snapshots and automatic code rollback."""
import hashlib
import json
import os
from pathlib import Path
import shlex
import sys
import time

ROOT = Path(__file__).resolve().parent.parent
RUNTIME = ROOT / 'deploy' / '.ssh-runtime'
sys.path.insert(0, str(RUNTIME))
import paramiko

settings = {
    'HOST': os.environ.get('DEPLOY_HOST', '102.203.202.104'),
    'PORT': int(os.environ.get('DEPLOY_PORT', '22')),
    'USER': os.environ['DEPLOY_USER'],
    'KEY_FILE': os.environ['DEPLOY_SSH_KEY'],
    'KEY_PASSPHRASE': os.environ.get('DEPLOY_SSH_KEY_PASSPHRASE'),
}

BASE = '/opt/lawyer_office'
FILES = ['server/middleware/auth.js', 'server/middleware/permissions.js'] + [
    'server/routes/' + name + 'Routes.js' for name in (
        'activity', 'backup', 'case', 'client', 'document', 'event', 'expense',
        'export', 'invoice', 'report', 'search', 'task', 'timeEntry')
]
FILES += ['server/services/caseStatusService.js']
REVIEW = ROOT / 'deploy' / '.server-review' / 'permissions'
ssh = paramiko.SSHClient()
ssh.load_host_keys(str(RUNTIME / 'known_hosts'))

ssh.set_missing_host_key_policy(paramiko.RejectPolicy())


def command(value):
    _, stdout, stderr = ssh.exec_command(value, timeout=90)
    output = stdout.read().decode('utf-8', errors='replace')
    error = stderr.read().decode('utf-8', errors='replace')
    status = stdout.channel.recv_exit_status()
    if status:
        raise RuntimeError(f'Remote command failed ({status}): {error.strip()} {output.strip()}')
    return output.strip()

def digest(data):
    return hashlib.sha256(data).hexdigest()

def health(url):
    try:
        result = json.loads(command('curl --fail --silent --location --max-time 20 ' + shlex.quote(url)))
        return result.get('status') == 'ok'
    except Exception:
        return False

try:
    ssh.connect(settings['HOST'], port=settings['PORT'], username=settings['USER'],
                key_filename=settings['KEY_FILE'], passphrase=settings['KEY_PASSPHRASE'],
                timeout=25, look_for_keys=False, allow_agent=False)
    mode = sys.argv[1] if len(sys.argv) > 1 else 'preflight'
    sftp = ssh.open_sftp()
    if mode == 'preflight':
        print(command('systemctl show lawyer-office --property=ActiveState,User,WorkingDirectory'))
        if not health('http://127.0.0.1:3000/api/health'):
            raise RuntimeError('Server health failed before deployment')
        for relative in FILES + ['server/index.js', 'server/package.json']:
            destination = REVIEW / relative
            destination.parent.mkdir(parents=True, exist_ok=True)
            sftp.get(BASE + '/' + relative, str(destination))
            print(relative, 'same' if digest(destination.read_bytes()) == digest((ROOT / relative).read_bytes()) else 'different')
        print('Preflight complete; remote code snapshots saved locally.')
    elif mode == 'verify':
        if command('systemctl is-active lawyer-office') != 'active' or not health('https://muhami.ly/api/health'):
            raise RuntimeError('Service or public health check failed')
        for endpoint, expected in [('https://muhami.ly/', '200'), ('https://muhami.ly/api/cases', '401')]:
            status = command('curl --silent --location --output /dev/null --write-out "%{http_code}" --max-time 20 ' + shlex.quote(endpoint))
            if status != expected:
                raise RuntimeError('Public smoke check failed: ' + endpoint + ' returned ' + status)
        print('Verified: service active; HTTPS health ok; homepage 200; unauthenticated cases 401.')
    elif mode == 'deploy':
        if not health('http://127.0.0.1:3000/api/health'):
            raise RuntimeError('Pre-deployment health check failed')
        for relative in FILES + ['server/index.js', 'server/package.json']:
            actual = command('sha256sum ' + shlex.quote(BASE + '/' + relative)).split()[0]
            if actual != digest((REVIEW / relative).read_bytes()):
                raise RuntimeError('Remote code changed since review: ' + relative)
        with sftp.open(BASE + '/server/.env') as environment:
            for line in environment.read().decode('utf-8').splitlines():
                if line.startswith('DB_PATH=') and line.split('=', 1)[1].strip().strip('"\'') not in ('', BASE + '/server/database/lawyer_office.db'):
                    raise RuntimeError('Custom database path requires matching backup configuration')
        stamp = time.strftime('%Y%m%d-%H%M%S', time.gmtime())
        backup = BASE + '/deployment-backups/permissions-' + stamp
        stage = '/tmp/lawyer-permissions-' + stamp
        command('mkdir -p ' + shlex.quote(backup) + ' ' + shlex.quote(stage))
        for relative in FILES:
            command('mkdir -p ' + shlex.quote(stage + '/' + str(Path(relative).parent).replace('\\', '/')) + ' ' + shlex.quote(backup + '/' + str(Path(relative).parent).replace('\\', '/')))
            sftp.put(str(ROOT / relative), stage + '/' + relative)
            command('node --check ' + shlex.quote(stage + '/' + relative))
            command('cp -a ' + shlex.quote(BASE + '/' + relative) + ' ' + shlex.quote(backup + '/' + relative))
        stopped = False
        changed = False
        try:
            command('systemctl stop lawyer-office')
            stopped = True
            snapshot = 'import sqlite3; source=sqlite3.connect("' + BASE + '/server/database/lawyer_office.db"); target=sqlite3.connect("' + backup + '/database.db"); source.backup(target); target.close(); source.close()'
            command('python3 -c ' + shlex.quote(snapshot))
            changed = True
            for relative in FILES:
                command('cp ' + shlex.quote(stage + '/' + relative) + ' ' + shlex.quote(BASE + '/' + relative))
            command('systemctl start lawyer-office')
            stopped = False
            for _ in range(15):
                if health('http://127.0.0.1:3000/api/health'):
                    break
                time.sleep(2)
            else:
                raise RuntimeError('Post-deployment health check failed')
            for relative in FILES:
                actual = command('sha256sum ' + shlex.quote(BASE + '/' + relative)).split()[0]
                if actual != digest((ROOT / relative).read_bytes()):
                    raise RuntimeError('Deployed checksum mismatch: ' + relative)
            if not health('https://muhami.ly/api/health'):
                raise RuntimeError('Public HTTPS health check failed')
            for endpoint, expected in [('https://muhami.ly/', '200'), ('https://muhami.ly/api/cases', '401')]:
                status = command('curl --silent --location --output /dev/null --write-out "%{http_code}" --max-time 20 ' + shlex.quote(endpoint))
                if status != expected:
                    raise RuntimeError('Public smoke check failed: ' + endpoint + ' returned ' + status)
            print('Service:', command('systemctl is-active lawyer-office'))
            print('Public HTTPS health: ok')
            print('Homepage: 200; unauthenticated cases access: 401')
            print('Backup:', backup)
            (ROOT / 'deploy' / 'PERMISSIONS-DEPLOYMENT-RESULT.json').write_text(json.dumps({
                'backup': backup, 'files': FILES, 'health': 'ok', 'public_health': 'ok',
                'verified_at_utc': stamp, 'sha256': {f: digest((ROOT / f).read_bytes()) for f in FILES}
            }, indent=2), encoding='utf-8')
        except Exception:
            if changed:
                command('systemctl stop lawyer-office')
                for relative in FILES:
                    command('cp -a ' + shlex.quote(backup + '/' + relative) + ' ' + shlex.quote(BASE + '/' + relative))
            if stopped or changed:
                command('systemctl start lawyer-office')
            print('Deployment failed; original code restored where changed.')
            raise
    else:
        raise ValueError('Use preflight or deploy')
    sftp.close()
finally:
    ssh.close()
