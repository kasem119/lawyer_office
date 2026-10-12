"""Deploy reviewed fixes without changing accounts, secrets or dependencies."""
import hashlib
import json
import os
from pathlib import Path
import shlex
import sys
import tarfile
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
BACKEND = ['server/routes/caseRoutes.js', 'server/services/caseStatusService.js']
ssh = paramiko.SSHClient()
hosts_file = RUNTIME / 'known_hosts'
if hosts_file.exists():
    ssh.load_host_keys(str(hosts_file))

ssh.set_missing_host_key_policy(paramiko.RejectPolicy())


def command(text):
    _, stdout, stderr = ssh.exec_command(text, timeout=90)
    output = stdout.read().decode('utf-8', errors='replace')
    errors = stderr.read().decode('utf-8', errors='replace')
    status = stdout.channel.recv_exit_status()
    if status:
        raise RuntimeError(f'Remote command failed ({status}): {errors.strip()} {output.strip()}')
    return output.strip()

def healthy():
    try:
        body = json.loads(command('curl --fail --silent --max-time 10 http://127.0.0.1:3000/api/health'))
        return body.get('status') == 'ok'
    except Exception:
        return False

try:
    ssh.connect(settings['HOST'], port=settings['PORT'], username=settings['USER'],
                key_filename=settings['KEY_FILE'], passphrase=settings['KEY_PASSPHRASE'],
                timeout=25, look_for_keys=False, allow_agent=False)
    mode = sys.argv[1] if len(sys.argv) > 1 else 'preflight'
    if mode == 'preflight':
        print(command('systemctl show lawyer-office --property=ActiveState,User,WorkingDirectory'))
        print('Health:', healthy())
        print('Node:', command('node --version'))
        sftp = ssh.open_sftp()
        destination = ROOT / 'deploy' / '.server-review'
        destination.mkdir(exist_ok=True)
        for relative in ['server/routes/caseRoutes.js', 'server/services/exportService.js', 'server/package.json']:
            local = destination / relative
            local.parent.mkdir(parents=True, exist_ok=True)
            sftp.get(BASE + '/' + relative, str(local))
            print(relative, 'sha256', hashlib.sha256(local.read_bytes()).hexdigest())
        sftp.close()
    elif mode == 'deploy':
        if not healthy():
            raise RuntimeError('Pre-deployment health check failed')
        reviewed = ROOT / 'deploy' / '.server-review' / 'server' / 'routes' / 'caseRoutes.js'
        expected_existing = hashlib.sha256(reviewed.read_bytes()).hexdigest()
        if command(f'sha256sum {BASE}/server/routes/caseRoutes.js').split()[0] != expected_existing:
            raise RuntimeError('Server code changed after preflight; review again before deploying')
        sftp = ssh.open_sftp()
        with sftp.open(BASE + '/server/.env') as environment:
            for line in environment.read().decode('utf-8').splitlines():
                if line.startswith('DB_PATH=') and line.split('=', 1)[1].strip().strip('"\'') not in ('', BASE + '/server/database/lawyer_office.db'):
                    raise RuntimeError('Custom database path requires matching backup configuration')
        sftp.close()
        stamp = time.strftime('%Y%m%d-%H%M%S', time.gmtime())
        backup = BASE + '/deployment-backups/improvements-' + stamp
        stage = '/tmp/lawyer-improvements-' + stamp
        archive = ROOT / 'deploy' / 'improvements.tar.gz'
        files = BACKEND + [str(p.relative_to(ROOT)).replace('\\', '/') for p in (ROOT / 'client' / 'dist').rglob('*') if p.is_file()]
        with tarfile.open(archive, 'w:gz') as bundle:
            for relative in files:
                bundle.add(ROOT / relative, arcname=relative)
        print('Artifact files:', len(files))
        command(f'mkdir -p {shlex.quote(stage)} {shlex.quote(backup)}')
        sftp = ssh.open_sftp()
        sftp.put(str(archive), stage + '/improvements.tar.gz')
        sftp.close()
        command(f'tar -xzf {stage}/improvements.tar.gz -C {stage}')
        for relative in BACKEND:
            command(f'node --check {stage}/{relative}')
        # Code snapshot before stopping; database snapshot while writes are stopped.
        command(f'cp -a {BASE}/client/dist {backup}/dist; cp -a {BASE}/server/routes/caseRoutes.js {backup}/caseRoutes.js')
        had_helper = command(f'test -f {BASE}/server/services/caseStatusService.js && echo yes || echo no') == 'yes'
        if had_helper:
            command(f'cp -a {BASE}/server/services/caseStatusService.js {backup}/caseStatusService.js')
        changed = False
        try:
            command('systemctl stop lawyer-office')
            command(f"python3 -c {shlex.quote('import sqlite3; source=sqlite3.connect(\"' + BASE + '/server/database/lawyer_office.db\"); target=sqlite3.connect(\"' + backup + '/database.db\"); source.backup(target); target.close(); source.close()')}")
            changed = True
            for relative in BACKEND:
                command(f'cp {stage}/{relative} {BASE}/{relative}')
            # Keep old hashed assets for browsers that still have the preceding index.
            command(f'cp -a {stage}/client/dist/. {BASE}/client/dist/')
            command('systemctl start lawyer-office')
            for _ in range(10):
                if healthy():
                    break
                time.sleep(2)
            else:
                raise RuntimeError('Post-deployment health check failed')
            for relative in files:
                expected = hashlib.sha256((ROOT / relative).read_bytes()).hexdigest()
                actual = command(f'sha256sum {BASE}/{relative}').split()[0]
                if actual != expected:
                    raise RuntimeError('Deployed checksum mismatch: ' + relative)
            print('Deployment verified. Backup:', backup)
            print('Service:', command('systemctl is-active lawyer-office'))
            print('Health:', command('curl --fail --silent --max-time 10 http://127.0.0.1:3000/api/health'))
            public_health = json.loads(command('curl --location --fail --silent --max-time 20 http://muhami.ly/api/health'))
            if public_health.get('status') != 'ok':
                raise RuntimeError('Public health check failed')
            print('Public health:', public_health['status'])
            (ROOT / 'deploy' / 'DEPLOYMENT-RESULT.json').write_text(json.dumps({
                'host': settings['HOST'], 'backup': backup, 'files': files,
                'health': 'ok', 'public_health': 'ok', 'verified_at_utc': stamp
            }, indent=2), encoding='utf-8')
        except Exception:
            if changed:
                command('systemctl stop lawyer-office')
                command(f'cp -a {backup}/caseRoutes.js {BASE}/server/routes/caseRoutes.js')
                if had_helper:
                    command(f'cp -a {backup}/caseStatusService.js {BASE}/server/services/caseStatusService.js')
                command(f'cp -a {backup}/dist/. {BASE}/client/dist/')
            command('systemctl start lawyer-office')
            print('Previous code restored; database was not modified by this deployment.')
            raise
    else:
        raise ValueError('Use preflight or deploy')
finally:
    ssh.close()
