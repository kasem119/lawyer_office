import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { once } from 'node:events';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { WebSocket } from 'ws';

const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'office-security-review-'));
Object.assign(process.env, {
  NODE_ENV: 'test', DB_PATH: ':memory:',
  UPLOADS_DIR: path.join(temporaryRoot, 'uploads'), BACKUPS_DIR: path.join(temporaryRoot, 'backups'),
  JWT_SECRET: 'security-review-test-access-secret', JWT_REFRESH_SECRET: 'security-review-test-refresh-secret',
  ENCRYPTION_KEY: 'security-review-test-encryption-key'
});
const { default: app } = await import('../index.js');
const { default: db } = await import('../database/db.js');
const { JWT_SECRET, DB_PATH } = await import('../config.js');
const { generateTokens } = await import('../middleware/auth.js');
const { initWebSocketServer, sendToUser, broadcastEvent } = await import('../services/websocketService.js');
assert.equal(DB_PATH, ':memory:', 'Never run this suite against an office database');
let passed = 0;
let server, wss;
const sockets = [];
const check = async (name, fn) => { await fn(); passed++; console.log(`PASS ${name}`); };
const token = id => generateTokens(db.prepare('SELECT * FROM users WHERE id=?').get(id)).accessToken;
const call = (id, method, route, body) => request(app)[method](route).set('Authorization', `Bearer ${token(id)}`).send(body);
const settleFiles = async () => {
  for (let i = 0; i < 20 && fs.readdirSync(process.env.UPLOADS_DIR).length; i++) await new Promise(resolve => setTimeout(resolve, 10));
};
try {
  db.prepare("INSERT INTO tenants(id,slug,name,owner_name,email,status,is_active) VALUES(902,'security-other','Other','Owner','security-other@test.invalid','active',1)").run();
  for (const [id, role, tenant] of [[901,'admin',1],[902,'lawyer',1],[903,'lawyer',902]]) {
    db.prepare('INSERT INTO users(id,name,email,password_hash,role,tenant_id,is_active) VALUES(?,?,?,?,?,?,1)').run(id, `Test ${id}`, `${id}@security.invalid`, 'unused', role, tenant);
  }
  db.prepare("INSERT INTO clients(id,name,created_by,tenant_id) VALUES(901,'Security Client',901,1)").run();
  db.prepare("INSERT INTO cases(id,case_number,title,client_id,lead_lawyer_id,tenant_id) VALUES(901,'SECURITY-901','Security Case',901,902,1)").run();
  for (const [id, tenant] of [[901,0],[902,null],[903,902],[904,1]]) {
    db.prepare("INSERT INTO document_templates(id,name,content_html,created_by,tenant_id) VALUES(?,?,'<p>{{name}}</p>',901,?)").run(id, `Security ${id}`, tenant);
  }
  await check('Shared and foreign templates cannot be mutated by office accounts', async () => {
    for (const id of [901,902,903]) {
      assert.equal((await call(901,'put',`/api/templates/${id}`,{ name:'Changed' })).status,403);
      assert.equal((await call(901,'delete',`/api/templates/${id}`)).status,403);
      assert.equal(db.prepare('SELECT name FROM document_templates WHERE id=?').get(id).name,`Security ${id}`);
    }
    for (const id of [901,902]) assert.equal((await call(902,'get',`/api/templates/${id}`)).status,200);
  });
  await check('Office templates can still be created, edited, generated and deleted', async () => {
    const created = await call(902,'post','/api/templates',{ name:'Local copy', content_html:'<p>{{name}}</p>' });
    assert.equal(created.status,201);
    const id = created.body.template.id;
    assert.equal((await call(902,'put',`/api/templates/${id}`,{name:'Edited local'})).status,200);
    const generated = await call(902,'post',`/api/templates/${id}/generate`,{values:{name:'<script>x</script>'}});
    assert.equal(generated.body.generated_html,'<p>&lt;script&gt;x&lt;/script&gt;</p>');
    assert.equal((await call(902,'delete',`/api/templates/${id}`)).status,200);
  });
  await check('AI rejects malformed prompts, modes and summaries without a case before provider work', async () => {
    for(const body of [{prompt:{}},{prompt:42},{prompt:'x',mode:'unknown'},{prompt:' '.repeat(10)},{prompt:'x'.repeat(16001)},{mode:'summarize_case'}]) {
      assert.equal((await call(902,'post','/api/ai/assist',body)).status,400);
    }
  });
  await check('Blocked historical account deletion preserves notifications, time entries, shares and task ownership',async()=>{
    db.prepare("INSERT INTO users(id,name,email,password_hash,role,tenant_id) VALUES(904,'Historical','904@security.invalid','unused','lawyer',1)").run();
    db.prepare("INSERT INTO clients(id,name,created_by,tenant_id) VALUES(904,'Historical Client',904,1)").run();
    db.prepare("INSERT INTO notifications(id,user_id,title,message) VALUES(904,904,'History','Keep')").run();
    db.prepare("INSERT INTO time_entries(id,user_id,case_id,description,duration_minutes,tenant_id) VALUES(904,904,901,'Keep',60,1)").run();
    db.prepare("INSERT INTO documents(id,original_name,stored_name,file_path,file_size,mime_type,case_id,uploaded_by,tenant_id) VALUES(904,'Test','test.txt','unused',1,'text/plain',901,901,1)").run();
    db.prepare("INSERT INTO document_shares(id,document_id,shared_with_user_id,shared_by_user_id,permissions) VALUES(904,904,904,901,'view')").run();
    db.prepare("INSERT INTO tasks(id,title,created_by,assigned_to,status,tenant_id) VALUES(904,'Completed',904,904,'done',1)").run();
    const response=await call(901,'delete','/api/users/904');
    assert.equal(response.status,400);
    assert.ok(db.prepare('SELECT id FROM users WHERE id=904').get());
    assert.ok(db.prepare('SELECT id FROM notifications WHERE id=904').get());
    assert.ok(db.prepare('SELECT id FROM time_entries WHERE id=904').get());
    assert.ok(db.prepare('SELECT id FROM document_shares WHERE id=904').get());
    const task=db.prepare('SELECT created_by,assigned_to FROM tasks WHERE id=904').get();
    assert.equal(task.created_by,904); assert.equal(task.assigned_to,904);
    db.prepare("INSERT INTO users(id,name,email,password_hash,role,tenant_id) VALUES(905,'Unused','905@security.invalid','unused','lawyer',1)").run();
    db.prepare("INSERT INTO tasks(id,title,created_by,assigned_to,status,tenant_id) VALUES(905,'Completed',905,905,'done',1)").run();
    assert.equal((await call(901,'delete','/api/users/905')).status,200);
    assert.equal(db.prepare('SELECT id FROM users WHERE id=905').get(),undefined);
    const transferred=db.prepare('SELECT created_by,assigned_to FROM tasks WHERE id=905').get();
    assert.equal(transferred.created_by,901); assert.equal(transferred.assigned_to,901);
  });
  await check('Office admin cannot list, alter, delete or share documents with the platform owner',async()=>{
    db.prepare("INSERT INTO users(id,name,email,password_hash,role,tenant_id) VALUES(906,'Owner','906@security.invalid','unused','super_admin',1)").run();
    const original=db.prepare('SELECT * FROM users WHERE id=906').get();
    const list=await call(901,'get','/api/users');
    assert.equal(list.status,200);
    assert.ok(!list.body.users.some(user=>user.id===906));
    assert.equal((await call(901,'put','/api/users/906',{name:'Changed',email:'changed@security.invalid',role:'admin',is_active:0,password:'newpassword123'})).status,404);
    assert.equal((await call(901,'delete','/api/users/906')).status,404);
    assert.deepEqual(db.prepare('SELECT * FROM users WHERE id=906').get(),original);
    assert.equal((await call(901,'post','/api/documents/share',{document_id:904,shared_with_user_id:906})).status,400);
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM document_shares WHERE shared_with_user_id=906').get().n,0);
  });
  await check('Missing and forbidden case uploads do not leave files or records', async () => {
    for (const caseId of [null,999999]) {
      let upload = request(app).post('/api/documents/upload').set('Authorization',`Bearer ${token(902)}`);
      if (caseId) upload = upload.field('case_id',String(caseId));
      const response = await upload.attach('file',Buffer.from('Test'),{filename:'test.txt',contentType:'text/plain'});
      assert.equal(response.status,caseId ? 403 : 400);
      await settleFiles();
      assert.deepEqual(fs.readdirSync(process.env.UPLOADS_DIR),[]);
      assert.equal(db.prepare('SELECT COUNT(*) AS n FROM documents WHERE uploaded_by=902').get().n,0);
    }
  });
  await check('Failed version creation rolls back document row and removes upload', async () => {
    db.exec("CREATE TRIGGER reject_security_version BEFORE INSERT ON document_versions WHEN NEW.uploaded_by=902 BEGIN SELECT RAISE(ABORT,'test version failure'); END;");
    const response = await request(app).post('/api/documents/upload').set('Authorization',`Bearer ${token(902)}`)
      .field('case_id','901').attach('file',Buffer.from('Test'),{filename:'test.txt',contentType:'text/plain'});
    assert.equal(response.status,500);
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM documents WHERE uploaded_by=902').get().n,0);
    await settleFiles();
    assert.deepEqual(fs.readdirSync(process.env.UPLOADS_DIR),[]);
    db.exec('DROP TRIGGER reject_security_version');
  });
  await check('Valid uploads work and failed replacement preserves the existing version and file', async () => {
    const response = await request(app).post('/api/documents/upload').set('Authorization',`Bearer ${token(902)}`)
      .field('case_id','901').attach('file',Buffer.from('Original'),{filename:'original.txt',contentType:'text/plain'});
    assert.equal(response.status,201);
    const id=response.body.documentId;
    const original=db.prepare('SELECT * FROM documents WHERE id=?').get(id);
    assert.equal((await call(902,'get',`/api/documents/download/${id}`)).status,200);
    db.exec("CREATE TRIGGER reject_security_version BEFORE INSERT ON document_versions WHEN NEW.uploaded_by=902 BEGIN SELECT RAISE(ABORT,'test version failure'); END;");
    const failed = await request(app).post(`/api/documents/${id}/version`).set('Authorization',`Bearer ${token(902)}`)
      .attach('file',Buffer.from('Replacement'),{filename:'replacement.txt',contentType:'text/plain'});
    assert.equal(failed.status,500);
    assert.deepEqual(db.prepare('SELECT * FROM documents WHERE id=?').get(id),original);
    for(let i=0;i<20 && fs.readdirSync(process.env.UPLOADS_DIR).length>1;i++) await new Promise(resolve=>setTimeout(resolve,10));
    assert.deepEqual(fs.readdirSync(process.env.UPLOADS_DIR),[original.stored_name]);
    assert.equal(fs.readFileSync(original.file_path,'utf8'),'Original');
    db.exec('DROP TRIGGER reject_security_version');
    assert.equal((await call(901,'delete',`/api/documents/${id}`)).status,200);
  });
  server = http.createServer(); wss = initWebSocketServer(server);
  await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
  const connect = async accessToken => {
    const socket = new WebSocket(`ws://127.0.0.1:${server.address().port}/ws?token=${encodeURIComponent(accessToken)}`);
    sockets.push(socket);
    await once(socket,'open');
    return socket;
  };
  const accepted = async id => {
    const socket = await connect(token(id));
    // Server welcome is sent immediately after opening; wait one turn.
    await new Promise(resolve => setImmediate(resolve));
    return socket;
  };
  await check('Suspended offices cannot establish staff WebSocket sessions',async () => {
    db.prepare("UPDATE tenants SET status='suspended' WHERE id=902").run();
    const socket = await connect(token(903));
    assert.equal((await once(socket,'close'))[0],1008);
    db.prepare("UPDATE tenants SET status='active' WHERE id=902").run();
  });
  await check('Existing sockets stop delivery after office suspension, user revocation, role change or expiry',async () => {
    for (const reason of ['office','account','role','expiry']) {
      const socket = reason === 'expiry'
        ? await connect(jwt.sign({id:902,role:'lawyer',tenant_id:1},JWT_SECRET,{expiresIn:'1s'}))
        : await accepted(902);
      await new Promise(resolve=>setImmediate(resolve));
      const delivered = [];
      socket.on('message', data => delivered.push(JSON.parse(data)));
      if (reason === 'office') db.prepare("UPDATE tenants SET status='suspended' WHERE id=1").run();
      if (reason === 'account') db.prepare('UPDATE users SET is_active=0 WHERE id=902').run();
      if (reason === 'role') db.prepare("UPDATE users SET role='admin' WHERE id=902").run();
      if (reason === 'expiry') await new Promise(resolve=>setTimeout(resolve,1100));
      const closed = once(socket,'close');
      sendToUser(902,'SENSITIVE_TEST',{secretMarker:'must not arrive'});
      assert.equal((await closed)[0],1008);
      assert.deepEqual(delivered,[]);
      db.prepare("UPDATE tenants SET status='active',is_active=1 WHERE id=1").run();
      db.prepare("UPDATE users SET is_active=1,role='lawyer' WHERE id=902").run();
    }
  });
  await check('Trial expiration denies new WebSocket sessions and closes existing ones before delivery', async () => {
    db.prepare("UPDATE tenants SET plan='trial',trial_ends_at=? WHERE id=1").run(new Date(Date.now()+86400000).toISOString());
    const current = await accepted(902);
    db.prepare('UPDATE tenants SET trial_ends_at=? WHERE id=1').run(new Date(Date.now()-86400000).toISOString());
    const closed = once(current, 'close');
    sendToUser(902,'TRIAL_SECRET',{ secret:'must not arrive' });
    assert.equal((await closed)[0],1008);
    const deniedSocket = await connect(token(902));
    assert.equal((await once(deniedSocket, 'close'))[0],1008);
    db.prepare("UPDATE tenants SET plan='pro',trial_ends_at=NULL WHERE id=1").run();
  });
  await check('Broadcast requires explicit tenant and reaches only that office',async () => {
    const a=await accepted(902), b=await accepted(903);
    const seenA=[],seenB=[];
    a.on('message',data=>seenA.push(JSON.parse(data)));
    b.on('message',data=>seenB.push(JSON.parse(data)));
    broadcastEvent('UNSCOPED',{test:1});
    const arrival=once(a,'message');
    broadcastEvent('SCOPED',{test:2},1);
    await arrival;
    await new Promise(resolve=>setTimeout(resolve,20));
    assert.deepEqual(seenA.map(item=>item.type),['SCOPED']);
    assert.deepEqual(seenB,[]);
  });
  console.log(`Security review: ${passed} passed; isolated memory database and temporary uploads.`);
} catch(error) { console.error(error); process.exitCode=1; }
finally {
  for (const socket of sockets) socket.terminate();
  if (wss) await new Promise(resolve=>wss.close(resolve));
  if (server) await new Promise(resolve=>server.close(resolve));
  const resolved=path.resolve(temporaryRoot);
  if (path.dirname(resolved)===path.resolve(os.tmpdir()) && path.basename(resolved).startsWith('office-security-review-')) fs.rmSync(resolved,{recursive:true,force:true});
  process.exit(process.exitCode || 0);
}
