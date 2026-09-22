import express from 'express';
import db from '../database/db.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();
router.use(authenticateToken);

// GET /api/expenses
router.get('/', (req, res, next) => {
  try {
    let sql = `
      SELECT e.*, c.case_number 
      FROM expenses e
      LEFT JOIN cases c ON e.case_id = c.id
    `;
    let params = [];
    const conditions = [];
    
    if (req.user.role !== 'admin') {
      conditions.push(`e.created_by = ?`);
      params.push(req.user.id);
    }
    
    if (req.query.case_id) {
      conditions.push(`e.case_id = ?`);
      params.push(req.query.case_id);
    }
    
    if (conditions.length > 0) {
      sql += ` WHERE ` + conditions.join(' AND ');
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
    const { case_id, description, amount, category, date } = req.body;
    
    const stmt = db.prepare(`
      INSERT INTO expenses (case_id, description, amount, category, date, created_by)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    
    const info = stmt.run(case_id || null, description, amount, category, date, req.user.id);
    
    res.json({ success: true, message: 'تم إضافة المصروف بنجاح', data: { id: info.lastInsertRowid } });
  } catch (err) {
    next(err);
  }
});

// PUT /api/expenses/:id
router.put('/:id', (req, res, next) => {
  try {
    const id = req.params.id;
    const { case_id, description, amount, category, date } = req.body;
    
    const checkStmt = db.prepare('SELECT * FROM expenses WHERE id = ?');
    const expense = checkStmt.get(id);
    
    if (!expense) return res.status(404).json({ success: false, message: 'المصروف غير موجود' });
    
    if (req.user.role !== 'admin' && expense.created_by !== req.user.id) {
      return res.status(403).json({ success: false, message: 'غير مصرح لك' });
    }
    
    const stmt = db.prepare(`
      UPDATE expenses SET case_id = ?, description = ?, amount = ?, category = ?, date = ?
      WHERE id = ?
    `);
    stmt.run(case_id || null, description, amount, category, date, id);
    
    res.json({ success: true, message: 'تم تحديث المصروف بنجاح' });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/expenses/:id
router.delete('/:id', (req, res, next) => {
  try {
    const id = req.params.id;
    
    const checkStmt = db.prepare('SELECT * FROM expenses WHERE id = ?');
    const expense = checkStmt.get(id);
    
    if (!expense) return res.status(404).json({ success: false, message: 'المصروف غير موجود' });
    
    if (req.user.role !== 'admin' && expense.created_by !== req.user.id) {
      return res.status(403).json({ success: false, message: 'غير مصرح لك' });
    }
    
    const stmt = db.prepare('DELETE FROM expenses WHERE id = ?');
    stmt.run(id);
    
    res.json({ success: true, message: 'تم حذف المصروف بنجاح' });
  } catch (err) {
    next(err);
  }
});

export default router;
