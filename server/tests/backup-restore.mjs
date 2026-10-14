import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { DatabaseSync } from 'node:sqlite';
import archiver from 'archiver';
import express from 'express';
import request from 'supertest';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'office-backup-restore-'));
Object.assign(process.env, {
  NODE_ENV: 'test', DB_PATH: path.join(root, 'office.db'),
  UPLOADS_DIR: path.join(root, 'uploads'), BACKUPS_DIR: path.join(root, 'backups'), CLOUD_BACKUP_DIR: '',
  JWT_SECRET: 'backup-test-secret', JWT_REFRESH_SECRET: 'backup-test-refresh', ENCRYPTION_KEY: 'backup-test-encryption'
});
const { default: db } = await import('../database/db.js');
const { runBackup, restoreBackup } = await import('../services/backupService.js');
const { default: router } = await import('../routes/backupRoutes.js');
const { generateTokens } = await import('../middleware/auth.js');
const { DB_PATH, UPLOADS_DIR, BACKUPS_DIR } = await import('../config.js');
assert.equal(DB_PATH, path.join(root, 'office.db'));
const app = express(); app.use(express.json()); app.use('/api/backups', router);
db.prepare("INSERT OR IGNORE INTO tenants(id,slug,name,owner_name,email,status,plan,subscription_ends_at) VALUES(1,'restore-test','Restore test','Test','test@invalid.test','active','professional','2099-01-01')").run();
db.prepare("INSERT INTO users(id,name,email,password_hash,role,tenant_id) VALUES(900,'Test admin','admin@invalid.test','unused','admin',1)").run();
db.exec('CREATE TABLE restore_probe(id INTEGER PRIMARY KEY, value TEXT); INSERT INTO restore_probe VALUES(1,\'original\');');
const cached = db.prepare('SELECT value FROM restore_probe WHERE id=1');
const auth = () => `Bearer ${generateTokens(db.prepare('SELECT * FROM users WHERE id=900').get()).accessToken}`;
fs.mkdirSync(path.join(UPLOADS_DIR, 'tenant-1', 'cases'), { recursive: true });
const attachment = path.join(UPLOADS_DIR, 'tenant-1', 'cases', 'document.txt');
fs.writeFileSync(attachment, 'original attachment');
let count = 0;
async function check(name, fn) { await fn(); count++; console.log(`PASS ${name}`); }
async function fixtureZip(name, build) {
  const file = path.join(BACKUPS_DIR, name);
  await new Promise((resolve, reject) => {
    const output = fs.createWriteStream(file); const zip = archiver('zip');
    output.on('close', resolve); output.on('error', reject); zip.on('error', reject);
    zip.pipe(output); build(zip); zip.finalize().catch(reject);
  });
  return file;
}
const original = await runBackup(); assert.equal(original.success, true, original.error);
try {
  await check('Concurrent operations rejected while atomic snapshot runs', async () => {
    const running = runBackup();
    assert.equal((await runBackup()).success, false);
    assert.equal((await restoreBackup(original.destinationPath)).success, false);
    assert.equal((await running).success, true);
  });
  await check('WAL database and nested attachments restore in same process and fresh connection', async () => {
    db.prepare('UPDATE restore_probe SET value=?').run('changed'); fs.writeFileSync(attachment, 'changed attachment');
    fs.writeFileSync(path.join(UPLOADS_DIR, 'extra.txt'), 'should disappear');
    const restored = await restoreBackup(original.destinationPath);
    assert.equal(restored.success, true, restored.error);
    assert.equal(cached.get().value, 'original');
    const reopened = new DatabaseSync(DB_PATH, { readOnly: true });
    try { assert.equal(reopened.prepare('SELECT value FROM restore_probe').get().value, 'original'); } finally { reopened.close(); }
    assert.equal(fs.readFileSync(attachment, 'utf8'), 'original attachment');
    assert.equal(fs.existsSync(path.join(UPLOADS_DIR, 'extra.txt')), false);
    assert.ok(fs.existsSync(path.join(BACKUPS_DIR, restored.safetyBackup)));
    assert.equal(db.prepare('PRAGMA foreign_keys').get().foreign_keys, 1);
    assert.equal(db.prepare('PRAGMA journal_mode').get().journal_mode, 'wal');
    // Safety copy recovers pre-restore DB, nested upload, and extra file.
    const rollback = await restoreBackup(restored.safetyBackup); assert.equal(rollback.success, true, rollback.error);
    assert.equal(cached.get().value, 'changed'); assert.equal(fs.readFileSync(attachment, 'utf8'), 'changed attachment');
    assert.equal(fs.existsSync(path.join(UPLOADS_DIR, 'extra.txt')), true);
  });
  await check('Legacy DB restores keep uploads and refresh cached statements', async () => {
    const legacy = path.join(BACKUPS_DIR, 'legacy.db'); await db.backup(legacy);
    db.prepare('UPDATE restore_probe SET value=?').run('legacy-change'); fs.writeFileSync(attachment, 'legacy attachment');
    const result = await restoreBackup(legacy); assert.equal(result.success, true, result.error);
    assert.equal(cached.get().value, 'changed'); assert.equal(fs.readFileSync(attachment, 'utf8'), 'legacy attachment');
  });
  await check('Reject missing database, invalid SQLite, malformed ZIP and symlink entries without mutation', async () => {
    const missing = await fixtureZip('missing.zip', zip => zip.append('x', { name: 'uploads/x.txt' }));
    const invalid = await fixtureZip('invalid.zip', zip => zip.append('not sqlite', { name: 'database.db' }));
    const linked = await fixtureZip('linked.zip', zip => zip.symlink('uploads/link', '../../escape'));
    const outside = await fixtureZip('outside.zip', zip => zip.append('x', { name: 'escape.txt' }));
    const malformed = path.join(BACKUPS_DIR, 'malformed.zip'); fs.writeFileSync(malformed, 'not zip');
    const traversal = await fixtureZip('traversal.zip', zip => zip.append('x', { name: 'uploads/a.txt' }));
    const raw = fs.readFileSync(traversal);
    const safeName = Buffer.from('uploads/a.txt'); const unsafeName = Buffer.from('../escape.txt');
    for (let offset = raw.indexOf(safeName); offset !== -1; offset = raw.indexOf(safeName, offset + safeName.length)) unsafeName.copy(raw, offset);
    fs.writeFileSync(traversal, raw);
    const before = cached.get().value;
    for (const file of [missing, invalid, linked, outside, malformed, traversal]) assert.equal((await restoreBackup(file)).success, false, file);
    assert.equal(fs.existsSync(path.join(BACKUPS_DIR, 'escape.txt')), false);
    assert.equal(cached.get().value, before); assert.equal(fs.readFileSync(attachment, 'utf8'), 'legacy attachment');
    assert.equal(fs.readdirSync(BACKUPS_DIR).some(name => name.startsWith('restore_temp_')), false);
  });
  await check('Failed database replacement rolls back DB and staged attachments', async () => {
    const copy = fs.copyFileSync; let fail = true;
    fs.copyFileSync = function(source, dest, ...args) {
      if (dest === DB_PATH && fail) { fail = false; throw new Error('Injected database replacement failure'); }
      return copy.call(this, source, dest, ...args);
    };
    try {
      const result = await restoreBackup(original.destinationPath); assert.equal(result.success, false); assert.match(result.error, /Injected/);
      assert.equal(cached.get().value, 'changed'); assert.equal(fs.readFileSync(attachment, 'utf8'), 'legacy attachment');
      assert.ok(result.safetyBackup);
    } finally { fs.copyFileSync = copy; }
  });
  await check('Reject intact SQLite snapshot missing application tables before mutation', async () => {
    const incomplete = path.join(BACKUPS_DIR, 'incomplete.db'); await db.backup(incomplete);
    const candidate = new DatabaseSync(incomplete);
    try { candidate.exec('DROP TABLE tasks'); assert.equal(candidate.prepare('PRAGMA integrity_check').get().integrity_check, 'ok'); } finally { candidate.close(); }
    const result = await restoreBackup(incomplete); assert.equal(result.success, false); assert.match(result.error, /Missing required table: tasks/);
    assert.equal(cached.get().value, 'changed'); assert.equal(fs.readFileSync(attachment, 'utf8'), 'legacy attachment');
  });
  await check('Authenticated multipart ZIP upload restores despite extensionless multer path', async () => {
    const res = await request(app).post('/api/backups/restore').set('Authorization', auth()).attach('backup_file', original.destinationPath);
    assert.equal(res.status, 200, JSON.stringify(res.body)); assert.equal(cached.get().value, 'original');
    assert.ok(res.body.safetyBackup);
    assert.equal(fs.readdirSync(BACKUPS_DIR).some(name => /^[a-f0-9]{32}$/.test(name)), false);
  });
  await check('Anonymous and multi-office API restore requests are denied', async () => {
    assert.equal((await request(app).post('/api/backups/restore').send({ filename: original.backupFileName })).status, 401);
    db.prepare("INSERT INTO tenants(id,slug,name,owner_name,email) VALUES(2,'second','Second','Test','second@invalid.test')").run();
    assert.equal((await request(app).post('/api/backups/restore').set('Authorization', auth()).send({ filename: original.backupFileName })).status, 403);
    db.prepare('DELETE FROM tenants WHERE id=2').run();
  });
  await check('External SQLite reader prevents unsafe replacement and leaves files intact', async () => {
    const reader = new DatabaseSync(DB_PATH);
    reader.exec('BEGIN'); reader.prepare('SELECT value FROM restore_probe').get();
    db.prepare('UPDATE restore_probe SET value=?').run('busy-state');
    fs.writeFileSync(attachment, 'busy attachment');
    try {
      const result = await restoreBackup(original.destinationPath);
      assert.equal(result.success, false); assert.match(result.error, /busy/i);
      assert.equal(cached.get().value, 'busy-state'); assert.equal(fs.readFileSync(attachment, 'utf8'), 'busy attachment');
    } finally { reader.exec('ROLLBACK'); reader.close(); }
  });
  console.log(`Backup restore verification: ${count}/${count} passed. Isolated synthetic files: ${root}`);
} finally {
  db.close();
  if (path.dirname(path.resolve(root)) !== path.resolve(os.tmpdir()) || !path.basename(root).startsWith('office-backup-restore-')) throw new Error('Unsafe test cleanup');
  fs.rmSync(root, { recursive: true, force: true });
}
