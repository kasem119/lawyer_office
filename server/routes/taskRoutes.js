import express from 'express';
import db from '../database/db.js';
import { authenticateToken } from '../middleware/auth.js';
import { createNotification } from '../services/notificationService.js';
import { validateTask } from '../middleware/validator.js';
import { canChangeTaskStatus } from '../middleware/permissions.js';

const router = express.Router();
router.use(authenticateToken);

// GET /api/tasks - List tasks
router.get('/', (req, res, next) => {
  try {
    let tasks;
    if (req.user.role === 'admin') {
      tasks = db.prepare(`
        SELECT t.*, u.name as assigned_to_name, u2.name as created_by_name, c.title as case_title, c.case_number
        FROM tasks t
        JOIN users u ON t.assigned_to = u.id
        JOIN users u2 ON t.created_by = u2.id
        LEFT JOIN cases c ON t.case_id = c.id
        ORDER BY t.id DESC
      `).all();
    } else {
      tasks = db.prepare(`
        SELECT DISTINCT t.*, u.name as assigned_to_name, u2.name as created_by_name, c.title as case_title, c.case_number
        FROM tasks t
        JOIN users u ON t.assigned_to = u.id
        JOIN users u2 ON t.created_by = u2.id
        LEFT JOIN cases c ON t.case_id = c.id
        LEFT JOIN case_lawyers cl ON cl.case_id = c.id
        WHERE t.assigned_to = ? OR t.created_by = ? OR c.lead_lawyer_id = ? OR cl.user_id = ?
        ORDER BY t.id DESC
      `).all(req.user.id, req.user.id, req.user.id, req.user.id);
    }
    res.json({ success: true, tasks });
  } catch (err) {
    next(err);
  }
});

// POST /api/tasks - Create task
router.post('/', validateTask, (req, res, next) => {
  try {
    const { title, description, priority = 'medium', due_date, case_id, assigned_to } = req.body;

    const stmt = db.prepare(`
      INSERT INTO tasks (title, description, priority, due_date, case_id, assigned_to, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(title, description, priority, due_date, case_id, assigned_to, req.user.id);
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
      INSERT INTO activity_log (user_id, action, entity_type, details_json)
      VALUES (?, ?, ?, ?)
    `).run(req.user.id, 'CREATE_TASK', 'task', JSON.stringify({ taskId, title, assigned_to }));

    res.status(201).json({ success: true, message: 'تم إضافة المهمة بنجاح', taskId });
  } catch (err) {
    next(err);
  }
});

// PUT /api/tasks/:id/status - Update task status (for Kanban drag & drop)
router.put('/:id/status', (req, res, next) => {
  try {
    const { status } = req.body;
    if (!['todo', 'in_progress', 'review', 'done'].includes(status)) {
      return res.status(400).json({ message: 'حالة المهمة غير صالحة' });
    }

    const existing = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
    if (!existing) {
      return res.status(404).json({ message: 'المهمة غير موجودة' });
    }

    if (!canChangeTaskStatus(req.user, existing)) {
      return res.status(403).json({ message: 'ليس لديك صلاحية تغيير حالة هذه المهمة' });
    }

    db.prepare('UPDATE tasks SET status = ? WHERE id = ?').run(status, req.params.id);
    res.json({ success: true, message: 'تم تحديث حالة المهمة' });
  } catch (err) {
    next(err);
  }
});

// PUT /api/tasks/:id - Edit task
router.put('/:id', validateTask, (req, res, next) => {
  try {
    const taskId = req.params.id;
    const { title, description, priority = 'medium', due_date, case_id, assigned_to } = req.body;

    const existing = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'المهمة غير موجودة' });
    }

    if (req.user.role !== 'admin' && existing.created_by !== req.user.id && existing.assigned_to !== req.user.id) {
      return res.status(403).json({ success: false, message: 'ليس لديك صلاحية تعديل هذه المهمة' });
    }

    db.prepare(`
      UPDATE tasks
      SET title = ?, description = ?, priority = ?, due_date = ?, case_id = ?, assigned_to = ?
      WHERE id = ?
    `).run(
      title,
      description !== undefined ? description : existing.description,
      priority || existing.priority,
      due_date !== undefined ? due_date : existing.due_date,
      case_id !== undefined ? case_id : existing.case_id,
      assigned_to || existing.assigned_to,
      taskId
    );

    // Audit log
    db.prepare(`
      INSERT INTO activity_log (user_id, action, entity_type, entity_id, details_json)
      VALUES (?, ?, ?, ?, ?)
    `).run(req.user.id, 'UPDATE_TASK', 'task', taskId, JSON.stringify({ taskId, title }));

    res.json({ success: true, message: 'تم تحديث بيانات المهمة بنجاح' });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/tasks/:id - Delete task
router.delete('/:id', (req, res, next) => {
  try {
    const taskId = req.params.id;
    const existing = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'المهمة غير موجودة' });
    }

    if (req.user.role !== 'admin' && existing.created_by !== req.user.id) {
      return res.status(403).json({ success: false, message: 'ليس لديك صلاحية حذف هذه المهمة' });
    }

    db.prepare('DELETE FROM tasks WHERE id = ?').run(taskId);

    // Audit log
    db.prepare(`
      INSERT INTO activity_log (user_id, action, entity_type, entity_id, details_json)
      VALUES (?, ?, ?, ?, ?)
    `).run(req.user.id, 'DELETE_TASK', 'task', taskId, JSON.stringify({ taskId, title: existing.title }));

    res.json({ success: true, message: 'تم حذف المهمة بنجاح' });
  } catch (err) {
    next(err);
  }
});

export default router;
