import fs from 'fs';
import path from 'path';
import cron from 'node-cron';
import archiver from 'archiver';
import { execSync } from 'child_process';
import { DB_PATH, BACKUPS_DIR, UPLOADS_DIR, CLOUD_BACKUP_DIR } from '../config.js';
import db from '../database/db.js';

export async function runBackup() {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFileName = `backup_${timestamp}.zip`;
    const destinationPath = path.join(BACKUPS_DIR, backupFileName);
    const tempDbPath = path.join(BACKUPS_DIR, `temp_${timestamp}.db`);

    if (!fs.existsSync(BACKUPS_DIR)) {
      fs.mkdirSync(BACKUPS_DIR, { recursive: true });
    }

    // 1. Export atomic database snapshot
    if (fs.existsSync(DB_PATH)) {
      await db.backup(tempDbPath);
    }

    // 2. Compress DB + uploads into a single secure ZIP
    await new Promise((resolve, reject) => {
      const output = fs.createWriteStream(destinationPath);
      const archive = archiver('zip', { zlib: { level: 9 } });

      output.on('close', resolve);
      archive.on('error', reject);

      archive.pipe(output);

      // Add database file
      if (fs.existsSync(tempDbPath)) {
        archive.file(tempDbPath, { name: 'database.db' });
      }

      // Add attachments folder
      if (fs.existsSync(UPLOADS_DIR)) {
        archive.directory(UPLOADS_DIR, 'uploads');
      }

      archive.finalize();
    });

    // Cleanup temp db file
    if (fs.existsSync(tempDbPath)) {
      try { fs.unlinkSync(tempDbPath); } catch {}
    }

    console.log(`[Backup] Created full ZIP backup (DB + Uploads): ${destinationPath}`);

    // Copy to cloud sync directory if configured
    if (CLOUD_BACKUP_DIR && fs.existsSync(CLOUD_BACKUP_DIR)) {
      const cloudDest = path.join(CLOUD_BACKUP_DIR, backupFileName);
      fs.copyFileSync(destinationPath, cloudDest);
      console.log(`[Backup] Copied full backup to cloud: ${cloudDest}`);
    }

    // Clean old backups (keep 30)
    cleanOldBackups(BACKUPS_DIR, 30);
    if (CLOUD_BACKUP_DIR && fs.existsSync(CLOUD_BACKUP_DIR)) {
      cleanOldBackups(CLOUD_BACKUP_DIR, 30);
    }

    const stat = fs.statSync(destinationPath);
    return {
      success: true,
      backupFileName,
      destinationPath,
      size: stat.size,
      createdAt: stat.mtime
    };
  } catch (err) {
    console.error('[Backup Error]:', err);
    return { success: false, error: err.message };
  }
}

export async function restoreBackup(backupFileName) {
  try {
    const backupFilePath = path.isAbsolute(backupFileName)
      ? backupFileName
      : path.join(BACKUPS_DIR, path.basename(backupFileName));

    if (!fs.existsSync(backupFilePath)) {
      throw new Error('ملف النسخة الاحتياطية غير موجود على الخادم');
    }

    const isZip = backupFilePath.endsWith('.zip');
    const isDb = backupFilePath.endsWith('.db');

    if (!isZip && !isDb) {
      throw new Error('تنسيق ملف النسخة الاحتياطية غير صالح، يجب أن يكون zip أو db');
    }

    // Create a safety restore point of current state
    const safetySnapshot = path.join(BACKUPS_DIR, `pre_restore_safety_${Date.now()}.db`);
    if (fs.existsSync(DB_PATH)) {
      await db.backup(safetySnapshot);
    }

    if (isZip) {
      const tempExtractDir = path.join(BACKUPS_DIR, `restore_temp_${Date.now()}`);
      if (!fs.existsSync(tempExtractDir)) fs.mkdirSync(tempExtractDir, { recursive: true });

      // Extract ZIP using native tar
      execSync(`tar -xf "${backupFilePath}" -C "${tempExtractDir}"`);

      // Restore database
      const extractedDb = path.join(tempExtractDir, 'database.db');
      if (fs.existsSync(extractedDb)) {
        fs.copyFileSync(extractedDb, DB_PATH);
      }

      // Restore uploads
      const extractedUploads = path.join(tempExtractDir, 'uploads');
      if (fs.existsSync(extractedUploads)) {
        if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
        const files = fs.readdirSync(extractedUploads);
        for (const file of files) {
          const src = path.join(extractedUploads, file);
          const dest = path.join(UPLOADS_DIR, file);
          if (fs.statSync(src).isFile()) {
            fs.copyFileSync(src, dest);
          }
        }
      }

      // Cleanup extraction folder
      try {
        fs.rmSync(tempExtractDir, { recursive: true, force: true });
      } catch {}
    } else if (isDb) {
      // Legacy .db backup restoration
      fs.copyFileSync(backupFilePath, DB_PATH);
    }

    console.log(`[Backup] System successfully restored from: ${backupFilePath}`);
    return { success: true, message: 'تمت استعادة النسخة الاحتياطية وقاعدة البيانات والمرفقات بنجاح!' };
  } catch (err) {
    console.error('[Backup Restore Error]:', err);
    return { success: false, error: err.message };
  }
}

function cleanOldBackups(dirPath, keepCount) {
  try {
    const files = fs.readdirSync(dirPath)
      .filter(f => (f.startsWith('backup_') || f.startsWith('pre_restore_')) && (f.endsWith('.zip') || f.endsWith('.db')))
      .map(f => ({ name: f, time: fs.statSync(path.join(dirPath, f)).mtime.getTime() }))
      .sort((a, b) => b.time - a.time);

    if (files.length > keepCount) {
      files.slice(keepCount).forEach(file => {
        fs.unlinkSync(path.join(dirPath, file.name));
        console.log(`[Backup] Cleaned old backup: ${file.name}`);
      });
    }
  } catch (err) {
    console.error('[Backup Cleanup Error]:', err);
  }
}

// Schedule daily automated backup at 2:00 AM
export function initBackupCron() {
  if (process.env.NODE_ENV === 'test') return;
  cron.schedule('0 2 * * *', async () => {
    console.log('[Backup Cron] Running scheduled daily backup...');
    await runBackup();
  });
}
