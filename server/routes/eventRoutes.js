import express from 'express';
import db from '../database/db.js';
import { authenticateToken } from '../middleware/auth.js';
import { validateEvent } from '../middleware/validator.js';
import { createNotification } from '../services/notificationService.js';
import { getEventRecipients } from '../services/reminderCron.js';

const router = express.Router();
router.use(authenticateToken);

function getTenantId(req) {
  return req.user.tenant_id || 1;
}

// GET /api/events - List calendar events
router.get('/', (req, res, next) => {
  try {
    const tenantId = getTenantId(req);
    let events;
    if (req.user.role === 'admin' || req.user.role === 'super_admin') {
      events = db.prepare(`
        SELECT e.*, c.case_number, c.title as case_title, u.name as lawyer_name
        FROM events e
        LEFT JOIN cases c ON e.case_id = c.id
        JOIN users u ON e.user_id = u.id
        WHERE e.tenant_id = ?
        ORDER BY e.date ASC, e.time ASC
      `).all(tenantId);
    } else {
      events = db.prepare(`
        SELECT e.*, c.case_number, c.title as case_title, u.name as lawyer_name
        FROM events e
        LEFT JOIN cases c ON e.case_id = c.id
        JOIN users u ON e.user_id = u.id
        LEFT JOIN case_lawyers cl ON cl.case_id = c.id
        WHERE e.tenant_id = ? AND (e.user_id = ? OR c.lead_lawyer_id = ? OR cl.user_id = ?)
        ORDER BY e.date ASC, e.time ASC
      `).all(tenantId, req.user.id, req.user.id, req.user.id);
    }
    res.json({ success: true, events });
  } catch (err) {
    next(err);
  }
});

// POST /api/events - Create new event / court date
router.post('/', validateEvent, (req, res, next) => {
  try {
    const tenantId = getTenantId(req);
    const { title, description, event_type = 'court_date', date, time, end_time, location, case_id, reminder_minutes = 60 } = req.body;

    const stmt = db.prepare(`
      INSERT INTO events (title, description, event_type, date, time, end_time, location, case_id, user_id, reminder_minutes, tenant_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(title, description, event_type, date, time, end_time, location, case_id, req.user.id, reminder_minutes, tenantId);
    const eventId = result.lastInsertRowid;

    // Notify assigned lawyers if linked to a case
    const recipients = getEventRecipients(eventId);
    const isCourt = event_type === 'court_date';
    recipients.forEach(userId => {
      if (userId !== req.user.id) {
        createNotification({
          userId,
          title: isCourt ? '⚖️ جلسة محكمة جديدة' : '📅 موعد جديد في التقويم',
          message: `أضاف ${req.user.name} ${isCourt ? 'جلسة محكمة' : 'موعداً'}: "${title}" بتاريخ ${date}${time ? ` الساعة ${time}` : ''}${location ? ` في ${location}` : ''}`,
          type: isCourt ? 'urgent' : 'info',
          relatedEntityType: 'event',
          relatedEntityId: eventId
        });
      }
    });

    // Audit log
    db.prepare(`
      INSERT INTO activity_log (user_id, action, entity_type, details_json, tenant_id)
      VALUES (?, ?, ?, ?, ?)
    `).run(req.user.id, 'CREATE_EVENT', 'event', JSON.stringify({ eventId, title, date }), tenantId);

    res.status(201).json({ success: true, message: 'تم إضافة الموعد إلى التقويم بنجاح', eventId });
  } catch (err) {
    next(err);
  }
});

// PUT /api/events/:id - Update event
router.put('/:id', validateEvent, (req, res, next) => {
  try {
    const tenantId = getTenantId(req);
    const { title, description, event_type, date, time, end_time, location, case_id, reminder_minutes } = req.body;
    const eventId = req.params.id;

    // Check permissions: Admin or event creator within tenant
    const existing = db.prepare('SELECT * FROM events WHERE id = ? AND tenant_id = ?').get(eventId, tenantId);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'الموعد غير موجود' });
    }

    if (req.user.role !== 'admin' && req.user.role !== 'super_admin' && existing.user_id !== req.user.id) {
      return res.status(403).json({ success: false, message: 'ليس لديك صلاحية تعديل هذا الموعد' });
    }

    db.prepare(`
      UPDATE events
      SET title = ?, description = ?, event_type = ?, date = ?, time = ?, end_time = ?, location = ?, case_id = ?, reminder_minutes = ?
      WHERE id = ? AND tenant_id = ?
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
      eventId,
      tenantId
    );

    // Audit log
    db.prepare(`
      INSERT INTO activity_log (user_id, action, entity_type, entity_id, details_json, tenant_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(req.user.id, 'UPDATE_EVENT', 'event', eventId, JSON.stringify({ eventId, title, date }), tenantId);

    res.json({ success: true, message: 'تم تحديث بيانات الموعد بنجاح' });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/events/:id - Delete event
router.delete('/:id', (req, res, next) => {
  try {
    const tenantId = getTenantId(req);
    const eventId = req.params.id;
    const existing = db.prepare('SELECT * FROM events WHERE id = ? AND tenant_id = ?').get(eventId, tenantId);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'الموعد غير موجود' });
    }

    if (req.user.role !== 'admin' && req.user.role !== 'super_admin' && existing.user_id !== req.user.id) {
      return res.status(403).json({ success: false, message: 'ليس لديك صلاحية حذف هذا الموعد' });
    }

    db.prepare('DELETE FROM events WHERE id = ? AND tenant_id = ?').run(eventId, tenantId);

    // Audit log
    db.prepare(`
      INSERT INTO activity_log (user_id, action, entity_type, entity_id, details_json, tenant_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(req.user.id, 'DELETE_EVENT', 'event', eventId, JSON.stringify({ eventId, title: existing.title }), tenantId);

    res.json({ success: true, message: 'تم حذف الموعد من التقويم بنجاح' });
  } catch (err) {
    next(err);
  }
});

// POST /api/events/:id/remind - Send instant manual reminder to lawyers
router.post('/:id/remind', (req, res, next) => {
  try {
    const tenantId = getTenantId(req);
    const eventId = req.params.id;
    const event = db.prepare(`
      SELECT e.*, c.title as case_title, c.case_number
      FROM events e
      LEFT JOIN cases c ON e.case_id = c.id
      WHERE e.id = ? AND e.tenant_id = ?
    `).get(eventId, tenantId);

    if (!event) {
      return res.status(404).json({ success: false, message: 'الموعد غير موجود' });
    }

    const recipients = getEventRecipients(eventId);
    if (recipients.length === 0) {
      return res.status(400).json({ success: false, message: 'لا يوجد محامين مرتبطين بهذا الموعد' });
    }

    const isCourt = event.event_type === 'court_date';
    const timeStr = event.time ? ` الساعة ${event.time}` : '';
    const locStr = event.location ? ` في ${event.location}` : '';
    const caseStr = event.case_title ? ` [قضية: ${event.case_title}]` : '';

    let sentCount = 0;
    recipients.forEach(userId => {
      createNotification({
        userId,
        title: isCourt ? '⚖️ تذكير فوري بجلسة المحكمة' : '🔔 تذكير فوري بموعد',
        message: `تذكير عاجل من ${req.user.name}: موعد ${isCourt ? 'جلسة المحكمة' : 'الموعد'} "${event.title}"${caseStr} بتاريخ ${event.date}${timeStr}${locStr}`,
        type: isCourt ? 'urgent' : 'warning',
        relatedEntityType: 'event',
        relatedEntityId: event.id
      });
      sentCount++;
    });

    res.json({ 
      success: true, 
      message: `تم إرسال التنبيه الفوري بنجاح إلى ${sentCount} محامي` 
    });
  } catch (err) {
    next(err);
  }
});

export default router;
