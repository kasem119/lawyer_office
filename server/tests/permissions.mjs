import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import nodemailer from 'nodemailer';
import puppeteer from 'puppeteer';
import ExcelJS from 'exceljs';
import { WebSocket } from 'ws';

const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'lawyer-permissions-'));
Object.assign(process.env, {
  NODE_ENV: 'test', DB_PATH: ':memory:',
  // Authorization tests must never inherit a paid provider from server/.env.
  AI_PROVIDER: 'local', LLM_API_KEY: '',
  UPLOADS_DIR: path.join(temporaryRoot, 'uploads'), BACKUPS_DIR: path.join(temporaryRoot, 'backups'),
  JWT_SECRET: 'permissions-test-access-secret', JWT_REFRESH_SECRET: 'permissions-test-refresh-secret',
  ENCRYPTION_KEY: 'permissions-test-encryption-key'
});

// Keep real routing, SQL, token validation, templates and Excel generation.
// Only external delivery and Chromium rendering are replaced.
let mailCalls = 0;
let pdfHTML = '';
let blockedPDFRequests = 0;
const originalTransport = nodemailer.createTransport;
const originalLaunch = puppeteer.launch;
nodemailer.createTransport = () => ({ sendMail: async () => { mailCalls++; return { messageId: 'test' }; } });
puppeteer.launch = async () => ({
  newPage: async () => {
    let requestHandler;
    return {
      setJavaScriptEnabled: async enabled => assert.equal(enabled, false),
      setRequestInterception: async enabled => assert.equal(enabled, true),
      on: (event, handler) => { if (event === 'request') requestHandler = handler; },
      setContent: async html => {
        pdfHTML = html;
        await requestHandler({
          url: () => 'http://127.0.0.1:3000/internal-metadata',
          abort: () => { blockedPDFRequests++; return Promise.resolve(); },
          continue: () => { throw new Error('PDF renderer attempted a network request'); }
        });
      },
      emulateMediaType: async () => {},
      pdf: async () => new Uint8Array(Buffer.from('%PDF-test'))
    };
  },
  close: async () => {}
});

let passed = 0, failed = 0, requests = 0;
const checks = [];
const check = (name, run) => checks.push({ name, run });
try {
  const { default: app } = await import('../index.js');
  const { default: db } = await import('../database/db.js');
  const { DB_PATH, JWT_SECRET } = await import('../config.js');
  const { generateTokens } = await import('../middleware/auth.js');
  assert.equal(DB_PATH, ':memory:', 'Refuse to run against a persistent office database');
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all().map(row => row.name);
  const users = [
    [1, 'admin', 1], [2, 'lawyer', 1], [3, 'lawyer', 1], [4, 'lawyer', 1],
    [5, 'lawyer', 1], [6, 'admin', 2], [7, 'lawyer', 2], [8, 'super_admin', 1]
  ];
  const fixtures = () => {
    db.pragma('foreign_keys=OFF');
    for (const table of tables) db.exec(`DELETE FROM "${table.replaceAll('"', '""')}"`);
    db.pragma('foreign_keys=ON');
    for (const tenant of [1, 2]) db.prepare("INSERT INTO tenants(id,slug,name,owner_name,email,plan,status,is_active) VALUES(?,?,?,? ,?,'professional','active',1)").run(tenant, `office-${tenant}`, `Office ${tenant}`, 'Owner', `office-${tenant}@test.invalid`);
    for (const [id, role, tenant] of users) db.prepare('INSERT INTO users(id,name,email,password_hash,role,tenant_id,is_active) VALUES(?,?,?,?,?,?,?)').run(id, `User ${id}`, `user-${id}@test.invalid`, 'unused', role, tenant, id === 5 ? 0 : 1);
    for (const [id, tenant, creator] of [[1, 1, 1], [2, 1, 1], [3, 2, 6]]) db.prepare('INSERT INTO clients(id,name,phone,created_by,tenant_id) VALUES(?,?,?,?,?)').run(id, `MARKER Client ${id}`, `091000000${id}`, creator, tenant);
    for (const [id, tenant, lead, client] of [[101, 1, 2, 1], [102, 1, 4, 2], [103, 1, 4, 1], [201, 2, 7, 3]]) {
      db.prepare('INSERT INTO cases(id,case_number,title,case_type,client_id,lead_lawyer_id,tenant_id) VALUES(?,?,?,?,?,?,?)').run(id, `MARKER-${id}`, `MARKER Case ${id}`, `type-${id}`, client, lead, tenant);
      db.prepare('INSERT INTO case_lawyers(case_id,user_id,role_in_case) VALUES(?,?,?)').run(id, lead, 'lead');
      db.prepare("INSERT INTO events(id,title,event_type,date,case_id,user_id,tenant_id) VALUES(?,?,'court_date',date('now'),?,?,?)").run(id, `MARKER Event ${id}`, id, lead, tenant);
      db.prepare('INSERT INTO tasks(id,title,case_id,assigned_to,created_by,tenant_id) VALUES(?,?,?,?,?,?)').run(id, `MARKER Task ${id}`, id, lead, tenant === 1 ? 1 : 6, tenant);
      const filename = path.join(process.env.UPLOADS_DIR, `document-${id}.pdf`);
      fs.writeFileSync(filename, `DOCUMENT-${id}`);
      db.prepare("INSERT INTO documents(id,original_name,stored_name,file_path,file_size,mime_type,case_id,uploaded_by,tenant_id) VALUES(?,?,?,?,10,'application/pdf',?,?,?)").run(id, `MARKER Document ${id}`, `document-${id}.pdf`, filename, id, lead, tenant);
      db.prepare('INSERT INTO document_versions(document_id,version_number,file_path,file_size,uploaded_by) VALUES(?,1,?,10,?)').run(id, filename, lead);
      db.prepare("INSERT INTO invoices(id,invoice_number,case_id,client_id,total_amount,status,created_by,tenant_id) VALUES(?,?,?,?,?,'paid',?,?)").run(id, `MARKER-INV-${id}`, id, client, id, tenant === 1 ? 1 : 6, tenant);
      db.prepare('INSERT INTO expenses(id,case_id,description,amount,created_by,tenant_id) VALUES(?,?,?,?,?,?)').run(id, id, `MARKER Expense ${id}`, 10, lead, tenant);
      db.prepare('INSERT INTO time_entries(id,case_id,user_id,description,duration_minutes,tenant_id) VALUES(?,?,?,?,60,?)').run(id, id, lead, `MARKER Time ${id}`, tenant);
      db.prepare('INSERT INTO case_notes(id,case_id,content,created_by,tenant_id) VALUES(?,?,?,?,?)').run(id, id, `PUBLIC-${id}`, lead, tenant);
    }
    db.prepare("INSERT INTO case_lawyers(case_id,user_id,role_in_case) VALUES(101,3,'assigned')").run();
    for (const [id, author] of [[111, 4], [112, 2], [113, 3]]) db.prepare('INSERT INTO case_notes(id,case_id,content,created_by,is_private,tenant_id) VALUES(?,101,?,?,1,1)').run(id, `PRIVATE-${id}`, author);
    for (const [id, tenant, author] of [[101, 1, 1], [201, 2, 6], [301, 0, 1]]) db.prepare("INSERT INTO document_templates(id,name,content_html,created_by,tenant_id) VALUES(?,?,'<p>Test</p>',?,?)").run(id, `MARKER Template ${id}`, author, tenant);
    for (const [id, tenant, author] of [[101, 1, 1], [201, 2, 6], [202, null, 6]]) db.prepare("INSERT INTO activity_log(id,user_id,action,entity_type,details_json,tenant_id) VALUES(?,?,'TEST','case',?,?)").run(id, author, `MARKER Audit ${id}`, tenant);
    for (const [id, user] of [[101, 2], [201, 7]]) db.prepare('INSERT INTO notifications(id,user_id,title,message) VALUES(?,?,?,?)').run(id, user, `MARKER Notification ${id}`, 'Test');
    fs.writeFileSync(path.join(process.env.BACKUPS_DIR, 'backup_global.db'), 'GLOBAL-SNAPSHOT');
    mailCalls = 0;
    pdfHTML = '';
    blockedPDFRequests = 0;
  };
  const token = id => generateTokens(db.prepare('SELECT * FROM users WHERE id = ?').get(id)).accessToken;
  const call = async (id, method, url, body) => {
    requests++;
    let req = request(app)[method](url);
    if (url.includes('format=excel')) req = req.buffer(true).parse((res, done) => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => done(null, Buffer.concat(chunks)));
      res.on('error', done);
    });
    if (id) req = req.set('Authorization', `Bearer ${typeof id === 'number' ? token(id) : id}`);
    if (body !== undefined) req = req.send(body);
    return req;
  };
  const ids = values => values.map(value => value.id).sort((a, b) => a - b);
  const snapshot = () => JSON.stringify(tables.map(table => [table, db.prepare(`SELECT * FROM "${table}" ORDER BY rowid`).all()]));
  const denied = async (user, method, url, body, statuses = [403, 404]) => {
    const before = snapshot();
    const res = await call(user, method, url, body);
    assert.ok(statuses.includes(res.status), `${method} ${url}: expected ${statuses}, got ${res.status}`);
    assert.equal(snapshot(), before, 'Denied request changed database records');
    assert.equal(mailCalls, 0, 'Denied request reached email delivery');
  };

  for (const [user, visible] of [[1, [101, 102, 103]], [2, [101]], [3, [101]], [4, [102, 103]], [6, [201]], [7, [201]]]) {
    for (const [endpoint, key] of [['cases', 'cases'], ['events', 'events'], ['tasks', 'tasks'], ['documents', 'documents'], ['invoices', 'data']]) {
      check(`User ${user}: ${endpoint} list contains exactly authorized records`, async () => {
        const res = await call(user, 'get', `/api/${endpoint}`);
        assert.equal(res.status, 200);
        assert.deepEqual(ids(res.body[key]), visible);
        if (endpoint === 'documents') assert.equal(res.body.pagination.total, visible.length);
      });
    }
  }
  for (const [user, visible] of [[1, [1, 2]], [2, [1]], [3, [1]], [4, [1, 2]], [6, [3]], [7, [3]]]) {
    check(`User ${user}: client list and search expose only authorized clients`, async () => {
      assert.deepEqual(ids((await call(user, 'get', '/api/clients')).body.clients), visible);
      assert.deepEqual(ids((await call(user, 'get', '/api/search?q=MARKER')).body.data.clients), visible);
    });
  }
  check('Shared client details hide cases assigned to other lawyers', async () => {
    const res = await call(2, 'get', '/api/clients/1');
    assert.equal(res.status, 200);
    assert.deepEqual(ids(res.body.cases), [101]);
  });
  for (const user of [1, 2, 3]) {
    check(`User ${user}: direct foreign-office records and writes denied`, async () => {
      for (const url of ['/api/cases/201', '/api/clients/3', '/api/case-notes/201', '/api/invoices/201', '/api/invoices/MARKER-INV-201', '/api/documents/201/versions', '/api/documents/download/201', '/api/exports/cases/201', '/api/exports/invoices/201', '/api/templates/201']) await denied(user, 'get', url);
      for (const [url, body] of [['/api/cases/201', { title: 'Change' }], ['/api/clients/3', { name: 'Change' }], ['/api/case-notes/201', { content: 'Change' }], ['/api/invoices/201', { notes: 'Change' }], ['/api/invoices/201/status', { status: 'sent' }], ['/api/tasks/201/status', { status: 'done' }], ['/api/events/201', { title: 'Change', date: '2099-01-01' }], ['/api/expenses/201', { description: 'Change', amount: 1 }], ['/api/time-entries/201', { duration_minutes: 1 }]]) await denied(user, 'put', url, body);
      await denied(user, 'patch', '/api/cases/201/status', { status: 'pending' });
      for (const url of ['/api/cases/201', '/api/clients/3', '/api/case-notes/201', '/api/invoices/201', '/api/tasks/201', '/api/events/201', '/api/expenses/201', '/api/time-entries/201', '/api/documents/201']) await denied(user, 'delete', url);
    });
  }
  check('Same-office unassigned lawyer cannot read cases, notes, documents or invoices', async () => {
    for (const url of ['/api/cases/102', '/api/clients/2', '/api/case-notes/102', '/api/invoices/102', '/api/documents/102/versions', '/api/documents/download/102', '/api/exports/cases/102', '/api/exports/invoices/102']) await denied(2, 'get', url);
    await denied(2, 'put', '/api/invoices/102/status', { status: 'sent' });
    await denied(2, 'post', '/api/invoices/102/send-email');
    await denied(2, 'post', '/api/events/102/remind');
    await denied(2, 'post', '/api/tasks/102/remind');
  });
  check('Assigned lawyer can read but cannot manage case or delete documents', async () => {
    assert.equal((await call(3, 'get', '/api/cases/101')).status, 200);
    for (const method of ['put', 'delete']) await denied(3, method, '/api/cases/101', { title: 'Change' });
    await denied(3, 'patch', '/api/cases/101/status', { status: 'pending' });
    await denied(3, 'delete', '/api/documents/101');
    assert.equal((await call(2, 'put', '/api/cases/101', { title: 'Authorized edit' })).status, 200);
  });
  check('Private note visibility is identical in JSON and case PDF export', async () => {
    for (const [user, visible] of [[1, [101, 111, 112, 113]], [2, [101, 112]], [3, [101, 113]]]) {
      assert.deepEqual(ids((await call(user, 'get', '/api/case-notes/101')).body.data), visible);
      assert.equal((await call(user, 'get', '/api/exports/cases/101')).status, 200);
      for (const note of [111, 112, 113]) assert.equal(pdfHTML.includes(`PRIVATE-${note}`), visible.includes(note), `Private note ${note} leaked in PDF for user ${user}`);
    }
  });
  check('AI case summaries require same-tenant case access while authorized summaries still work', async () => {
    assert.equal((await call(2, 'post', '/api/ai/assist', { mode: 'summarize_case', case_id: 101 })).status, 200);
    await denied(2, 'post', '/api/ai/assist', { mode: 'summarize_case', case_id: 102 });
    await denied(2, 'post', '/api/ai/assist', { mode: 'summarize_case', case_id: 201 });
    await denied(2, 'post', '/api/ai/assist', { mode: 'summarize_case', case_id: '<img src=x>' }, [400]);
  });
  check('PDF templates escape attacker markup and renderer blocks loopback requests', async () => {
    db.prepare('UPDATE cases SET title = ? WHERE id = 101').run('<img src="http://127.0.0.1/secret">');
    assert.equal((await call(2, 'get', '/api/exports/cases')).status, 200);
    assert.ok(pdfHTML.includes('&lt;img'));
    assert.ok(!pdfHTML.includes('<img src="http://127.0.0.1/secret">'));
    assert.equal(blockedPDFRequests, 1);
  });
  check('Template placeholder values are HTML-escaped before generated HTML is returned', async () => {
    db.prepare('UPDATE document_templates SET content_html = ? WHERE id = 101').run('<p>{{client_name}}</p>');
    const res = await call(2, 'post', '/api/templates/101/generate', { values: { client_name: '<img src=x onerror=alert(1)>' } });
    assert.equal(res.status, 200);
    assert.ok(res.body.generated_html.includes('&lt;img'));
    assert.ok(!res.body.generated_html.includes('<img src=x'));
  });
  check('WebSocket notifications accept staff only and preserve staff delivery', async () => {
    const { initWebSocketServer, sendToUser } = await import('../services/websocketService.js');
    const server = http.createServer();
    const wss = initWebSocketServer(server);
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    const baseUrl = `ws://127.0.0.1:${address.port}/ws?token=`;
    const clientToken = jwt.sign({ id: 2, role: 'client', tenant_id: 1 }, JWT_SECRET);
    const clientSocket = new WebSocket(baseUrl + encodeURIComponent(clientToken));
    const clientClose = new Promise((resolve, reject) => {
      clientSocket.once('close', (code) => code === 1008 ? resolve() : reject(new Error(`Client socket closed with ${code}`)));
      clientSocket.once('error', () => {});
    });
    await clientClose;

    const staffToken = token(2);
    const staffSockets = [new WebSocket(baseUrl + encodeURIComponent(staffToken)), new WebSocket(baseUrl + encodeURIComponent(staffToken))];
    await Promise.all(staffSockets.map(socket => new Promise((resolve, reject) => {
      socket.once('open', resolve);
      socket.once('error', reject);
    })));
    const received = staffSockets.map(socket => new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Staff notification timed out')), 2000);
      socket.once('message', data => {
        clearTimeout(timeout);
        resolve(JSON.parse(data.toString()));
      });
    }));
    sendToUser(2, 'SECURITY_TEST', { marker: 'staff-only' });
    for (const message of await Promise.all(received)) assert.equal(message.type, 'SECURITY_TEST');
    const staffClose = staffSockets.map(socket => new Promise(resolve => socket.once('close', resolve)));
    for (const socket of staffSockets) socket.close();
    await Promise.all(staffClose);
    await new Promise(resolve => wss.close(resolve));
    await new Promise(resolve => server.close(resolve));
  });
  check('Explicit document sharing grants download without granting whole-case access', async () => {
    assert.equal((await call(1, 'post', '/api/documents/share', { document_id: 102, shared_with_user_id: 3, permissions: 'download' })).status, 200);
    assert.equal((await call(3, 'get', '/api/documents/download/102')).status, 200);
    assert.equal((await call(3, 'get', '/api/documents/102/versions')).status, 200);
    await denied(3, 'get', '/api/cases/102');
    await denied(3, 'delete', '/api/documents/102');
    await denied(1, 'post', '/api/documents/share', { document_id: 101, shared_with_user_id: 7 }, [400, 403]);
    await denied(1, 'post', '/api/documents/share', { document_id: 101, shared_with_user_id: 5 }, [400, 403]);
  });
  for (const [user, visible] of [[1, [101, 102, 103]], [2, [101]], [3, [101]], [6, [201]], [7, [201]]]) {
    check(`User ${user}: reports contain only allowed case totals`, async () => {
      const overview = (await call(user, 'get', '/api/reports/overview')).body.data;
      assert.equal(overview.cases.reduce((sum, row) => sum + row.count, 0), visible.length);
      assert.equal(overview.total_documents, visible.length);
      const types = (await call(user, 'get', '/api/reports/case-types')).body.data;
      assert.deepEqual(types.map(row => row.case_type).sort(), visible.map(id => `type-${id}`).sort());
      const finance = (await call(user, 'get', '/api/reports/financial-summary')).body.data;
      assert.equal(finance.total_paid, visible.reduce((sum, id) => sum + id, 0));
      assert.deepEqual(ids(finance.top_cases_by_revenue), visible);
    });
  }
  check('Forged tenant query parameters cannot change scope', async () => {
    assert.deepEqual(ids((await call(2, 'get', '/api/cases?tenant_id=2')).body.cases), [101]);
    assert.deepEqual(ids((await call(2, 'get', '/api/documents?case_id=201&tenant_id=2')).body.documents), []);
    assert.deepEqual(ids((await call(2, 'get', '/api/invoices?case_id=201')).body.data), []);
  });
  for (const [endpoint, field] of [['cases', 'MARKER-'], ['clients', 'MARKER Client '], ['tasks', 'MARKER Task '], ['events', 'MARKER Event ']]) {
    check(`Excel ${endpoint} export omits hidden and foreign records`, async () => {
      const res = await call(2, 'get', `/api/exports/${endpoint}?format=excel`);
      assert.equal(res.status, 200);
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(res.body);
      const cells = [];
      workbook.eachSheet(sheet => sheet.eachRow(row => row.eachCell(cell => cells.push(String(cell.value)))));
      assert.ok(cells.includes(field + (endpoint === 'clients' ? '1' : '101')));
      for (const id of endpoint === 'clients' ? [2, 3] : [102, 103, 201]) assert.ok(!cells.includes(field + id));
    });
  }
  check('Platform owner cannot enter office APIs; staff cannot enter platform APIs', async () => {
    for (const endpoint of ['cases', 'clients', 'documents', 'events', 'tasks', 'invoices', 'expenses', 'time-entries', 'search', 'reports/overview', 'templates', 'activities', 'backups', 'users']) await denied(8, 'get', `/api/${endpoint}`);
    for (const user of [1, 2, 6, 7]) await denied(user, 'get', '/api/platform/tenants');
    assert.equal((await call(8, 'get', '/api/platform/tenants')).status, 200);
  });
  check('Absent, expired, invalid, disabled and client-portal tokens denied by office API', async () => {
    for (const user of [null, 'invalid', 5, jwt.sign({ id: 1, role: 'client' }, JWT_SECRET), jwt.sign({ id: 1 }, JWT_SECRET, { expiresIn: -1 })]) await denied(user, 'get', '/api/cases', undefined, [401, 403]);
    const misleading = jwt.sign({ id: 2, role: 'admin', tenant_id: 2 }, JWT_SECRET);
    assert.deepEqual(ids((await call(misleading, 'get', '/api/cases')).body.cases), [101]);
    await denied(misleading, 'get', '/api/users');
  });
  check('Users and audit logs remain scoped, including legacy NULL tenant audit rows', async () => {
    assert.deepEqual(ids((await call(1, 'get', '/api/users')).body.users), [1, 2, 3, 4, 5]);
    assert.deepEqual(ids((await call(6, 'get', '/api/users')).body.users), [6, 7]);
    assert.deepEqual(ids((await call(1, 'get', '/api/activities')).body.activities), [101]);
    assert.deepEqual(ids((await call(6, 'get', '/api/activities')).body.activities), [201, 202]);
    assert.equal((await call(1, 'get', '/api/activities/stats')).body.stats.total, 1);
    await denied(2, 'get', '/api/activities');
  });
  check('Global database backups are inaccessible to office admins in multi-office mode', async () => {
    for (const user of [1, 6]) {
      await denied(user, 'get', '/api/backups');
      await denied(user, 'get', '/api/backups/download/backup_global.db');
      await denied(user, 'post', '/api/backups/create');
      await denied(user, 'post', '/api/backups/restore', { filename: 'backup_global.db' });
    }
  });
  check('Notification access and mark-read operations stay with recipient', async () => {
    assert.deepEqual(ids((await call(2, 'get', '/api/notifications')).body.notifications), [101]);
    await call(2, 'put', '/api/notifications/201/read');
    assert.equal(db.prepare('SELECT is_read FROM notifications WHERE id=201').get().is_read, 0);
    await call(2, 'put', '/api/notifications/101/read');
    assert.equal(db.prepare('SELECT is_read FROM notifications WHERE id=101').get().is_read, 1);
  });
  check('Shared system templates are readable, foreign office templates are not', async () => {
    assert.deepEqual(ids((await call(2, 'get', '/api/templates')).body.templates), [101, 301]);
    assert.deepEqual(ids((await call(7, 'get', '/api/templates')).body.templates), [201, 301]);
    await denied(2, 'get', '/api/templates/201');
  });
  for (const caseId of [102, 201]) {
    check(`Unauthorized case ${caseId} cannot be linked through POST or PUT`, async () => {
      db.prepare('UPDATE invoices SET created_by=2 WHERE id=101').run();
      const bodies = {
        events: { title: 'Injected', date: '2099-01-01', case_id: caseId },
        tasks: { title: 'Injected', assigned_to: 2, case_id: caseId },
        invoices: { case_id: caseId, client_id: caseId === 201 ? 3 : 2, items: [{ description: 'Test', quantity: 1, unit_price: 1 }] },
        expenses: { case_id: caseId, description: 'Injected', amount: 1 },
        'time-entries': { case_id: caseId, description: 'Injected', duration_minutes: 1 }
      };
      for (const [endpoint, body] of Object.entries(bodies)) {
        await denied(2, 'post', `/api/${endpoint}`, body);
        await denied(2, 'put', `/api/${endpoint}/101`, body, [400, 403, 404]);
      }
    });
  }
  check('Foreign-office client, lead lawyer and task assignee cannot be injected', async () => {
    await denied(1, 'put', '/api/cases/101', { client_id: 3 }, [400, 403]);
    await denied(1, 'put', '/api/cases/101', { lead_lawyer_id: 7 }, [400, 403]);
    await denied(1, 'post', '/api/tasks', { title: 'Test', assigned_to: 7, case_id: 101 }, [400, 403]);
    await denied(1, 'put', '/api/tasks/101', { title: 'Test', assigned_to: 7, case_id: 101 }, [400, 403]);
    await denied(1, 'post', '/api/invoices', { case_id: 101, client_id: 3 }, [400, 403]);
    await denied(1, 'put', '/api/invoices/101', { client_id: 3 }, [400, 403]);
  });
  check('Own-case creation and editing remain available to authorized lawyer', async () => {
    for (const [endpoint, body] of Object.entries({
      events: { title: 'Allowed', date: '2099-01-01', case_id: 101 },
      tasks: { title: 'Allowed', assigned_to: 3, case_id: 101 },
      expenses: { case_id: 101, description: 'Allowed', amount: 1 },
      'time-entries': { case_id: 101, description: 'Allowed', duration_minutes: 1 }
    })) assert.ok([200, 201].includes((await call(2, 'post', `/api/${endpoint}`, body)).status), endpoint);
  });
  check('Case time summary requires permission to read that case', async () => {
    assert.equal((await call(3, 'get', '/api/time-entries/summary/101')).body.data.billable_hours, 1);
    await denied(2, 'get', '/api/time-entries/summary/102');
    await denied(1, 'get', '/api/time-entries/summary/201');
  });
  for (const { name, run } of checks) {
    fixtures();
    try { await run(); passed++; console.log(`PASS ${name}`); }
    catch (error) { failed++; console.error(`FAIL ${name}: ${error.message}`); }
  }
  console.log(`Permissions: ${passed} passed, ${failed} failed; ${requests} HTTP requests. Memory database, temporary files, no external email or Chromium.`);
} catch (error) {
  failed++;
  console.error(error);
} finally {
  nodemailer.createTransport = originalTransport;
  puppeteer.launch = originalLaunch;
  const resolved = path.resolve(temporaryRoot);
  if (path.dirname(resolved) === path.resolve(os.tmpdir()) && path.basename(resolved).startsWith('lawyer-permissions-')) fs.rmSync(resolved, { recursive: true, force: true });
}
// The application rate limiter owns a timer; tests do not start a listening server.
process.exit(failed ? 1 : 0);
