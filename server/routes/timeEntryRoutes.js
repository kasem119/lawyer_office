import express from 'express';
import db from '../database/db.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();
router.use(authenticateToken);

function getTenantId(req) {
  return req.user.tenant_id || 1;
}

// GET /api/time-entries
router.get('/', (req, res, next) => {
  try {
    const tenantId = getTenantId(req);
    let sql = `
      SELECT t.*, c.case_number, c.title as case_title, u.name as lawyer_name
      FROM time_entries t
      LEFT JOIN cases c ON t.case_id = c.id
      LEFT JOIN users u ON t.user_id = u.id
      WHERE t.tenant_id = ?
    `;
    let params = [tenantId];
    
    if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
      sql += ` AND t.user_id = ?`;
      params.push(req.user.id);
    }
    
    if (req.query.case_id) {
      sql += ` AND t.case_id = ?`;
      params.push(req.query.case_id);
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
    const tenantId = getTenantId(req);
    const { case_id, description, duration_minutes, date, billable } = req.body;
    
    const stmt = db.prepare(`
      INSERT INTO time_entries (case_id, user_id, description, duration_minutes, date, billable, tenant_id)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    
    const info = stmt.run(case_id, req.user.id, description, duration_minutes, date, billable ? 1 : 0, tenantId);
    
    res.json({ success: true, message: 'تم إضافة قيد الوقت بنجاح', data: { id: info.lastInsertRowid } });
  } catch (err) {
    next(err);
  }
});

// PUT /api/time-entries/:id
router.put('/:id', (req, res, next) => {
  try {
    const tenantId = getTenantId(req);
    const id = req.params.id;
    const { case_id, description, duration_minutes, date, billable } = req.body;
    
    const checkStmt = db.prepare('SELECT * FROM time_entries WHERE id = ? AND tenant_id = ?');
    const entry = checkStmt.get(id, tenantId);
    
    if (!entry) return res.status(404).json({ success: false, message: 'المدخل غير موجود' });
    
    if (entry.user_id !== req.user.id && req.user.role !== 'admin' && req.user.role !== 'super_admin') {
      return res.status(403).json({ success: false, message: 'غير مصرح لك' });
    }
    
    const stmt = db.prepare(`
      UPDATE time_entries SET case_id = ?, description = ?, duration_minutes = ?, date = ?, billable = ?
      WHERE id = ? AND tenant_id = ?
    `);
    stmt.run(case_id, description, duration_minutes, date, billable ? 1 : 0, id, tenantId);
    
    res.json({ success: true, message: 'تم تحديث قيد الوقت بنجاح' });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/time-entries/:id
router.delete('/:id', (req, res, next) => {
  try {
    const tenantId = getTenantId(req);
    const id = req.params.id;
    
    const checkStmt = db.prepare('SELECT * FROM time_entries WHERE id = ? AND tenant_id = ?');
    const entry = checkStmt.get(id, tenantId);
    
    if (!entry) return res.status(404).json({ success: false, message: 'المدخل غير موجود' });
    
    if (req.user.role !== 'admin' && req.user.role !== 'super_admin' && entry.user_id !== req.user.id) {
      return res.status(403).json({ success: false, message: 'غير مصرح لك' });
    }
    
    const stmt = db.prepare('DELETE FROM time_entries WHERE id = ? AND tenant_id = ?');
    stmt.run(id, tenantId);
    
    res.json({ success: true, message: 'تم حذف قيد الوقت بنجاح' });
  } catch (err) {
    next(err);
  }
});

// GET /api/time-entries/summary/:caseId
router.get('/summary/:caseId', (req, res, next) => {
  try {
    const tenantId = getTenantId(req);
    const caseId = req.params.caseId;
    
    const stmt = db.prepare(`
      SELECT 
        SUM(CASE WHEN billable = 1 THEN duration_minutes ELSE 0 END) as billable_minutes,
        SUM(CASE WHEN billable = 0 THEN duration_minutes ELSE 0 END) as non_billable_minutes
      FROM time_entries
      WHERE case_id = ? AND tenant_id = ?
    `);
    
    const result = stmt.get(caseId, tenantId);
    
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
