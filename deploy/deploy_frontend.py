"""Deploy the built frontend with an index-last switch and automatic rollback."""
import hashlib
import getpass
import json
import os
from pathlib import Path
import shlex
import sys
import tarfile
from datetime import datetime, timezone

ROOT = Path(__file__).resolve().parent.parent
RUNTIME = ROOT / 'deploy' / '.ssh-runtime'
sys.path.insert(0, str(RUNTIME))
import paramiko

settings = {
    'HOST': os.environ.get('DEPLOY_HOST', '102.203.202.104'),
    'PORT': int(os.environ.get('DEPLOY_PORT', '22')),
    'USER': os.environ.get('DEPLOY_USER', 'root'),
    'KEY_FILE': os.environ.get('DEPLOY_SSH_KEY'),
    'KEY_PASSPHRASE': os.environ.get('DEPLOY_SSH_KEY_PASSPHRASE'),
}
settings['PASSWORD'] = None if settings['KEY_FILE'] else getpass.getpass('Deployment SSH password (input is hidden): ')

REMOTE = r'''
import concurrent.futures, hashlib, json, os, pathlib, shutil, sys, urllib.request
config = json.loads(sys.stdin.readline())
base = pathlib.Path('/opt/lawyer_office/client/dist')
origin = 'http://muhami.ly'
def get(path):
    request = urllib.request.Request(origin + path, headers={'Cache-Control': 'no-cache', 'Accept-Encoding': 'identity'})
    with urllib.request.urlopen(request, timeout=20) as response:
        return response.read(), response.geturl()
def health():
    body, url = get('/api/health')
    assert json.loads(body).get('status') == 'ok', 'Public health check failed'
    return url
health_url = health()
old_index = (base / 'index.html').read_bytes()
old_hash = hashlib.sha256(old_index).hexdigest()
if config['mode'] == 'preflight':
    print(json.dumps({'health': 'ok', 'health_url': health_url, 'index_sha256': old_hash, 'assets': len(list((base / 'assets').iterdir()))}))
    sys.exit(0)
assert old_hash == config['expected_index'], 'Live frontend changed after preflight'
stage = pathlib.Path(config['stage']) / 'dist'
files = config['files']
assert 'index.html' in files
for name, digest in files.items():
    path = stage / name
    assert path.resolve().is_relative_to(stage.resolve())
    assert hashlib.sha256(path.read_bytes()).hexdigest() == digest, 'Staged checksum mismatch: ' + name
backup = pathlib.Path('/opt/lawyer_office/deployment-backups') / ('frontend-' + config['stamp'])
shutil.copytree(base, backup / 'dist')
def publish(source, names):
    ordered = sorted(name for name in names if name != 'index.html') + ['index.html']
    for name in ordered:
        target = base / name
        target.parent.mkdir(parents=True, exist_ok=True)
        temporary = target.with_name(target.name + '.deploy-' + config['stamp'])
        shutil.copyfile(source / name, temporary)
        os.chmod(temporary, 0o644)
        os.replace(temporary, target)
try:
    publish(stage, files)
    def verify(name):
        assert hashlib.sha256((base / name).read_bytes()).hexdigest() == files[name], 'Remote checksum mismatch: ' + name
        body, _ = get('/' + name + '?deployment=' + config['stamp'])
        assert hashlib.sha256(body).hexdigest() == files[name], 'Public checksum mismatch: ' + name
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        list(pool.map(verify, files))
    health()
    print(json.dumps({'status': 'deployed', 'backup': str(backup), 'files_verified': len(files), 'health': 'ok', 'health_url': health_url, 'index_sha256': files['index.html'], 'verified_at_utc': config['stamp']}))
except Exception:
    previous = backup / 'dist'
    publish(previous, [str(path.relative_to(previous)) for path in previous.rglob('*') if path.is_file()])
    print('Previous frontend restored after verification failure.', file=sys.stderr)
    raise
'''

ssh = paramiko.SSHClient()
ssh.load_host_keys(str(RUNTIME / 'known_hosts'))

ssh.set_missing_host_key_policy(paramiko.RejectPolicy())


def command(text, payload=None):
    stdin, stdout, stderr = ssh.exec_command(text, timeout=90)
    if payload is not None:
        stdin.write(payload)
        stdin.channel.shutdown_write()
    output = stdout.read().decode('utf-8', errors='replace')
    errors = stderr.read().decode('utf-8', errors='replace')
    status = stdout.channel.recv_exit_status()
    if status:
        raise RuntimeError(f'Remote command failed ({status}): {errors.strip()} {output.strip()}')
    return output.strip()

def remote(config):
    return json.loads(command('python3 -c ' + shlex.quote(REMOTE), json.dumps(config) + '\n'))

try:
    ssh.connect(settings['HOST'], port=settings['PORT'], username=settings['USER'], key_filename=settings['KEY_FILE'], passphrase=settings['KEY_PASSPHRASE'], password=settings['PASSWORD'], timeout=25, look_for_keys=False, allow_agent=False)
    print(command('systemctl show lawyer-office --property=ActiveState,WorkingDirectory'))
    before = remote({'mode': 'preflight'})
    print('Preflight:', json.dumps(before))
    mode = sys.argv[1] if len(sys.argv) > 1 else 'preflight'
    if mode == 'deploy':
        dist = ROOT / 'client' / 'dist'
        files = {path.relative_to(dist).as_posix(): hashlib.sha256(path.read_bytes()).hexdigest() for path in dist.rglob('*') if path.is_file() and not any(part.startswith('.') for part in path.relative_to(dist).parts)}
        assert 'index.html' in files
        assert all(name.startswith(('assets/', 'icons/')) or name in ('index.html', 'sw.js', 'manifest.json', 'favicon.svg') for name in files), 'Unexpected file in frontend artifact'
        stamp = datetime.now(timezone.utc).strftime('%Y%m%d-%H%M%S')
        stage = '/tmp/lawyer-frontend-' + stamp
        archive = RUNTIME / ('frontend-' + stamp + '.tar.gz')
        with tarfile.open(archive, 'w:gz') as bundle:
            for name in files:
                bundle.add(dist / name, arcname='dist/' + name)
        command('mkdir -p ' + shlex.quote(stage))
        with ssh.open_sftp() as sftp:
            sftp.put(str(archive), stage + '/frontend.tar.gz')
        command(f'tar -xzf {shlex.quote(stage + "/frontend.tar.gz")} -C {shlex.quote(stage)}')
        result = remote({'mode': 'deploy', 'expected_index': before['index_sha256'], 'stage': stage, 'stamp': stamp, 'files': files})
        result['host'] = settings['HOST']
        result['files'] = files
        (ROOT / 'deploy' / 'FRONTEND-DEPLOYMENT-RESULT.json').write_text(json.dumps(result, indent=2), encoding='utf-8')
        print('Deployment:', json.dumps({key: value for key, value in result.items() if key != 'files'}))
    elif mode != 'preflight':
        raise ValueError('Use preflight or deploy')
finally:
    ssh.close()
