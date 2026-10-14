import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import bcrypt from 'bcryptjs';
import request from 'supertest';
import { officeAccessError, trialEndsAt } from '../domain/subscriptions/accessPolicy.js';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lawyer-trial-access-'));
Object.assign(process.env, { NODE_ENV: 'test', DB_PATH: ':memory:', SEED_DEMO_DATA: 'false',
  UPLOADS_DIR: path.join(root, 'uploads'), BACKUPS_DIR: path.join(root, 'backups'),
  JWT_SECRET: 'trial-test-access', JWT_REFRESH_SECRET: 'trial-test-refresh', ENCRYPTION_KEY: 'trial-test-encryption' });
let passed = 0;
try {
  const { default: app } = await import('../index.js');
  const { default: db } = await import('../database/db.js');
  const { generateTokens } = await import('../middleware/auth.js');
  const check = async (name, run) => { await run(); passed++; console.log('PASS ' + name); };
  const future = new Date(Date.now() + 86400000).toISOString();
  const past = new Date(Date.now() - 86400000).toISOString();
  db.prepare("INSERT INTO tenants(id,slug,name,owner_name,email,plan,status,is_active,trial_ends_at,subscription_ends_at) VALUES(991,'trial-test','Trial test','Owner','trial@test.invalid','trial','active',1,?,?)").run(future, future);
  const hash = bcrypt.hashSync('test-password-123', 4);
  for (const [id, role] of [[991,'admin'],[992,'lawyer'],[993,'super_admin']]) db.prepare('INSERT INTO users(id,name,email,password_hash,role,tenant_id,is_active) VALUES(?,?,?,?,?,991,1)').run(id, 'Synthetic', `${id}@trial.invalid`, hash, role);
  const tokens = id => generateTokens(db.prepare('SELECT * FROM users WHERE id=?').get(id));
  const login = id => request(app).post('/api/auth/login').send({ email: `${id}@trial.invalid`, password: 'test-password-123' });
  const saved = tokens(992);
  await check('Registration creates a 30-day trial and matching subscription record', async () => {
    const before = Date.now();
    const res = await request(app).post('/api/onboarding/register-office').send({ officeName:'Test trial', adminName:'Test', email:'new@trial.invalid', password:'test-password-123' });
    assert.equal(res.status, 201);
    const tenant = db.prepare('SELECT * FROM tenants WHERE id=?').get(res.body.tenant.id);
    assert.ok(Date.parse(tenant.trial_ends_at) >= before + 30*86400000);
    assert.ok(Date.parse(tenant.trial_ends_at) <= Date.now() + 30*86400000);
    assert.equal(tenant.subscription_ends_at, tenant.trial_ends_at);
    assert.equal(db.prepare('SELECT period FROM subscriptions WHERE tenant_id=?').get(tenant.id).period, 'trial_30_days');
    const publicPlans = await request(app).get('/api/subscriptions/plans');
    assert.equal(publicPlans.body.plans.find(plan => plan.id==='trial').period, '30 يوم مجاناً');
  });
  await check('Platform owner office creation also grants exactly 30 days', async () => {
    const before = Date.now();
    const res = await request(app).post('/api/platform/tenants').set('Authorization', `Bearer ${tokens(993).accessToken}`).send({ name:'Owner trial', owner_name:'Owner', email:'owner-new@trial.invalid', password:'test-password-123' });
    assert.equal(res.status, 201);
    assert.ok(Date.parse(res.body.tenant.trial_ends_at) >= before + 30*86400000);
    assert.ok(Date.parse(res.body.tenant.trial_ends_at) <= Date.now() + 30*86400000);
  });
  await check('Admin and lawyer login and refresh work during an active trial', async () => {
    for (const id of [991,992]) {
      assert.equal((await login(id)).status, 200);
      assert.equal((await request(app).post('/api/auth/refresh').send({ refreshToken: tokens(id).refreshToken })).status, 200);
    }
  });
  db.prepare('UPDATE tenants SET trial_ends_at=?,subscription_ends_at=? WHERE id=991').run(past, future);
  await check('Expired trial blocks new admin/lawyer login without issuing tokens', async () => {
    for (const id of [991,992]) {
      const res = await login(id);
      assert.equal(res.status, 403); assert.equal(res.body.code, 'SUBSCRIPTION_EXPIRED'); assert.ok(!res.body.accessToken);
    }
  });
  await check('Expired trial blocks an existing access token and refresh token', async () => {
    for (const endpoint of ['/api/auth/me','/api/cases','/api/subscriptions/current']) {
      const res = await request(app).get(endpoint).set('Authorization', `Bearer ${saved.accessToken}`);
      assert.equal(res.status, 403); assert.equal(res.body.code, 'SUBSCRIPTION_EXPIRED');
    }
    const res = await request(app).post('/api/auth/refresh').send({ refreshToken: saved.refreshToken });
    assert.equal(res.status,403); assert.equal(res.body.code,'SUBSCRIPTION_EXPIRED'); assert.ok(!res.body.accessToken);
  });
  await check('Owner remains able to log in and manage the platform for renewal', async () => {
    assert.equal((await login(993)).status,200);
    assert.equal((await request(app).get('/api/platform/stats').set('Authorization',`Bearer ${tokens(993).accessToken}`)).status,200);
  });
  await check('Free plan expiration is enforced too', async () => {
    db.prepare("UPDATE tenants SET plan='free' WHERE id=991").run();
    assert.equal((await login(992)).body.code,'SUBSCRIPTION_EXPIRED');
  });
  await check('Paid renewal restores login despite old trial expiration', async () => {
    db.prepare("UPDATE tenants SET plan='pro',subscription_ends_at=? WHERE id=991").run(future);
    assert.equal((await login(992)).status,200);
    assert.equal((await request(app).get('/api/auth/me').set('Authorization',`Bearer ${saved.accessToken}`)).status,200);
    db.prepare('UPDATE tenants SET subscription_ends_at=? WHERE id=991').run(past);
    assert.equal((await login(992)).body.code,'SUBSCRIPTION_EXPIRED');
  });
  await check('Exact expiry boundary, invalid dates and legacy timestamp policy are deterministic', async () => {
    const now=Date.parse('2026-10-14T12:00:00Z');
    const tenant={plan:'trial',status:'active',is_active:1,trial_ends_at:'2026-10-14T12:00:00Z'};
    assert.equal(officeAccessError(tenant,'lawyer',now-1),null);
    assert.equal(officeAccessError(tenant,'lawyer',now).code,'SUBSCRIPTION_EXPIRED');
    assert.equal(officeAccessError({...tenant,trial_ends_at:'invalid'},'lawyer',now).code,'SUBSCRIPTION_EXPIRED');
    assert.equal(officeAccessError({...tenant,trial_ends_at:'2026-10-14 12:00:00'},'lawyer',now).code,'SUBSCRIPTION_EXPIRED');
    assert.equal(officeAccessError({plan:'trial',status:'active',is_active:1,created_at:'2026-09-01 12:00:00'},'lawyer',now).code,'SUBSCRIPTION_EXPIRED');
    assert.equal(Date.parse(trialEndsAt(new Date(now)))-now,30*86400000);
  });
  console.log(`Trial access: ${passed} passed; in-memory DB only.`);
} finally {
  if (path.dirname(path.resolve(root))===path.resolve(os.tmpdir()) && path.basename(root).startsWith('lawyer-trial-access-')) fs.rmSync(root,{recursive:true,force:true});
}
process.exit(0);
