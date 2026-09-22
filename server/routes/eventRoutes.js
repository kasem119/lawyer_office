import express from 'express';
import db from '../database/db.js';
import { authenticateToken } from '../middleware/auth.js';
import { validateEvent } from '../middleware/validator.js';

const router = express.Router();
router.use(authenticateToken);

// GET /api/events - List calendar events
router.get('/', (req, res, next) => {
  try {
    let events;
    if (req.user.role === 'admin') {
      events = db.prepare(`
        SELECT e.*, c.case_number, c.title as case_title, u.name as lawyer_name
        FROM events e
        LEFT JOIN cases c ON e.case_id = c.id
        JOIN users u ON e.user_id = u.id
        ORDER BY e.date ASC, e.time ASC
      `).all();
    } else {
      events = db.prepare(`
        SELECT e.*, c.case_number, c.title as case_title, u.name as lawyer_name
        FROM events e
        LEFT JOIN cases c ON e.case_id = c.id
        JOIN users u ON e.user_id = u.id
        LEFT JOIN case_lawyers cl ON cl.case_id = c.id
        WHERE e.user_id = ? OR c.lead_lawyer_id = ? OR cl.user_id = ?
        ORDER BY e.date ASC, e.time ASC
      `).all(req.user.id, req.user.id, req.user.id);
    }
    res.json({ success: true, events });
  } catch (err) {
    next(err);
  }
});

// POST /api/events - Create new event / court date
router.post('/', validateEvent, (req, res, next) => {
  try {
    const { title, description, event_type = 'court_date', date, time, end_time, location, case_id, reminder_minutes = 60 } = req.body;

    const stmt = db.prepare(`
      INSERT INTO events (title, description, event_type, date, time, end_time, location, case_id, user_id, reminder_minutes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(title, description, event_type, date, time, end_time, location, case_id, req.user.id, reminder_minutes);
    const eventId = result.lastInsertRowid;

    // Audit log
    db.prepare(`
      INSERT INTO activity_log (user_id, action, entity_type, details_json)
      VALUES (?, ?, ?, ?)
    `).run(req.user.id, 'CREATE_EVENT', 'event', JSON.stringify({ eventId, title, date }));

    res.status(201).json({ success: true, message: 'تم إضافة الموعد إلى التقويم بنجاح', eventId });
  } catch (err) {
    next(err);
  }
});

// PUT /api/events/:id - Update event
router.put('/:id', validateEvent, (req, res, next) => {
  try {
    const { title, description, event_type, date, time, end_time, location, case_id, reminder_minutes } = req.body;
    const eventId = req.params.id;

    // Check permissions: Admin or event creator
    const existing = db.prepare('SELECT * FROM events WHERE id = ?').get(eventId);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'الموعد غير موجود' });
    }

    if (req.user.role !== 'admin' && existing.user_id !== req.user.id) {
      return res.status(403).json({ success: false, message: 'ليس لديك صلاحية تعديل هذا الموعد' });
    }

    db.prepare(`
      UPDATE events
      SET title = ?, description = ?, event_type = ?, date = ?, time = ?, end_time = ?, location = ?, case_id = ?, reminder_minutes = ?
      WHERE id = ?
    `).run(
      title,
      description !== undefined ? description : existing.description,
      event_type || existing.event_type,
      date || existing.date,
      time !== undefined ? time : existing.time,
      end_time !== undefined ? end_time : existing.end_time,
      location !== undefined ? location : existing.location,
      case_id !== undefined ? case_id : existing.case_id,
      reminder_minutes !== undefined ? reminder_minutes : existing.reminder_minutes,
      eventId
    );

    // Audit log
    db.prepare(`
      INSERT INTO activity_log (user_id, action, entity_type, entity_id, details_json)
      VALUES (?, ?, ?, ?, ?)
    `).run(req.user.id, 'UPDATE_EVENT', 'event', eventId, JSON.stringify({ eventId, title, date }));

    res.json({ success: true, message: 'تم تحديث بيانات الموعد بنجاح' });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/events/:id - Delete event
router.delete('/:id', (req, res, next) => {
  try {
    const eventId = req.params.id;
    const existing = db.prepare('SELECT * FROM events WHERE id = ?').get(eventId);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'الموعد غير موجود' });
    }

    if (req.user.role !== 'admin' && existing.user_id !== req.user.id) {
      return res.status(403).json({ success: false, message: 'ليس لديك صلاحية حذف هذا الموعد' });
    }

    db.prepare('DELETE FROM events WHERE id = ?').run(eventId);

    // Audit log
    db.prepare(`
      INSERT INTO activity_log (user_id, action, entity_type, entity_id, details_json)
      VALUES (?, ?, ?, ?, ?)
    `).run(req.user.id, 'DELETE_EVENT', 'event', eventId, JSON.stringify({ eventId, title: existing.title }));

    res.json({ success: true, message: 'تم حذف الموعد من التقويم بنجاح' });
  } catch (err) {
    next(err);
  }
});

export default router;
