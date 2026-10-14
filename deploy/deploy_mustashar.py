"""Isolated AI release: pinned SSH, hash baseline, private service, rollback."""
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import shlex
import subprocess
import tarfile
from datetime import datetime, timezone

ROOT = Path(__file__).resolve().parent.parent
spec = importlib.util.spec_from_file_location('guarded', ROOT / 'deploy/deploy_review_release.py')
guarded = importlib.util.module_from_spec(spec)
spec.loader.exec_module(guarded)
BACKEND = ['server/routes/aiRoutes.js', 'server/services/llmService.js', 'server/services/mustasharService.js']

REMOTE = r'''
import hashlib,json,os,pathlib,shutil,sqlite3,subprocess,sys,tarfile,time,urllib.request,urllib.error
c=json.loads(sys.stdin.read());base=pathlib.Path('/opt/lawyer_office');stage=pathlib.Path(c['stage']);backup=base/'deployment-backups'/('mustashar-'+c['stamp'])
service=pathlib.Path('/etc/systemd/system/muhami-legal-retrieval.service')
env=base/'server/.env';unit_name='muhami-legal-retrieval';changed=False
def run(args,cwd=None):
 p=subprocess.run(args,cwd=cwd,capture_output=True,text=True,timeout=120)
 if p.returncode: raise RuntimeError('Command failed: '+str(args[:3])+' '+p.stderr[-800:])
 return p.stdout.strip()
def digest(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def get(url,token=None):
 headers={'Cache-Control':'no-cache'}
 if token:headers['Authorization']='Bearer '+token
 try:
  with urllib.request.urlopen(urllib.request.Request(url,headers=headers),timeout=12) as r:return r.status,r.read()
 except urllib.error.HTTPError as e:return e.code,e.read()
def wait(url,token=None):
 for _ in range(20):
  try:
   status,body=get(url,token)
   if status==200 and json.loads(body).get('status')=='ok':return json.loads(body)
  except Exception:pass
  time.sleep(1)
 raise RuntimeError('Service did not become healthy')
def publish(source,names):
 for name in sorted(names,key=lambda n:n=='client/dist/index.html'):
  dst=base/name;dst.parent.mkdir(parents=True,exist_ok=True)
  temporary=dst.with_name(dst.name+'.mustashar-new');shutil.copy2(source/name,temporary);os.chmod(temporary,0o644);os.replace(temporary,dst)
for name,expected in c['baseline'].items():
 p=base/name
 assert (digest(p) if p.exists() else None)==expected,'Live baseline changed: '+name
assert not (base/'services/legal-retrieval').exists(),'Retrieval destination already exists'
assert not service.exists(),'Retrieval service already exists'
wait('http://127.0.0.1:3000/api/health')
with tarfile.open(stage/'release.tar.gz','r:gz') as archive:
 for member in archive.getmembers():
  assert member.isfile() and member.name in c['hashes'],'Unexpected archive entry'
  dst=stage/member.name;assert dst.resolve().is_relative_to(stage.resolve())
  dst.parent.mkdir(parents=True,exist_ok=True)
  with archive.extractfile(member) as src,dst.open('wb') as out:shutil.copyfileobj(src,out)
for name,h in c['hashes'].items():assert digest(stage/name)==h,'Staged hash mismatch'
for name in c['backend']:run(['node','--check',str(stage/name)])
run(['python3','-m','unittest','discover','-s',str(stage/'services/legal-retrieval/tests')])
backup.mkdir(parents=True,mode=0o700);os.chmod(backup,0o700)
shutil.copytree(base/'client/dist',backup/'client/dist')
for name in c['backend']:
 dst=backup/name;dst.parent.mkdir(parents=True,exist_ok=True)
 if (base/name).exists():shutil.copy2(base/name,dst)
shutil.copy2(env,backup/'server.env');os.chmod(backup/'server.env',0o600)
dbpath=base/'server/database/lawyer_office.db'
for line in env.read_text().splitlines():
 if line.startswith('DB_PATH=') and line.split('=',1)[1].strip():
  value=line.split('=',1)[1].strip().strip('"\'');dbpath=pathlib.Path(value) if value.startswith('/') else base/'server'/value
with sqlite3.connect('file:'+str(dbpath)+'?mode=ro',uri=True) as db,sqlite3.connect(backup/'office-snapshot.db') as copy:db.backup(copy)
try:
 changed=True
 publish(stage,[name for name in c['hashes'] if not name.startswith('client/dist/')])
 private=base/'services/legal-retrieval/service.env'
 private.write_text('LEGAL_RETRIEVAL_TOKEN='+c['retrieval_token']+'\nLEGAL_RETRIEVAL_DATA_DIR=/opt/lawyer_office/services/legal-retrieval/data\n')
 os.chmod(private,0o600)
 service.write_text('[Unit]\nDescription=Muhami private Libyan law retrieval\nAfter=network.target\n\n[Service]\nType=simple\nUser=lawyer\nGroup=lawyer\nWorkingDirectory=/opt/lawyer_office/services/legal-retrieval\nEnvironmentFile=/opt/lawyer_office/services/legal-retrieval/service.env\nEnvironment=PYTHONDONTWRITEBYTECODE=1\nExecStart=/usr/bin/python3 /opt/lawyer_office/services/legal-retrieval/server.py\nRestart=on-failure\nRestartSec=3\nNoNewPrivileges=true\nPrivateTmp=true\nProtectSystem=strict\nProtectHome=true\nMemoryMax=192M\nTasksMax=32\n\n[Install]\nWantedBy=multi-user.target\n')
 run(['systemctl','daemon-reload']);run(['systemctl','enable','--now',unit_name])
 health=wait('http://127.0.0.1:8100/health',c['retrieval_token']);assert health['corpus']['law_count']==45
 assert get('http://127.0.0.1:8100/health')[0]==401
 updates={'AI_PROVIDER':'mustashar','LEGAL_RETRIEVAL_URL':'http://127.0.0.1:8100','LEGAL_RETRIEVAL_TOKEN':c['retrieval_token'],'GEMINI_API_KEY':c['gemini_key'],'GEMINI_MODEL':'gemini-3.5-flash-lite'}
 lines=[line for line in env.read_text().splitlines() if line.split('=',1)[0].strip() not in updates]
 info=env.stat();temporary=env.with_name('.env.mustashar-new')
 temporary.write_text('\n'.join(lines+[k+'='+v for k,v in updates.items()])+'\n');os.chmod(temporary,0o600);os.chown(temporary,info.st_uid,info.st_gid);os.replace(temporary,env)
 run(['systemctl','restart','lawyer-office']);wait('http://127.0.0.1:3000/api/health')
 publish(stage,[name for name in c['hashes'] if name.startswith('client/dist/')])
 for name,h in c['hashes'].items():assert digest(base/name)==h,'Published hash mismatch: '+name
 assert get('https://muhami.ly/api/ai/status')[0]==401
 assert get('https://muhami.ly/api/health')[0]==200
 status,index=get('https://muhami.ly/?release='+c['stamp']);assert status==200 and hashlib.sha256(index).hexdigest()==c['hashes']['client/dist/index.html']
 print(json.dumps({'deployed':True,'backup':str(backup),'laws':health['corpus']['law_count'],'files':len(c['hashes']),'private_auth':401,'public_auth':401,'model':'gemini-3.5-flash-lite'}))
except Exception:
 if changed:
  subprocess.run(['systemctl','disable','--now',unit_name],capture_output=True)
  if service.exists():service.unlink()
  subprocess.run(['systemctl','daemon-reload'],capture_output=True)
  for name in c['backend']:
   if (backup/name).exists():publish(backup,[name])
   elif (base/name).exists():(base/name).unlink()
  shutil.copy2(backup/'server.env',env)
  publish(backup,['client/dist/'+p.relative_to(backup/'client/dist').as_posix() for p in (backup/'client/dist').rglob('*') if p.is_file()])
  subprocess.run(['systemctl','restart','lawyer-office'],capture_output=True)
  wait('http://127.0.0.1:3000/api/health')
 raise
'''


def main():
    stamp = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')
    baseline = json.loads((ROOT / 'artifacts/mustashar-live-baseline.json').read_text())
    # The build without our AI UI change must reproduce production exactly.
    for file in (ROOT / 'artifacts/mustashar-client-baseline/dist').rglob('*'):
        if file.is_file():
            name = file.relative_to(ROOT / 'artifacts/mustashar-client-baseline/dist').as_posix()
            assert hashlib.sha256(file.read_bytes()).hexdigest() == baseline['assets'].get(name), 'Frontend base differs from live'
    files = BACKEND + ['services/legal-retrieval/retrieval.py', 'services/legal-retrieval/server.py', 'services/legal-retrieval/tests/test_retrieval.py']
    for folder in ['services/legal-retrieval/data', 'client/dist']:
        files += [p.relative_to(ROOT).as_posix() for p in (ROOT / folder).rglob('*') if p.is_file()]
    hashes = {name: hashlib.sha256((ROOT / name).read_bytes()).hexdigest() for name in files}
    archive = ROOT / 'artifacts/mustashar-release.tar.gz'
    with tarfile.open(archive, 'w:gz') as tar:
        for name in files:
            tar.add(ROOT / name, arcname=name, recursive=False)
    # Secrets remain in memory and approved protected environment files only.
    secret_reader = "import dotenv from 'dotenv';dotenv.config({path:'.env'});console.log(JSON.stringify({key:process.env.GEMINI_API_KEY,token:process.env.LEGAL_RETRIEVAL_TOKEN}));"
    secrets = json.loads(subprocess.check_output(['node', '--input-type=module', '-e', secret_reader], cwd=ROOT / 'server', text=True))
    assert secrets.get('key') and len(secrets.get('token', '')) >= 32, 'Required configuration missing'
    assert all('\n' not in value and '\r' not in value for value in secrets.values())
    ssh = guarded.paramiko.SSHClient()
    ssh.load_host_keys(str(ROOT / 'deploy/.ssh-runtime/known_hosts'))
    ssh.set_missing_host_key_policy(guarded.paramiko.RejectPolicy())
    try:
        ssh.connect('102.203.202.104', port=22, username='root', password=guarded.credential(), timeout=25, look_for_keys=False, allow_agent=False)
        stage = '/opt/lawyer_office/deployment-staging/mustashar-' + stamp
        guarded.command(ssh, 'mkdir -p ' + shlex.quote(stage) + ' && chmod 700 ' + shlex.quote(stage))
        with ssh.open_sftp() as sftp:
            sftp.put(str(archive), stage + '/release.tar.gz')
            with sftp.file(stage + '/install.py', 'w') as script:
                script.write(REMOTE)
        payload = dict(stage=stage, stamp=stamp, hashes=hashes, baseline=baseline['fingerprints'], backend=BACKEND, gemini_key=secrets['key'], retrieval_token=secrets['token'])
        result = guarded.command(ssh, 'python3 ' + shlex.quote(stage + '/install.py'), json.dumps(payload), timeout=240)
        (ROOT / 'artifacts/MUSTASHAR-DEPLOYMENT-RESULT.json').write_text(result, encoding='utf-8')
        print(result)
    finally:
        ssh.close()


if __name__ == '__main__':
    main()
