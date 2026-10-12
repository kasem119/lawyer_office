import assert from 'node:assert/strict';
import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'lawyer-review-'));
Object.assign(process.env, {
  NODE_ENV: 'test', DB_PATH: ':memory:', SEED_DEMO_DATA: 'false',
  JWT_SECRET: 'review-regression-access', JWT_REFRESH_SECRET: 'review-regression-refresh',
  ENCRYPTION_KEY: 'review-regression-encryption',
  UPLOADS_DIR: path.join(temporaryRoot, 'uploads'), BACKUPS_DIR: path.join(temporaryRoot, 'backups')
});
let passed = 0;
try {
  const { default: db } = await import('../database/db.js');
  const { default: invoices } = await import('../routes/invoiceRoutes.js');
  const { default: portal } = await import('../routes/portalRoutes.js');
  const { default: notes } = await import('../routes/caseNoteRoutes.js');
  const { generateTokens } = await import('../middleware/auth.js');
  const { errorHandler } = await import('../middleware/errorHandler.js');
  const app = express();
  app.use(express.json());
  app.use('/api/invoices', invoices);
  app.use('/api/portal', portal);
  app.use('/api/case-notes', notes);
  app.use(errorHandler);
  for (const tenant of [901, 902]) {
    db.prepare("INSERT INTO tenants(id,slug,name,owner_name,email,status,is_active) VALUES(?,?,?,?,?,'active',1)").run(tenant, `review-${tenant}`, 'Synthetic Office', 'Test Owner', `review-${tenant}@test.invalid`);
    db.prepare("INSERT INTO users(id,name,email,password_hash,role,tenant_id,is_active) VALUES(?,?,?,'unused','admin',?,1)").run(tenant, 'Test User', `user-${tenant}@test.invalid`, tenant);
    db.prepare('INSERT INTO clients(id,name,phone,tenant_id,created_by) VALUES(?,?,?,?,?)').run(tenant, 'Test Client', `0910000${tenant}`, tenant, tenant);
    db.prepare("INSERT INTO cases(id,case_number,title,case_type,client_id,lead_lawyer_id,tenant_id) VALUES(?,?,?,'civil',?,?,?)").run(tenant, `review-case-${tenant}`, 'Test Case', tenant, tenant, tenant);
  }
  const token = id => generateTokens(db.prepare('SELECT * FROM users WHERE id=?').get(id)).accessToken;
  const staff = (id, method, url, body) => request(app)[method](url).set('Authorization', `Bearer ${token(id)}`).send(body);
  const body = id => ({ case_id: id, client_id: id, items: [{ description: 'Test work', quantity: 2, unit_price: 15 }] });
  const check = async (name, fn) => { await fn(); passed++; console.log(`PASS ${name}`); };
  let firstId;
  await check('Invoice numbers remain unique across offices and after deleting a middle invoice', async () => {
    const first = await staff(901, 'post', '/api/invoices', body(901));
    assert.equal(first.status, 200); firstId = first.body.data.id;
    const second = await staff(902, 'post', '/api/invoices', body(902));
    assert.equal(second.status, 200);
    assert.equal((await staff(901, 'post', '/api/invoices', body(901))).status, 200);
    assert.equal((await staff(902, 'delete', `/api/invoices/${second.body.data.id}`)).status, 200);
    assert.equal((await staff(901, 'post', '/api/invoices', body(901))).status, 200);
    const numbers = db.prepare('SELECT invoice_number FROM invoices').all().map(row => row.invoice_number);
    assert.equal(new Set(numbers).size, numbers.length);
  });
  await check('Malformed invoice items fail before creating or changing any data', async () => {
    const before = db.prepare('SELECT * FROM invoices WHERE id=?').get(firstId);
    const count = db.prepare('SELECT COUNT(*) AS count FROM invoices').get().count;
    for (const items of [null, {}, [null], [{ description: 'Bad', quantity: 0, unit_price: 1 }], [{ description: 'Bad', quantity: 1, unit_price: -1 }], [{ description: '', quantity: 1, unit_price: 1 }]]) {
      assert.equal((await staff(901, 'post', '/api/invoices', { ...body(901), items })).status, 400);
      assert.equal((await staff(901, 'put', `/api/invoices/${firstId}`, { items })).status, 400);
    }
    assert.equal(db.prepare('SELECT COUNT(*) AS count FROM invoices').get().count, count);
    assert.deepEqual(db.prepare('SELECT * FROM invoices WHERE id=?').get(firstId), before);
  });
  await check('Invoice creation rolls back the parent when an item insert fails', async () => {
    const count = db.prepare('SELECT COUNT(*) AS count FROM invoices').get().count;
    db.exec("CREATE TRIGGER review_fail_item BEFORE INSERT ON invoice_items WHEN NEW.description='force failure' BEGIN SELECT RAISE(ABORT, 'synthetic failure'); END");
    try {
      const response = await staff(901, 'post', '/api/invoices', { ...body(901), items: [{ description: 'force failure', quantity: 1, unit_price: 1 }] });
      assert.equal(response.status, 500);
      assert.equal(db.prepare('SELECT COUNT(*) AS count FROM invoices').get().count, count);
    } finally { db.exec('DROP TRIGGER review_fail_item'); }
  });
  await check('Both invoice update paths reject invalid status and synchronize paid date', async () => {
    for (const url of [`/api/invoices/${firstId}`, `/api/invoices/${firstId}/status`]) {
      assert.equal((await staff(901, 'put', url, { status: 'invalid' })).status, 400);
      assert.equal((await staff(901, 'put', url, { status: 'paid' })).status, 200);
      assert.ok(db.prepare('SELECT paid_date FROM invoices WHERE id=?').get(firstId).paid_date);
      assert.equal((await staff(901, 'put', url, { status: 'draft' })).status, 200);
      assert.equal(db.prepare('SELECT paid_date FROM invoices WHERE id=?').get(firstId).paid_date, null);
    }
  });
  let portalToken;
  await check('Client portal login keeps identifier flow and rejects non-string input', async () => {
    assert.equal((await request(app).post('/api/portal/login').send({ identifier: 123 })).status, 400);
    const response = await request(app).post('/api/portal/login').send({ identifier: '0910000901' });
    assert.equal(response.status, 200); portalToken = response.body.token;
    assert.equal(jwt.verify(portalToken, process.env.JWT_SECRET).tenant_id, 901);
    assert.equal((await request(app).get('/api/portal/overview').set('Authorization', `Bearer ${portalToken}`)).status, 200);
  });
  await check('New office notes save the correct tenant and legacy public notes stay visible in the portal', async () => {
    assert.equal((await staff(902, 'post', '/api/case-notes', { case_id: 902, content: 'Office two note' })).status, 200);
    assert.equal(db.prepare("SELECT tenant_id FROM case_notes WHERE content='Office two note'").get().tenant_id, 902);
    db.prepare("INSERT INTO case_notes(case_id,content,created_by,tenant_id,is_private) VALUES(902,'Legacy public note',902,1,0)").run();
    db.prepare("INSERT INTO case_notes(case_id,content,created_by,tenant_id,is_private) VALUES(902,'Private note',902,902,1)").run();
    const secondToken = jwt.sign({ id: 902, role: 'client' }, process.env.JWT_SECRET);
    const response = await request(app).get('/api/portal/overview').set('Authorization', `Bearer ${secondToken}`);
    assert.equal(response.status, 200);
    const contents = response.body.data.recent_updates.map(note => note.content);
    assert.ok(contents.includes('Office two note'));
    assert.ok(contents.includes('Legacy public note'));
    assert.ok(!contents.includes('Private note'));
    assert.equal((await staff(902, 'post', '/api/case-notes', { case_id: 902, content: 123 })).status, 400);
  });
  await check('Suspending an office blocks new portal login and existing sessions', async () => {
    db.prepare("UPDATE tenants SET status='suspended' WHERE id=901").run();
    assert.equal((await request(app).post('/api/portal/login').send({ identifier: '0910000901' })).status, 404);
    for (const url of ['/api/portal/overview', `/api/portal/invoices/${firstId}`]) {
      assert.equal((await request(app).get(url).set('Authorization', `Bearer ${portalToken}`)).status, 403);
    }
    db.prepare("UPDATE tenants SET status='active' WHERE id=901").run();
  });
  await check('Portal reads reject foreign tenant claims, preserve legacy tokens and omit inconsistent tenant rows', async () => {
    const forged = jwt.sign({ id: 901, role: 'client', tenant_id: 902 }, process.env.JWT_SECRET);
    assert.equal((await request(app).get('/api/portal/overview').set('Authorization', `Bearer ${forged}`)).status, 403);
    const legacy = jwt.sign({ id: 901, role: 'client' }, process.env.JWT_SECRET);
    db.prepare('UPDATE invoices SET tenant_id=902 WHERE id=?').run(firstId);
    const result = await request(app).get('/api/portal/overview').set('Authorization', `Bearer ${legacy}`);
    assert.equal(result.status, 200);
    assert.ok(result.body.data.invoices.every(invoice => invoice.id !== firstId));
    assert.equal((await request(app).get(`/api/portal/invoices/${firstId}`).set('Authorization', `Bearer ${legacy}`)).status, 404);
  });
  console.log(`Review regressions: ${passed} passed; memory database only.`);
} finally {
  const resolved = path.resolve(temporaryRoot);
  if (path.dirname(resolved) === path.resolve(os.tmpdir()) && path.basename(resolved).startsWith('lawyer-review-')) fs.rmSync(resolved, { recursive: true, force: true });
}
