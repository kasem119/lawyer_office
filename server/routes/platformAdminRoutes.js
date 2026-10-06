import express from 'express';
import db from '../database/db.js';
import { authenticateToken } from '../middleware/auth.js';

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
        (SELECT COUNT(*) FROM cases c WHERE c.tenant_id = t.id) as cases_count
      FROM tenants t
      ORDER BY t.id DESC
    `).all();

    res.json({ success: true, tenants });
  } catch (err) {
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
    const { plan, durationMonths = 12, notes } = req.body;

    const tenant = db.prepare('SELECT * FROM tenants WHERE id = ?').get(tenantId);
    if (!tenant) return res.status(404).json({ message: 'المكتب غير موجود' });

    const selectedPlan = plan || (tenant.plan === 'trial' ? 'pro' : tenant.plan);

    // Calculate new expiry date
    const now = new Date();
    const currentEnd = tenant.subscription_ends_at ? new Date(tenant.subscription_ends_at) : now;
    const baseDate = currentEnd > now ? currentEnd : now;
    
    baseDate.setMonth(baseDate.getMonth() + parseInt(durationMonths));
    const newExpiry = baseDate.toISOString();

    const maxUsers = selectedPlan === 'starter' ? 3 : selectedPlan === 'pro' ? 6 : 999;

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
    const tenantId = req.params.id;
    const { status, is_active } = req.body;

    db.prepare(`
      UPDATE tenants SET status = COALESCE(?, status), is_active = COALESCE(?, is_active)
      WHERE id = ?
    `).run(status, is_active !== undefined ? is_active : 1, tenantId);

    res.json({ success: true, message: 'تم تحديث حالة المكتب بنجاح' });
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
    const { durationMonths = 12 } = req.body;

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
      const maxUsers = targetPlan === 'starter' ? 3 : targetPlan === 'pro' ? 6 : 999;

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
