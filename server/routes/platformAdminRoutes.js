import express from 'express';
import bcrypt from 'bcryptjs';
import fs from 'node:fs';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import db from '../database/db.js';
import { authenticateToken } from '../middleware/auth.js';
import { UPLOADS_DIR } from '../config.js';
import { disconnectUser } from '../services/websocketService.js';

const router = express.Router();

// Middleware: Platform Admin verification
// ONLY users with role 'super_admin' are allowed
function requirePlatformOwner(req, res, next) {
  if (req.user.role !== 'super_admin') {
    return res.status(403).json({ message: 'عفواً، هذه اللوحة مخصصة لإدارة المنظومة الرئيسية فقط' });
  }
  next();
}

router.use(authenticateToken);
router.use(requirePlatformOwner);

const defaultPlatformSettings = {
  defaultRenewalMonths: 12,
  starterMaxUsers: 3,
  proMaxUsers: 6,
  enterpriseMaxUsers: 999
};

function getPlatformSettings() {
  const rows = db.prepare("SELECT key, value FROM settings WHERE key LIKE 'platform.%'").all();
  const stored = Object.fromEntries(rows.map(({ key, value }) => [key.slice('platform.'.length), Number(value)]));
  return { ...defaultPlatformSettings, ...stored };
}

function maxUsersForPlan(plan) {
  const settings = getPlatformSettings();
  if (plan === 'starter') return settings.starterMaxUsers;
  if (plan === 'pro') return settings.proMaxUsers;
  return settings.enterpriseMaxUsers;
}

router.get('/settings', (req, res, next) => {
  try {
    res.json({ success: true, settings: getPlatformSettings() });
  } catch (err) {
    next(err);
  }
});

router.put('/settings', (req, res, next) => {
  try {
    const { defaultRenewalMonths, starterMaxUsers, proMaxUsers, enterpriseMaxUsers } = req.body || {};
    const settings = { defaultRenewalMonths, starterMaxUsers, proMaxUsers, enterpriseMaxUsers };
    const allowedRenewalTerms = [1, 3, 6, 12, 24];

    if (!allowedRenewalTerms.includes(Number(defaultRenewalMonths))) {
      return res.status(400).json({ message: 'مدة التجديد يجب أن تكون 1 أو 3 أو 6 أو 12 أو 24 شهراً' });
    }
    for (const key of ['starterMaxUsers', 'proMaxUsers', 'enterpriseMaxUsers']) {
      const value = Number(settings[key]);
      if (!Number.isInteger(value) || value < 1 || value > 10000) {
        return res.status(400).json({ message: 'حد المستخدمين لكل خطة يجب أن يكون بين 1 و10000' });
      }
      settings[key] = value;
    }
    settings.defaultRenewalMonths = Number(defaultRenewalMonths);
    if (settings.proMaxUsers < settings.starterMaxUsers || settings.enterpriseMaxUsers < settings.proMaxUsers) {
      return res.status(400).json({ message: 'يجب ألا يقل حد المستخدمين في الخطة الأعلى عن الخطة الأدنى' });
    }

    db.transaction(() => {
      for (const [key, value] of Object.entries(settings)) {
        db.prepare(`
          INSERT INTO settings (key, value) VALUES (?, ?)
          ON CONFLICT(key) DO UPDATE SET value = excluded.value
        `).run(`platform.${key}`, String(value));
      }
    })();

    res.json({ success: true, settings });
  } catch (err) {
    next(err);
  }
});

// GET /api/platform/stats - Platform Overview Stats
router.get('/stats', (req, res, next) => {
  try {
    const totalTenants = db.prepare('SELECT COUNT(*) as count FROM tenants').get()?.count || 0;
    const activeTenants = db.prepare("SELECT COUNT(*) as count FROM tenants WHERE status = 'active'").get()?.count || 0;
    const trialTenants = db.prepare("SELECT COUNT(*) as count FROM tenants WHERE plan = 'trial'").get()?.count || 0;
    const paidTenants = db.prepare("SELECT COUNT(*) as count FROM tenants WHERE plan != 'trial' AND status = 'active'").get()?.count || 0;
    
    const pendingPaymentsCount = db.prepare("SELECT COUNT(*) as count FROM tenant_payments WHERE status = 'pending'").get()?.count || 0;
    const totalRevenue = db.prepare("SELECT SUM(amount) as sum FROM tenant_payments WHERE status = 'confirmed'").get()?.sum || 0;

    const totalCases = db.prepare('SELECT COUNT(*) as count FROM cases').get()?.count || 0;
    const totalLawyers = db.prepare('SELECT COUNT(*) as count FROM users').get()?.count || 0;

    res.json({
      success: true,
      stats: {
        totalTenants,
        activeTenants,
        trialTenants,
        paidTenants,
        pendingPaymentsCount,
        totalRevenue,
        totalCases,
        totalLawyers
      }
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/platform/tenants - List all offices
router.get('/tenants', (req, res, next) => {
  try {
    const tenants = db.prepare(`
      SELECT t.*, 
        (SELECT COUNT(*) FROM users u WHERE u.tenant_id = t.id) as users_count,
        (SELECT COUNT(*) FROM cases c WHERE c.tenant_id = t.id) as cases_count,
        (SELECT u.id FROM users u WHERE u.tenant_id = t.id AND u.role = 'admin'
          AND LOWER(TRIM(u.email)) = LOWER(TRIM(t.email)) ORDER BY u.id LIMIT 1) as owner_login_user_id,
        (SELECT u.is_active FROM users u WHERE u.tenant_id = t.id AND u.role = 'admin'
          AND LOWER(TRIM(u.email)) = LOWER(TRIM(t.email)) ORDER BY u.id LIMIT 1) as owner_login_active
      FROM tenants t
      ORDER BY t.id DESC
    `).all();

    res.json({ success: true, tenants });
  } catch (err) {
    next(err);
  }
});

// POST /api/platform/tenants - Create an office and its initial admin account
router.post('/tenants', (req, res, next) => {
  try {
    const { name, owner_name, email, password, phone, city, slug } = req.body || {};
    const officeName = typeof name === 'string' ? name.trim() : '';
    const ownerName = typeof owner_name === 'string' ? owner_name.trim() : '';
    const cleanEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
    if (!officeName || !ownerName || !cleanEmail || typeof password !== 'string') {
      return res.status(400).json({ message: 'اسم المكتب واسم المدير والبريد وكلمة المرور مطلوبة' });
    }
    if (password.length < 8) return res.status(400).json({ message: 'كلمة المرور يجب ألا تقل عن 8 خانات' });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return res.status(400).json({ message: 'البريد الإلكتروني غير صالح' });
    }
    if (db.prepare('SELECT id FROM tenants WHERE LOWER(TRIM(email)) = ?').get(cleanEmail) ||
        db.prepare('SELECT id FROM users WHERE LOWER(TRIM(email)) = ?').get(cleanEmail)) {
      return res.status(409).json({ message: 'البريد الإلكتروني مسجل بالفعل' });
    }

    const requestedSlug = typeof slug === 'string'
      ? slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-{2,}/g, '-').replace(/^-+|-+$/g, '').slice(0, 50)
      : '';
    const tenantSlug = requestedSlug || `office-${randomBytes(6).toString('hex')}`;
    if (db.prepare('SELECT id FROM tenants WHERE slug = ?').get(tenantSlug)) {
      return res.status(409).json({ message: 'معرّف المكتب مستخدم بالفعل' });
    }

    const trialEnd = new Date();
    trialEnd.setDate(trialEnd.getDate() + 14);
    const passwordHash = bcrypt.hashSync(password, 10);
    const createOffice = db.transaction(() => {
      const tenant = db.prepare(`
        INSERT INTO tenants (slug, name, owner_name, email, phone, city, plan, status, trial_ends_at, subscription_ends_at, max_users, is_active)
        VALUES (?, ?, ?, ?, ?, ?, 'trial', 'active', ?, ?, ?, 1)
      `).run(tenantSlug, officeName, ownerName, cleanEmail, phone?.trim() || null, city?.trim() || null, trialEnd.toISOString(), trialEnd.toISOString(), getPlatformSettings().starterMaxUsers);
      const tenantId = Number(tenant.lastInsertRowid);
      const admin = db.prepare(`
        INSERT INTO users (name, email, password_hash, role, phone, is_active, tenant_id)
        VALUES (?, ?, ?, 'admin', ?, 1, ?)
      `).run(ownerName, cleanEmail, passwordHash, phone?.trim() || null, tenantId);
      db.prepare(`
        INSERT INTO subscriptions (tenant_id, plan, period, amount, currency, starts_at, ends_at, status, notes)
        VALUES (?, 'trial', 'trial_14_days', 0, 'LYD', CURRENT_TIMESTAMP, ?, 'active', 'إنشاء من لوحة مالك المنصة')
      `).run(tenantId, trialEnd.toISOString());
      db.prepare(`
        INSERT INTO activity_log (user_id, action, entity_type, entity_id, details_json, tenant_id)
        VALUES (?, 'PLATFORM_CREATE_TENANT', 'tenant', ?, ?, ?)
      `).run(req.user.id, tenantId, JSON.stringify({ name: officeName, adminEmail: cleanEmail }), tenantId);
      return { tenantId, adminId: Number(admin.lastInsertRowid) };
    });

    const created = createOffice();
    res.status(201).json({
      success: true,
      message: 'تم إنشاء حساب المكتب التجريبي بنجاح',
      tenant: { id: created.tenantId, name: officeName, owner_name: ownerName, email: cleanEmail, slug: tenantSlug, plan: 'trial', status: 'active', trial_ends_at: trialEnd.toISOString() },
      admin: { id: created.adminId, email: cleanEmail }
    });
  } catch (err) {
    if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') return res.status(409).json({ message: 'البريد أو معرّف المكتب مسجل بالفعل' });
    next(err);
  }
});

// GET /api/platform/tenants/:id - Office details
router.get('/tenants/:id', (req, res, next) => {
  try {
    const tenant = db.prepare('SELECT * FROM tenants WHERE id = ?').get(req.params.id);
    if (!tenant) return res.status(404).json({ message: 'المكتب غير موجود' });

    const users = db.prepare('SELECT id, name, email, role, phone, is_active FROM users WHERE tenant_id = ?').all(tenant.id);
    const payments = db.prepare('SELECT * FROM tenant_payments WHERE tenant_id = ? ORDER BY id DESC').all(tenant.id);
    const subscription = db.prepare('SELECT * FROM subscriptions WHERE tenant_id = ? ORDER BY id DESC LIMIT 1').get(tenant.id);

    res.json({ success: true, tenant, users, payments, subscription });
  } catch (err) {
    next(err);
  }
});

// POST /api/platform/tenants/:id/activate - Activate / Extend Office Subscription
router.post('/tenants/:id/activate', (req, res, next) => {
  try {
    const tenantId = req.params.id;
    const { plan, notes } = req.body;
    const durationMonths = Number(req.body.durationMonths || getPlatformSettings().defaultRenewalMonths);

    const tenant = db.prepare('SELECT * FROM tenants WHERE id = ?').get(tenantId);
    if (!tenant) return res.status(404).json({ message: 'المكتب غير موجود' });

    const selectedPlan = plan || (tenant.plan === 'trial' ? 'pro' : tenant.plan);

    // Calculate new expiry date
    const now = new Date();
    const currentEnd = tenant.subscription_ends_at ? new Date(tenant.subscription_ends_at) : now;
    const baseDate = currentEnd > now ? currentEnd : now;
    
    baseDate.setMonth(baseDate.getMonth() + parseInt(durationMonths));
    const newExpiry = baseDate.toISOString();

    const maxUsers = maxUsersForPlan(selectedPlan);

    db.transaction(() => {
      db.prepare(`
        UPDATE tenants
        SET plan = ?, status = 'active', subscription_ends_at = ?, max_users = ?, is_active = 1
        WHERE id = ?
      `).run(selectedPlan, newExpiry, maxUsers, tenantId);

      db.prepare(`
        INSERT INTO subscriptions (tenant_id, plan, period, starts_at, ends_at, status, notes)
        VALUES (?, ?, ?, CURRENT_TIMESTAMP, ?, 'active', ?)
      `).run(tenantId, selectedPlan, `${durationMonths}_months`, newExpiry, notes || 'تفعيل مباشر من الإدارة');
    })();

    res.json({
      success: true,
      message: `تم تفعيل اشتراك المكتب بنجاح حتى تاريخ: ${new Date(newExpiry).toLocaleDateString('ar-LY')}`,
      newExpiry
    });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/platform/tenants/:id/status - Toggle Office Status (Suspend / Resume)
router.patch('/tenants/:id/status', (req, res, next) => {
  try {
    const tenantId = Number(req.params.id);
    const { status } = req.body || {};
    if (!Number.isInteger(tenantId) || !['active', 'suspended'].includes(status)) {
      return res.status(400).json({ message: 'حالة المكتب غير صالحة' });
    }
    const tenant = db.prepare('SELECT id, name FROM tenants WHERE id = ?').get(tenantId);
    if (!tenant) return res.status(404).json({ message: 'المكتب غير موجود' });

    db.transaction(() => {
      db.prepare('UPDATE tenants SET status = ?, is_active = ? WHERE id = ?').run(status, status === 'active' ? 1 : 0, tenantId);
      db.prepare(`
        INSERT INTO activity_log (user_id, action, entity_type, entity_id, details_json, tenant_id)
        VALUES (?, ?, 'tenant', ?, ?, ?)
      `).run(req.user.id, status === 'suspended' ? 'PLATFORM_SUSPEND_TENANT' : 'PLATFORM_REACTIVATE_TENANT', tenantId, JSON.stringify({ name: tenant.name }), tenantId);
    })();

    res.json({ success: true, message: status === 'suspended' ? 'تم إيقاف دخول المكتب مع الاحتفاظ ببياناته' : 'تمت إعادة تفعيل دخول المكتب' });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/platform/tenants/:id/owner-login - Disable/restore the office owner's login without deleting records
router.patch('/tenants/:id/owner-login', (req, res, next) => {
  try {
    const tenantId = Number(req.params.id);
    const { active } = req.body || {};
    if (!Number.isInteger(tenantId) || tenantId < 1 || typeof active !== 'boolean') {
      return res.status(400).json({ message: 'بيانات دخول مدير المكتب غير صالحة' });
    }

    const tenant = db.prepare('SELECT id, name, email FROM tenants WHERE id = ?').get(tenantId);
    if (!tenant) return res.status(404).json({ message: 'المكتب غير موجود' });
    const ownerLogin = db.prepare(`
      SELECT id, is_active FROM users
      WHERE tenant_id = ? AND role = 'admin' AND LOWER(TRIM(email)) = LOWER(TRIM(?))
      ORDER BY id LIMIT 1
    `).get(tenantId, tenant.email);
    if (!ownerLogin) return res.status(404).json({ message: 'لم يتم العثور على حساب مدير المكتب المرتبط بهذا البريد' });
    if (ownerLogin.is_active === Number(active)) {
      return res.json({ success: true, message: active ? 'دخول مدير المكتب مفعّل بالفعل' : 'دخول مدير المكتب موقوف بالفعل' });
    }

    db.transaction(() => {
      db.prepare('UPDATE users SET is_active = ? WHERE id = ? AND tenant_id = ?')
        .run(active ? 1 : 0, ownerLogin.id, tenantId);
      db.prepare(`
        INSERT INTO activity_log (user_id, action, entity_type, entity_id, details_json, tenant_id)
        VALUES (?, ?, 'tenant_owner_login', ?, ?, ?)
      `).run(req.user.id, active ? 'PLATFORM_RESTORE_TENANT_OWNER_LOGIN' : 'PLATFORM_REMOVE_TENANT_OWNER_LOGIN', tenantId,
        JSON.stringify({ officeName: tenant.name, ownerLoginUserId: ownerLogin.id }), tenantId);
    })();
    if (!active) disconnectUser(ownerLogin.id);

    res.json({
      success: true,
      message: active ? 'تمت إعادة دخول مدير المكتب مع الاحتفاظ بالبيانات' : 'تم إيقاف دخول مدير المكتب مع الاحتفاظ بجميع بيانات المكتب'
    });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/platform/tenants/:id - Permanently remove a suspended office and its records
router.delete('/tenants/:id', (req, res, next) => {
  try {
    const tenantId = Number(req.params.id);
    const confirmation = typeof req.body?.confirmation === 'string' ? req.body.confirmation.trim() : '';
    if (!Number.isInteger(tenantId) || tenantId < 1) {
      return res.status(400).json({ message: 'معرّف المكتب غير صالح' });
    }
    if (tenantId === 1) {
      return res.status(403).json({ message: 'لا يمكن حذف المكتب الرئيسي الافتراضي' });
    }

    const tenant = db.prepare('SELECT id, name, owner_name, email, slug, status, is_active FROM tenants WHERE id = ?').get(tenantId);
    if (!tenant) return res.status(404).json({ message: 'المكتب غير موجود' });
    if (tenant.status !== 'suspended' && tenant.is_active !== 0) {
      return res.status(409).json({ message: 'أوقف دخول المكتب أولاً قبل حذفه نهائياً' });
    }
    if (confirmation !== tenant.name.trim()) {
      return res.status(400).json({ message: 'اكتب اسم المكتب كما يظهر لتأكيد الحذف النهائي' });
    }

    const tenantUserIds = db.prepare('SELECT id FROM users WHERE tenant_id = ?').all(tenantId).map(user => user.id);
    const fileRows = [
      ...db.prepare('SELECT file_path AS path FROM documents WHERE tenant_id = ?').all(tenantId),
      ...db.prepare(`SELECT dv.file_path AS path FROM document_versions dv
        JOIN documents d ON d.id = dv.document_id WHERE d.tenant_id = ?`).all(tenantId),
      ...db.prepare('SELECT receipt_path AS path FROM expenses WHERE tenant_id = ? AND receipt_path IS NOT NULL').all(tenantId),
      ...db.prepare('SELECT receipt_image AS path FROM tenant_payments WHERE tenant_id = ? AND receipt_image IS NOT NULL').all(tenantId)
    ];
    const uploadRoot = path.resolve(UPLOADS_DIR);
    const rootPrefix = uploadRoot.endsWith(path.sep) ? uploadRoot : `${uploadRoot}${path.sep}`;
    const filePaths = [...new Set(fileRows.map(row => row.path).filter(value => typeof value === 'string' && value.trim()).map(value => {
      const resolved = path.resolve(path.isAbsolute(value) ? value : path.join(uploadRoot, value));
      if (!resolved.startsWith(rootPrefix)) return null;
      return resolved;
    }).filter(Boolean))];

    db.transaction(() => {
      const tenantUsers = '(SELECT id FROM users WHERE tenant_id = ?)';
      const tenantCases = '(SELECT id FROM cases WHERE tenant_id = ?)';
      const tenantDocuments = '(SELECT id FROM documents WHERE tenant_id = ?)';
      const tenantInvoices = '(SELECT id FROM invoices WHERE tenant_id = ?)';

      // Remove dependent rows first; some legacy foreign keys intentionally restrict user deletion.
      db.prepare(`DELETE FROM document_shares WHERE document_id IN ${tenantDocuments}
        OR shared_with_user_id IN ${tenantUsers} OR shared_by_user_id IN ${tenantUsers}`)
        .run(tenantId, tenantId, tenantId);
      db.prepare(`DELETE FROM document_versions WHERE document_id IN ${tenantDocuments}`).run(tenantId);
      db.prepare(`DELETE FROM case_lawyers WHERE case_id IN ${tenantCases} OR user_id IN ${tenantUsers}`)
        .run(tenantId, tenantId);
      db.prepare(`DELETE FROM invoice_items WHERE invoice_id IN ${tenantInvoices}`).run(tenantId);
      db.prepare(`DELETE FROM notifications WHERE user_id IN ${tenantUsers}`).run(tenantId);
      db.prepare(`DELETE FROM push_subscriptions WHERE user_id IN ${tenantUsers}`).run(tenantId);

      // Rows owned directly by this office, in foreign-key-safe order.
      for (const table of [
        'activity_log', 'document_templates', 'case_notes', 'tasks', 'events',
        'invoices', 'expenses', 'time_entries', 'documents', 'cases', 'clients',
        'users', 'subscriptions', 'tenant_payments'
      ]) {
        db.prepare(`DELETE FROM ${table} WHERE tenant_id = ?`).run(tenantId);
      }

      db.prepare('DELETE FROM tenants WHERE id = ?').run(tenantId);
      // Keep a platform-level audit event after removing the office's own activity history.
      db.prepare(`
        INSERT INTO activity_log (user_id, action, entity_type, entity_id, details_json, tenant_id)
        VALUES (?, 'PLATFORM_DELETE_TENANT', 'tenant', ?, ?, ?)
      `).run(req.user.id, tenantId, JSON.stringify({ deletedOfficeId: tenantId }), tenantId);
    })();

    tenantUserIds.forEach(userId => disconnectUser(userId, 'تم حذف حساب المكتب'));

    let filesDeleted = 0;
    let fileCleanupFailures = 0;
    for (const filePath of filePaths) {
      if (!fs.existsSync(filePath)) continue;
      try {
        fs.unlinkSync(filePath);
        filesDeleted += 1;
      } catch {
        fileCleanupFailures += 1;
      }
    }

    res.json({
      success: true,
      message: fileCleanupFailures
        ? `تم حذف بيانات المكتب، لكن تعذّر حذف ${fileCleanupFailures} ملف من مجلد المرفقات`
        : 'تم حذف المكتب وجميع بياناته نهائياً',
      filesDeleted,
      fileCleanupFailures
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/platform/payments/pending - List Pending Payments
router.get('/payments/pending', (req, res, next) => {
  try {
    const payments = db.prepare(`
      SELECT p.*, t.name as tenant_name, t.slug as tenant_slug, t.phone as tenant_phone
      FROM tenant_payments p
      JOIN tenants t ON p.tenant_id = t.id
      WHERE p.status = 'pending'
      ORDER BY p.id DESC
    `).all();

    res.json({ success: true, payments });
  } catch (err) {
    next(err);
  }
});

// POST /api/platform/payments/:id/confirm - Confirm Payment and Auto-Extend
router.post('/payments/:id/confirm', (req, res, next) => {
  try {
    const paymentId = req.params.id;
    const durationMonths = Number(req.body.durationMonths || getPlatformSettings().defaultRenewalMonths);

    const payment = db.prepare('SELECT * FROM tenant_payments WHERE id = ?').get(paymentId);
    if (!payment) return res.status(404).json({ message: 'الدفعة غير موجودة' });

    const tenant = db.prepare('SELECT * FROM tenants WHERE id = ?').get(payment.tenant_id);

    const now = new Date();
    const currentEnd = tenant?.subscription_ends_at ? new Date(tenant.subscription_ends_at) : now;
    const baseDate = currentEnd > now ? currentEnd : now;
    baseDate.setMonth(baseDate.getMonth() + parseInt(durationMonths));
    const newExpiry = baseDate.toISOString();

    db.transaction(() => {
      // Confirm payment
      db.prepare(`
        UPDATE tenant_payments
        SET status = 'confirmed', confirmed_by = ?, confirmed_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(req.user.name, paymentId);

      // Upgrade tenant if in trial
      const targetPlan = tenant.plan === 'trial' ? 'pro' : tenant.plan;
      const maxUsers = maxUsersForPlan(targetPlan);

      db.prepare(`
        UPDATE tenants
        SET plan = ?, status = 'active', subscription_ends_at = ?, max_users = ?, is_active = 1
        WHERE id = ?
      `).run(targetPlan, newExpiry, maxUsers, payment.tenant_id);
    })();

    res.json({ success: true, message: 'تم تأكيد الدفعة وتمديد الاشتراك بنجاح!' });
  } catch (err) {
    next(err);
  }
});

// POST /api/platform/payments/:id/reject - Reject Payment
router.post('/payments/:id/reject', (req, res, next) => {
  try {
    const paymentId = req.params.id;
    const { reason } = req.body;

    db.prepare(`
      UPDATE tenant_payments
      SET status = 'rejected', notes = COALESCE(?, notes), confirmed_by = ?
      WHERE id = ?
    `).run(reason, req.user.name, paymentId);

    res.json({ success: true, message: 'تم رفض الدفعة' });
  } catch (err) {
    next(err);
  }
});

export default router;
