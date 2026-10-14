"""Read-only production facts and authenticated law smoke; no tokens saved."""
import json
from deploy_remaining_fixes import connect, guard, OUT

AUTH = r'''
import fs from 'node:fs';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import {DatabaseSync} from 'node:sqlite';
import {DB_PATH,JWT_SECRET} from './config.js';
import {officeAccessError} from './domain/subscriptions/accessPolicy.js';
const db=new DatabaseSync(DB_PATH,{readOnly:true});
const users=db.prepare("SELECT u.id,u.role,u.tenant_id FROM users u JOIN tenants t ON t.id=u.tenant_id WHERE u.is_active=1 AND u.role IN ('admin','lawyer') AND t.is_active=1 AND COALESCE(t.status,'')!='suspended' ORDER BY u.role='admin' DESC").all();
const user=users.find(u=>!officeAccessError(db.prepare('SELECT * FROM tenants WHERE id=?').get(u.tenant_id),u.role));
assert(user,'No eligible office account');
const token=jwt.sign(user,JWT_SECRET,{expiresIn:'2m'});
const candidate=db.prepare("SELECT id FROM cases WHERE tenant_id=? AND (?='admin' OR lead_lawyer_id=? OR id IN (SELECT case_id FROM case_lawyers WHERE user_id=?)) LIMIT 1").get(user.tenant_id,user.role,user.id,user.id);
const tenantCount=db.prepare('SELECT count(*) AS n FROM tenants').get().n;
const call=async url=>fetch('https://muhami.ly'+url,{headers:{Authorization:'Bearer '+token},signal:AbortSignal.timeout(60000)});
const backups=await call('/api/backups');
if(tenantCount>1)assert.equal(backups.status,403);
const status=await call('/api/ai/status');assert.equal(status.status,200);assert.equal((await status.json()).data.ready,true);
let pdfStatus=null,pdfBytes=null;
if(candidate){const pdf=await call('/api/exports/cases/'+candidate.id+'?format=pdf');const bytes=Buffer.from(await pdf.arrayBuffer());assert.equal(pdf.status,200);assert.equal(bytes.subarray(0,5).toString(),'%PDF-');pdfStatus=200;pdfBytes=bytes.length;}
const versions=Object.fromEntries(['archiver','yauzl'].map(name=>[name,JSON.parse(fs.readFileSync('node_modules/'+name+'/package.json','utf8')).version]));
db.close();console.log(JSON.stringify({authenticated_ai_ready:true,backups_api_status:backups.status,multi_office_guard:tenantCount>1?backups.status===403:null,pdf_status:pdfStatus,pdf_bytes:pdfBytes,dependency_versions:versions}));
'''

FACTS = r'''
import pathlib,json,subprocess,urllib.request
base=pathlib.Path('/opt/lawyer_office')
names=['server/domain/subscriptions/accessPolicy.js','server/database/db.js','server/services/backupService.js']
with urllib.request.urlopen('http://127.0.0.1:3000/api/health',timeout=10) as response: health=json.load(response)
print(json.dumps({'imports':{n:(base/n).is_file() for n in names},'service':subprocess.check_output(['systemctl','is-active','lawyer-office'],text=True).strip(),'local_health':health.get('status')}))
'''

def main():
    ssh=connect()
    try:
        print(guard.command(ssh, 'python3 -', FACTS))
        result=guard.command(ssh,'cd /opt/lawyer_office/server && node --input-type=module',AUTH,timeout=90)
        (OUT/'FINAL-LIVE-SMOKE.json').write_text(result,encoding='utf-8')
        print(result)
        cleanup=r'''
import pathlib,shutil,json
root=pathlib.Path('/opt/lawyer_office/deployment-staging').resolve();removed=[]
for name in ['backup-validation-20261014-184542','backup-validation-20261014-184801']:
 p=root/name
 assert p.resolve().parent==root and p.name==name and not p.is_symlink()
 if p.exists():shutil.rmtree(p);removed.append(name)
print(json.dumps({'private_validation_copies_removed':len(removed),'live_data_untouched':True}))
'''
        print(guard.command(ssh,'python3 -',cleanup))
    finally: ssh.close()

if __name__ == '__main__': main()
