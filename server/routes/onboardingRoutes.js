import express from 'express';
import bcrypt from 'bcryptjs';
import db from '../database/db.js';
import { generateTokens } from '../middleware/auth.js';

const router = express.Router();

// POST /api/onboarding/register-office
router.post('/register-office', (req, res, next) => {
  try {
    const { officeName, adminName, email, password, phone, city, slug } = req.body;
    
    if (!officeName || !adminName || !email || !password) {
      return res.status(400).json({ message: 'الاسم، اسم المكتب، البريد الإلكتروني، وكلمة المرور مطلوبة' });
    }
    
    if (password.length < 8) {
      return res.status(400).json({ message: 'كلمة المرور يجب أن لا تقل عن 8 خانات' });
    }

    // Clean or generate slug
    const cleanSlug = (slug || officeName.replace(/[^a-zA-Z0-9\u0621-\u064A]/g, '-'))
      .trim()
      .toLowerCase()
      .slice(0, 50);

    // Check if slug or email exists
    const existingTenant = db.prepare('SELECT id FROM tenants WHERE slug = ? OR email = ?').get(cleanSlug, email);
    if (existingTenant) {
      return res.status(400).json({ message: 'اسم المعرف أو البريد الإلكتروني مسجل بالفعل لمكتب آخر' });
    }

    const existingUser = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existingUser) {
      return res.status(400).json({ message: 'البريد الإلكتروني مسجل بالفعل لمستخدم آخر' });
    }

    const passwordHash = bcrypt.hashSync(password, 10);
    const trialEnd = new Date();
    trialEnd.setDate(trialEnd.getDate() + 14); // 14-day free trial

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
        VALUES (?, 'trial', 'trial_14_days', 0, 'LYD', CURRENT_TIMESTAMP, ?, 'active', 'فترة تجريبية مجانية')
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

    const result = createOffice();
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
