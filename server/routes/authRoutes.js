import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import db from '../database/db.js';
import { generateTokens, authenticateToken } from '../middleware/auth.js';
import { validateLogin } from '../middleware/validator.js';
import { JWT_REFRESH_SECRET } from '../config.js';

const router = express.Router();

// POST /api/auth/register - one-time installation bootstrap only
router.post('/register', (req, res, next) => {
  try {
    const { name, email, password, phone } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'الاسم، البريد الإلكتروني، وكلمة المرور مطلوبة لإنشاء الحساب' });
    }
    if (password.length < 12) {
      return res.status(400).json({ message: 'كلمة المرور يجب أن لا تقل عن 12 خانة' });
    }

    const userCount = db.prepare('SELECT COUNT(*) AS count FROM users').get().count;
    if (userCount > 0) {
      return res.status(403).json({ message: 'تم إعداد المكتب بالفعل. يجب على مدير النظام إنشاء حسابات جديدة.' });
    }

    const existingUser = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existingUser) {
      return res.status(400).json({ message: 'البريد الإلكتروني مسجل بالفعل لمستخدم آخر' });
    }

    const passwordHash = bcrypt.hashSync(password, 10);
    const stmt = db.prepare(`
      INSERT INTO users (name, email, password_hash, role, phone, is_active)
      VALUES (?, ?, ?, ?, ?, 1)
    `);
    // The only public registration is the first, initial administrator.
    const result = stmt.run(name, email, passwordHash, 'admin', phone || null);

    const newUser = {
      id: result.lastInsertRowid,
      name,
      email,
      role: 'admin',
      phone
    };

    const tokens = generateTokens(newUser);

    // Audit log
    db.prepare(`
      INSERT INTO activity_log (user_id, action, entity_type, details_json)
      VALUES (?, ?, ?, ?)
    `).run(newUser.id, 'REGISTER', 'user', JSON.stringify({ email: newUser.email, name: newUser.name }));

    res.status(201).json({
      success: true,
      message: 'تم إنشاء حساب المحامي بنجاح',
      user: newUser,
      ...tokens
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/login
router.post('/login', validateLogin, (req, res, next) => {
  try {
    const { email, password } = req.body;

    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (!user) {
      db.prepare(`
        INSERT INTO activity_log (user_id, action, entity_type, details_json)
        VALUES (?, ?, ?, ?)
      `).run(1, 'FAILED_LOGIN', 'user', JSON.stringify({ email, reason: 'user_not_found' }));
      return res.status(401).json({ message: 'بيانات الدخول غير صحيحة' });
    }

    if (user.is_active !== 1) {
      db.prepare(`
        INSERT INTO activity_log (user_id, action, entity_type, details_json)
        VALUES (?, ?, ?, ?)
      `).run(user.id, 'FAILED_LOGIN', 'user', JSON.stringify({ email, reason: 'inactive_account' }));
      return res.status(403).json({ message: 'هذا الحساب معطل، يرجى مراجعة إدارة المكتب' });
    }

    const validPassword = bcrypt.compareSync(password, user.password_hash);
    if (!validPassword) {
      db.prepare(`
        INSERT INTO activity_log (user_id, action, entity_type, details_json)
        VALUES (?, ?, ?, ?)
      `).run(user.id, 'FAILED_LOGIN', 'user', JSON.stringify({ email, reason: 'invalid_password' }));
      return res.status(401).json({ message: 'بيانات الدخول غير صحيحة' });
    }

    const tokens = generateTokens(user);

    // Audit log
    db.prepare(`
      INSERT INTO activity_log (user_id, action, entity_type, details_json)
      VALUES (?, ?, ?, ?)
    `).run(user.id, 'LOGIN', 'user', JSON.stringify({ email: user.email }));

    res.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone
      },
      ...tokens
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/refresh
router.post('/refresh', (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(401).json({ message: 'رمز التحديث مطلوب' });
    }

    jwt.verify(refreshToken, JWT_REFRESH_SECRET, (err, decoded) => {
      if (err) {
        return res.status(403).json({ message: 'انتهت صلاحية الجلسة بالكامل، يرجى إعادة تسجيل الدخول' });
      }

      const user = db.prepare('SELECT * FROM users WHERE id = ?').get(decoded.id);
      if (!user || user.is_active !== 1) {
        return res.status(403).json({ message: 'المستخدم غير موجود أو معطل' });
      }

      const tokens = generateTokens(user);
      res.json({ success: true, ...tokens });
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/auth/me
router.get('/me', authenticateToken, (req, res) => {
  res.json({ success: true, user: req.user });
});

export default router;
