import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import db from '../database/db.js';
import { authenticateToken } from '../middleware/auth.js';
import { canAccessCase, canManageCase } from '../middleware/permissions.js';
import { UPLOADS_DIR } from '../config.js';
import { createNotification } from '../services/notificationService.js';

const router = express.Router();
router.use(authenticateToken);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => {
    const allowed = new Set([
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'image/jpeg', 'image/png'
    ]);
    cb(allowed.has(file.mimetype) ? null : new Error('نوع الملف غير مسموح به'), allowed.has(file.mimetype));
  }
});

function requireDocumentAccess(req, res, documentId, { manage = false } = {}) {
  const doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(documentId);
  if (!doc) {
    res.status(404).json({ message: 'المستند غير موجود' });
    return null;
  }
  const allowed = manage ? canManageCase(req.user, doc.case_id) : canAccessCase(req.user, doc.case_id);
  if (!allowed) {
    res.status(403).json({ message: 'ليس لديك صلاحية الوصول إلى هذا المستند' });
    return null;
  }
  return doc;
}

// GET /api/documents - List all documents with search, filtering, and pagination
router.get('/', (req, res, next) => {
  try {
    const { case_id, search, page = 1, limit = 50 } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10) || 50));
    const offset = (pageNum - 1) * limitNum;

    let baseSql = `
      FROM documents d
      JOIN cases c ON d.case_id = c.id
      JOIN users u ON d.uploaded_by = u.id
      LEFT JOIN clients cl ON c.client_id = cl.id
    `;

    const whereClauses = [];
    const params = [];

    if (req.user.role !== 'admin') {
      whereClauses.push(`(
        c.lead_lawyer_id = ? 
        OR EXISTS (SELECT 1 FROM case_lawyers cl2 WHERE cl2.case_id = c.id AND cl2.user_id = ?)
        OR EXISTS (SELECT 1 FROM document_shares ds WHERE ds.document_id = d.id AND ds.shared_with_user_id = ?)
      )`);
      params.push(req.user.id, req.user.id, req.user.id);
    }

    if (case_id && case_id !== 'all') {
      whereClauses.push(`d.case_id = ?`);
      params.push(case_id);
    }

    if (search && search.trim()) {
      whereClauses.push(`(d.original_name LIKE ? OR c.title LIKE ? OR c.case_number LIKE ? OR cl.name LIKE ?)`);
      const term = `%${search.trim()}%`;
      params.push(term, term, term, term);
    }

    const whereStr = whereClauses.length > 0 ? ` WHERE ${whereClauses.join(' AND ')}` : '';

    const countRow = db.prepare(`SELECT COUNT(*) as total ${baseSql} ${whereStr}`).get(...params);
    const total = countRow ? countRow.total : 0;

    const selectSql = `
      SELECT 
        d.id, d.original_name, d.stored_name, d.file_size, d.mime_type, d.current_version, d.created_at,
        d.case_id, c.title as case_title, c.case_number,
        cl.name as client_name,
        u.name as uploader_name
      ${baseSql}
      ${whereStr}
      ORDER BY d.created_at DESC
      LIMIT ? OFFSET ?
    `;

    const documents = db.prepare(selectSql).all(...params, limitNum, offset);

    res.json({
      success: true,
      documents,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum) || 1
      }
    });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/documents/:id - Delete a document and its physical files
router.delete('/:id', (req, res, next) => {
  try {
    const docId = req.params.id;
    const doc = requireDocumentAccess(req, res, docId, { manage: true });
    if (!doc) return;

    // Fetch version files
    const versions = db.prepare('SELECT file_path FROM document_versions WHERE document_id = ?').all(docId);

    // Delete physical files
    if (doc.file_path && fs.existsSync(doc.file_path)) {
      try { fs.unlinkSync(doc.file_path); } catch (e) {}
    }
    for (const v of versions) {
      if (v.file_path && fs.existsSync(v.file_path) && v.file_path !== doc.file_path) {
        try { fs.unlinkSync(v.file_path); } catch (e) {}
      }
    }

    // Delete records from database (document_versions and shares CASCADE)
    db.prepare('DELETE FROM documents WHERE id = ?').run(docId);

    // Activity log
    db.prepare(`
      INSERT INTO activity_log (user_id, action, entity_type, entity_id, details_json)
      VALUES (?, ?, ?, ?, ?)
    `).run(req.user.id, 'DELETE_DOCUMENT', 'document', docId, JSON.stringify({ original_name: doc.original_name }));

    res.json({ success: true, message: 'تم حذف المستند بنجاح' });
  } catch (err) {
    next(err);
  }
});

// POST /api/documents/upload - Upload file to case
router.post('/upload', upload.single('file'), (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'يرجى اختيار ملف لرفعه' });
    const { case_id } = req.body;
    if (!case_id) return res.status(400).json({ message: 'معرف القضية مطلوب' });
    if (!canAccessCase(req.user, case_id)) {
      fs.unlink(req.file.path, () => {});
      return res.status(403).json({ message: 'ليس لديك صلاحية رفع مستند لهذه القضية' });
    }

    const stmt = db.prepare(`
      INSERT INTO documents (original_name, stored_name, file_path, file_size, mime_type, case_id, uploaded_by)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      req.file.originalname,
      req.file.filename,
      req.file.path,
      req.file.size,
      req.file.mimetype,
      case_id,
      req.user.id
    );

    // Initial version entry (version 1)
    db.prepare(`
      INSERT INTO document_versions (document_id, version_number, file_path, file_size, change_note, uploaded_by)
      VALUES (?, 1, ?, ?, ?, ?)
    `).run(result.lastInsertRowid, req.file.path, req.file.size, 'النسخة الأصلية الأولى', req.user.id);

    res.status(201).json({ success: true, message: 'تم رفع المستند بنجاح', documentId: result.lastInsertRowid });
  } catch (err) {
    next(err);
  }
});

// POST /api/documents/:id/version - Upload new version of document
router.post('/:id/version', upload.single('file'), (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'يرجى اختيار ملف النسخة الجديدة' });
    const { change_note } = req.body;
    const docId = req.params.id;

    const doc = requireDocumentAccess(req, res, docId, { manage: true });
    if (!doc) return;

    const newVersion = doc.current_version + 1;

    // Update document record
    db.prepare(`
      UPDATE documents
      SET stored_name = ?, file_path = ?, file_size = ?, mime_type = ?, current_version = ?
      WHERE id = ?
    `).run(req.file.filename, req.file.path, req.file.size, req.file.mimetype, newVersion, docId);

    // Add version record
    db.prepare(`
      INSERT INTO document_versions (document_id, version_number, file_path, file_size, change_note, uploaded_by)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(docId, newVersion, req.file.path, req.file.size, change_note || `تحديث الإصدار رقم ${newVersion}`, req.user.id);

    res.json({ success: true, message: `تم إضافة الإصدار رقم ${newVersion} للمستند بنجاح` });
  } catch (err) {
    next(err);
  }
});

// GET /api/documents/:id/versions - List version history
router.get('/:id/versions', (req, res, next) => {
  try {
    const doc = requireDocumentAccess(req, res, req.params.id);
    if (!doc) return;
    const versions = db.prepare(`
      SELECT dv.*, u.name as uploader_name
      FROM document_versions dv
      JOIN users u ON dv.uploaded_by = u.id
      WHERE dv.document_id = ?
      ORDER BY dv.version_number DESC
    `).all(req.params.id);

    res.json({ success: true, versions });
  } catch (err) {
    next(err);
  }
});

// POST /api/documents/share - Share document with another lawyer
router.post('/share', (req, res, next) => {
  try {
    const { document_id, shared_with_user_id, permissions = 'view' } = req.body;

    const doc = requireDocumentAccess(req, res, document_id, { manage: true });
    if (!doc) return;
    const recipient = db.prepare('SELECT id FROM users WHERE id = ? AND is_active = 1').get(shared_with_user_id);
    if (!recipient) return res.status(400).json({ message: 'المستخدم المراد المشاركة معه غير موجود أو غير مفعّل' });
    if (!['view', 'download', 'edit'].includes(permissions)) return res.status(400).json({ message: 'صلاحية المشاركة غير صالحة' });

    db.prepare(`
      INSERT INTO document_shares (document_id, shared_with_user_id, shared_by_user_id, permissions)
      VALUES (?, ?, ?, ?)
    `).run(document_id, shared_with_user_id, req.user.id, permissions);

    createNotification({
      userId: shared_with_user_id,
      title: 'مشاركة مستند جديد',
      message: `قام ${req.user.name} بمشاركة المستند (${doc.original_name}) معك`,
      type: 'info',
      relatedEntityType: 'document',
      relatedEntityId: document_id
    });

    res.json({ success: true, message: 'تم مشاركة المستند بنجاح' });
  } catch (err) {
    next(err);
  }
});

// GET /api/documents/download/:id - Download document file
router.get('/download/:id', (req, res, next) => {
  try {
    const doc = requireDocumentAccess(req, res, req.params.id);
    if (!doc) return;
    if (!fs.existsSync(doc.file_path)) {
      return res.status(404).json({ message: 'الملف غير موجود على الخادم' });
    }
    res.download(doc.file_path, doc.original_name);
  } catch (err) {
    next(err);
  }
});

export default router;
