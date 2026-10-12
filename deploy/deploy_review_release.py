"""Publish reviewed web fixes with pinned SSH identity, backups and rollback."""
import ctypes
from ctypes import wintypes
import hashlib
import json
from pathlib import Path
import shlex
import sys
import tarfile
from datetime import datetime, timezone

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / 'deploy' / '.ssh-runtime'))
import paramiko

REVIEW = ROOT / 'deploy' / '.server-review' / 'review-release'
BACKEND = [f'server/routes/{name}Routes.js' for name in
           ('ai', 'caseNote', 'document', 'invoice', 'portal', 'template', 'user')]
BACKEND += ['server/services/websocketService.js']

def credential():
    class Credential(ctypes.Structure):
        _fields_ = [('Flags', wintypes.DWORD), ('Type', wintypes.DWORD),
                    ('TargetName', wintypes.LPWSTR), ('Comment', wintypes.LPWSTR),
                    ('LastWritten', wintypes.FILETIME), ('CredentialBlobSize', wintypes.DWORD),
                    ('CredentialBlob', ctypes.POINTER(ctypes.c_ubyte)), ('Persist', wintypes.DWORD),
                    ('AttributeCount', wintypes.DWORD), ('Attributes', ctypes.c_void_p),
                    ('TargetAlias', wintypes.LPWSTR), ('UserName', wintypes.LPWSTR)]
    pointer = ctypes.POINTER(Credential)()
    api = ctypes.WinDLL('Advapi32.dll', use_last_error=True)
    api.CredReadW.argtypes = [wintypes.LPCWSTR, wintypes.DWORD, wintypes.DWORD,
                             ctypes.POINTER(ctypes.POINTER(Credential))]
    api.CredReadW.restype = wintypes.BOOL
    api.CredFree.argtypes = [ctypes.c_void_p]
    if not api.CredReadW('LawyerOffice/muhami.ly/root-ssh', 1, 0, ctypes.byref(pointer)):
        raise RuntimeError('Saved deployment credential is unavailable')
    try:
        return ctypes.string_at(pointer.contents.CredentialBlob,
                                pointer.contents.CredentialBlobSize).decode('utf-16-le')
    finally:
        api.CredFree(pointer)

def digest(data):
    return hashlib.sha256(data).hexdigest()

def command(ssh, value, payload=None, timeout=180):
    stdin, stdout, stderr = ssh.exec_command(value, timeout=timeout)
    if payload is not None:
        stdin.write(payload)
        stdin.channel.shutdown_write()
    output = stdout.read().decode('utf-8', errors='replace').strip()
    error = stderr.read().decode('utf-8', errors='replace').strip()
    status = stdout.channel.recv_exit_status()
    if status:
        raise RuntimeError(f'Remote command failed ({status}): {error or output}')
    return output

def main():
    mode = sys.argv[1] if len(sys.argv) > 1 else 'preflight'
    ssh = paramiko.SSHClient()
    ssh.load_host_keys(str(ROOT / 'deploy' / '.ssh-runtime' / 'known_hosts'))
    ssh.set_missing_host_key_policy(paramiko.RejectPolicy())
    try:
        ssh.connect('102.203.202.104', port=22, username='root', password=credential(),
                    timeout=25, look_for_keys=False, allow_agent=False)
        if mode == 'preflight':
            print(command(ssh, 'systemctl show lawyer-office --property=ActiveState,User,WorkingDirectory'))
            print(command(ssh, 'node --version'))
            print(command(ssh, 'curl --fail --silent --max-time 20 https://muhami.ly/api/health'))
            REVIEW.mkdir(parents=True, exist_ok=True)
            files = BACKEND + ['server/package.json', 'server/package-lock.json', 'server/index.js',
                               'client/dist/index.html']
            with ssh.open_sftp() as sftp:
                for name in files:
                    destination = REVIEW / name
                    destination.parent.mkdir(parents=True, exist_ok=True)
                    sftp.get('/opt/lawyer_office/' + name, str(destination))
                    local = ROOT / name
                    print(name, 'same' if local.exists() and digest(local.read_bytes()) == digest(destination.read_bytes()) else 'different')
            baseline = {name: digest((REVIEW / name).read_bytes()) for name in files}
            (REVIEW / 'baseline.json').write_text(json.dumps(baseline, indent=2), encoding='utf-8')
            print('Preflight snapshots and hashes saved; no live files changed.')
        elif mode == 'deploy':
            deploy(ssh)
        elif mode == 'verify':
            print(command(ssh, 'systemctl is-active lawyer-office'))
            print(command(ssh, 'curl --fail --silent --max-time 20 https://muhami.ly/api/health'))
        elif mode == 'smoke':
            target = '/tmp/lawyer-review-live-smoke.mjs'
            with ssh.open_sftp() as sftp:
                sftp.put(str(ROOT / 'deploy' / 'review_live_smoke.mjs'), target)
            output = command(ssh, 'node ' + target, timeout=180)
            result = json.loads(output.splitlines()[-1])
            (ROOT / 'deploy' / 'REVIEW-LIVE-SMOKE-RESULT.json').write_text(json.dumps(result, indent=2), encoding='utf-8')
            print(json.dumps(result), flush=True)
        else:
            raise ValueError('Use preflight, deploy or verify')
    finally:
        ssh.close()

def deploy(ssh):
    baseline = json.loads((REVIEW / 'baseline.json').read_text(encoding='utf-8'))
    stamp = datetime.now(timezone.utc).strftime('%Y%m%d-%H%M%S')
    stage = '/tmp/lawyer-review-release-' + stamp
    backend = BACKEND + ['server/package-lock.json']
    sources = {name: ROOT / name for name in backend}
    for path in (ROOT / 'client' / 'dist').rglob('*'):
        if path.is_file():
            relative = path.relative_to(ROOT).as_posix()
            assert relative.startswith('client/dist/') and not any(part.startswith('.') for part in path.relative_to(ROOT / 'client' / 'dist').parts)
            sources[relative] = path
    hashes = {name: digest(path.read_bytes()) for name, path in sources.items()}
    assert 'client/dist/index.html' in hashes
    archive = REVIEW / ('review-release-' + stamp + '.tar.gz')
    with tarfile.open(archive, 'w:gz') as bundle:
        for name, path in sources.items():
            bundle.add(path, arcname=name)
    command(ssh, 'mkdir -p ' + shlex.quote(stage))
    with ssh.open_sftp() as sftp:
        sftp.put(str(archive), stage + '/release.tar.gz')
    command(ssh, f'tar -xzf {shlex.quote(stage + "/release.tar.gz")} -C {shlex.quote(stage)}')
    config = {'stage': stage, 'stamp': stamp, 'backend': backend, 'hashes': hashes,
              'baseline': baseline}
    print('Uploaded reviewed release; preparing dependency runtime before changing live files.', flush=True)
    output = command(ssh, 'python3 -u -c ' + shlex.quote(REMOTE), json.dumps(config) + '\n', timeout=900)
    result = json.loads(output.splitlines()[-1])
    result['hashes'] = hashes
    (ROOT / 'deploy' / 'REVIEW-DEPLOYMENT-RESULT.json').write_text(json.dumps(result, indent=2), encoding='utf-8')
    print(json.dumps({key: value for key, value in result.items() if key != 'hashes'}), flush=True)

REMOTE = r'''
import concurrent.futures, hashlib, json, os, pathlib, shutil, sqlite3, subprocess, sys, time, urllib.request, urllib.error
config=json.loads(sys.stdin.readline())
base=pathlib.Path('/opt/lawyer_office')
stage=pathlib.Path(config['stage'])
backup=base/'deployment-backups'/('review-'+config['stamp'])
backend=config['backend']
hashes=config['hashes']
def digest(path): return hashlib.sha256(path.read_bytes()).hexdigest()
def run(args, cwd=None, timeout=120):
    result=subprocess.run(args,cwd=cwd,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True,timeout=timeout)
    if result.returncode: raise RuntimeError('Command failed: '+str(args[:3])+' '+result.stderr[-2000:])
    return result.stdout.strip()
def get(url):
    req=urllib.request.Request(url,headers={'Cache-Control':'no-cache','Accept-Encoding':'identity'})
    try:
        with urllib.request.urlopen(req,timeout=25) as response: return response.status,response.read()
    except urllib.error.HTTPError as error: return error.code,error.read()
def health():
    status,body=get('http://127.0.0.1:3000/api/health')
    return status==200 and json.loads(body).get('status')=='ok'
def wait_health():
    for _ in range(20):
        try:
            if health(): return
        except Exception: pass
        time.sleep(2)
    raise RuntimeError('API failed startup health check')
def publish(source, names):
    ordered=sorted(name for name in names if name!='client/dist/index.html')
    if 'client/dist/index.html' in names: ordered.append('client/dist/index.html')
    for name in ordered:
        target=base/name
        target.parent.mkdir(parents=True,exist_ok=True)
        temporary=target.with_name(target.name+'.review-'+config['stamp'])
        shutil.copy2(source/name,temporary)
        os.chmod(temporary,0o644)
        os.replace(temporary,target)
for name,value in config['baseline'].items():
    assert digest(base/name)==value,'Live files changed after preflight: '+name
for name,value in hashes.items():
    assert (stage/name).resolve().is_relative_to(stage.resolve())
    assert digest(stage/name)==value,'Staged hash mismatch: '+name
for name in backend:
    if name.endswith('.js'): run(['node','--check',str(stage/name)])
assert run(['systemctl','is-active','lawyer-office'])=='active'
assert health()
runtime=stage/'dependency-runtime'
runtime.mkdir()
shutil.copy2(base/'server/package.json',runtime/'package.json')
shutil.copy2(stage/'server/package-lock.json',runtime/'package-lock.json')
run(['npm','ci','--omit=dev','--legacy-peer-deps','--ignore-scripts','--no-fund'],cwd=runtime,timeout=600)
versions=run(['node','--input-type=module','-e',"import fs from 'node:fs'; console.log(JSON.stringify(Object.fromEntries(['express','proxy-addr','qs','brace-expansion'].map(n=>[n,JSON.parse(fs.readFileSync('node_modules/'+n+'/package.json')).version]))));"],cwd=runtime)
backup.mkdir(parents=True,exist_ok=False)
shutil.copytree(base/'client/dist',backup/'client/dist')
for name in backend:
    target=backup/name
    target.parent.mkdir(parents=True,exist_ok=True)
    shutil.copy2(base/name,target)
# SQLite backup includes a consistent WAL snapshot; rollback changes code only.
dbpath=base/'server/database/lawyer_office.db'
envfile=base/'server/.env'
if envfile.exists():
    for line in envfile.read_text().splitlines():
        if line.strip().startswith('DB_PATH='):
            value=line.split('=',1)[1].strip().strip('"\'')
            if value: dbpath=pathlib.Path(value) if value.startswith('/') else base/'server'/value
assert dbpath.is_file(),'Office database path missing; cannot take deployment snapshot'
with sqlite3.connect('file:'+str(dbpath)+'?mode=ro',uri=True) as source:
    with sqlite3.connect(str(backup/'office-snapshot.db')) as destination: source.backup(destination)
changed=False
dependencies_swapped=False
try:
    # Recheck preflight after preparing the complete new runtime.
    for name,value in config['baseline'].items(): assert digest(base/name)==value,'Concurrent live change: '+name
    run(['systemctl','stop','lawyer-office'])
    changed=True
    os.rename(base/'server/node_modules',backup/'server/node_modules')
    dependencies_swapped=True
    os.rename(runtime/'node_modules',base/'server/node_modules')
    publish(stage,backend)
    run(['systemctl','start','lawyer-office'])
    wait_health()
    frontend=[name for name in hashes if name.startswith('client/dist/')]
    publish(stage,frontend)
    for name,value in hashes.items(): assert digest(base/name)==value,'Published hash mismatch: '+name
    def verify_public(name):
        url='https://muhami.ly/'+name.removeprefix('client/dist/')+'?review='+config['stamp']
        status,body=get(url)
        assert status==200 and hashlib.sha256(body).hexdigest()==hashes[name],'Public asset mismatch: '+name
    with concurrent.futures.ThreadPoolExecutor(max_workers=5) as pool: list(pool.map(verify_public,frontend))
    assert run(['systemctl','is-active','lawyer-office'])=='active'
    status,body=get('https://muhami.ly/api/health')
    assert status==200 and json.loads(body).get('status')=='ok'
    probes={}
    for path in ['/api/cases','/api/users','/api/documents','/api/templates','/api/invoices','/api/platform/tenants']:
        status,_=get('https://muhami.ly'+path)
        assert status==401,'Authorization probe failed: '+path
        probes[path]=status
    status,_=get('https://muhami.ly/api/portal/overview')
    assert status==401
    probes['/api/portal/overview']=status
    print(json.dumps({'status':'deployed','host':'102.203.202.104','backup':str(backup),'database_backup':str(backup/'office-snapshot.db'),
      'backend_files':backend,'frontend_files':len(frontend),'files_verified':len(hashes),'service':'active','health':'ok',
      'authorization_probes':probes,'runtime_versions':json.loads(versions),'verified_at_utc':config['stamp']}))
except Exception:
    if changed:
        run(['systemctl','stop','lawyer-office'])
        if dependencies_swapped:
            live=base/'server/node_modules'
            if live.exists(): os.rename(live,stage/'failed-node_modules')
            os.rename(backup/'server/node_modules',live)
        publish(backup,backend)
        previous=['client/dist/'+path.relative_to(backup/'client/dist').as_posix() for path in (backup/'client/dist').rglob('*') if path.is_file()]
        publish(backup,previous)
        run(['systemctl','start','lawyer-office'])
        wait_health()
        print('Previous code, frontend and dependency runtime restored.',file=sys.stderr)
    raise
'''

if __name__ == '__main__':
    main()
