"""Read-only authenticated production smoke; tokens never leave remote memory."""
import json
from deploy_mustashar import guarded, ROOT

CHECK = r'''
import 'dotenv/config';
import jwt from 'jsonwebtoken';
import {DatabaseSync} from 'node:sqlite';
import {DB_PATH, JWT_SECRET} from './config.js';
const db=new DatabaseSync(DB_PATH,{readOnly:true});
const user=db.prepare("SELECT u.id,u.role FROM users u JOIN tenants t ON t.id=u.tenant_id WHERE u.is_active=1 AND u.role IN ('admin','lawyer') AND t.is_active=1 AND COALESCE(t.status,'')!='suspended' LIMIT 1").get();
if(!user) throw Error('No active office account for smoke');
const token=jwt.sign(user,JWT_SECRET,{expiresIn:'2m'});
async function call(path,body,auth=token){return fetch('https://muhami.ly/api/ai/'+path,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+auth,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(65000)});}
const status=await call('status');const readiness=await status.json();
if(status.status!==200||!readiness.data?.ready)throw Error('Assistant not ready');
const lawsResponse=await call('laws');const laws=await lawsResponse.json();
if(laws.data?.laws?.length!==45)throw Error('Law catalog mismatch');
const first=laws.data.laws[0];
const pdf=await call('laws/'+(first.id||first.law_id)+'/pdf');
const bytes=Buffer.from(await pdf.arrayBuffer());
if(pdf.status!==200||bytes.subarray(0,5).toString()!=='%PDF-')throw Error('PDF check failed');
const portal=await call('status',null,jwt.sign({id:user.id,role:'client'},JWT_SECRET,{expiresIn:'1m'}));
if(portal.status!==403)throw Error('Portal isolation failed');
const response=await call('assist',{mode:'legal_advice',prompt:'ما التزامات المستأجر في عقد الإيجار وفق القانون المدني الليبي؟ اذكر النصوص المتاحة فقط.'});
const answer=await response.json();
const result={ready:true,laws:45,pdf_status:pdf.status,pdf_bytes:bytes.length,portal_status:portal.status,ai_status:response.status,source:answer.data?.source,model:answer.data?.model,no_evidence:answer.data?.no_evidence,sources:answer.data?.sources?.length,answer_characters:answer.data?.content?.length};
console.log(JSON.stringify(result));
if(response.status!==200||answer.data?.source!=='mustashar'||answer.data?.model!=='gemini-3.5-flash-lite'||answer.data?.no_evidence!==false)process.exitCode=1;
db.close();
'''

ssh=guarded.paramiko.SSHClient()
ssh.load_host_keys(str(ROOT/'deploy/.ssh-runtime/known_hosts'))
ssh.set_missing_host_key_policy(guarded.paramiko.RejectPolicy())
try:
    ssh.connect('102.203.202.104',username='root',password=guarded.credential(),timeout=25,look_for_keys=False,allow_agent=False)
    result=guarded.command(ssh,'cd /opt/lawyer_office/server && node --input-type=module',CHECK,timeout=100)
    (ROOT/'artifacts/MUSTASHAR-PRODUCTION-SMOKE.json').write_text(result,encoding='utf-8')
    print(result)
finally:
    ssh.close()
