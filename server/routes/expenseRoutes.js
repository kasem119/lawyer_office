import express from 'express';
import db from '../database/db.js';
import { authenticateToken } from '../middleware/auth.js';
import { canAccessCase } from '../middleware/permissions.js';

const router = express.Router();
router.use(authenticateToken);

function getTenantId(req) {
  return req.user.tenant_id || 1;
}

// GET /api/expenses
router.get('/', (req, res, next) => {
  try {
    const tenantId = getTenantId(req);
    let sql = `
      SELECT e.*, c.case_number 
      FROM expenses e
      LEFT JOIN cases c ON e.case_id = c.id
      WHERE e.tenant_id = ?
    `;
    let params = [tenantId];
    
    if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
      sql += ` AND e.created_by = ?`;
      params.push(req.user.id);
    }
    
    if (req.query.case_id) {
      sql += ` AND e.case_id = ?`;
      params.push(req.query.case_id);
    }
    
    sql += ` ORDER BY e.date DESC`;
    
    const stmt = db.prepare(sql);
    const expenses = stmt.all(...params);
    
    res.json({ success: true, data: expenses });
  } catch (err) {
    next(err);
  }
});

// POST /api/expenses
router.post('/', (req, res, next) => {
  try {
    const tenantId = getTenantId(req);
    const { case_id, description, amount, category, date } = req.body;
    if (case_id != null && !canAccessCase(req.user, case_id)) return res.status(403).json({ message: 'ليس لديك صلاحية الوصول لهذه القضية' });
    
    const stmt = db.prepare(`
      INSERT INTO expenses (case_id, description, amount, category, date, created_by, tenant_id)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    
    const info = stmt.run(case_id || null, description, amount, category, date, req.user.id, tenantId);
    
    res.json({ success: true, message: 'تم إضافة المصروف بنجاح', data: { id: info.lastInsertRowid } });
  } catch (err) {
    next(err);
  }
});

// PUT /api/expenses/:id
router.put('/:id', (req, res, next) => {
  try {
    const tenantId = getTenantId(req);
    const id = req.params.id;
    const { case_id, description, amount, category, date } = req.body;
    
    const checkStmt = db.prepare('SELECT * FROM expenses WHERE id = ? AND tenant_id = ?');
    const expense = checkStmt.get(id, tenantId);
    
    if (!expense) return res.status(404).json({ success: false, message: 'المصروف غير موجود' });
    
    if (req.user.role !== 'admin' && req.user.role !== 'super_admin' && expense.created_by !== req.user.id) {
      return res.status(403).json({ success: false, message: 'غير مصرح لك' });
    }

    if (case_id != null && !canAccessCase(req.user, case_id)) return res.status(403).json({ message: 'ليس لديك صلاحية الوصول لهذه القضية' });
    
    const stmt = db.prepare(`
      UPDATE expenses SET case_id = ?, description = ?, amount = ?, category = ?, date = ?
      WHERE id = ? AND tenant_id = ?
    `);
    stmt.run(case_id || null, description, amount, category, date, id, tenantId);
    
    res.json({ success: true, message: 'تم تحديث المصروف بنجاح' });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/expenses/:id
router.delete('/:id', (req, res, next) => {
  try {
    const tenantId = getTenantId(req);
    const id = req.params.id;
    
    const checkStmt = db.prepare('SELECT * FROM expenses WHERE id = ? AND tenant_id = ?');
    const expense = checkStmt.get(id, tenantId);
    
    if (!expense) return res.status(404).json({ success: false, message: 'المصروف غير موجود' });
    
    if (req.user.role !== 'admin' && req.user.role !== 'super_admin' && expense.created_by !== req.user.id) {
      return res.status(403).json({ success: false, message: 'غير مصرح لك' });
    }
    
    const stmt = db.prepare('DELETE FROM expenses WHERE id = ? AND tenant_id = ?');
    stmt.run(id, tenantId);
    
    res.json({ success: true, message: 'تم حذف المصروف بنجاح' });
  } catch (err) {
    next(err);
  }
});

export default router;
