import jwt from 'jsonwebtoken';
import { JWT_SECRET, JWT_REFRESH_SECRET, ACCESS_TOKEN_EXPIRES, REFRESH_TOKEN_EXPIRES } from '../config.js';
import db from '../database/db.js';

export function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'تنبيه: يتطلب تسجيل الدخول للوصول' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ message: 'انتهت صلاحية الجلسة، يرجى إعادة تسجيل الدخول', code: 'TOKEN_EXPIRED' });
    }

    // Verify user is active in DB
    const dbUser = db.prepare('SELECT id, name, email, role, is_active FROM users WHERE id = ?').get(user.id);
    if (!dbUser || dbUser.is_active !== 1) {
      return res.status(403).json({ message: 'الحساب غير مفعّل أو ملغى' });
    }

    req.user = dbUser;
    next();
  });
}

export function generateTokens(user) {
  const payload = { id: user.id, name: user.name, email: user.email, role: user.role };
  const accessToken = jwt.sign(payload, JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRES });
  const refreshToken = jwt.sign(payload, JWT_REFRESH_SECRET, { expiresIn: REFRESH_TOKEN_EXPIRES });
  return { accessToken, refreshToken };
}
