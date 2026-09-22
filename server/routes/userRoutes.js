import express from 'express';
import bcrypt from 'bcryptjs';
import db from '../database/db.js';
import { authenticateToken } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/permissions.js';

const router = express.Router();
router.use(authenticateToken);

// GET /api/users - List lawyers
router.get('/', requireAdmin, (req, res, next) => {
  try {
    const users = db.prepare('SELECT id, name, email, role, phone, is_active, created_at FROM users ORDER BY id DESC').all();
    res.json({ success: true, users });
  } catch (err) {
    next(err);
  }
});

// POST /api/users - Create lawyer (Admin only)
router.post('/', requireAdmin, (req, res, next) => {
  try {
    const { name, email, password, role = 'lawyer', phone } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'الاسم، البريد الإلكتروني، وكلمة المرور مطلوبة' });
    }
    if (password.length < 12) {
      return res.status(400).json({ message: 'كلمة المرور يجب أن لا تقل عن 12 خانة' });
    }
    if (!['admin', 'lawyer'].includes(role)) {
      return res.status(400).json({ message: 'دور المستخدم غير صالح' });
    }

    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existing) {
      return res.status(400).json({ message: 'البريد الإلكتروني مسجل بالفعل لمستخدم آخر' });
    }

    const passwordHash = bcrypt.hashSync(password, 10);
    const stmt = db.prepare(`
      INSERT INTO users (name, email, password_hash, role, phone)
      VALUES (?, ?, ?, ?, ?)
    `);
    const result = stmt.run(name, email, passwordHash, role, phone);

    res.status(201).json({
      success: true,
      message: 'تم إضافة المحامي بنجاح',
      userId: result.lastInsertRowid
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/users/profile - Get current authenticated user profile
router.get('/profile', (req, res, next) => {
  try {
    const user = db.prepare('SELECT id, name, email, role, phone, created_at FROM users WHERE id = ?').get(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'المستخدم غير موجود' });
    }
    res.json({ success: true, user });
  } catch (err) {
    next(err);
  }
});

// PUT /api/users/profile - Update current user profile info
router.put('/profile', (req, res, next) => {
  try {
    const { name, phone } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'الاسم مطلوب' });
    }

    db.prepare('UPDATE users SET name = ?, phone = ? WHERE id = ?').run(name.trim(), phone || null, req.user.id);

    // Audit log
    db.prepare(`
      INSERT INTO activity_log (user_id, action, entity_type, entity_id, details_json)
      VALUES (?, ?, ?, ?, ?)
    `).run(req.user.id, 'UPDATE_PROFILE', 'user', req.user.id, JSON.stringify({ name }));

    const updated = db.prepare('SELECT id, name, email, role, phone FROM users WHERE id = ?').get(req.user.id);
    res.json({ success: true, message: 'تم تحديث الملف الشخصي بنجاح', user: updated });
  } catch (err) {
    next(err);
  }
});

// PUT /api/users/change-password - Change current user password
router.put('/change-password', (req, res, next) => {
  try {
    const { current_password, new_password } = req.body;
    if (!current_password || !new_password) {
      return res.status(400).json({ success: false, message: 'كلمة المرور الحالية والجديدة مطلوبتان' });
    }

    if (new_password.length < 8) {
      return res.status(400).json({ success: false, message: 'كلمة المرور الجديدة يجب ألا تقل عن 8 خانات' });
    }

    const user = db.prepare('SELECT id, password_hash FROM users WHERE id = ?').get(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'المستخدم غير موجود' });
    }

    const isMatch = bcrypt.compareSync(current_password, user.password_hash);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: 'كلمة المرور الحالية غير صحيحة' });
    }

    const newHash = bcrypt.hashSync(new_password, 10);
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(newHash, req.user.id);

    // Audit log
    db.prepare(`
      INSERT INTO activity_log (user_id, action, entity_type, entity_id, details_json)
      VALUES (?, ?, ?, ?, ?)
    `).run(req.user.id, 'CHANGE_PASSWORD', 'user', req.user.id, JSON.stringify({ message: 'Password changed' }));

    res.json({ success: true, message: 'تم تغيير كلمة المرور بنجاح' });
  } catch (err) {
    next(err);
  }
});

// PUT /api/users/:id - Update lawyer (Admin only)
router.put('/:id', requireAdmin, (req, res, next) => {
  try {
    const { name, email, role, phone, is_active, password } = req.body;
    const userId = req.params.id;
    const targetUser = db.prepare('SELECT id, role, is_active FROM users WHERE id = ?').get(userId);
    if (!targetUser) {
      return res.status(404).json({ message: 'المستخدم غير موجود' });
    }
    if (!['admin', 'lawyer'].includes(role)) {
      return res.status(400).json({ message: 'دور المستخدم غير صالح' });
    }
    if (password && password.length < 12) {
      return res.status(400).json({ message: 'كلمة المرور يجب أن لا تقل عن 12 خانة' });
    }
    if (Number(userId) === Number(req.user.id) && (role !== 'admin' || !is_active)) {
      return res.status(400).json({ message: 'لا يمكنك خفض صلاحيتك أو تعطيل حساب المدير الذي تستخدمه حالياً' });
    }
    const removesActiveAdmin = targetUser.role === 'admin' && targetUser.is_active === 1 && (role !== 'admin' || !is_active);
    if (removesActiveAdmin) {
      const activeAdminCount = db.prepare("SELECT COUNT(*) AS count FROM users WHERE role = 'admin' AND is_active = 1").get().count;
      if (activeAdminCount <= 1) {
        return res.status(400).json({ message: 'لا يمكن تعطيل أو خفض صلاحية آخر مدير نظام مفعّل' });
      }
    }

    let query = 'UPDATE users SET name = ?, email = ?, role = ?, phone = ?, is_active = ?';
    const params = [name, email, role, phone, is_active ? 1 : 0];

    if (password) {
      query += ', password_hash = ?';
      params.push(bcrypt.hashSync(password, 10));
    }

    query += ' WHERE id = ?';
    params.push(userId);

    db.prepare(query).run(...params);
    res.json({ success: true, message: 'تم تحديث بيانات المحامي بنجاح' });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/users/:id - permanently delete user account (Admin only)
router.delete('/:id', requireAdmin, (req, res, next) => {
  try {
    const userId = Number(req.params.id);
    const adminId = Number(req.user.id);

    if (userId === adminId) {
      return res.status(400).json({ message: 'لا يمكنك حذف الحساب الذي تستخدمه حالياً' });
    }

    const user = db.prepare('SELECT id, name, role, is_active FROM users WHERE id = ?').get(userId);
    if (!user) return res.status(404).json({ message: 'المستخدم غير موجود' });

    if (user.role === 'admin' && user.is_active === 1) {
      const activeAdminCount = db.prepare("SELECT COUNT(*) AS count FROM users WHERE role = 'admin' AND is_active = 1").get().count;
      if (activeAdminCount <= 1) {
        return res.status(400).json({ message: 'لا يمكن حذف آخر مدير نظام مفعّل' });
      }
    }

    // Check if the lawyer has actual assigned work:
    // - Lead lawyer on cases
    const leadCasesCount = db.prepare('SELECT COUNT(*) AS count FROM cases WHERE lead_lawyer_id = ?').get(userId).count;
    // - Assigned to cases
    const assignedCasesCount = db.prepare('SELECT COUNT(*) AS count FROM case_lawyers WHERE user_id = ?').get(userId).count;
    // - Has assigned pending/active tasks
    const activeTasksCount = db.prepare("SELECT COUNT(*) AS count FROM tasks WHERE assigned_to = ? AND status != 'done'").get(userId).count;
    // - Has scheduled events/hearings
    const eventsCount = db.prepare('SELECT COUNT(*) AS count FROM events WHERE user_id = ?').get(userId).count;

    const blockingItems = [];
    if (leadCasesCount > 0) blockingItems.push(`${leadCasesCount} قضية رئيسية`);
    if (assignedCasesCount > 0) blockingItems.push(`${assignedCasesCount} قضية مسندة`);
    if (activeTasksCount > 0) blockingItems.push(`${activeTasksCount} مهمة نشطة`);
    if (eventsCount > 0) blockingItems.push(`${eventsCount} جلسة/موعد`);

    // If lawyer has anything assigned to him, strictly PREVENT deletion!
    if (blockingItems.length > 0) {
      return res.status(400).json({
        message: `لا يمكن حذف المحامي (${user.name}) لوجود قضايا أو مهام مسندة إليه: ${blockingItems.join('، ')}. يرجى حذفها أو إسنادها لمحامٍ آخر أولاً.`
      });
    }

    // Only if the lawyer has NOTHING assigned to him, proceed with clean deletion:
    db.prepare('DELETE FROM notifications WHERE user_id = ?').run(userId);
    db.prepare('DELETE FROM case_lawyers WHERE user_id = ?').run(userId);
    db.prepare('DELETE FROM document_shares WHERE shared_with_user_id = ? OR shared_by_user_id = ?').run(userId, userId);
    db.prepare('UPDATE tasks SET created_by = ? WHERE created_by = ?').run(adminId, userId);
    db.prepare('UPDATE tasks SET assigned_to = NULL WHERE assigned_to = ?').run(userId);
    db.prepare('UPDATE activity_log SET user_id = ? WHERE user_id = ?').run(adminId, userId);
    db.prepare('UPDATE clients SET created_by = ? WHERE created_by = ?').run(adminId, userId);
    db.prepare('UPDATE documents SET uploaded_by = ? WHERE uploaded_by = ?').run(adminId, userId);
    db.prepare('UPDATE document_versions SET uploaded_by = ? WHERE uploaded_by = ?').run(adminId, userId);
    db.prepare('UPDATE case_notes SET created_by = ? WHERE created_by = ?').run(adminId, userId);
    db.prepare('UPDATE invoices SET created_by = ? WHERE created_by = ?').run(adminId, userId);
    db.prepare('UPDATE expenses SET created_by = ? WHERE created_by = ?').run(adminId, userId);
    db.prepare('DELETE FROM time_entries WHERE user_id = ?').run(userId);
    db.prepare('UPDATE document_templates SET created_by = ? WHERE created_by = ?').run(adminId, userId);

    // Delete the user permanently
    db.prepare('DELETE FROM users WHERE id = ?').run(userId);

    res.json({ success: true, message: `تم حذف حساب المحامي ${user.name} بنجاح` });
  } catch (err) {
    next(err);
  }
});

export default router;
