import { DatabaseSync, backup } from 'node:sqlite';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { DB_PATH, UPLOADS_DIR, BACKUPS_DIR } from '../config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure directories exist
const dbDir = path.dirname(DB_PATH);
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
if (!fs.existsSync(BACKUPS_DIR)) fs.mkdirSync(BACKUPS_DIR, { recursive: true });

// Initialize Native SQLite Engine with WAL & Foreign Keys
const rawDb = new DatabaseSync(DB_PATH);
rawDb.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;
`);

// Step 1: Run table creation from schema
const schemaPath = path.join(__dirname, 'schema.sql');
if (fs.existsSync(schemaPath)) {
  const schemaSql = fs.readFileSync(schemaPath, 'utf8');
  // Separate table definitions from index definitions to allow column migrations first
  const statements = schemaSql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0);

  for (const stmt of statements) {
    if (!stmt.toUpperCase().startsWith('CREATE INDEX')) {
      try {
        rawDb.exec(stmt + ';');
      } catch (err) {
        // Table may already exist
      }
    }
  }
}

// Step 2: Ensure schema column migrations for existing databases
function runColumnMigrations() {
  const migrations = [
    `ALTER TABLE cases ADD COLUMN opponent_name TEXT`,
    `ALTER TABLE cases ADD COLUMN opponent_id_number TEXT`,
    `ALTER TABLE cases ADD COLUMN opponent_lawyer TEXT`,
    `ALTER TABLE cases ADD COLUMN opponent_phone TEXT`,
    `ALTER TABLE clients ADD COLUMN national_id_hash TEXT`
  ];

  for (const sql of migrations) {
    try {
      rawDb.exec(sql);
    } catch {
      // Column already exists
    }
  }
}
runColumnMigrations();

// Step 3: Create performance indexes
function createIndexes() {
  const indexStatements = [
    `CREATE INDEX IF NOT EXISTS idx_cases_client_id ON cases(client_id)`,
    `CREATE INDEX IF NOT EXISTS idx_cases_lead_lawyer ON cases(lead_lawyer_id)`,
    `CREATE INDEX IF NOT EXISTS idx_cases_status ON cases(status)`,
    `CREATE INDEX IF NOT EXISTS idx_cases_case_number ON cases(case_number)`,
    `CREATE INDEX IF NOT EXISTS idx_cases_opponent_name ON cases(opponent_name)`,
    `CREATE INDEX IF NOT EXISTS idx_clients_name ON clients(name)`,
    `CREATE INDEX IF NOT EXISTS idx_clients_id_hash ON clients(national_id_hash)`,
    `CREATE INDEX IF NOT EXISTS idx_documents_case_id ON documents(case_id)`,
    `CREATE INDEX IF NOT EXISTS idx_documents_uploaded_by ON documents(uploaded_by)`,
    `CREATE INDEX IF NOT EXISTS idx_events_date ON events(date)`,
    `CREATE INDEX IF NOT EXISTS idx_events_user_id ON events(user_id)`,
    `CREATE INDEX IF NOT EXISTS idx_events_case_id ON events(case_id)`,
    `CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON tasks(assigned_to)`,
    `CREATE INDEX IF NOT EXISTS idx_tasks_case_id ON tasks(case_id)`,
    `CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status)`,
    `CREATE INDEX IF NOT EXISTS idx_invoices_case_id ON invoices(case_id)`,
    `CREATE INDEX IF NOT EXISTS idx_invoices_client_id ON invoices(client_id)`,
    `CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status)`,
    `CREATE INDEX IF NOT EXISTS idx_activity_user_id ON activity_log(user_id)`,
    `CREATE INDEX IF NOT EXISTS idx_activity_created_at ON activity_log(created_at)`,
    `CREATE INDEX IF NOT EXISTS idx_case_notes_case_id ON case_notes(case_id)`,
    `CREATE INDEX IF NOT EXISTS idx_expenses_case_id ON expenses(case_id)`,
    `CREATE INDEX IF NOT EXISTS idx_time_entries_case_id ON time_entries(case_id)`
  ];

  for (const sql of indexStatements) {
    try {
      rawDb.exec(sql);
    } catch (err) {
      console.error('Index creation warning:', err.message);
    }
  }
}
createIndexes();

function sanitizeParams(params) {
  if (params.length === 1 && Array.isArray(params[0])) {
    return params[0].map(p => (p === undefined ? null : p));
  }
  return params.map(p => (p === undefined ? null : p));
}

// Statement Wrapper to preserve API compatibility
class StatementWrapper {
  constructor(rawStmt) {
    this.rawStmt = rawStmt;
  }

  run(...params) {
    const actual = sanitizeParams(params);
    const result = this.rawStmt.run(...actual);
    return {
      lastInsertRowid: result.lastInsertRowid ? Number(result.lastInsertRowid) : 0,
      changes: result.changes || 0
    };
  }

  get(...params) {
    const actual = sanitizeParams(params);
    return this.rawStmt.get(...actual);
  }

  all(...params) {
    const actual = sanitizeParams(params);
    return this.rawStmt.all(...actual);
  }
}

const db = {
  prepare(sql) {
    const stmt = rawDb.prepare(sql);
    return new StatementWrapper(stmt);
  },
  exec(sql) {
    rawDb.exec(sql);
  },
  transaction(fn) {
    return (...args) => {
      rawDb.exec('BEGIN IMMEDIATE');
      try {
        const result = fn(...args);
        rawDb.exec('COMMIT');
        return result;
      } catch (err) {
        rawDb.exec('ROLLBACK');
        throw err;
      }
    };
  },
  pragma(sql) {
    rawDb.exec(`PRAGMA ${sql};`);
  },
  async backup(destinationPath) {
    if (typeof backup === 'function') {
      return await backup(rawDb, destinationPath);
    } else {
      fs.copyFileSync(DB_PATH, destinationPath);
    }
  }
};

export default db;
