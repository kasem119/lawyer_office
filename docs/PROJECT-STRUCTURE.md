# هيكل المشروع

```text
lawyer_office/
├── client/                  # واجهة ويب React وVite
│   ├── public/              # الأصول العامة وService Worker
│   ├── scripts/             # فحوص الواجهة والحزمة
│   └── src/
│       ├── api/              # الاتصال بالخادم
│       ├── components/       # الشاشات والمكونات حسب المجال
│       ├── contexts/         # حالة التطبيق المشتركة
│       ├── hooks/            # React hooks
│       └── utils/            # أدوات مساعدة
├── server/                  # Express API
│   ├── app.js                # إعداد HTTP والمسارات
│   ├── index.js              # تشغيل العملية والخدمات المجدولة
│   ├── domain/               # قواعد مستقلة، بدءاً بالفواتير
│   ├── application/          # حالات الاستخدام بقدرات محقونة
│   ├── infrastructure/       # تنفيذ التخزين، بدءاً بمستودع الفواتير
│   ├── composition/          # ربط تنفيذ التبعيات بحالات الاستخدام
│   ├── database/             # المخطط والاتصال وتهيئة البيانات
│   ├── middleware/           # المصادقة والصلاحيات والتحقق
│   ├── routes/               # نقاط النهاية
│   ├── services/             # خدمات التطبيق
│   ├── templates/            # قوالب المستندات
│   ├── scripts/              # إعداد الخادم
│   └── tests/                # الاختبارات المعتمدة
├── deploy/                  # أدوات النشر وإعدادات VPS وتقارير النشر
├── docs/                    # وثائق المشروع
│   ├── frontend/             # التصميم والأداء
│   └── deployment/           # أدلة إعداد الخادم والنشر
├── scripts/                 # أدوات تطوير وتشغيل مشتركة
│   ├── windows/              # تجهيز نسخة التسليم
│   └── archive/              # سكربتات تاريخية؛ لا تعمل تلقائياً
│       └── desktop/          # كود وإعداد Electron السابق
├── artifacts/               # سجلات محلية ونواتج تشخيص؛ خارج Git
├── database/                # بيانات محلية موجودة
├── uploads/                 # ملفات مرفوعة محلياً
├── backups/                 # نسخ احتياطية محلية
├── package.json             # أوامر التشغيل والبناء والنشر
├── Makefile                 # اختصارات النشر
└── README.md                # نقطة البداية
```

## إضافة الملفات

- ضع منطق التطبيق داخل `client/` أو `server/` بحسب مسؤوليته.
- اتبع [حدود الطبقات](ARCHITECTURE.md) عند إضافة منطق جديد؛ لا تستورد Express أو SQLite في domain/application.
- ضع وثائق المشروع داخل `docs/` وأضف رابطاً في [الفهرس](README.md).
- ضع أدوات النشر داخل `deploy/` وأدوات التطوير المشتركة داخل `scripts/`.
- ضع سجلات التشخيص المحلية داخل `artifacts/logs/`. النواتج المبنية تبقى داخل `client/dist/` و`client/release/`.
- ملفات `.env` وقواعد البيانات والمرفقات والنسخ الاحتياطية تبقى في مواقعها الحالية خارج التتبع.
- تبقى اختصارات نشر الويب في الجذر. أدوات تشغيل سطح المكتب وWindows المحلية القديمة داخل `scripts/archive/desktop/windows/`.

## السكربتات التاريخية

نُقلت سكربتات الإصلاح والتشخيص القديمة إلى `scripts/archive/` مع الحفاظ على محتواها. سكربتات `patches/` تعتمد على تشغيلها من جذر المشروع وقد تعيد تطبيق تعديلات قديمة؛ راجعها قبل استخدامها. سكربتات `remote/` تتصل بالخادم وقد تعدّل إعداداته. اختبار `tests/test-apis.js` القديم يُنشئ سجلات، لذلك ليس جزءاً من الاختبارات المعتمدة.

## التحقق والتسليم

```powershell
npm run build:client
npm run test:architecture
npm run test:domain
npm --prefix client run test:bundle
npm --prefix server run test:permissions
powershell -ExecutionPolicy Bypass -File scripts/windows/prepare-flash.ps1 -Destination E:\LawOffice-Delivery
```

أمر التسليم الأخير ينسخ بيانات المكتب وملف البيئة إلى الوجهة المحددة، ويُستخدم فقط عند تجهيز نسخة تسليم فعلية.
