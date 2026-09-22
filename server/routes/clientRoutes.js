import express from 'express';
import db from '../database/db.js';
import { authenticateToken } from '../middleware/auth.js';
import { encryptText, decryptText, hashSearchTerm } from '../services/encryptionService.js';
import { checkConflict } from '../services/conflictService.js';
import { validateClient } from '../middleware/validator.js';
import { canAccessCase, canAccessClient } from '../middleware/permissions.js';

const router = express.Router();
router.use(authenticateToken);

// GET /api/clients - List clients (Admin sees all; lawyer sees clients of their cases)
router.get('/', (req, res, next) => {
  try {
    let clients;
    if (req.user.role === 'admin') {
      clients = db.prepare('SELECT * FROM clients ORDER BY id DESC').all();
    } else {
      clients = db.prepare(`
        SELECT DISTINCT c.* FROM clients c
        JOIN cases ca ON ca.client_id = c.id
        LEFT JOIN case_lawyers cl ON cl.case_id = ca.id
        WHERE ca.lead_lawyer_id = ? OR cl.user_id = ?
        ORDER BY c.id DESC
      `).all(req.user.id, req.user.id);
    }

    // Decrypt national_id for authorized output
    const formatted = clients.map(c => ({
      ...c,
      national_id: decryptText(c.national_id_encrypted)
    }));

    res.json({ success: true, clients: formatted });
  } catch (err) {
    next(err);
  }
});

// GET /api/clients/:id - Client details + linked cases
router.get('/:id', (req, res, next) => {
  try {
    const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(req.params.id);
    if (!client) return res.status(404).json({ message: 'العميل غير موجود' });

    if (!canAccessClient(req.user, req.params.id)) {
      return res.status(403).json({ message: 'ليس لديك صلاحية عرض بيانات هذا العميل' });
    }

    client.national_id = decryptText(client.national_id_encrypted);

    const cases = db.prepare(`
      SELECT c.*, u.name as lead_lawyer_name
      FROM cases c
      JOIN users u ON c.lead_lawyer_id = u.id
      WHERE c.client_id = ?
    `).all(req.params.id).filter(c => canAccessCase(req.user, c.id));

    res.json({ success: true, client, cases });
  } catch (err) {
    next(err);
  }
});

// POST /api/clients - Add client (with conflict of interest check)
router.post('/', validateClient, (req, res, next) => {
  try {
    const { name, national_id, phone, email, address, notes, force } = req.body;

    // Conflict of interest check unless forced
    if (!force) {
      const conflictCheck = checkConflict({ clientName: name, nationalId: national_id });
      if (conflictCheck.hasConflict) {
        return res.status(409).json({
          success: false,
          isConflict: true,
          conflicts: conflictCheck.conflicts,
          message: 'تنبيه تعارض مصالح / بيانات مكررة!'
        });
      }
    }

    const nationalIdEncrypted = encryptText(national_id);
    const nationalIdHash = hashSearchTerm(national_id);
    const stmt = db.prepare(`
      INSERT INTO clients (name, national_id_encrypted, national_id_hash, phone, email, address, notes, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(name, nationalIdEncrypted, nationalIdHash, phone, email, address, notes, req.user.id);
    const clientId = result.lastInsertRowid;

    // Audit log
    db.prepare(`
      INSERT INTO activity_log (user_id, action, entity_type, details_json)
      VALUES (?, ?, ?, ?)
    `).run(req.user.id, 'CREATE_CLIENT', 'client', JSON.stringify({ clientId, name }));

    res.status(201).json({
      success: true,
      message: 'تم إضافة العميل بنجاح',
      clientId: clientId
    });
  } catch (err) {
    next(err);
  }
});

// PUT /api/clients/:id - Edit client
router.put('/:id', validateClient, (req, res, next) => {
  try {
    if (!canAccessClient(req.user, req.params.id)) {
      return res.status(403).json({ message: 'ليس لديك صلاحية تعديل بيانات هذا العميل' });
    }

    const { name, national_id, phone, email, address, notes } = req.body;
    const nationalIdEncrypted = encryptText(national_id);
    const nationalIdHash = hashSearchTerm(national_id);

    db.prepare(`
      UPDATE clients
      SET name = ?, national_id_encrypted = ?, national_id_hash = ?, phone = ?, email = ?, address = ?, notes = ?
      WHERE id = ?
    `).run(name, nationalIdEncrypted, nationalIdHash, phone, email, address, notes, req.params.id);

    // Audit log
    db.prepare(`
      INSERT INTO activity_log (user_id, action, entity_type, details_json)
      VALUES (?, ?, ?, ?)
    `).run(req.user.id, 'UPDATE_CLIENT', 'client', JSON.stringify({ clientId: req.params.id, name }));

    res.json({ success: true, message: 'تم تحديث بيانات العميل بنجاح' });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/clients/:id - Delete client (Admin only)
router.delete('/:id', (req, res, next) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'صلاحية حذف العملاء مقتصرة على مدير المكتب فقط' });
    }

    const client = db.prepare('SELECT id, name FROM clients WHERE id = ?').get(req.params.id);
    if (!client) {
      return res.status(404).json({ message: 'العميل غير موجود' });
    }

    // Check if client has active cases
    const linkedCases = db.prepare('SELECT COUNT(*) as count FROM cases WHERE client_id = ?').get(req.params.id);
    if (linkedCases.count > 0 && !req.query.force) {
      return res.status(400).json({
        hasLinkedCases: true,
        casesCount: linkedCases.count,
        message: `لا يمكن حذف العميل (${client.name}) لوجود (${linkedCases.count}) قضايا مسجلة باسمه. يرجى حذف القضايا أولاً أو نقلها.`
      });
    }

    // Delete client in a transaction
    const deleteTransaction = db.transaction(() => {
      // If force delete is passed, unlink or cascade
      if (req.query.force) {
        db.prepare('DELETE FROM cases WHERE client_id = ?').run(req.params.id);
      }
      db.prepare('DELETE FROM clients WHERE id = ?').run(req.params.id);

      db.prepare(`
        INSERT INTO activity_log (user_id, action, entity_type, details_json)
        VALUES (?, ?, ?, ?)
      `).run(req.user.id, 'DELETE_CLIENT', 'client', JSON.stringify({ clientId: req.params.id, name: client.name }));
    });

    deleteTransaction();

    res.json({ success: true, message: `تم حذف ملف العميل (${client.name}) بنجاح` });
  } catch (err) {
    next(err);
  }
});

export default router;
