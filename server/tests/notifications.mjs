import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import request from 'supertest';
import webpush from 'web-push';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'office-notifications-'));
Object.assign(process.env, { NODE_ENV: 'test', DB_PATH: ':memory:', UPLOADS_DIR: path.join(root, 'uploads'), BACKUPS_DIR: path.join(root, 'backups') });
const { default: app } = await import('../index.js');
const { default: db } = await import('../database/db.js');
const { generateTokens } = await import('../middleware/auth.js');
const { getPushKeys, sendPushToUser } = await import('../services/pushService.js');
const { createNotification } = await import('../services/notificationService.js');
assert.equal((await import('../config.js')).DB_PATH, ':memory:');
let passed = 0;
async function check(name, fn) { await fn(); passed++; console.log(`PASS ${name}`); }
const originalSend = webpush.sendNotification;
const deliveries = [];
webpush.sendNotification = async (subscription, payload, options) => {
  deliveries.push({ subscription, payload: JSON.parse(payload), options });
};
try {
  for (const [id, role] of [[901, 'lawyer'], [902, 'admin'], [903, 'super_admin']]) {
    db.prepare('INSERT INTO users(id,name,email,password_hash,role,tenant_id) VALUES(?,?,?,?,?,1)').run(id, `Test ${id}`, `${id}@test.invalid`, 'unused', role);
  }
  const token = id => generateTokens(db.prepare('SELECT * FROM users WHERE id=?').get(id)).accessToken;
  const call = (id, method, route, body) => request(app)[method](`/api/notifications${route}`).set('Authorization', `Bearer ${token(id)}`).send(body);
  const subscription = n => ({ endpoint: `https://fcm.googleapis.com/fcm/send/test-${n}`, keys: { p256dh: Buffer.concat([Buffer.from([4]), Buffer.alloc(64, n)]).toString('base64url'), auth: Buffer.alloc(16, n).toString('base64url') } });

  await check('Stable VAPID identity and no private key in public API', async () => {
    assert.deepEqual(getPushKeys(), getPushKeys());
    const res = await call(901, 'get', '/push/public-key');
    assert.equal(res.status, 200);
    assert.deepEqual(Object.keys(res.body), ['publicKey']);
    assert.equal(res.body.publicKey, getPushKeys().publicKey);
  });
  await check('Real Web Push encryption produces an authenticated encrypted request', async () => {
    const recipientKeys = webpush.generateVAPIDKeys();
    const details = webpush.generateRequestDetails({ endpoint: 'https://fcm.googleapis.com/fcm/send/encryption-test',
      keys: { p256dh: recipientKeys.publicKey, auth: Buffer.alloc(16, 7).toString('base64url') } }, 'Test notification',
    { vapidDetails: { ...getPushKeys(), subject: 'https://office.test' } });
    assert.equal(details.headers['Content-Encoding'], 'aes128gcm');
    assert.ok(details.headers.Authorization.startsWith('vapid '));
    assert.ok(Buffer.isBuffer(details.body));
    assert.ok(!details.body.includes(Buffer.from('Test notification')));
  });
  await check('Unauthenticated users and platform owner cannot register push', async () => {
    assert.equal((await request(app).post('/api/notifications/push/subscribe').send({ subscription: subscription(1) })).status, 401);
    assert.equal((await call(903, 'post', '/push/subscribe', { subscription: subscription(1) })).status, 403);
  });
  await check('Multiple devices, idempotent registration, ownership isolation', async () => {
    for (const n of [1, 1, 2]) assert.equal((await call(901, 'post', '/push/subscribe', { subscription: subscription(n) })).status, 200);
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM push_subscriptions WHERE user_id=901').get().n, 2);
    assert.equal((await call(902, 'post', '/push/subscribe', { subscription: subscription(1) })).status, 409);
    await call(902, 'post', '/push/unsubscribe', { endpoint: subscription(1).endpoint });
    assert.equal(db.prepare('SELECT user_id FROM push_subscriptions WHERE endpoint=?').get(subscription(1).endpoint).user_id, 901);
  });
  await check('Reject internal URLs, spoofed provider hosts and malformed keys', async () => {
    for (const endpoint of ['http://127.0.0.1/internal', 'https://localhost/internal', 'https://fcm.googleapis.com.attacker.test/x', 'https://user:pass@fcm.googleapis.com/x', 'https://fcm.googleapis.com:8443/x']) {
      assert.equal((await call(901, 'post', '/push/subscribe', { subscription: { ...subscription(1), endpoint } })).status, 400);
    }
    assert.equal((await call(901, 'post', '/push/subscribe', { subscription: { ...subscription(1), keys: { auth: 'x', p256dh: 'x' } } })).status, 400);
  });
  await check('Creating a notification delivers to all recipient devices only', async () => {
    await call(902, 'post', '/push/subscribe', { subscription: subscription(3) });
    deliveries.length = 0;
    createNotification({ userId: 901, title: 'Assigned task', message: 'New task' });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(deliveries.length, 2);
    assert.ok(deliveries.every(item => item.payload.userId === 901 && item.payload.body === 'New task'));
    assert.equal(deliveries[0].options.vapidDetails.publicKey, getPushKeys().publicKey);
  });
  await check('Revoked users receive no push', async () => {
    deliveries.length = 0;
    db.prepare('UPDATE users SET is_active=0 WHERE id=901').run();
    await sendPushToUser(901, { id: 1, title: 'Test', message: 'Test' });
    assert.equal(deliveries.length, 0);
    db.prepare('UPDATE users SET is_active=1 WHERE id=901').run();
  });
  await check('Expired subscriptions are removed; temporary failures retain them', async () => {
    webpush.sendNotification = async sub => { throw Object.assign(new Error('Delivery error'), { statusCode: sub.endpoint.endsWith('1') ? 410 : 503 }); };
    await sendPushToUser(901, { id: 1, title: 'Test', message: 'Test' });
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM push_subscriptions WHERE user_id=901').get().n, 1);
    webpush.sendNotification = async (sub, payload) => { deliveries.push({ subscription: sub, payload: JSON.parse(payload) }); };
  });
  await check('Test alert routes to the signed-in user and unsubscribe stops delivery', async () => {
    deliveries.length = 0;
    assert.equal((await call(901, 'post', '/push/test', {})).status, 200);
    assert.equal(deliveries.length, 1);
    assert.equal(deliveries[0].payload.userId, 901);
    await call(901, 'post', '/push/unsubscribe', { endpoint: subscription(2).endpoint });
    deliveries.length = 0;
    await sendPushToUser(901, { id: 2, title: 'Test', message: 'Test' });
    assert.equal(deliveries.length, 0);
    assert.equal((await call(901, 'post', '/push/test', {})).status, 503);
  });
  await check('Service worker displays push, tolerates malformed payload, safely focuses/opens app', async () => {
    const handlers = {}, shown = [], opened = [], messages = [];
    let windows = [];
    const self = {
      addEventListener: (name, handler) => { handlers[name] = handler; },
      registration: { showNotification: async (title, options) => { shown.push({ title, options }); } },
      location: { origin: 'https://office.test' },
      clients: { matchAll: async () => windows, openWindow: async url => opened.push(url) }
    };
    vm.runInNewContext(fs.readFileSync(new URL('../../client/public/sw.js', import.meta.url), 'utf8'), { self, URL });
    let pending;
    const waitUntil = promise => { pending = promise; };
    windows = [{ url: 'https://office.test/', postMessage: data => messages.push(data), focus: async () => { messages.push('focused'); } }];
    handlers.push({ data: { json: () => ({ title: 'Hearing', body: 'Tomorrow', tag: 'notification-7', url: 'https://attacker.test', userId: 901 }) }, waitUntil });
    await pending;
    assert.equal(shown[0].options.data.url, '/');
    assert.equal(shown[0].title, 'Hearing');
    handlers.push({ data: { json: () => { throw new Error('malformed'); } }, waitUntil });
    await pending;
    assert.ok(shown[1].title);
    handlers.notificationclick({ notification: { close() {} }, waitUntil });
    await pending;
    assert.ok(messages.includes('focused'));
    windows = [];
    handlers.notificationclick({ notification: { close() {} }, waitUntil });
    await pending;
    assert.deepEqual(opened, ['/']);
  });
  await check('Device setup needs a tap, restores only its account and cleans up on logout', async () => {
    const calls = [], store = new Map();
    let permission = 'default', unsubscribed = false;
    const subscription = { endpoint: 'https://fcm.googleapis.com/fcm/send/device', toJSON: () => ({ endpoint: 'device', keys: {} }), unsubscribe: async () => { unsubscribed = true; return true; } };
    const registration = { pushManager: { getSubscription: async () => subscription }, getNotifications: async () => [] };
    const navigator = { userAgent: 'Android', platform: 'Linux', serviceWorker: { register: async () => calls.push('register'), ready: Promise.resolve(registration), getRegistration: async () => registration } };
    const window = { location: { origin: 'https://office.test' }, isSecureContext: true, matchMedia: () => ({ matches: false }), Notification: {}, PushManager: {} };
    const context = vm.createContext({
      window, navigator, URL, Uint8Array, atob,
      Notification: { get permission() { return permission; }, requestPermission: async () => { calls.push('permission'); permission = 'granted'; return permission; } },
      localStorage: { getItem: key => store.get(key), setItem: (key, value) => store.set(key, value), removeItem: key => store.delete(key) },
      apiFetch: async (route, options) => { calls.push(route); return { ok: true, json: async () => ({ publicKey: webpush.generateVAPIDKeys().publicKey }) }; }
    });
    const code = fs.readFileSync(new URL('../../client/src/utils/deviceNotifications.js', import.meta.url), 'utf8').replace(/^import .*;\r?\n/m, '').replace(/export /g, '');
    vm.runInContext(code, context);
    assert.equal(vm.runInContext('deviceNotificationSupport()', context), 'push');
    assert.equal(await vm.runInContext('restoreDeviceNotifications(901)', context), false);
    await vm.runInContext('enableDeviceNotifications(901)', context);
    assert.equal(calls[0], 'permission');
    assert.equal(await vm.runInContext('restoreDeviceNotifications(902)', context), false);
    assert.equal(await vm.runInContext('restoreDeviceNotifications(901)', context), true);
    await vm.runInContext('disableDeviceNotifications()', context);
    assert.ok(unsubscribed);
    assert.ok(calls.includes('/notifications/push/unsubscribe'));
    assert.equal(store.size, 0);
    navigator.userAgent = 'iPhone';
    assert.equal(vm.runInContext('deviceNotificationSupport()', context), 'install');
    window.matchMedia = () => ({ matches: true });
    assert.equal(vm.runInContext('deviceNotificationSupport()', context), 'push');
    window.isSecureContext = false;
    navigator.userAgent = 'Android';
    assert.equal(vm.runInContext('deviceNotificationSupport()', context), 'https');
    window.electronAPI = { showNotification: async () => ({ success: true }) };
    assert.equal(vm.runInContext('deviceNotificationSupport()', context), 'native');
  });
  await check('Windows native bridge validates sender and restores minimized window on click', async () => {
    const handlers = {}, emitted = [];
    let appId, clicked, restored = false, focused = false;
    const win = { isDestroyed: () => false, isMinimized: () => true, restore: () => { restored = true; }, show() {}, focus: () => { focused = true; } };
    class Notification {
      static isSupported() { return true; }
      constructor(payload) { emitted.push(payload); }
      on(event, callback) { if (event === 'click') clicked = callback; }
      show() {}
    }
    const source = fs.readFileSync(new URL('../../client/electron/main.js', import.meta.url), 'utf8')
      .replace(/^import .*;\r?\n/gm, '').replace(/^const __filename = .*;\r?\n/m, '').replace(/^const __dirname = .*;\r?\n/m, '');
    vm.runInNewContext(source, { URL, Notification, path: { join: (...parts) => parts.join('/') }, __dirname: 'C:/app/electron', ipcMain: { handle: (name, handler) => { handlers[name] = handler; } },
      app: { setAppUserModelId: id => { appId = id; }, whenReady: () => ({ then() {} }), on() {} },
      BrowserWindow: { fromWebContents: () => win }, process: { platform: 'win32' } });
    assert.equal(appId, 'com.lawyeroffice.desktop');
    const frame = { url: 'file:///C:/app/index.html' };
    const event = { sender: { mainFrame: frame }, senderFrame: frame };
    assert.equal(handlers['show-notification'](event, { title: 'Test', body: 'Hello' }).success, true);
    clicked();
    assert.ok(restored && focused);
    assert.equal(handlers['show-notification']({ ...event, senderFrame: { url: 'https://attacker.test' } }, { title: 'Test', body: 'Hello' }).success, false);
    frame.url = 'https://attacker.test';
    assert.equal(handlers['show-notification'](event, { title: 'Test', body: 'Hello' }).success, false);
    assert.equal(emitted.length, 1);
  });
  console.log(`${passed} notification checks passed`);
} catch (err) {
  console.error(err);
  process.exitCode = 1;
} finally {
  webpush.sendNotification = originalSend;
  fs.rmSync(root, { recursive: true, force: true });
}
// The imported application rate limiter owns a timer.
process.exit(process.exitCode || 0);
