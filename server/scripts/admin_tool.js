import bcrypt from 'bcryptjs';
import db from '../database/db.js';

const email = 'admin@lawyer.com';
const password = 'admin123';

const hash = bcrypt.hashSync(password, 10);
console.log('Generated hash for admin123:', hash);

// Check if user exists
const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
if (!user) {
  console.log('User not found, creating admin...');
  db.prepare(`
    INSERT INTO users (name, email, password_hash, role, phone, is_active)
    VALUES (?, ?, ?, 'admin', '0912345678', 1)
  `).run('مدير النظام', email, hash);
} else {
  console.log('User found, updating password...');
  db.prepare('UPDATE users SET password_hash = ?, is_active = 1 WHERE email = ?').run(hash, email);
}

const updated = db.prepare('SELECT id, name, email, role, is_active, password_hash FROM users WHERE email = ?').get(email);
console.log('Current Admin record:', updated);
console.log('Verify password match:', bcrypt.compareSync(password, updated.password_hash));
