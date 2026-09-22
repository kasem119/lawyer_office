import express from 'express';
import db from '../database/db.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();
router.use(authenticateToken);

// GET /api/time-entries
router.get('/', (req, res, next) => {
  try {
    let sql = `
      SELECT t.*, c.case_number, c.title as case_title, u.name as lawyer_name
      FROM time_entries t
      LEFT JOIN cases c ON t.case_id = c.id
      LEFT JOIN users u ON t.user_id = u.id
    `;
    let params = [];
    const conditions = [];
    
    if (req.user.role !== 'admin') {
      conditions.push(`t.user_id = ?`);
      params.push(req.user.id);
    }
    
    if (req.query.case_id) {
      conditions.push(`t.case_id = ?`);
      params.push(req.query.case_id);
    }
    
    if (conditions.length > 0) {
      sql += ` WHERE ` + conditions.join(' AND ');
    }
    
    sql += ` ORDER BY t.date DESC`;
    
    const stmt = db.prepare(sql);
    const entries = stmt.all(...params);
    
    res.json({ success: true, data: entries });
  } catch (err) {
    next(err);
  }
});

// POST /api/time-entries
router.post('/', (req, res, next) => {
  try {
    const { case_id, description, duration_minutes, date, billable } = req.body;
    
    const stmt = db.prepare(`
      INSERT INTO time_entries (case_id, user_id, description, duration_minutes, date, billable)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    
    const info = stmt.run(case_id, req.user.id, description, duration_minutes, date, billable ? 1 : 0);
    
    res.json({ success: true, message: 'تم إضافة قيد الوقت بنجاح', data: { id: info.lastInsertRowid } });
  } catch (err) {
    next(err);
  }
});

// PUT /api/time-entries/:id
router.put('/:id', (req, res, next) => {
  try {
    const id = req.params.id;
    const { case_id, description, duration_minutes, date, billable } = req.body;
    
    const checkStmt = db.prepare('SELECT * FROM time_entries WHERE id = ?');
    const entry = checkStmt.get(id);
    
    if (!entry) return res.status(404).json({ success: false, message: 'المدخل غير موجود' });
    
    if (entry.user_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'غير مصرح لك' });
    }
    
    const stmt = db.prepare(`
      UPDATE time_entries SET case_id = ?, description = ?, duration_minutes = ?, date = ?, billable = ?
      WHERE id = ?
    `);
    stmt.run(case_id, description, duration_minutes, date, billable ? 1 : 0, id);
    
    res.json({ success: true, message: 'تم تحديث قيد الوقت بنجاح' });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/time-entries/:id
router.delete('/:id', (req, res, next) => {
  try {
    const id = req.params.id;
    
    const checkStmt = db.prepare('SELECT * FROM time_entries WHERE id = ?');
    const entry = checkStmt.get(id);
    
    if (!entry) return res.status(404).json({ success: false, message: 'المدخل غير موجود' });
    
    if (req.user.role !== 'admin' && entry.user_id !== req.user.id) {
      return res.status(403).json({ success: false, message: 'غير مصرح لك' });
    }
    
    const stmt = db.prepare('DELETE FROM time_entries WHERE id = ?');
    stmt.run(id);
    
    res.json({ success: true, message: 'تم حذف قيد الوقت بنجاح' });
  } catch (err) {
    next(err);
  }
});

// GET /api/time-entries/summary/:caseId
router.get('/summary/:caseId', (req, res, next) => {
  try {
    const caseId = req.params.caseId;
    
    const stmt = db.prepare(`
      SELECT 
        SUM(CASE WHEN billable = 1 THEN duration_minutes ELSE 0 END) as billable_minutes,
        SUM(CASE WHEN billable = 0 THEN duration_minutes ELSE 0 END) as non_billable_minutes
      FROM time_entries
      WHERE case_id = ?
    `);
    
    const result = stmt.get(caseId);
    
    res.json({ 
      success: true, 
      data: {
        billable_hours: (result.billable_minutes || 0) / 60,
        non_billable_hours: (result.non_billable_minutes || 0) / 60
      }
    });
  } catch (err) {
    next(err);
  }
});

export default router;
