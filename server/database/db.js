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
let rawDb = new DatabaseSync(DB_PATH);
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

// Step 2: Ensure schema column migrations for existing databases & SaaS tables
function runColumnMigrations() {
  // Ensure SaaS tables exist
  try {
    rawDb.exec(`
      CREATE TABLE IF NOT EXISTS tenants (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        slug TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        owner_name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        phone TEXT,
        city TEXT,
        plan TEXT NOT NULL DEFAULT 'trial',
        status TEXT NOT NULL DEFAULT 'active',
        trial_ends_at DATETIME,
        subscription_ends_at DATETIME,
        max_users INTEGER DEFAULT 3,
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS subscriptions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tenant_id INTEGER NOT NULL,
        plan TEXT NOT NULL,
        period TEXT NOT NULL DEFAULT 'annual',
        amount REAL NOT NULL DEFAULT 0,
        currency TEXT DEFAULT 'LYD',
        starts_at DATETIME NOT NULL,
        ends_at DATETIME NOT NULL,
        status TEXT NOT NULL DEFAULT 'active',
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS tenant_payments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tenant_id INTEGER NOT NULL,
        amount REAL NOT NULL,
        currency TEXT DEFAULT 'LYD',
        payment_method TEXT NOT NULL,
        reference_number TEXT,
        receipt_image TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        notes TEXT,
        confirmed_by TEXT,
        confirmed_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (tenant_id) REFERENCES tenants (id) ON DELETE CASCADE
      );
    `);
  } catch (e) {
    console.warn('SaaS tables init warning:', e.message);
  }

  // Ensure default tenant #1 exists for existing/standalone offices
  try {
    const existingTenant = rawDb.prepare('SELECT id FROM tenants WHERE id = 1').get();
    if (!existingTenant) {
      const trialEnd = new Date();
      trialEnd.setDate(trialEnd.getDate() + 365);
      rawDb.prepare(`
        INSERT INTO tenants (id, slug, name, owner_name, email, phone, city, plan, status, trial_ends_at, subscription_ends_at)
        VALUES (1, 'default', 'المكتب الرئيسي للمحاماة', 'المدير العام', 'kasemgammo15@gmail.com', '0911225020 / 0921225020', 'طرابلس', 'pro', 'active', ?, ?)
      `).run(trialEnd.toISOString(), trialEnd.toISOString());
    }
  } catch (err) {
    // Ignore if table/entry exists
  }

  const migrations = [
    `ALTER TABLE cases ADD COLUMN opponent_name TEXT`,
    `ALTER TABLE cases ADD COLUMN opponent_id_number TEXT`,
    `ALTER TABLE cases ADD COLUMN opponent_lawyer TEXT`,
    `ALTER TABLE cases ADD COLUMN opponent_phone TEXT`,
    `ALTER TABLE clients ADD COLUMN national_id_hash TEXT`,
    `ALTER TABLE users ADD COLUMN tenant_id INTEGER DEFAULT 1`,
    `ALTER TABLE clients ADD COLUMN tenant_id INTEGER DEFAULT 1`,
    `ALTER TABLE cases ADD COLUMN tenant_id INTEGER DEFAULT 1`,
    `ALTER TABLE documents ADD COLUMN tenant_id INTEGER DEFAULT 1`,
    `ALTER TABLE events ADD COLUMN tenant_id INTEGER DEFAULT 1`,
    `ALTER TABLE tasks ADD COLUMN tenant_id INTEGER DEFAULT 1`,
    `ALTER TABLE invoices ADD COLUMN tenant_id INTEGER DEFAULT 1`,
    `ALTER TABLE expenses ADD COLUMN tenant_id INTEGER DEFAULT 1`,
    `ALTER TABLE time_entries ADD COLUMN tenant_id INTEGER DEFAULT 1`,
    `ALTER TABLE case_notes ADD COLUMN tenant_id INTEGER DEFAULT 1`,
    `ALTER TABLE document_templates ADD COLUMN tenant_id INTEGER DEFAULT 1`,
    `ALTER TABLE activity_log ADD COLUMN tenant_id INTEGER DEFAULT 1`
  ];

  for (const sql of migrations) {
    try {
      rawDb.exec(sql);
    } catch {
      // Column already exists
    }
  }

  // Ensure users table allows 'super_admin'
  try {
    const tableSql = rawDb.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='users'").get()?.sql || '';
    if (tableSql.includes("CHECK (role IN ('admin', 'lawyer'))") || tableSql.includes("CHECK(role IN ('admin', 'lawyer'))")) {
      rawDb.exec(`
        PRAGMA foreign_keys=OFF;
        CREATE TABLE users_migrated (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          email TEXT UNIQUE NOT NULL,
          password_hash TEXT NOT NULL,
          role TEXT NOT NULL DEFAULT 'lawyer' CHECK (role IN ('admin', 'lawyer', 'super_admin')),
          phone TEXT,
          is_active INTEGER NOT NULL DEFAULT 1,
          tenant_id INTEGER DEFAULT 1,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        INSERT INTO users_migrated (id, name, email, password_hash, role, phone, is_active, tenant_id, created_at)
          SELECT id, name, email, password_hash, role, phone, is_active, COALESCE(tenant_id, 1), created_at FROM users;
        DROP TABLE users;
        ALTER TABLE users_migrated RENAME TO users;
        PRAGMA foreign_keys=ON;
      `);
    }
  } catch (err) {
    console.warn('Users table migration warning:', err.message);
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
  constructor(rawStmt, sql) {
    this.rawStmt = rawStmt;
    this.sql = sql;
    this.connection = rawDb;
  }

  refresh() {
    if (this.connection !== rawDb) {
      this.rawStmt = rawDb.prepare(this.sql);
      this.connection = rawDb;
    }
  }

  run(...params) {
    this.refresh();
    const actual = sanitizeParams(params);
    const result = this.rawStmt.run(...actual);
    return {
      lastInsertRowid: result.lastInsertRowid ? Number(result.lastInsertRowid) : 0,
      changes: result.changes || 0
    };
  }

  get(...params) {
    this.refresh();
    const actual = sanitizeParams(params);
    return this.rawStmt.get(...actual);
  }

  all(...params) {
    this.refresh();
    const actual = sanitizeParams(params);
    return this.rawStmt.all(...actual);
  }
}

const db = {
  close() {
    rawDb.close();
  },
  prepare(sql) {
    const stmt = rawDb.prepare(sql);
    return new StatementWrapper(stmt, sql);
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
      throw new Error('Atomic SQLite backup is unavailable in this Node runtime');
    }
  },
  // Synchronous: no request can run between closing and reopening the connection.
  restoreFrom(snapshotPath) {
    if (DB_PATH === ':memory:') throw new Error('Restore requires a file database');
    const rollbackPath = `${DB_PATH}.restore-rollback`;
    let rollbackCreated = false;
    const open = () => {
      rawDb = new DatabaseSync(DB_PATH);
      rawDb.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;');
    };
    const checkpoint = rawDb.prepare('PRAGMA wal_checkpoint(TRUNCATE)').get();
    if (checkpoint.busy) throw new Error('Database is busy; restore must wait for other connections');
    rawDb.close();
    try {
      fs.copyFileSync(DB_PATH, rollbackPath);
      rollbackCreated = true;
      fs.copyFileSync(snapshotPath, DB_PATH);
      open();
      runColumnMigrations();
      createIndexes();
      // A cleanup failure must not revert a successfully restored database.
      try { fs.unlinkSync(rollbackPath); } catch {}
    } catch (error) {
      try { rawDb.close(); } catch {}
      if (rollbackCreated) {
        for (const suffix of ['-wal', '-shm']) {
          try { fs.unlinkSync(`${DB_PATH}${suffix}`); } catch {}
        }
        fs.copyFileSync(rollbackPath, DB_PATH);
      }
      open();
      // Retain the fresh recovery copy if either rollback or reopening throws.
      if (rollbackCreated) {
        try { fs.unlinkSync(rollbackPath); } catch {}
      }
      throw error;
    }
  }
};

export default db;
