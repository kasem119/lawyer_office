import webpush from 'web-push';
import db from '../database/db.js';
import { officeAccessError } from '../domain/subscriptions/accessPolicy.js';

// Keep one identity across restarts. The private key never leaves the server.
export function getPushKeys() {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (publicKey || privateKey) {
    if (!publicKey || !privateKey) throw new Error('Both VAPID keys must be configured');
    return { publicKey, privateKey };
  }
  let keys = db.prepare('SELECT public_key, private_key FROM push_config WHERE id = 1').get();
  if (!keys) {
    const generated = webpush.generateVAPIDKeys();
    db.prepare('INSERT OR IGNORE INTO push_config(id,public_key,private_key) VALUES(1,?,?)')
      .run(generated.publicKey, generated.privateKey);
    keys = db.prepare('SELECT public_key, private_key FROM push_config WHERE id = 1').get();
  }
  return { publicKey: keys.public_key, privateKey: keys.private_key };
}

export function validSubscription(subscription) {
  try {
    if (typeof subscription?.endpoint !== 'string' || subscription.endpoint.length > 2048) return false;
    const url = new URL(subscription.endpoint);
    const host = url.hostname;
    // Browser push providers only: do not let a subscription target internal URLs.
    const trusted = host === 'fcm.googleapis.com' || host === 'updates.push.services.mozilla.com'
      || host === 'web.push.apple.com' || host.endsWith('.push.apple.com')
      || host.endsWith('.notify.windows.com');
    if (!trusted || url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443')) return false;
    const { p256dh, auth } = subscription.keys || {};
    return typeof p256dh === 'string' && /^[A-Za-z0-9_-]+={0,2}$/.test(p256dh)
      && Buffer.from(p256dh, 'base64url').length === 65
      && typeof auth === 'string' && /^[A-Za-z0-9_-]+={0,2}$/.test(auth)
      && Buffer.from(auth, 'base64url').length === 16;
  } catch { return false; }
}

export async function sendPushToUser(userId, notification) {
  const user = db.prepare(`SELECT u.id,u.tenant_id,u.role FROM users u JOIN tenants t ON t.id=u.tenant_id
    WHERE u.id=? AND u.is_active=1 AND u.role IN ('admin','lawyer')
    AND t.is_active=1 AND t.status!='suspended'`).get(userId);
  if (!user) return { sent: 0, failed: 0 };
  if (officeAccessError(db.prepare('SELECT * FROM tenants WHERE id=?').get(user.tenant_id), user.role)) return { sent: 0, failed: 0 };
  const subscriptions = db.prepare('SELECT endpoint,subscription FROM push_subscriptions WHERE user_id=?').all(userId);
  if (!subscriptions.length) return { sent: 0, failed: 0 };
  const keys = getPushKeys();
  const payload = JSON.stringify({
    title: notification.title.slice(0, 150), body: notification.message.slice(0, 500),
    tag: `notification-${notification.id}`, url: '/', userId
  });
  const results = await Promise.all(subscriptions.map(async row => {
    try {
      const subscription = JSON.parse(row.subscription);
      if (!validSubscription(subscription)) return false;
      await webpush.sendNotification(subscription, payload, {
        vapidDetails: { ...keys, subject: process.env.VAPID_SUBJECT || 'https://lawyer-office.example' },
        TTL: 3600, timeout: 10000, urgency: 'normal'
      });
      return true;
    } catch (err) {
      if (err.statusCode === 404 || err.statusCode === 410) {
        db.prepare('DELETE FROM push_subscriptions WHERE endpoint=? AND user_id=?').run(row.endpoint, userId);
      } else {
        console.warn('Push delivery failed:', err.statusCode || err.code || 'network error');
      }
      return false;
    }
  }));
  return { sent: results.filter(Boolean).length, failed: results.filter(result => !result).length };
}
