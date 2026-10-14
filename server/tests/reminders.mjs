import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import cron from 'node-cron';
import { formatLibyaTime, parseUtcTimestamp } from '../../client/src/utils/dateTime.js';
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'office-reminders-'));
Object.assign(process.env, { NODE_ENV: 'test', DB_PATH: ':memory:', UPLOADS_DIR: path.join(root, 'uploads'), BACKUPS_DIR: path.join(root, 'backups') });
const { default: db } = await import('../database/db.js');
const { checkRemindersNow, initReminderCron } = await import('../services/reminderCron.js');
try {
  assert.equal(parseUtcTimestamp('2026-10-14 18:10:00').toISOString(), '2026-10-14T18:10:00.000Z');
  assert.equal(formatLibyaTime('2026-10-14 18:10:00'), formatLibyaTime('2026-10-14T18:10:00Z'));
  assert.equal(formatLibyaTime('2026-10-14T20:10:00+02:00'), formatLibyaTime('2026-10-14 18:10:00'));
  const digits = formatLibyaTime('2026-10-14 18:10:00').replace(/[٠-٩]/g, digit => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)));
  assert.match(digits, /08:10|8:10/); assert.equal(formatLibyaTime(null), '—');
  db.prepare("INSERT INTO tenants(id,slug,name,owner_name,email,plan,status) VALUES(991,'reminders','Test','Test','reminders@test.invalid','professional','active')").run();
  db.prepare("INSERT INTO users(id,name,email,password_hash,role,tenant_id) VALUES(991,'Test','reminder@test.invalid','unused','lawyer',991)").run();
  db.prepare("INSERT INTO events(id,title,event_type,date,time,user_id,tenant_id) VALUES(991,'جلسة اختبار','court_date','2026-10-14','09:00',991,991)").run();
  db.prepare("INSERT INTO tasks(id,title,due_date,assigned_to,created_by,tenant_id) VALUES(991,'Test','2026-10-14',991,991,991)").run();
  const rows = () => db.prepare('SELECT * FROM notifications WHERE user_id=991').all();
  checkRemindersNow(new Date('2026-10-13T22:00:00Z')); assert.equal(rows().length, 0);
  checkRemindersNow(new Date('2026-10-14T05:59:00Z')); assert.equal(rows().length, 0);
  checkRemindersNow(new Date('2026-10-14T06:00:00Z')); assert.equal(rows().length, 2);
  assert.ok(rows().every(n => n.title.startsWith('☀️')));
  checkRemindersNow(new Date('2026-10-14T06:00:00Z')); assert.equal(rows().length, 2);
  checkRemindersNow(new Date('2026-10-14T16:00:00Z')); assert.equal(rows().length, 4);
  checkRemindersNow(new Date('2026-10-14T16:00:00Z')); assert.equal(rows().length, 4);
  assert.equal(rows().filter(n => n.title.startsWith('🌙')).length, 2);
  checkRemindersNow(new Date('2026-10-14T22:00:00Z')); assert.equal(rows().length, 4);
  checkRemindersNow(new Date('2026-10-15T06:00:00Z')); assert.equal(rows().length, 5); // overdue task only
  const schedule = cron.schedule;
  try {
    let called;
    cron.schedule = (...args) => { called = args; return 'scheduled'; };
    process.env.NODE_ENV = 'production';
    assert.equal(initReminderCron(), 'scheduled');
    assert.equal(called[0], '0 8,18 * * *'); assert.equal(called[2].timezone, 'Africa/Tripoli');
  } finally { cron.schedule = schedule; process.env.NODE_ENV = 'test'; }
  console.log('PASS UTC/ISO/offset display is Libya 8:10; invalid timestamp handled.');
  console.log('PASS no midnight reminders; morning + evening; repeat/restart deduplication; Libya day rollover; explicit cron timezone.');
} finally {
  db.close();
  if (path.dirname(path.resolve(root)) === path.resolve(os.tmpdir()) && path.basename(root).startsWith('office-reminders-')) fs.rmSync(root, { recursive: true, force: true });
}
