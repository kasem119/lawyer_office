# منظومة إدارة مكتب المحاماة

تطبيق ويب لإدارة القضايا والموكلين والمواعيد والمستندات والفواتير، مع فصل صلاحيات مالك المنصة والمكاتب. الموقع المنشور: [muhami.ly](https://muhami.ly).

## نقطة البداية

- [البنية المعمارية وحدود الطبقات](docs/ARCHITECTURE.md)
- [هيكل المجلدات](docs/PROJECT-STRUCTURE.md)
- [فهرس الوثائق](docs/README.md)
- [النشر وإعداد الخادم](docs/deployment/README-DEPLOY.md)

## التقنيات

واجهة React 18 وVite، خادم Express، وقاعدة SQLite عبر `node:sqlite` المدمجة في Node.js. الدخول يستخدم JWT وتُشفّر الحقول الحساسة. اختيار المنتج الحالي هو الويب؛ إعداد Electron السابق محفوظ داخل `scripts/archive/desktop/`.

## إعداد بيئة التطوير

يتطلب المشروع Node.js **22.23 أو أحدث**. من الجذر:

```powershell
npm --prefix server ci --legacy-peer-deps
npm --prefix client ci
Copy-Item server/.env.example server/.env
```

اضبط مفاتيح `JWT_SECRET` و`JWT_REFRESH_SECRET` و`ENCRYPTION_KEY` قبل التشغيل. الخادم يرفض تشغيل الإنتاج دونها. لا تُنسخ أسرار الإنتاج إلى المستودع.

```powershell
npm run start:server
npm run start:client
```

أمر الواجهة خاص بخادم التطوير. في النشر، يقدم Express ملفات `client/dist/` المبنية، ويستقبل الخادم `/api` و`/ws`.

## البناء والتحقق

```powershell
npm run build:client
npm run test:architecture
npm run test:domain
npm run test:permissions
npm run test:security
npm run test:regressions
npm --prefix server run test:improvements
npm --prefix server run test:notifications
npm --prefix client run test:auth-session
npm --prefix client run test:bundle
npm --prefix client run test:mobile
```

مجموعات الصلاحيات والأمان والانحدار المذكورة تستخدم قاعدة ذاكرة وملفات مؤقتة. لا تستخدم `server/npm test` القديم ضد بيانات مكتب حقيقية؛ هذا المشغل التاريخي ليس ضمن الفحوص المعتمدة هنا.

## النشر والبيانات

أدوات النشر داخل `deploy/`، والوثائق داخل `docs/deployment/`. يجب أن تشمل أي حزمة خلفية كل الملفات الجديدة التي يستوردها الكود؛ لا يكفي نقل مسار HTTP وحده بعد استخراج طبقات جديدة. تفاصيل نشر المعمارية في [تقرير الإصدار](docs/deployment/ARCHITECTURE-RELEASE.md).

ملفات البيئة وقواعد البيانات والمرفقات والنسخ الاحتياطية خارج Git. نواتج التشخيص داخل `artifacts/`، وملفات البناء داخل `client/dist/`. لا تنقل قواعد البيانات أو المرفقات أثناء تنظيم الكود.
