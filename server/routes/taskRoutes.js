import express from 'express';
import db from '../database/db.js';
import { authenticateToken } from '../middleware/auth.js';
import { createNotification } from '../services/notificationService.js';
import { validateTask } from '../middleware/validator.js';
import { canChangeTaskStatus } from '../middleware/permissions.js';

const router = express.Router();
router.use(authenticateToken);

function getTenantId(req) {
  return req.user.tenant_id || 1;
}

// GET /api/tasks - List tasks
router.get('/', (req, res, next) => {
  try {
    const tenantId = getTenantId(req);
    let tasks;
    if (req.user.role === 'admin' || req.user.role === 'super_admin') {
      tasks = db.prepare(`
        SELECT t.*, u.name as assigned_to_name, u2.name as created_by_name, c.title as case_title, c.case_number
        FROM tasks t
        JOIN users u ON t.assigned_to = u.id
        JOIN users u2 ON t.created_by = u2.id
        LEFT JOIN cases c ON t.case_id = c.id
        WHERE t.tenant_id = ?
        ORDER BY t.id DESC
      `).all(tenantId);
    } else {
      tasks = db.prepare(`
        SELECT DISTINCT t.*, u.name as assigned_to_name, u2.name as created_by_name, c.title as case_title, c.case_number
        FROM tasks t
        JOIN users u ON t.assigned_to = u.id
        JOIN users u2 ON t.created_by = u2.id
        LEFT JOIN cases c ON t.case_id = c.id
        LEFT JOIN case_lawyers cl ON cl.case_id = c.id
        WHERE t.tenant_id = ? AND (t.assigned_to = ? OR t.created_by = ? OR c.lead_lawyer_id = ? OR cl.user_id = ?)
        ORDER BY t.id DESC
      `).all(tenantId, req.user.id, req.user.id, req.user.id, req.user.id);
    }
    res.json({ success: true, tasks });
  } catch (err) {
    next(err);
  }
});

// POST /api/tasks - Create task
router.post('/', validateTask, (req, res, next) => {
  try {
    const tenantId = getTenantId(req);
    const { title, description, priority = 'medium', due_date, case_id, assigned_to } = req.body;

    const stmt = db.prepare(`
      INSERT INTO tasks (title, description, priority, due_date, case_id, assigned_to, created_by, tenant_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(title, description, priority, due_date, case_id, assigned_to, req.user.id, tenantId);
    const taskId = result.lastInsertRowid;

    if (assigned_to !== req.user.id) {
      createNotification({
        userId: assigned_to,
        title: 'تعيين مهمة جديدة',
        message: `تم تكليفك بمهمة جديدة: ${title}`,
        type: 'info',
        relatedEntityType: 'task',
        relatedEntityId: taskId
      });
    }

    // Audit log
    db.prepare(`
      INSERT INTO activity_log (user_id, action, entity_type, details_json, tenant_id)
      VALUES (?, ?, ?, ?, ?)
    `).run(req.user.id, 'CREATE_TASK', 'task', JSON.stringify({ taskId, title, assigned_to }), tenantId);

    res.status(201).json({ success: true, message: 'تم إضافة المهمة بنجاح', taskId });
  } catch (err) {
    next(err);
  }
});

// PUT /api/tasks/:id/status - Update task status (for Kanban drag & drop)
router.put('/:id/status', (req, res, next) => {
  try {
    const tenantId = getTenantId(req);
    const { status } = req.body;
    if (!['todo', 'in_progress', 'review', 'done'].includes(status)) {
      return res.status(400).json({ message: 'حالة المهمة غير صالحة' });
    }

    const existing = db.prepare('SELECT * FROM tasks WHERE id = ? AND tenant_id = ?').get(req.params.id, tenantId);
    if (!existing) {
      return res.status(404).json({ message: 'المهمة غير موجودة' });
    }

    if (!canChangeTaskStatus(req.user, existing)) {
      return res.status(403).json({ message: 'ليس لديك صلاحية تغيير حالة هذه المهمة' });
    }

    db.prepare('UPDATE tasks SET status = ? WHERE id = ? AND tenant_id = ?').run(status, req.params.id, tenantId);
    res.json({ success: true, message: 'تم تحديث حالة المهمة' });
  } catch (err) {
    next(err);
  }
});

// PUT /api/tasks/:id - Edit task
router.put('/:id', validateTask, (req, res, next) => {
  try {
    const tenantId = getTenantId(req);
    const taskId = req.params.id;
    const { title, description, priority = 'medium', due_date, case_id, assigned_to } = req.body;

    const existing = db.prepare('SELECT * FROM tasks WHERE id = ? AND tenant_id = ?').get(taskId, tenantId);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'المهمة غير موجودة' });
    }

    if (req.user.role !== 'admin' && req.user.role !== 'super_admin' && existing.created_by !== req.user.id && existing.assigned_to !== req.user.id) {
      return res.status(403).json({ success: false, message: 'ليس لديك صلاحية تعديل هذه المهمة' });
    }

    db.prepare(`
      UPDATE tasks
      SET title = ?, description = ?, priority = ?, due_date = ?, case_id = ?, assigned_to = ?
      WHERE id = ? AND tenant_id = ?
    `).run(
      title,
      description !== undefined ? description : existing.description,
      priority || existing.priority,
      due_date !== undefined ? due_date : existing.due_date,
      case_id !== undefined ? case_id : existing.case_id,
      assigned_to || existing.assigned_to,
      taskId,
      tenantId
    );

    // Audit log
    db.prepare(`
      INSERT INTO activity_log (user_id, action, entity_type, entity_id, details_json, tenant_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(req.user.id, 'UPDATE_TASK', 'task', taskId, JSON.stringify({ taskId, title }), tenantId);

    res.json({ success: true, message: 'تم تحديث بيانات المهمة بنجاح' });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/tasks/:id - Delete task
router.delete('/:id', (req, res, next) => {
  try {
    const tenantId = getTenantId(req);
    const taskId = req.params.id;
    const existing = db.prepare('SELECT * FROM tasks WHERE id = ? AND tenant_id = ?').get(taskId, tenantId);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'المهمة غير موجودة' });
    }

    if (req.user.role !== 'admin' && req.user.role !== 'super_admin' && existing.created_by !== req.user.id) {
      return res.status(403).json({ success: false, message: 'ليس لديك صلاحية حذف هذه المهمة' });
    }

    db.prepare('DELETE FROM tasks WHERE id = ? AND tenant_id = ?').run(taskId, tenantId);

    // Audit log
    db.prepare(`
      INSERT INTO activity_log (user_id, action, entity_type, entity_id, details_json, tenant_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(req.user.id, 'DELETE_TASK', 'task', taskId, JSON.stringify({ taskId, title: existing.title }), tenantId);

    res.json({ success: true, message: 'تم حذف المهمة بنجاح' });
  } catch (err) {
    next(err);
  }
});

// POST /api/tasks/:id/remind - Send instant manual reminder for a task
router.post('/:id/remind', (req, res, next) => {
  try {
    const tenantId = getTenantId(req);
    const taskId = req.params.id;
    const task = db.prepare(`
      SELECT t.*, u.name as assigned_to_name, c.title as case_title, c.case_number
      FROM tasks t
      JOIN users u ON t.assigned_to = u.id
      LEFT JOIN cases c ON t.case_id = c.id
      WHERE t.id = ? AND t.tenant_id = ?
    `).get(taskId, tenantId);

    if (!task) {
      return res.status(404).json({ success: false, message: 'المهمة غير موجودة' });
    }

    if (task.status === 'done') {
      return res.status(400).json({ success: false, message: 'هذه المهمة مكتملة بالفعل' });
    }

    const caseStr = task.case_title ? ` (قضية: ${task.case_title})` : '';
    const dueStr = task.due_date ? `، تاريخ الاستحقاق: ${task.due_date}` : '';

    createNotification({
      userId: task.assigned_to,
      title: '📋 تذكير عاجل بإنجاز مهمة',
      message: `تذكير من ${req.user.name}: يرجى متابعة وإنجاز المهمة "${task.title}"${caseStr}${dueStr}`,
      type: task.priority === 'urgent' ? 'urgent' : 'warning',
      relatedEntityType: 'task',
      relatedEntityId: task.id
    });

    res.json({
      success: true,
      message: `تم إرسال تذكير فوري إلى المحامي ${task.assigned_to_name} بنجاح`
    });
  } catch (err) {
    next(err);
  }
});

export default router;
