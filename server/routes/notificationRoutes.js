import express from 'express';
import db from '../database/db.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();
router.use(authenticateToken);

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
