import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });

const isProduction = process.env.NODE_ENV === 'production';

function requiredSecret(name) {
  const value = process.env[name];
  if (isProduction && !value) {
    throw new Error(`${name} must be set when NODE_ENV=production`);
  }
  // Production never starts with a known credential or encryption key.
  return value || `development-only-${name}-change-me`;
}

export const PORT = process.env.PORT || 3000;
export const HOST = process.env.HOST || '0.0.0.0';
export const JWT_SECRET = requiredSecret('JWT_SECRET');
export const JWT_REFRESH_SECRET = requiredSecret('JWT_REFRESH_SECRET');
export const ACCESS_TOKEN_EXPIRES = '8h';
export const REFRESH_TOKEN_EXPIRES = '7d';

export const ENCRYPTION_KEY = requiredSecret('ENCRYPTION_KEY');

export const DB_PATH = process.env.DB_PATH || path.join(
  __dirname,
  'database',
  process.env.NODE_ENV === 'test' ? 'lawyer_office.test.db' : 'lawyer_office.db'
);
export const UPLOADS_DIR = process.env.UPLOADS_DIR || path.join(__dirname, 'uploads');
export const BACKUPS_DIR = process.env.BACKUPS_DIR || path.join(__dirname, 'backups');
export const CLOUD_BACKUP_DIR = process.env.CLOUD_BACKUP_DIR || '';
