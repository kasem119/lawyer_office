"""Safely publish the owner account controls and their matching frontend build."""
import getpass
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

HOST = os.environ.get('DEPLOY_HOST', '102.203.202.104')
PORT = int(os.environ.get('DEPLOY_PORT', '22'))
USER = os.environ.get('DEPLOY_USER', 'root')
KEY_FILE = os.environ.get('DEPLOY_SSH_KEY')
KEY_PASSPHRASE = os.environ.get('DEPLOY_SSH_KEY_PASSPHRASE')
PASSWORD = None if KEY_FILE else getpass.getpass('Deployment SSH password (input is hidden): ')
BASE = '/opt/lawyer_office'
BACKEND = ['server/routes/platformAdminRoutes.js', 'server/services/websocketService.js']
DIST = ROOT / 'client' / 'dist'
STAMP = time.strftime('%Y%m%d-%H%M%S', time.gmtime())
STAGE = f'/tmp/lawyer-owner-controls-{STAMP}'

REMOTE = r'''
import concurrent.futures, hashlib, json, os, pathlib, shutil, sys, time, urllib.request
config = json.loads(sys.stdin.readline())
base = pathlib.Path('/opt/lawyer_office')
dist = base / 'client' / 'dist'
stage = pathlib.Path(config.get('stage', '/tmp'))
backup = pathlib.Path('/opt/lawyer_office/deployment-backups') / ('owner-controls-' + config.get('stamp', 'preflight'))
files = config.get('files', {})
backend = config['backend']
def health(url='http://127.0.0.1:3000/api/health'):
    with urllib.request.urlopen(url, timeout=15) as response:
        return json.loads(response.read()).get('status') == 'ok'
def publish_frontend(source, names):
    ordered = sorted(name for name in names if name != 'index.html') + ['index.html']
    for name in ordered:
        target = dist / name
        target.parent.mkdir(parents=True, exist_ok=True)
        temporary = target.with_name(target.name + '.deploy-' + config['stamp'])
        shutil.copyfile(source / name, temporary)
        os.chmod(temporary, 0o644)
        os.replace(temporary, target)
def public_check(name):
    url = 'https://muhami.ly/' + name
    request = urllib.request.Request(url + '?deployment=' + config['stamp'], headers={'Cache-Control':'no-cache','Accept-Encoding':'identity'})
    with urllib.request.urlopen(request, timeout=20) as response:
        body = response.read()
    assert hashlib.sha256(body).hexdigest() == files['client/dist/' + name], 'Public checksum mismatch: ' + name
if config['mode'] == 'preflight':
    assert health(), 'Local API health failed'
    body = urllib.request.urlopen('https://muhami.ly/api/health', timeout=20).read()
    assert json.loads(body).get('status') == 'ok', 'Public API health failed'
    print(json.dumps({
        'health':'ok', 'index_sha256':hashlib.sha256((dist/'index.html').read_bytes()).hexdigest(),
        'backend_sha256':{name:hashlib.sha256((base/name).read_bytes()).hexdigest() for name in backend},
        'service':os.popen('systemctl is-active lawyer-office').read().strip()
    }))
    sys.exit(0)
assert hashlib.sha256((dist/'index.html').read_bytes()).hexdigest() == config['expected_index'], 'Frontend changed after preflight'
for name, digest in files.items():
    local = stage / name
    assert local.resolve().is_relative_to(stage.resolve()), 'Invalid staged file path'
    assert hashlib.sha256(local.read_bytes()).hexdigest() == digest, 'Staged checksum mismatch: ' + name
for name, digest in config['expected_backend'].items():
    assert hashlib.sha256((base/name).read_bytes()).hexdigest() == digest, 'Backend changed after preflight: ' + name
for name in backend:
    result = os.system('node --check ' + str(stage/name))
    assert result == 0, 'Staged Node syntax check failed: ' + name
backup.mkdir(parents=True, exist_ok=False)
shutil.copytree(dist, backup/'dist')
for name in backend:
    target = backup/name
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(base/name, target)
changed = False
try:
    for name in backend:
        target = base/name
        temporary = target.with_name(target.name + '.deploy-' + config['stamp'])
        shutil.copyfile(stage/name, temporary)
        os.chmod(temporary, 0o644)
        os.replace(temporary, target)
    changed = True
    assert os.system('systemctl restart lawyer-office') == 0, 'Service restart failed'
    for _ in range(15):
        try:
            if health(): break
        except Exception:
            pass
        time.sleep(2)
    else:
        raise RuntimeError('Post-restart API health failed')
    frontend_names = [name.removeprefix('client/dist/') for name in files if name.startswith('client/dist/')]
    publish_frontend(stage/'client'/'dist', frontend_names)
    for name, digest in files.items():
        path = stage/name
        remote = dist/name.removeprefix('client/dist/') if name.startswith('client/dist/') else base/name
        assert hashlib.sha256(remote.read_bytes()).hexdigest() == digest, 'Remote checksum mismatch: ' + name
    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
        list(pool.map(public_check, frontend_names))
    with urllib.request.urlopen('https://muhami.ly/api/health', timeout=20) as response:
        assert json.loads(response.read()).get('status') == 'ok', 'Public API health failed after deployment'
    print(json.dumps({'status':'deployed','backup':str(backup),'files_verified':len(files),'health':'ok','service':'active','verified_at_utc':config['stamp']}))
except Exception:
    if changed:
        publish_frontend(backup/'dist', [str(path.relative_to(backup/'dist')) for path in (backup/'dist').rglob('*') if path.is_file()])
        for name in backend:
            shutil.copy2(backup/name, base/name)
        os.system('systemctl restart lawyer-office')
        for _ in range(15):
            try:
                if health(): break
            except Exception:
                pass
            time.sleep(2)
    raise
'''

ssh = paramiko.SSHClient()
ssh.load_host_keys(str(RUNTIME / 'known_hosts'))
ssh.set_missing_host_key_policy(paramiko.RejectPolicy())

def command(text, payload=None):
    stdin, stdout, stderr = ssh.exec_command(text, timeout=180)
    if payload is not None:
        stdin.write(payload)
        stdin.channel.shutdown_write()
    output = stdout.read().decode('utf-8', errors='replace').strip()
    errors = stderr.read().decode('utf-8', errors='replace').strip()
    status = stdout.channel.recv_exit_status()
    if status:
        raise RuntimeError(f'Remote command failed ({status}): {errors or output}')
    return output

def remote(config):
    result = command('python3 -c ' + shlex.quote(REMOTE), json.dumps(config) + '\n')
    return json.loads(result)

try:
    ssh.connect(HOST, port=PORT, username=USER, key_filename=KEY_FILE,
                passphrase=KEY_PASSPHRASE, password=PASSWORD, timeout=25,
                look_for_keys=False, allow_agent=False)
    preflight = remote({'mode':'preflight','backend':BACKEND})
    files = {path.relative_to(DIST).as_posix(): path for path in DIST.rglob('*')
             if path.is_file() and not any(part.startswith('.') for part in path.relative_to(DIST).parts)}
    assert 'index.html' in files, 'Built frontend index is missing'
    hashes = {'client/dist/' + name: hashlib.sha256(path.read_bytes()).hexdigest() for name, path in files.items()}
    for relative in BACKEND:
        source = ROOT / relative
        hashes[relative] = hashlib.sha256(source.read_bytes()).hexdigest()
    archive = RUNTIME / ('owner-controls-' + STAMP + '.tar.gz')
    with tarfile.open(archive, 'w:gz') as bundle:
        for name, path in files.items():
            bundle.add(path, arcname='client/dist/' + name)
        for relative in BACKEND:
            bundle.add(ROOT / relative, arcname=relative)
    command(f'mkdir -p {shlex.quote(STAGE)}')
    with ssh.open_sftp() as sftp:
        sftp.put(str(archive), STAGE + '/release.tar.gz')
    command(f'tar -xzf {shlex.quote(STAGE + "/release.tar.gz")} -C {shlex.quote(STAGE)}')
    result = remote({
        'mode':'deploy','stage':STAGE,'stamp':STAMP,'files':hashes,
        'backend':BACKEND,'expected_index':preflight['index_sha256'],
        'expected_backend':preflight['backend_sha256']
    })
    result.update({'host':HOST,'backend_files':BACKEND,'frontend_files':len(files),'index_sha256':hashes['client/dist/index.html']})
    output = ROOT / 'deploy' / 'OWNER-ACCOUNT-CONTROLS-DEPLOYMENT-RESULT.json'
    output.write_text(json.dumps(result, indent=2), encoding='utf-8')
    print(json.dumps(result))
finally:
    ssh.close()
