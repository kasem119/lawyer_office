import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import express from 'express';
import request from 'supertest';

const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'lawyer-onboarding-'));
Object.assign(process.env, {
  NODE_ENV: 'test', DB_PATH: ':memory:',
  UPLOADS_DIR: path.join(temporaryRoot, 'uploads'),
  BACKUPS_DIR: path.join(temporaryRoot, 'backups'),
  JWT_SECRET: 'onboarding-test-access-secret',
  JWT_REFRESH_SECRET: 'onboarding-test-refresh-secret',
  ENCRYPTION_KEY: 'onboarding-test-encryption-key'
});

try {
  const { default: db } = await import('../database/db.js');
  const { default: onboarding } = await import('../routes/onboardingRoutes.js');
  const { errorHandler } = await import('../middleware/errorHandler.js');
  const app = express();
  app.use(express.json());
  app.use('/api/onboarding', onboarding);
  app.use(errorHandler);

  const register = (overrides = {}) => request(app).post('/api/onboarding/register-office').send({
    officeName: 'مكتب المحاماة الجديد',
    adminName: 'مسؤول المكتب',
    email: `new-${Math.random().toString(16).slice(2)}@test.invalid`,
    phone: '0910000000',
    city: 'طرابلس',
    password: 'long-test-password',
    ...overrides
  });

  const first = await register({ email: ' FIRST@TEST.INVALID ' });
  assert.equal(first.status, 201, first.body.message);
  assert.match(first.body.tenant.slug, /^office-[a-f0-9]{12}$/);
  assert.equal(first.body.user.email, 'first@test.invalid');

  const second = await register({ email: 'second@test.invalid' });
  assert.equal(second.status, 201, second.body.message);
  assert.notEqual(second.body.tenant.slug, first.body.tenant.slug);

  const duplicateEmail = await register({ email: ' FIRST@test.invalid ', slug: 'a-different-office' });
  assert.equal(duplicateEmail.status, 409);
  assert.match(duplicateEmail.body.message, /البريد الإلكتروني/);

  const duplicateSlug = await register({ email: 'third@test.invalid', slug: first.body.tenant.slug });
  assert.equal(duplicateSlug.status, 409);
  assert.match(duplicateSlug.body.message, /معرّف المكتب/);

  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM tenants WHERE email LIKE '%@test.invalid'").get().count, 2);
  console.log('PASS Arabic office names receive unique generated slugs; email and slug conflicts are reported separately.');
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  const resolved = path.resolve(temporaryRoot);
  if (path.dirname(resolved) === path.resolve(os.tmpdir()) && path.basename(resolved).startsWith('lawyer-onboarding-')) {
    fs.rmSync(resolved, { recursive: true, force: true });
  }
}
