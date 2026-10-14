import express from 'express';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'node:crypto';
import db from '../database/db.js';
import { generateTokens } from '../middleware/auth.js';
import { trialEndsAt } from '../domain/subscriptions/accessPolicy.js';

const router = express.Router();

// POST /api/onboarding/register-office
router.post('/register-office', (req, res, next) => {
  try {
    const { officeName, adminName, password, phone, city, slug } = req.body;
    const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    
    if (!officeName || !adminName || !email || !password) {
      return res.status(400).json({ message: 'الاسم، اسم المكتب، البريد الإلكتروني، وكلمة المرور مطلوبة' });
    }
    
    if (password.length < 8) {
      return res.status(400).json({ message: 'كلمة المرور يجب أن لا تقل عن 8 خانات' });
    }

    // Arabic office names do not produce a useful ASCII slug. Never derive a
    // shared slug from them: generate a random one when the client has none.
    const requestedSlug = typeof slug === 'string'
      ? slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-{2,}/g, '-').replace(/^-+|-+$/g, '').slice(0, 50)
      : '';
    const cleanSlug = requestedSlug || `office-${randomBytes(6).toString('hex')}`;

    const existingTenantEmail = db.prepare('SELECT id FROM tenants WHERE LOWER(TRIM(email)) = ?').get(email);
    if (existingTenantEmail) {
      return res.status(409).json({ message: 'هذا البريد الإلكتروني مسجل بالفعل لمكتب. سجّل الدخول أو استخدم بريداً آخر.' });
    }

    const existingUserEmail = db.prepare('SELECT id FROM users WHERE LOWER(TRIM(email)) = ?').get(email);
    if (existingUserEmail) {
      return res.status(409).json({ message: 'هذا البريد الإلكتروني مسجل بالفعل. سجّل الدخول أو استخدم بريداً آخر.' });
    }

    const existingTenantSlug = db.prepare('SELECT id FROM tenants WHERE slug = ?').get(cleanSlug);
    if (existingTenantSlug) {
      return res.status(409).json({ message: 'معرّف المكتب مستخدم بالفعل. أعد المحاولة لإنشاء معرّف جديد.' });
    }

    const passwordHash = bcrypt.hashSync(password, 10);
    const trialEnd = new Date(trialEndsAt());

    const createOffice = db.transaction(() => {
      // 1. Create Tenant
      const tenantResult = db.prepare(`
        INSERT INTO tenants (slug, name, owner_name, email, phone, city, plan, status, trial_ends_at, subscription_ends_at, max_users, is_active)
        VALUES (?, ?, ?, ?, ?, ?, 'trial', 'active', ?, ?, 3, 1)
      `).run(
        cleanSlug,
        officeName,
        adminName,
        email,
        phone || null,
        city || 'طرابلس',
        trialEnd.toISOString(),
        trialEnd.toISOString()
      );

      const tenantId = tenantResult.lastInsertRowid;

      // 2. Create Initial Subscription Record
      db.prepare(`
        INSERT INTO subscriptions (tenant_id, plan, period, amount, currency, starts_at, ends_at, status, notes)
        VALUES (?, 'trial', 'trial_30_days', 0, 'LYD', CURRENT_TIMESTAMP, ?, 'active', 'فترة تجريبية مجانية')
      `).run(tenantId, trialEnd.toISOString());

      // 3. Create Admin User
      const userResult = db.prepare(`
        INSERT INTO users (name, email, password_hash, role, phone, is_active, tenant_id)
        VALUES (?, ?, ?, 'admin', ?, 1, ?)
      `).run(
        adminName,
        email,
        passwordHash,
        phone || null,
        tenantId
      );

      const userId = userResult.lastInsertRowid;

      // 4. Activity log
      db.prepare(`
        INSERT INTO activity_log (user_id, action, entity_type, details_json, tenant_id)
        VALUES (?, 'REGISTER_OFFICE', 'tenant', ?, ?)
      `).run(userId, JSON.stringify({ officeName, email, slug: cleanSlug }), tenantId);

      return {
        user: { id: userId, name: adminName, email, role: 'admin', phone, tenant_id: tenantId },
        tenant: { id: tenantId, name: officeName, slug: cleanSlug, plan: 'trial', status: 'active', trial_ends_at: trialEnd.toISOString() }
      };
    });

    let result;
    try {
      result = createOffice();
    } catch (err) {
      // A simultaneous signup can pass the checks above, then lose the unique
      // index race. Return a useful conflict instead of a generic server error.
      if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        return res.status(409).json({ message: 'البريد الإلكتروني أو معرّف المكتب مسجل بالفعل. راجع البيانات وحاول مجدداً.' });
      }
      throw err;
    }
    const tokens = generateTokens(result.user);

    res.status(201).json({
      success: true,
      message: 'تم تسجيل مكتب المحاماة بنجاح، مرحباً بك في المنظومة!',
      user: result.user,
      tenant: result.tenant,
      ...tokens
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/onboarding/check-slug
router.post('/check-slug', (req, res, next) => {
  try {
    const { slug } = req.body;
    if (!slug) {
      return res.status(400).json({ message: 'الرابط التعريفي مطلوب' });
    }
    const tenant = db.prepare('SELECT id FROM tenants WHERE slug = ?').get(slug.trim().toLowerCase());
    res.json({ available: !tenant });
  } catch (err) {
    next(err);
  }
});

export default router;
