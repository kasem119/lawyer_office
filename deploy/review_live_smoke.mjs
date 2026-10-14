// Read-only production probes. Tokens stay in this process and are never logged.
import { DatabaseSync } from 'node:sqlite';
import jwt from '/opt/lawyer_office/server/node_modules/jsonwebtoken/index.js';
import { DB_PATH, JWT_SECRET } from '/opt/lawyer_office/server/config.js';

const db = new DatabaseSync(DB_PATH, { readOnly: true });
const results = [];
const token = user => jwt.sign({ id: user.id, role: user.role, tenant_id: user.tenant_id }, JWT_SECRET, { expiresIn: '2m' });
async function probe(name, user, path, expected, inspect) {
  const response = await fetch('http://127.0.0.1:3000' + path, { headers: { Authorization: 'Bearer ' + token(user) } });
  if (response.status !== expected) throw new Error(name + ': unexpected status ' + response.status);
  if (inspect) await inspect(response);
  else await response.arrayBuffer();
  results.push({ check: name, status: response.status, pass: true });
}
try {
  const owner = db.prepare("SELECT id,role,tenant_id FROM users WHERE role='super_admin' AND is_active=1 LIMIT 1").get();
  const staff = role => db.prepare(`SELECT u.id,u.role,u.tenant_id FROM users u JOIN tenants t ON t.id=u.tenant_id
    WHERE u.role=? AND u.is_active=1 AND t.is_active=1 AND t.status!='suspended' LIMIT 1`).get(role);
  if (owner) {
    await probe('Platform owner office API separation', owner, '/api/cases', 403);
    await probe('Platform owner dashboard available', owner, '/api/platform/stats', 200);
  } else results.push({ check: 'Platform owner probes', skipped: 'No active owner account' });
  const admin = staff('admin');
  if (admin) {
    await probe('Office admin platform API separation', admin, '/api/platform/stats', 403);
    await probe('Office staff list excludes platform owner', admin, '/api/users', 200, async response => {
      const body = await response.json();
      if (body.users.some(user => !['admin', 'lawyer'].includes(user.role))) throw new Error('Platform owner exposed in office staff list');
    });
    await probe('Office admin cases available', admin, '/api/cases', 200);
    await probe('Refactored invoice service list available', admin, '/api/invoices', 200);
    const invoice = db.prepare('SELECT id FROM invoices WHERE tenant_id=? LIMIT 1').get(admin.tenant_id);
    if (invoice) await probe('Refactored invoice service detail available', admin, `/api/invoices/${invoice.id}`, 200);
    const item = db.prepare('SELECT id FROM cases WHERE tenant_id=? LIMIT 1').get(admin.tenant_id);
    if (item) await probe('Real production PDF download', admin, `/api/exports/cases/${item.id}`, 200, async response => {
      const bytes = Buffer.from(await response.arrayBuffer());
      if (bytes.subarray(0,5).toString() !== '%PDF-' || bytes.length < 1000) throw new Error('Invalid production PDF output');
      results.push({ check: 'PDF binary content', prefix: '%PDF-', bytes: bytes.length, pass: true });
    });
  } else results.push({ check: 'Office admin probes', skipped: 'No active office admin' });
  const lawyer = staff('lawyer');
  if (lawyer) {
    await probe('Lawyer cannot list office user accounts', lawyer, '/api/users', 403);
    await probe('Lawyer cannot enter platform API', lawyer, '/api/platform/stats', 403);
    await probe('Lawyer case list available', lawyer, '/api/cases', 200);
  } else results.push({ check: 'Lawyer probes', skipped: 'No active lawyer' });
  const client = db.prepare(`SELECT c.id,c.tenant_id FROM clients c JOIN tenants t ON t.id=c.tenant_id
    WHERE t.is_active=1 AND t.status!='suspended' LIMIT 1`).get();
  if (client) {
    await probe('Client portal session available', { ...client, role: 'client' }, '/api/portal/overview', 200);
    await probe('Client portal token cannot enter staff API', { ...client, role: 'client' }, '/api/cases', 403);
  } else results.push({ check: 'Client portal probes', skipped: 'No active client office' });
  const publicResponse = await fetch('https://muhami.ly/api/platform/tenants');
  if (publicResponse.status !== 401) throw new Error('Public platform authorization probe failed');
  results.push({ check: 'Anonymous platform API requires login', path: '/api/platform/tenants', status: 401, pass: true });
  const homepage = await fetch('https://muhami.ly/');
  if (homepage.status !== 200 || !(await homepage.text()).includes('<div id="root">')) throw new Error('Public web app unavailable');
  results.push({ check: 'Public web app available', status: 200, pass: true });
  console.log(JSON.stringify({ status: 'verified', probes: results }));
} finally {
  db.close();
}
