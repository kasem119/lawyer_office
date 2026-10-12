import express from 'express';
import db from '../database/db.js';
import { authenticateToken } from '../middleware/auth.js';
import { requireOfficeAccount } from '../middleware/permissions.js';
import { getPushKeys, validSubscription, sendPushToUser } from '../services/pushService.js';

const router = express.Router();
router.use(authenticateToken);
router.use(requireOfficeAccount);

router.get('/push/public-key', (req, res, next) => {
  try { res.json({ publicKey: getPushKeys().publicKey }); } catch (err) { next(err); }
});

router.post('/push/subscribe', (req, res, next) => {
  try {
    const subscription = req.body.subscription;
    if (!validSubscription(subscription)) return res.status(400).json({ message: 'اشتراك الإشعارات غير صالح' });
    const existing = db.prepare('SELECT user_id FROM push_subscriptions WHERE endpoint=?').get(subscription.endpoint);
    if (existing && existing.user_id !== req.user.id) return res.status(409).json({ message: 'أوقف إشعارات الحساب السابق على هذا الجهاز أولاً' });
    const count = db.prepare('SELECT COUNT(*) AS n FROM push_subscriptions WHERE user_id=?').get(req.user.id).n;
    if (!existing && count >= 20) return res.status(400).json({ message: 'تم الوصول للحد الأقصى للأجهزة' });
    const safe = { endpoint: subscription.endpoint, keys: subscription.keys };
    db.prepare(`INSERT INTO push_subscriptions(endpoint,user_id,subscription) VALUES(?,?,?)
      ON CONFLICT(endpoint) DO UPDATE SET subscription=excluded.subscription`).run(safe.endpoint, req.user.id, JSON.stringify(safe));
    res.json({ success: true });
  } catch (err) { next(err); }
});

router.post('/push/unsubscribe', (req, res, next) => {
  try {
    if (typeof req.body.endpoint !== 'string') return res.status(400).json({ message: 'اشتراك غير صالح' });
    db.prepare('DELETE FROM push_subscriptions WHERE endpoint=? AND user_id=?').run(req.body.endpoint, req.user.id);
    res.json({ success: true });
  } catch (err) { next(err); }
});

router.post('/push/test', async (req, res, next) => {
  try {
    const result = await sendPushToUser(req.user.id, { id: 'test', title: 'اختبار الإشعارات', message: 'تم تفعيل إشعارات مكتب المحاماة على هذا الجهاز' });
    if (!result.sent) return res.status(503).json({ message: 'تعذر إرسال الاختبار؛ أعد تفعيل إشعارات الجهاز وتحقق من اتصال الخادم بالإنترنت' });
    res.json({ success: true, sent: result.sent });
  } catch (err) { next(err); }
});

// GET /api/notifications - List user notifications
router.get('/', (req, res, next) => {
  try {
    const notifications = db.prepare(`
      SELECT * FROM notifications
      WHERE user_id = ?
      ORDER BY id DESC LIMIT 50
    `).all(req.user.id);
    res.json({ success: true, notifications });
  } catch (err) {
    next(err);
  }
});

// PUT /api/notifications/:id/read - Mark notification as read
router.put('/:id/read', (req, res, next) => {
  try {
    db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
    res.json({ success: true, message: 'تم التعيين كـ مقروء' });
  } catch (err) {
    next(err);
  }
});

// PUT /api/notifications/read-all - Mark all as read
router.put('/read-all', (req, res, next) => {
  try {
    db.prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ?').run(req.user.id);
    res.json({ success: true, message: 'تم تعيين الكل كـ مقروء' });
  } catch (err) {
    next(err);
  }
});

export default router;
