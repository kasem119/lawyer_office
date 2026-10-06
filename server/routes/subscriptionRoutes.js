import express from 'express';
import db from '../database/db.js';
import { authenticateToken } from '../middleware/auth.js';
import { requireOfficeAccount } from '../middleware/permissions.js';

const router = express.Router();

// GET /api/subscriptions/plans (Public)
router.get('/plans', (req, res) => {
  const plans = [
    {
      id: 'trial',
      name: 'الباقة التجريبية',
      price: 0,
      period: '14 يوم مجاناً',
      currency: 'د.ل',
      description: 'لتجربة كافة مميزات المنظومة بدون أي التزام مالي',
      features: [
        'مستخدم واحد (مدير المكتب)',
        'إدارة حتى 15 قضية',
        'المساعد القانوني الذكي (20 طلب)',
        'التقويم ورول الجلسات',
        'إصدار الفواتير وسندات القبض',
        'دعم فني عبر واتساب'
      ],
      popular: false
    },
    {
      id: 'starter',
      name: 'المكتب الفردي',
      price: 450,
      monthlyEquivalent: 50,
      period: 'سنوياً',
      currency: 'د.ل',
      description: 'مثالية للمحامي المستقل أو المكتب الفردي الصغير',
      features: [
        'حتى 2 مستخدمين (محامي + سكرتير)',
        'قضايا وموكلين غير محدود',
        'مساعد ذكي لصياغة العقود (100 طلب/شهر)',
        'إدارة فواتير وأتعاب كاملة بالدينار الليبي',
        'أرشفة المستندات والملفات (5 جيجابايت)',
        'تنبيهات الجلسات القضائية عبر البريد',
        'دعم فني مستمر'
      ],
      popular: false
    },
    {
      id: 'pro',
      name: 'المكتب المحترف',
      price: 950,
      monthlyEquivalent: 100,
      period: 'سنوياً',
      currency: 'د.ل',
      description: 'الخيار الأكثر طلباً لمكاتب المحاماة النشطة والشراكات',
      features: [
        'حتى 6 مستخدمين للمكتب',
        'قضايا وموكلين غير محدود',
        'المساعد القانوني الذكي غير محدود',
        'كشف تعارض المصالح آلياً',
        'بوابة إلكترونية لمتابعة قضايا الموكلين',
        'أرشفة مستندات متقدمة (25 جيجابايت)',
        'تقارير أداء ومحاسبة شاملة للمكتب',
        'أولوية في الدعم الفني والتحديثات'
      ],
      popular: true
    },
    {
      id: 'enterprise',
      name: 'الشركات والمؤسسات',
      price: 1800,
      period: 'سنوياً',
      currency: 'د.ل',
      description: 'للمكاتب الكبرى والشركات القانونية متعددة الفروع',
      features: [
        'عدد غير محدود من المحامين والمستخدمين',
        'مساحة تخزين غير محدودة (100 جيجابايت)',
        'تخصيص كامل للهوية البصرية والترويسة',
        'نسخة سطح مكتب مخصصة للشبكة الداخلية',
        'مدير حساب ومسؤول دعم فني مخصص',
        'تدريب كادر المكتب مجاناً'
      ],
      popular: false
    }
  ];

  // Bank & Offline Payment Details for Libya
  const paymentInfo = {
    methods: [
      {
        id: 'bank_transfer',
        title: 'تحويل مصرفي مباشر',
        details: [
          { bank: 'مصرف الجمهورية', accountName: 'إدارة منظومة المحاماة', accountNumber: '018-XXXXXX', iban: 'LY0000180000000000000000' },
          { bank: 'المصرف التجاري الوطني', accountName: 'إدارة منظومة المحاماة', accountNumber: '012-XXXXXX', iban: 'LY0000120000000000000000' },
          { bank: 'مصرف الأمان', accountName: 'إدارة منظومة المحاماة', accountNumber: '025-XXXXXX', iban: 'LY0000250000000000000000' }
        ]
      },
      {
        id: 'electronic',
        title: 'الدفع الإلكتروني المحلي (سداد / موبي كاش)',
        details: [
          { service: 'خدمة سداد (Sadad)', phone: '091XXXXXXX' },
          { service: 'خدمة موبي كاش (MobiCash)', phone: '092XXXXXXX' }
        ]
      },
      {
        id: 'cash',
        title: 'الدفع نقداً (كاش) / مكتبنا',
        details: [
          { location: 'طرابلس / بنغازي / مصراتة', note: 'الدفع المباشر واستلام إيصال رسمي معتمد' }
        ]
      }
    ],
    whatsappSupport: '0910000000',
    contactEmail: 'contact@lawyer-system.ly'
  };

  res.json({ success: true, plans, paymentInfo });
});

router.use(authenticateToken, requireOfficeAccount);

// GET /api/subscriptions/current
router.get('/current', (req, res, next) => {
  try {
    const tenantId = req.user.tenant_id || 1;
    const tenant = db.prepare('SELECT * FROM tenants WHERE id = ?').get(tenantId);
    if (!tenant) return res.status(404).json({ message: 'المكتب غير موجود' });

    // Calculate days remaining
    const now = new Date();
    const expiryDate = new Date(tenant.subscription_ends_at || tenant.trial_ends_at || now);
    const diffTime = expiryDate.getTime() - now.getTime();
    const daysRemaining = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
    const isExpired = diffTime < 0;

    // Get current subscription record
    const subscription = db.prepare(`
      SELECT * FROM subscriptions WHERE tenant_id = ? ORDER BY id DESC LIMIT 1
    `).get(tenantId);

    // Get usage stats
    const usersCount = db.prepare('SELECT COUNT(*) as count FROM users WHERE tenant_id = ?').get(tenantId)?.count || 1;
    const casesCount = db.prepare('SELECT COUNT(*) as count FROM cases WHERE tenant_id = ?').get(tenantId)?.count || 0;
    const clientsCount = db.prepare('SELECT COUNT(*) as count FROM clients WHERE tenant_id = ?').get(tenantId)?.count || 0;
    const docsCount = db.prepare('SELECT COUNT(*) as count FROM documents WHERE tenant_id = ?').get(tenantId)?.count || 0;

    res.json({
      success: true,
      tenant: {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        plan: tenant.plan,
        status: tenant.status,
        trial_ends_at: tenant.trial_ends_at,
        subscription_ends_at: tenant.subscription_ends_at,
        max_users: tenant.max_users
      },
      subscription: subscription || { plan: tenant.plan, status: tenant.status },
      daysRemaining,
      isExpired,
      usage: {
        users: usersCount,
        maxUsers: tenant.max_users || 3,
        cases: casesCount,
        clients: clientsCount,
        documents: docsCount
      }
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/subscriptions/payment - Submit an offline payment / transfer receipt
router.post('/payment', (req, res, next) => {
  try {
    const tenantId = req.user.tenant_id || 1;
    const { amount, method, reference_number, notes } = req.body;

    if (!amount || !method) {
      return res.status(400).json({ message: 'المبلغ وطريقة التحويل مطلوبة' });
    }

    const result = db.prepare(`
      INSERT INTO tenant_payments (tenant_id, amount, currency, payment_method, reference_number, notes, status)
      VALUES (?, ?, 'LYD', ?, ?, ?, 'pending')
    `).run(tenantId, parseFloat(amount), method, reference_number || null, notes || null);

    res.status(201).json({
      success: true,
      message: 'تم إرسال إشعار السداد بنجاح! سيتم مراجعة التحويل وتفعيل اشتراكك فوراً من قبل الإدارة.',
      paymentId: result.lastInsertRowid
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/subscriptions/payments - View payment history
router.get('/payments', (req, res, next) => {
  try {
    const tenantId = req.user.tenant_id || 1;
    const payments = db.prepare(`
      SELECT * FROM tenant_payments WHERE tenant_id = ? ORDER BY id DESC
    `).all(tenantId);
    res.json({ success: true, payments });
  } catch (err) {
    next(err);
  }
});

export default router;
