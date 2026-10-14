import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { pipeline } from 'node:stream/promises';
import { DatabaseSync } from 'node:sqlite';
import cron from 'node-cron';
import archiver from 'archiver';
import yauzl from 'yauzl';
import { DB_PATH, BACKUPS_DIR, UPLOADS_DIR, CLOUD_BACKUP_DIR } from '../config.js';
import db from '../database/db.js';

let active = false;
const MAX_EXTRACTED_BYTES = 2 * 1024 * 1024 * 1024;
const requiredTables = [...fs.readFileSync(new URL('../database/schema.sql', import.meta.url), 'utf8')
  .matchAll(/CREATE TABLE IF NOT EXISTS\s+(\w+)/gi)].map(match => match[1]);

function removeTemp(directory) {
  const root = path.resolve(BACKUPS_DIR);
  const target = path.resolve(directory);
  if (path.dirname(target) !== root || !path.basename(target).startsWith('restore_temp_')) {
    throw new Error('Unsafe restore cleanup path');
  }
  fs.rmSync(target, { recursive: true, force: true });
}

function rejectLinks(directory) {
  if (!fs.existsSync(directory)) return;
  if (fs.lstatSync(directory).isSymbolicLink()) throw new Error('Symbolic links are not supported in backups');
  for (const name of fs.readdirSync(directory)) {
    const file = path.join(directory, name);
    const info = fs.lstatSync(file);
    if (info.isSymbolicLink()) throw new Error('Symbolic links are not supported in backups');
    if (info.isDirectory()) rejectLinks(file);
    else if (!info.isFile()) throw new Error('Unsupported attachment file type');
  }
}

async function createSnapshot(prefix = 'backup_') {
  fs.mkdirSync(BACKUPS_DIR, { recursive: true });
  const id = `${new Date().toISOString().replace(/[:.]/g, '-')}_${randomUUID()}`;
  const backupFileName = `${prefix}${id}.zip`;
  const destinationPath = path.join(BACKUPS_DIR, backupFileName);
  const tempDbPath = path.join(BACKUPS_DIR, `temp_${id}.db`);
  try {
    rejectLinks(UPLOADS_DIR);
    await db.backup(tempDbPath);
    await new Promise((resolve, reject) => {
      const output = fs.createWriteStream(destinationPath, { flags: 'wx' });
      const archive = archiver('zip', { zlib: { level: 9 } });
      let failure;
      const fail = error => {
        failure ||= error;
        archive.abort();
        output.destroy();
      };
      output.on('close', () => failure ? reject(failure) : resolve());
      output.on('error', fail);
      archive.on('error', fail);
      // Missing files must never be reported as a complete backup.
      archive.on('warning', fail);
      archive.pipe(output);
      archive.file(tempDbPath, { name: 'database.db' });
      if (fs.existsSync(UPLOADS_DIR)) archive.directory(UPLOADS_DIR, 'uploads');
      archive.finalize().catch(fail);
    });
    const stat = fs.statSync(destinationPath);
    return { success: true, backupFileName, destinationPath, size: stat.size, createdAt: stat.mtime };
  } catch (error) {
    try { fs.unlinkSync(destinationPath); } catch {}
    throw error;
  } finally {
    try { fs.unlinkSync(tempDbPath); } catch {}
  }
}

export async function runBackup() {
  if (active) return { success: false, error: 'عملية نسخ أو استعادة أخرى قيد التنفيذ' };
  active = true;
  try {
    const result = await createSnapshot();
    if (CLOUD_BACKUP_DIR && fs.existsSync(CLOUD_BACKUP_DIR)) {
      fs.copyFileSync(result.destinationPath, path.join(CLOUD_BACKUP_DIR, result.backupFileName));
      cleanOldBackups(CLOUD_BACKUP_DIR, 30);
    }
    cleanOldBackups(BACKUPS_DIR, 30);
    return result;
  } catch (error) {
    return { success: false, error: error.message };
  } finally { active = false; }
}

async function extractZip(file, directory) {
  const zip = await new Promise((resolve, reject) => yauzl.open(file,
    { lazyEntries: true, strictFileNames: true }, (error, value) => error ? reject(error) : resolve(value)));
  let bytes = 0;
  const names = new Set();
  try {
    await new Promise((resolve, reject) => {
      zip.on('error', reject);
      zip.on('end', resolve);
      zip.on('entry', async entry => {
        try {
          const name = entry.fileName;
          const mode = entry.externalFileAttributes >>> 16;
          const pieces = name.replace(/\/$/, '').split('/');
          const key = name.toLowerCase().replace(/\/$/, '');
          if ((entry.generalPurposeBitFlag & 1) || (mode & 0o170000) === 0o120000 ||
              pieces.some(piece => !piece || piece === '.' || piece === '..' || /[\\:*?"<>|]/.test(piece) || /[. ]$/.test(piece) || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\.|$)/i.test(piece)) ||
              !(name === 'database.db' || name === 'uploads/' || name.startsWith('uploads/')) || names.has(key)) {
            throw new Error('Unsafe or unexpected ZIP entry');
          }
          names.add(key);
          bytes += entry.uncompressedSize;
          if (bytes > MAX_EXTRACTED_BYTES || names.size > 100000) throw new Error('Backup exceeds extraction limits');
          const target = path.resolve(directory, ...pieces);
          if (!target.startsWith(`${path.resolve(directory)}${path.sep}`)) throw new Error('Unsafe ZIP path');
          if (name.endsWith('/')) fs.mkdirSync(target, { recursive: true });
          else {
            fs.mkdirSync(path.dirname(target), { recursive: true });
            const stream = await new Promise((res, rej) => zip.openReadStream(entry, (error, input) => error ? rej(error) : res(input)));
            await pipeline(stream, fs.createWriteStream(target, { flags: 'wx' }));
          }
          zip.readEntry();
        } catch (error) { reject(error); zip.close(); }
      });
      zip.readEntry();
    });
  } finally { zip.close(); }
}

function validateDatabase(file) {
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) throw new Error('Backup has no database.db');
  const header = Buffer.alloc(16);
  const descriptor = fs.openSync(file, 'r');
  try { fs.readSync(descriptor, header, 0, header.length, 0); } finally { fs.closeSync(descriptor); }
  if (header.toString('binary') !== 'SQLite format 3\0') throw new Error('Invalid SQLite database');
  const candidate = new DatabaseSync(file, { readOnly: true });
  try {
    if (candidate.prepare('PRAGMA integrity_check').get().integrity_check !== 'ok') throw new Error('Database integrity check failed');
    const requiredColumns = {
      tenants: ['id', 'slug', 'name'], users: ['id', 'email', 'password_hash', 'role', 'tenant_id'],
      clients: ['id', 'tenant_id'], cases: ['id', 'tenant_id'], documents: ['id', 'tenant_id']
    };
    for (const table of requiredTables) {
      if (!candidate.prepare('SELECT name FROM sqlite_master WHERE type=? AND name=?').get('table', table)) throw new Error(`Missing required table: ${table}`);
    }
    for (const [table, required] of Object.entries(requiredColumns)) {
      if (!candidate.prepare('SELECT name FROM sqlite_master WHERE type=? AND name=?').get('table', table)) throw new Error(`Missing required table: ${table}`);
      const columns = new Set(candidate.prepare(`PRAGMA table_info(${table})`).all().map(row => row.name));
      if (required.some(column => !columns.has(column))) throw new Error(`Incompatible backup schema: ${table}`);
    }
    if (candidate.prepare('PRAGMA foreign_key_check').get()) throw new Error('Backup contains invalid foreign key references');
    if (candidate.prepare('SELECT COUNT(*) AS count FROM tenants').get().count > 1) throw new Error('Multi-office recovery requires server maintenance');
  } finally { candidate.close(); }
}

export async function restoreBackup(backupFileName, format = path.extname(backupFileName).toLowerCase()) {
  if (active) return { success: false, error: 'عملية نسخ أو استعادة أخرى قيد التنفيذ' };
  active = true;
  let temp;
  let safety;
  try {
    const uploadRoot = path.resolve(UPLOADS_DIR);
    const isWithinUploads = target => target === uploadRoot || target.startsWith(`${uploadRoot}${path.sep}`);
    if (uploadRoot === path.parse(uploadRoot).root || isWithinUploads(path.resolve(DB_PATH)) || isWithinUploads(path.resolve(BACKUPS_DIR))) {
      throw new Error('Unsafe uploads directory configuration for restore');
    }
    if (db.prepare('SELECT COUNT(*) AS count FROM tenants').get().count > 1) throw new Error('Multi-office recovery requires server maintenance');
    const source = path.isAbsolute(backupFileName) ? backupFileName : path.join(BACKUPS_DIR, path.basename(backupFileName));
    if (!['.zip', '.db'].includes(format)) throw new Error('تنسيق النسخة يجب أن يكون zip أو db');
    fs.mkdirSync(BACKUPS_DIR, { recursive: true });
    temp = fs.mkdtempSync(path.join(BACKUPS_DIR, 'restore_temp_'));
    if (format === '.zip') await extractZip(source, temp);
    else fs.copyFileSync(source, path.join(temp, 'database.db'));
    const candidate = path.join(temp, 'database.db');
    validateDatabase(candidate);
    safety = await createSnapshot('pre_restore_safety_');
    const stagedUploads = path.join(temp, 'uploads');
    const oldUploads = `${UPLOADS_DIR}.restore-${randomUUID()}`;
    let moved = false;
    let installed = false;
    // All state changes below are synchronous; rollback covers DB replacement failures.
    try {
      if (format === '.zip') {
        fs.mkdirSync(stagedUploads, { recursive: true });
        // Copy beside the destination first so rename works across filesystem volumes.
        const incoming = `${oldUploads}-incoming`;
        try {
          fs.cpSync(stagedUploads, incoming, { recursive: true, errorOnExist: true });
          if (fs.existsSync(UPLOADS_DIR)) { fs.renameSync(UPLOADS_DIR, oldUploads); moved = true; }
          fs.renameSync(incoming, UPLOADS_DIR); installed = true;
        } finally { if (fs.existsSync(incoming)) fs.rmSync(incoming, { recursive: true, force: true }); }
      }
      db.restoreFrom(candidate);
    } catch (error) {
      if (installed) fs.rmSync(UPLOADS_DIR, { recursive: true, force: true });
      if (moved) fs.renameSync(oldUploads, UPLOADS_DIR);
      throw error;
    }
    if (moved) {
      try { fs.rmSync(oldUploads, { recursive: true, force: true }); } catch { /* Safety ZIP retained. */ }
    }
    return { success: true, safetyBackup: safety.backupFileName, message: format === '.zip' ? 'تمت استعادة قاعدة البيانات والمرفقات بنجاح' : 'تمت استعادة قاعدة البيانات؛ المرفقات لم تتغير' };
  } catch (error) {
    return { success: false, error: error.message, ...(safety ? { safetyBackup: safety.backupFileName } : {}) };
  } finally {
    if (temp) removeTemp(temp);
    active = false;
  }
}

function cleanOldBackups(directory, count) {
  const files = fs.readdirSync(directory).filter(name => name.startsWith('backup_') && /\.(zip|db)$/.test(name))
    .map(name => ({ name, time: fs.statSync(path.join(directory, name)).mtimeMs })).sort((a, b) => b.time - a.time);
  for (const file of files.slice(count)) fs.unlinkSync(path.join(directory, file.name));
}

export function initBackupCron() {
  if (process.env.NODE_ENV === 'test') return;
  cron.schedule('0 2 * * *', () => runBackup());
}
