import express from 'express';
import db from '../database/db.js';
import { authenticateToken } from '../middleware/auth.js';
import { createNotification } from '../services/notificationService.js';

const router = express.Router();

// Apply auth middleware to all routes
router.use(authenticateToken);

// GET /api/case-notes/:caseId
router.get('/:caseId', (req, res) => {
  try {
    const { caseId } = req.params;
    const userId = req.user.id;
    const role = req.user.role;

    let query = `
      SELECT cn.*, u.name as author_name 
      FROM case_notes cn
      JOIN users u ON cn.created_by = u.id
      WHERE cn.case_id = ? 
    `;
    const params = [caseId];

    if (role !== 'admin') {
      // Lawyer sees non-private + own private notes
      query += ` AND (cn.is_private = 0 OR cn.created_by = ?)`;
      params.push(userId);
    }

    query += ` ORDER BY cn.created_at DESC`;

    const notes = db.prepare(query).all(...params);
    res.json({ success: true, data: notes });
  } catch (error) {
    console.error('Error fetching case notes:', error);
    res.status(500).json({ success: false, message: 'حدث خطأ أثناء جلب الملاحظات' });
  }
});

// POST /api/case-notes
router.post('/', (req, res) => {
  try {
    const { case_id, content, note_type = 'note', is_private = 0 } = req.body;
    const userId = req.user.id;

    if (!content || content.trim() === '') {
      return res.status(400).json({ success: false, message: 'محتوى الملاحظة مطلوب' });
    }

    const result = db.prepare(`
      INSERT INTO case_notes (case_id, content, note_type, is_private, created_by)
      VALUES (?, ?, ?, ?, ?)
    `).run(case_id, content, note_type, is_private ? 1 : 0, userId);

    const newNoteId = result.lastInsertRowid;

    // Notify other lawyers assigned to the case
    const caseDetails = db.prepare(`SELECT title FROM cases WHERE id = ?`).get(case_id);
    if (caseDetails) {
      const assignedLawyers = db.prepare(`
        SELECT user_id FROM case_lawyers 
        WHERE case_id = ? AND user_id != ?
      `).all(case_id, userId);

      assignedLawyers.forEach(lawyer => {
        createNotification({
          userId: lawyer.user_id,
          title: 'ملاحظة جديدة',
          message: `تمت إضافة ملاحظة جديدة في قضية "${caseDetails.title}"`,
          type: 'info',
          relatedEntityType: 'case',
          relatedEntityId: case_id
        });
      });
    }

    const newNote = db.prepare(`
      SELECT cn.*, u.name as author_name 
      FROM case_notes cn
      JOIN users u ON cn.created_by = u.id
      WHERE cn.id = ?
    `).get(newNoteId);

    res.json({ success: true, message: 'تمت إضافة الملاحظة بنجاح', data: newNote });
  } catch (error) {
    console.error('Error adding case note:', error);
    res.status(500).json({ success: false, message: 'حدث خطأ أثناء إضافة الملاحظة' });
  }
});

// PUT /api/case-notes/:id
router.put('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { content, note_type } = req.body;
    const userId = req.user.id;

    if (!content || content.trim() === '') {
      return res.status(400).json({ success: false, message: 'محتوى الملاحظة مطلوب' });
    }

    // Check ownership
    const note = db.prepare(`SELECT created_by FROM case_notes WHERE id = ?`).get(id);
    if (!note) {
      return res.status(404).json({ success: false, message: 'الملاحظة غير موجودة' });
    }

    if (note.created_by !== userId) {
      return res.status(403).json({ success: false, message: 'غير مصرح لك بتعديل هذه الملاحظة' });
    }

    db.prepare(`
      UPDATE case_notes 
      SET content = ?, note_type = ?
      WHERE id = ?
    `).run(content, note_type || 'note', id);

    res.json({ success: true, message: 'تم تحديث الملاحظة بنجاح' });
  } catch (error) {
    console.error('Error updating case note:', error);
    res.status(500).json({ success: false, message: 'حدث خطأ أثناء تحديث الملاحظة' });
  }
});

// DELETE /api/case-notes/:id
router.delete('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const role = req.user.role;

    const note = db.prepare(`SELECT created_by FROM case_notes WHERE id = ?`).get(id);
    if (!note) {
      return res.status(404).json({ success: false, message: 'الملاحظة غير موجودة' });
    }

    if (note.created_by !== userId && role !== 'admin') {
      return res.status(403).json({ success: false, message: 'غير مصرح لك بحذف هذه الملاحظة' });
    }

    db.prepare(`DELETE FROM case_notes WHERE id = ?`).run(id);

    res.json({ success: true, message: 'تم حذف الملاحظة بنجاح' });
  } catch (error) {
    console.error('Error deleting case note:', error);
    res.status(500).json({ success: false, message: 'حدث خطأ أثناء حذف الملاحظة' });
  }
});

export default router;
