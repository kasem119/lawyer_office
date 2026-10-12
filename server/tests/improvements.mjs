import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';

// Set before importing application modules: never open the office database.
const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'lawyer-improvements-'));
process.env.NODE_ENV = 'test';
process.env.DB_PATH = ':memory:';
process.env.UPLOADS_DIR = path.join(temporaryRoot, 'uploads');
process.env.BACKUPS_DIR = path.join(temporaryRoot, 'backups');
const projectRoot = fileURLToPath(new URL('../../', import.meta.url));
let passed = 0;
async function check(name, run) {
  await run();
  passed++;
  console.log(`PASS ${name}`);
}

try {
  const { default: db } = await import('../database/db.js');
  const { JWT_SECRET } = await import('../config.js');
  const { default: cases } = await import('../routes/caseRoutes.js');
  const { default: documents } = await import('../routes/documentRoutes.js');
  const { errorHandler } = await import('../middleware/errorHandler.js');
  const { getPortalUrl } = await import('../../client/src/utils/portalUrl.js');
  const app = express();
  app.use(express.json());
  app.use('/api/cases', cases);
  app.use('/api/documents', documents);
  app.use(errorHandler);
  db.prepare("INSERT INTO users(id,name,email,password_hash,role,tenant_id) VALUES(1,'Admin','admin@test.invalid','unused','admin',1)").run();
  db.prepare("INSERT INTO users(id,name,email,password_hash,role,tenant_id) VALUES(2,'Other','other@test.invalid','unused','lawyer',2)").run();
  db.prepare("INSERT INTO clients(id,name,created_by,tenant_id) VALUES(1,'Client',1,1)").run();
  db.prepare("INSERT INTO cases(id,case_number,title,client_id,lead_lawyer_id,tenant_id) VALUES(1,'TEST-1','Case',1,1,1)").run();
  const token = jwt.sign({ id: 1, role: 'admin' }, JWT_SECRET);
  const update = (method, body, auth = token) => request(app)[method](method === 'patch' ? '/api/cases/1/status' : '/api/cases/1')
    .set('Authorization', `Bearer ${auth}`).send(body);
  const row = () => db.prepare('SELECT status, closed_at FROM cases WHERE id = 1').get();

  await check('PATCH and PUT reject unfinished tasks without saving judgment', async () => {
    db.prepare("INSERT INTO tasks(id,title,case_id,assigned_to,created_by) VALUES(1,'Pending',1,1,1)").run();
    for (const method of ['patch', 'put']) {
      assert.equal((await update(method, { status: 'closed', closure_note: 'Judgment' })).status, 400);
      assert.equal(row().status, 'active');
    }
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM case_notes').get().n, 0);
    db.prepare("UPDATE tasks SET status='done'").run();
  });
  await check('PATCH and PUT reject today and future events', async () => {
    for (const date of [new Date().toISOString().slice(0, 10), '2099-01-01']) {
      db.prepare("INSERT INTO events(id,title,event_type,date,case_id,user_id) VALUES(1,'Hearing','court_date',?,1,1)").run(date);
      for (const method of ['patch', 'put']) assert.equal((await update(method, { status: 'archived' })).status, 400);
      db.prepare('DELETE FROM events').run();
    }
  });
  await check('PATCH and PUT reject invalid, missing or null status', async () => {
    for (const method of ['patch', 'put']) {
      for (const status of ['invalid', null]) assert.equal((await update(method, { status })).status, 400);
    }
    assert.equal((await update('patch', {})).status, 400);
    assert.equal((await update('put', { title: 'Updated' })).status, 200);
    assert.equal(row().status, 'active');
  });
  await check('Upload judgment using file field and correct endpoint', async () => {
    const res = await request(app).post('/api/documents/upload').set('Authorization', `Bearer ${token}`)
      .field('case_id', '1').attach('file', Buffer.from('%PDF-1.4\nJudgment'), { filename: 'judgment.pdf', contentType: 'application/pdf' });
    assert.equal(res.status, 201);
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM documents WHERE case_id=1').get().n, 1);
  });
  await check('Close saves public judgment note and date; reopen clears date', async () => {
    assert.equal((await update('patch', { status: 'closed', closure_note: '  Final judgment  ' })).status, 200);
    assert.equal(row().status, 'closed');
    assert.equal(row().closed_at, new Date().toISOString().slice(0, 10));
    const note = db.prepare('SELECT * FROM case_notes WHERE case_id = 1').get();
    assert.equal(note.content, 'Final judgment');
    assert.equal(note.note_type, 'court_result');
    assert.equal(note.is_private, 0);
    assert.equal((await update('patch', { status: 'active' })).status, 200);
    assert.equal(row().closed_at, null);
  });
  await check('PUT closes and reopens; ordinary edits preserve closure date', async () => {
    assert.equal((await update('put', { status: 'archived' })).status, 200);
    const closedAt = row().closed_at;
    assert.ok(closedAt);
    assert.equal((await update('put', { title: 'Edited' })).status, 200);
    assert.equal(row().closed_at, closedAt);
    assert.equal((await update('put', { status: 'pending' })).status, 200);
    assert.equal(row().closed_at, null);
  });
  await check('A failed judgment insertion rolls back case status and audit', async () => {
    db.exec("CREATE TRIGGER fail_judgment BEFORE INSERT ON case_notes BEGIN SELECT RAISE(ABORT, 'test failure'); END;");
    const count = db.prepare('SELECT COUNT(*) AS n FROM activity_log').get().n;
    const res = await update('patch', { status: 'closed', closure_note: 'Fail' });
    assert.equal(res.status, 500);
    assert.equal(row().status, 'pending');
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM activity_log').get().n, count);
    db.exec('DROP TRIGGER fail_judgment');
  });
  await check('Cross-office user cannot update either status endpoint', async () => {
    const outsider = jwt.sign({ id: 2, role: 'lawyer' }, JWT_SECRET);
    for (const method of ['patch', 'put']) assert.equal((await update(method, { status: 'closed' }, outsider)).status, 404);
  });
  await check('Portal links use server/public URL and reject unusable origins', async () => {
    assert.equal(getPortalUrl('https://office.example/api/'), 'https://office.example/#portal');
    assert.equal(getPortalUrl('http://192.168.1.5:3000'), 'http://192.168.1.5:3000/#portal');
    assert.equal(getPortalUrl('http://localhost:3000', 'https://portal.example'), 'https://portal.example/#portal');
    for (const url of ['file:///C:/app/index.html', 'http://localhost:3000', 'http://127.0.0.1:3000', 'null']) {
      assert.throws(() => getPortalUrl(url));
    }
  });
  await check('Frontend failure keeps closure form and retry avoids duplicate upload', async () => {
    const source = fs.readFileSync(path.join(projectRoot, 'client/src/components/Cases/CaseDetails.jsx'), 'utf8');
    const start = source.indexOf('  const executeStatusChange =');
    const end = source.indexOf('  const handleToggleDone', start);
    const calls = [];
    const sandbox = {
      caseId: 1, closeFile: new Blob(['judgment'], { type: 'application/pdf' }), closeNote: 'Judgment', targetCloseStatus: 'closed',
      FormData, alert() {}, fetchDetails() {}, setCloseLoading() {},
      modalOpen: true,
      setCloseFile(value) { sandbox.closeFile = value; },
      setCloseUploadedFileName() {},
      setIsCloseCaseModalOpen(value) { sandbox.modalOpen = value; },
      async apiFetch(endpoint, options) {
        calls.push({ endpoint, options });
        if (endpoint === '/documents/upload') return { ok: true };
        return { ok: sandbox.success || false, json: async () => ({ message: 'Pending tasks' }) };
      }
    };
    const context = vm.createContext(sandbox);
    vm.runInContext(source.slice(start, end), context);
    await vm.runInContext('submitCloseCase({preventDefault(){}})', context);
    assert.equal(sandbox.modalOpen, true);
    assert.equal(sandbox.closeFile, null);
    assert.ok(calls[0].options.body.get('file'));
    assert.equal(calls[0].options.body.get('case_id'), '1');
    assert.equal(JSON.parse(calls[1].options.body).closure_note, 'Judgment');
    sandbox.success = true;
    await vm.runInContext('submitCloseCase({preventDefault(){}})', context);
    assert.equal(sandbox.modalOpen, false);
    assert.equal(calls.filter(call => call.endpoint === '/documents/upload').length, 1);
  });
  console.log(`${passed} checks passed. Only an in-memory database and temporary uploads were used.`);
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  // The resolved deletion target must be the directory created by this run under OS temp.
  const resolved = path.resolve(temporaryRoot);
  if (path.dirname(resolved) === path.resolve(os.tmpdir()) && path.basename(resolved).startsWith('lawyer-improvements-')) {
    fs.rmSync(resolved, { recursive: true, force: true });
  }
}
