import express from 'express';
import fs from 'fs';
import path from 'path';
import multer from 'multer';
import { authenticateToken } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/permissions.js';
import { runBackup, restoreBackup } from '../services/backupService.js';
import { BACKUPS_DIR } from '../config.js';

const router = express.Router();
router.use(authenticateToken);
router.use(requireAdmin);

const upload = multer({
  dest: BACKUPS_DIR,
  limits: { fileSize: 500 * 1024 * 1024 } // 500 MB
});

// GET /api/backups - List backups
router.get('/', (req, res, next) => {
  try {
    if (!fs.existsSync(BACKUPS_DIR)) fs.mkdirSync(BACKUPS_DIR, { recursive: true });

    const files = fs.readdirSync(BACKUPS_DIR)
      .filter(f => (f.endsWith('.zip') || f.endsWith('.db')) && (f.startsWith('backup_') || f.startsWith('pre_restore_')))
      .map(f => {
        const stat = fs.statSync(path.join(BACKUPS_DIR, f));
        return {
          filename: f,
          size: stat.size,
          isFullZip: f.endsWith('.zip'),
          createdAt: stat.mtime
        };
      })
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.json({ success: true, backups: files });
  } catch (err) {
    next(err);
  }
});

// POST /api/backups/create - Trigger instant backup
router.post('/create', async (req, res, next) => {
  try {
    const result = await runBackup();
    if (result && result.success) {
      res.json({ success: true, message: 'تم إنشاء النسخة الاحتياطية الشاملة (قاعدة البيانات + المرفقات) بنجاح', backup: result });
    } else {
      res.status(500).json({ success: false, message: result?.error || 'فشل إنشاء النسخة الاحتياطية' });
    }
  } catch (err) {
    next(err);
  }
});

// GET /api/backups/download/:filename - Download backup file
router.get('/download/:filename', (req, res, next) => {
  try {
    const safeFilename = path.basename(req.params.filename);
    const filePath = path.join(BACKUPS_DIR, safeFilename);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, message: 'ملف النسخة الاحتياطية غير موجود' });
    }
    res.download(filePath, safeFilename);
  } catch (err) {
    next(err);
  }
});

// POST /api/backups/restore - Restore from existing backup file or uploaded file
router.post('/restore', upload.single('backup_file'), async (req, res, next) => {
  try {
    let targetFile = null;

    if (req.file) {
      targetFile = req.file.path;
    } else if (req.body.filename) {
      const safeFilename = path.basename(req.body.filename);
      targetFile = path.join(BACKUPS_DIR, safeFilename);
    }

    if (!targetFile || !fs.existsSync(targetFile)) {
      return res.status(400).json({ success: false, message: 'يرجى تحديد ملف النسخة الاحتياطية للاستعادة' });
    }

    const result = await restoreBackup(targetFile);

    // If it was an uploaded file, clean it up after restore
    if (req.file) {
      try { fs.unlinkSync(req.file.path); } catch {}
    }

    if (result.success) {
      res.json({ success: true, message: result.message });
    } else {
      res.status(500).json({ success: false, message: result.error });
    }
  } catch (err) {
    next(err);
  }
});

export default router;
