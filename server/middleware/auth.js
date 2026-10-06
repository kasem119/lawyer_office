import jwt from 'jsonwebtoken';
import { JWT_SECRET, JWT_REFRESH_SECRET, ACCESS_TOKEN_EXPIRES, REFRESH_TOKEN_EXPIRES } from '../config.js';
import db from '../database/db.js';

export function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  let token = authHeader && authHeader.split(' ')[1];

  // Fallback to cookie if present in request headers
  if (!token && req.headers.cookie) {
    const match = req.headers.cookie.match(/token=([^;]+)/);
    if (match) token = match[1];
  }

  if (!token) {
    return res.status(401).json({ message: 'تنبيه: يتطلب تسجيل الدخول للوصول' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ message: 'انتهت صلاحية الجلسة، يرجى إعادة تسجيل الدخول', code: 'TOKEN_EXPIRED' });
    }

    // Verify user is active in DB
    const dbUser = db.prepare('SELECT id, name, email, role, phone, is_active, tenant_id FROM users WHERE id = ?').get(user.id);
    if (!dbUser || dbUser.is_active !== 1) {
      return res.status(403).json({ message: 'الحساب غير مفعّل أو ملغى' });
    }

    req.user = dbUser;
    
    // Attach tenant details
    try {
      req.tenant = db.prepare('SELECT * FROM tenants WHERE id = ?').get(dbUser.tenant_id || 1) || null;
    } catch {
      req.tenant = null;
    }

    next();
  });
}

export function generateTokens(user) {
  const tenantId = user.tenant_id || 1;
  const payload = { id: user.id, name: user.name, email: user.email, role: user.role, tenant_id: tenantId };
  const accessToken = jwt.sign(payload, JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRES });
  const refreshToken = jwt.sign(payload, JWT_REFRESH_SECRET, { expiresIn: REFRESH_TOKEN_EXPIRES });
  return { accessToken, refreshToken, tenantId };
}
