import express from 'express';
import db from '../database/db.js';
import { authenticateToken } from '../middleware/auth.js';
import { checkConflict } from '../services/conflictService.js';
import { createNotification } from '../services/notificationService.js';
import { validateCase } from '../middleware/validator.js';
import { canManageCase } from '../middleware/permissions.js';

const router = express.Router();
router.use(authenticateToken);

// GET /api/cases - List cases (Admin sees all; lawyer sees lead/assigned cases)
router.get('/', (req, res, next) => {
  try {
    let cases;
    if (req.user.role === 'admin') {
      cases = db.prepare(`
        SELECT c.*, cl.name as client_name, u.name as lead_lawyer_name
        FROM cases c
        JOIN clients cl ON c.client_id = cl.id
        JOIN users u ON c.lead_lawyer_id = u.id
        ORDER BY c.id DESC
      `).all();
    } else {
      cases = db.prepare(`
        SELECT DISTINCT c.*, cl.name as client_name, u.name as lead_lawyer_name
        FROM cases c
        JOIN clients cl ON c.client_id = cl.id
        JOIN users u ON c.lead_lawyer_id = u.id
        LEFT JOIN case_lawyers claw ON claw.case_id = c.id
        WHERE c.lead_lawyer_id = ? OR claw.user_id = ?
        ORDER BY c.id DESC
      `).all(req.user.id, req.user.id);
    }

    res.json({ success: true, cases });
  } catch (err) {
    next(err);
  }
});

// GET /api/cases/:id - Single case details, assigned lawyers, documents, events, tasks
router.get('/:id', (req, res, next) => {
  try {
    const caseItem = db.prepare(`
      SELECT c.*, cl.name as client_name, cl.phone as client_phone, u.name as lead_lawyer_name
      FROM cases c
      JOIN clients cl ON c.client_id = cl.id
      JOIN users u ON c.lead_lawyer_id = u.id
      WHERE c.id = ?
    `).get(req.params.id);

    if (!caseItem) return res.status(404).json({ message: 'القضية غير موجودة' });

    // Check lawyer access
    if (req.user.role !== 'admin') {
      const isAssigned = db.prepare(`
        SELECT 1 FROM case_lawyers WHERE case_id = ? AND user_id = ?
        UNION SELECT 1 FROM cases WHERE id = ? AND lead_lawyer_id = ?
      `).get(req.params.id, req.user.id, req.params.id, req.user.id);

      if (!isAssigned) {
        return res.status(403).json({ message: 'عفواً، ليس لديك صلاحية عرض هذه القضية' });
      }
    }

    // Assigned lawyers
    const assignedLawyers = db.prepare(`
      SELECT u.id, u.name, u.email, u.phone, cl.role_in_case
      FROM case_lawyers cl
      JOIN users u ON cl.user_id = u.id
      WHERE cl.case_id = ?
    `).all(req.params.id);

    // Case documents
    const documents = db.prepare(`
      SELECT d.*, u.name as uploader_name
      FROM documents d
      JOIN users u ON d.uploaded_by = u.id
      WHERE d.case_id = ?
      ORDER BY d.id DESC
    `).all(req.params.id);

    // Case events
    const events = db.prepare(`
      SELECT * FROM events WHERE case_id = ? ORDER BY date ASC, time ASC
    `).all(req.params.id);

    // Case tasks (visible to assigned lawyers)
    const tasks = db.prepare(`
      SELECT t.*, u.name as assigned_to_name, u2.name as created_by_name
      FROM tasks t
      JOIN users u ON t.assigned_to = u.id
      JOIN users u2 ON t.created_by = u2.id
      WHERE t.case_id = ?
      ORDER BY t.id DESC
    `).all(req.params.id);

    res.json({
      success: true,
      case: caseItem,
      assignedLawyers,
      documents,
      events,
      tasks
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/cases - Create new case
router.post('/', validateCase, (req, res, next) => {
  try {
    const {
      case_number, title, description, court_name, case_type, priority = 'medium',
      client_id, lead_lawyer_id, assigned_lawyer_ids = [], force,
      opponent_name, opponent_id_number, opponent_lawyer, opponent_phone
    } = req.body;

    // Check conflict (title + opponent)
    if (!force) {
      const conflictCheck = checkConflict({
        title,
        opponentName: opponent_name,
        opponentId: opponent_id_number
      });
      if (conflictCheck.hasConflict) {
        return res.status(409).json({
          success: false,
          isConflict: true,
          conflicts: conflictCheck.conflicts,
          message: conflictCheck.hasCriticalConflict
            ? 'تحذير تعارض مصالح حرج: الخصم أو رقمه يطابق عميلاً مسجلاً بالمكتب!'
            : 'تنبيه تعارض مصالح / قضايا مشابهة بالعنوان'
        });
      }
    }

    const leadId = lead_lawyer_id || req.user.id;
    const stmt = db.prepare(`
      INSERT INTO cases (
        case_number, title, description, court_name, case_type, priority,
        client_id, lead_lawyer_id, opponent_name, opponent_id_number, opponent_lawyer, opponent_phone
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      case_number, title, description, court_name, case_type, priority,
      client_id, leadId, opponent_name || null, opponent_id_number || null, opponent_lawyer || null, opponent_phone || null
    );
    const caseId = result.lastInsertRowid;

    // Link lead lawyer
    db.prepare('INSERT OR IGNORE INTO case_lawyers (case_id, user_id, role_in_case) VALUES (?, ?, ?)').run(caseId, leadId, 'lead');

    // Link additional lawyers
    const insertLawyer = db.prepare('INSERT OR IGNORE INTO case_lawyers (case_id, user_id, role_in_case) VALUES (?, ?, ?)');
    for (const lawyerId of assigned_lawyer_ids) {
      insertLawyer.run(caseId, lawyerId, 'assigned');
      // Notify assigned lawyer
      createNotification({
        userId: lawyerId,
        title: 'تحديد قضايا جديدة',
        message: `تم إسنادك لقضية جديدة: ${title} (${case_number})`,
        type: 'info',
        relatedEntityType: 'case',
        relatedEntityId: caseId
      });
    }

    // Audit log
    db.prepare(`
      INSERT INTO activity_log (user_id, action, entity_type, details_json)
      VALUES (?, ?, ?, ?)
    `).run(req.user.id, 'CREATE_CASE', 'case', JSON.stringify({ caseId, title, case_number, opponent_name }));

    res.status(201).json({ success: true, message: 'تم إنشاء القضية بنجاح', caseId });
  } catch (err) {
    next(err);
  }
});

// PUT /api/cases/:id - Update case
router.put('/:id', (req, res, next) => {
  try {
    const {
      case_number, title, description, court_name, case_type, status, priority,
      client_id, lead_lawyer_id, opponent_name, opponent_id_number, opponent_lawyer, opponent_phone
    } = req.body;
    
    // Check permission: Admin or Lead lawyer
    if (req.user.role !== 'admin') {
      const existing = db.prepare('SELECT lead_lawyer_id FROM cases WHERE id = ?').get(req.params.id);
      if (!existing || existing.lead_lawyer_id !== req.user.id) {
        return res.status(403).json({ message: 'ليس لديك صلاحية تعديل هذه القضية' });
      }
    }

    db.prepare(`
      UPDATE cases
      SET case_number = COALESCE(?, case_number),
          title = COALESCE(?, title),
          description = COALESCE(?, description),
          court_name = COALESCE(?, court_name),
          case_type = COALESCE(?, case_type),
          status = COALESCE(?, status),
          priority = COALESCE(?, priority),
          client_id = COALESCE(?, client_id),
          lead_lawyer_id = COALESCE(?, lead_lawyer_id),
          opponent_name = COALESCE(?, opponent_name),
          opponent_id_number = COALESCE(?, opponent_id_number),
          opponent_lawyer = COALESCE(?, opponent_lawyer),
          opponent_phone = COALESCE(?, opponent_phone)
      WHERE id = ?
    `).run(
      case_number, title, description, court_name, case_type, status, priority,
      client_id, lead_lawyer_id, opponent_name, opponent_id_number, opponent_lawyer, opponent_phone,
      req.params.id
    );

    if (lead_lawyer_id) {
      db.prepare('INSERT OR IGNORE INTO case_lawyers (case_id, user_id, role_in_case) VALUES (?, ?, ?)').run(req.params.id, lead_lawyer_id, 'lead');
    }

    // Audit log
    db.prepare(`
      INSERT INTO activity_log (user_id, action, entity_type, details_json)
      VALUES (?, ?, ?, ?)
    `).run(req.user.id, 'UPDATE_CASE', 'case', JSON.stringify({ caseId: req.params.id, title, status }));

    res.json({ success: true, message: 'تم تحديث بيانات القضية بنجاح' });
  } catch (err) {
    next(err);
  }
});

// PATCH or PUT /api/cases/:id/status - Quick status update (e.g. mark done/closed/active)
const handleStatusUpdate = (req, res, next) => {
  try {
    const { status } = req.body;
    const validStatuses = ['active', 'pending', 'closed', 'archived'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: 'حالة القضية غير صالحة' });
    }

    const currentCase = db.prepare('SELECT id, title, lead_lawyer_id FROM cases WHERE id = ?').get(req.params.id);
    if (!currentCase) {
      return res.status(404).json({ message: 'القضية غير موجودة' });
    }

    if (!canManageCase(req.user, req.params.id)) {
      return res.status(403).json({ message: 'ليس لديك صلاحية تغيير حالة هذه القضية' });
    }

    db.prepare('UPDATE cases SET status = ? WHERE id = ?').run(status, req.params.id);

    // Audit log
    db.prepare(`
      INSERT INTO activity_log (user_id, action, entity_type, details_json)
      VALUES (?, ?, ?, ?)
    `).run(req.user.id, 'CHANGE_CASE_STATUS', 'case', JSON.stringify({ caseId: req.params.id, newStatus: status }));

    // Notify lead lawyer if updated by admin
    if (req.user.id !== currentCase.lead_lawyer_id) {
      createNotification({
        userId: currentCase.lead_lawyer_id,
        title: 'تحديث حالة القضية',
        message: `تم تغيير حالة القضية "${currentCase.title}" إلى (${status === 'closed' ? 'مغلقة / منتهية' : status === 'active' ? 'نشطة' : status === 'pending' ? 'معلقة' : 'مؤرشفة'})`,
        type: status === 'closed' ? 'success' : 'info',
        relatedEntityType: 'case',
        relatedEntityId: currentCase.id
      });
    }

    res.json({ success: true, message: 'تم تحديث حالة القضية بنجاح', status });
  } catch (err) {
    next(err);
  }
};

router.patch('/:id/status', handleStatusUpdate);
router.put('/:id/status', handleStatusUpdate);
router.post('/:id/status', handleStatusUpdate);

// DELETE /api/cases/:id - Delete case (Admin only)
router.delete('/:id', (req, res, next) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'صلاحية حذف القضايا مقتصرة على مدير المكتب فقط' });
    }

    const caseItem = db.prepare('SELECT id, title, case_number FROM cases WHERE id = ?').get(req.params.id);
    if (!caseItem) {
      return res.status(404).json({ message: 'القضية غير موجودة' });
    }

    // Perform cascade delete in a transaction
    const deleteTransaction = db.transaction(() => {
      db.prepare('DELETE FROM case_notes WHERE case_id = ?').run(req.params.id);
      db.prepare('DELETE FROM tasks WHERE case_id = ?').run(req.params.id);
      db.prepare('DELETE FROM events WHERE case_id = ?').run(req.params.id);
      db.prepare('DELETE FROM documents WHERE case_id = ?').run(req.params.id);
      db.prepare('DELETE FROM case_lawyers WHERE case_id = ?').run(req.params.id);
      db.prepare('DELETE FROM cases WHERE id = ?').run(req.params.id);

      db.prepare(`
        INSERT INTO activity_log (user_id, action, entity_type, details_json)
        VALUES (?, ?, ?, ?)
      `).run(req.user.id, 'DELETE_CASE', 'case', JSON.stringify({ caseId: req.params.id, title: caseItem.title, case_number: caseItem.case_number }));
    });

    deleteTransaction();

    res.json({ success: true, message: `تم حذف القضية (${caseItem.title}) وكافة متعلقاتها بنجاح` });
  } catch (err) {
    next(err);
  }
});

export default router;
