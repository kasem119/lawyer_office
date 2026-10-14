"""Private on-server copy/restore verification; never restore production SQLite."""
import json
from pathlib import Path
import shlex
import sys
import tarfile
from datetime import datetime, timezone
from deploy_remaining_fixes import connect, guard, ROOT, OUT, BACKUPS

PREPARE = r'''
import pathlib,json,os,subprocess,shutil,tarfile,sqlite3,sys
c=json.loads(sys.stdin.read()); base=pathlib.Path('/opt/lawyer_office'); stage=pathlib.Path(c['stage'])
assert stage.parent==base/'deployment-staging' and stage.name.startswith('backup-validation-')
os.umask(0o077);stage.mkdir(parents=True,exist_ok=True);os.chmod(stage,0o700)
source=stage/'candidate'; server=source/'server'
for f in (base/'server').rglob('*'):
 rel=f.relative_to(base/'server')
 if any(part in ['node_modules','uploads','backups'] for part in rel.parts):continue
 if f.is_file() and (f.suffix in ['.js','.mjs','.sql'] or rel.as_posix() in ['package.json','package-lock.json']):
  target=server/rel;target.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(f,target)
with tarfile.open(stage/'candidate.tar.gz','r:gz') as archive:
 for m in archive.getmembers():
  assert m.isfile() and m.name in c['files']
  target=source/m.name;assert target.resolve().is_relative_to(source.resolve());target.parent.mkdir(parents=True,exist_ok=True)
  with archive.extractfile(m) as inp, target.open('wb') as out:shutil.copyfileobj(inp,out)
r=subprocess.run(['npm','ci','--ignore-scripts','--no-audit','--no-fund'],cwd=server,capture_output=True,text=True,timeout=600)
if r.returncode:raise RuntimeError('Candidate dependency installation failed: '+r.stderr[-1000:])
r=subprocess.run(['node','tests/backup-restore.mjs'],cwd=server,capture_output=True,text=True,timeout=120)
if r.returncode:raise RuntimeError('Candidate isolated backup checks failed: '+r.stderr[-1000:])
paths={'DB_PATH':str(base/'server/database/lawyer_office.db'),'UPLOADS_DIR':str(base/'server/uploads')}
for line in (base/'server/.env').read_text().splitlines():
 if '=' in line:
  k,v=line.split('=',1);k=k.strip();v=v.strip().strip('"\'')
  if k in paths and v:paths[k]=v if v.startswith('/') else str(base/'server'/v)
state=stage/'state';state.mkdir();uploads=state/'uploads';dbfile=state/'office.db'
stopped=False
try:
 subprocess.run(['systemctl','stop','lawyer-office'],check=True);stopped=True
 with sqlite3.connect('file:'+paths['DB_PATH']+'?mode=ro',uri=True) as old:
  with sqlite3.connect(dbfile) as new:old.backup(new)
 sourceuploads=pathlib.Path(paths['UPLOADS_DIR'])
 if sourceuploads.exists():shutil.copytree(sourceuploads,uploads,symlinks=True)
 else:uploads.mkdir()
finally:
 if stopped:subprocess.run(['systemctl','start','lawyer-office'],check=True)
print(json.dumps({'stage':str(stage),'candidate':str(server),'copy':str(dbfile),'isolated_suite':'10/10 passed'}))
'''

CHECK = r'''
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
const root=process.env.PRIVATE_STAGE;
assert(root && root.startsWith('/opt/lawyer_office/deployment-staging/backup-validation-'));
const state=path.join(root,'state');
Object.assign(process.env,{NODE_ENV:'test',DB_PATH:path.join(state,'office.db'),UPLOADS_DIR:path.join(state,'uploads'),BACKUPS_DIR:path.join(state,'backups'),CLOUD_BACKUP_DIR:'',JWT_SECRET:'private-stage-test',JWT_REFRESH_SECRET:'private-stage-test-refresh',ENCRYPTION_KEY:'private-stage-test-encryption'});
for(const key of ['DB_PATH','UPLOADS_DIR','BACKUPS_DIR']) assert(path.resolve(process.env[key]).startsWith(state+'/'));
const {default:db}=await import('./database/db.js');
const {runBackup,restoreBackup}=await import('./services/backupService.js');
const tables=db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all().map(r=>r.name);
const counts=()=>Object.fromEntries(tables.map(name=>[name,db.prepare('SELECT count(*) AS n FROM "'+name.replaceAll('"','""')+'"').get().n]));
const contentHashes=()=>Object.fromEntries(tables.map(name=>[name,crypto.createHash('sha256').update(JSON.stringify(db.prepare('SELECT * FROM "'+name.replaceAll('"','""')+'" ORDER BY rowid').all())).digest('hex')]));
const scan=dir=>{
 const result={};if(!fs.existsSync(dir))return result;
 const walk=target=>{for(const name of fs.readdirSync(target)){
  const file=path.join(target,name),info=fs.lstatSync(file);assert(!info.isSymbolicLink());
  if(info.isDirectory())walk(file);else if(info.isFile()) result[path.relative(dir,file)]=crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
 }};walk(dir);return result;
};
const before=counts(),hashes=scan(process.env.UPLOADS_DIR);
const originalContentHashes=contentHashes();
assert.equal(db.prepare('PRAGMA integrity_check').get().integrity_check,'ok');
const originalForeignKeys=db.prepare('PRAGMA foreign_key_check').all();
const foreignKeyCounts=Object.fromEntries([...new Set(originalForeignKeys.map(row=>row.table))].map(table=>[table,originalForeignKeys.filter(row=>row.table===table).length]));
const backup=await runBackup();assert.equal(backup.success,true,backup.error);
const extracted=fs.mkdtempSync(path.join(state,'extracted-'));
// This is our freshly generated trusted ZIP, not an uploaded archive.
execFileSync('python3',['-c','import zipfile,sys; zipfile.ZipFile(sys.argv[1]).extractall(sys.argv[2])',backup.destinationPath,extracted]);
assert.deepEqual(scan(path.join(extracted,'uploads')),hashes);
fs.writeFileSync(path.join(process.env.UPLOADS_DIR,'private_restore_marker.txt'),'private copy only');
const copiedUploads=path.join(extracted,'uploads');fs.mkdirSync(copiedUploads,{recursive:true});
assert(path.resolve(copiedUploads).startsWith(state+'/'));
const previousUploads=path.join(state,'before-private-restore-'+crypto.randomUUID());
fs.renameSync(process.env.UPLOADS_DIR,previousUploads);
fs.cpSync(copiedUploads,process.env.UPLOADS_DIR,{recursive:true});
db.exec('CREATE TABLE private_restore_marker(value TEXT); INSERT INTO private_restore_marker VALUES(\'private only\');');
db.restoreFrom(path.join(extracted,'database.db'));
assert.deepEqual(counts(),before);
assert.deepEqual(contentHashes(),originalContentHashes);
assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(),originalForeignKeys);
assert.equal(db.prepare("SELECT count(*) AS n FROM sqlite_master WHERE name='private_restore_marker'").get().n,0);
assert.deepEqual(scan(process.env.UPLOADS_DIR),hashes);
if(before.tenants>1 || originalForeignKeys.length){const denied=await restoreBackup(backup.destinationPath);assert.equal(denied.success,false);assert.match(denied.error,/Multi-office|foreign key/);}
const result={copied_production_integrity:'ok',tables_checked:tables.length,tenant_count:before.tenants,attachment_files:Object.keys(hashes).length,all_attachment_hashes_match:true,all_table_content_hashes_match:true,private_database_restored:true,private_uploads_restored:true,multi_office_guard_preserved:true,preexisting_foreign_key_violations:foreignKeyCounts,foreign_key_state_preserved:true};
db.close();console.log(JSON.stringify(result));
'''

def main():
    stamp=datetime.now(timezone.utc).strftime('%Y%m%d-%H%M%S')
    stage='/opt/lawyer_office/deployment-staging/backup-validation-'+stamp
    resume='--resume' in sys.argv
    if resume:
        stage=sys.argv[sys.argv.index('--resume')+1]
        assert stage.startswith('/opt/lawyer_office/deployment-staging/backup-validation-')
    output=OUT/'backups';output.mkdir(parents=True,exist_ok=True)
    files=BACKUPS+['server/tests/backup-restore.mjs']
    archive=output/('validation-'+stamp+'.tar.gz')
    with tarfile.open(archive,'w:gz') as bundle:
        for name in files:bundle.add(ROOT/name,arcname=name)
    ssh=connect()
    try:
        if resume:
            prepared={'candidate':stage+'/candidate/server'}
        else:
            guard.command(ssh,'mkdir -p '+shlex.quote(stage)+' && chmod 700 '+shlex.quote(stage))
            with ssh.open_sftp() as sftp:sftp.put(str(archive),stage+'/candidate.tar.gz')
            prepared=json.loads(guard.command(ssh,'python3 -u -c '+shlex.quote(PREPARE),json.dumps(dict(stage=stage,files=files)),timeout=900).splitlines()[-1])
        result=json.loads(guard.command(ssh,'cd '+shlex.quote(prepared['candidate'])+' && PRIVATE_STAGE='+shlex.quote(stage)+' node --input-type=module',CHECK,timeout=150).splitlines()[-1])
        result['stage']=stage;result['candidate_suite']='10/10 passed'
        (output/'PRIVATE-RESTORE-RESULT.json').write_text(json.dumps(result,indent=2),encoding='utf-8')
        # Poll local startup after the brief snapshot window.
        guard.command(ssh,"python3 -c \"import urllib.request,json,time;\nfor i in range(30):\n try:\n  assert json.load(urllib.request.urlopen('http://127.0.0.1:3000/api/health',timeout=3))['status']=='ok';break\n except Exception:time.sleep(1)\nelse:raise RuntimeError('health timeout')\"",timeout=50)
        print(json.dumps(result))
    finally:ssh.close()

if __name__=='__main__':main()
