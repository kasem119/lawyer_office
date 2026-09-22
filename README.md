# منظومة إدارة مكتب محاماة متكاملة
# Law Office Management System

نظام متكامل وشامل لإدارة مكاتب المحاماة والاستشارات القانونية، يشمل إدارة القضايا، الجلسات، الموكلين، الحسابات، الأتعاب، إدارة الوثائق والمستندات، والنسخ الاحتياطي التلقائي.

---

## 🛠️ التقنيات المستخدمة (Tech Stack)

- **الواجهة الأمامية (Frontend):** React, Tailwind CSS, Lucide Icons, Vite
- **الخلفية (Backend):** Node.js, Express.js
- **قاعدة البيانات (Database):** SQLite (better-sqlite3)
- **الحماية والأمان:** JWT Authentication, Data Encryption, CORS, Helmet
- **تطبيق سطح المكتب (Desktop App):** Electron

---

## 🚀 طريقة التثبيت والتشغيل (Getting Started)

### 1. المتطلبات الأساسية
- تثبيت [Node.js](https://nodejs.org/) (الإصدار 18 أو أحدث)
- تثبيت Git

### 2. تثبيت الحزم (Dependencies)
يمكن تثبيت حزم الخادم والواجهة معاً:
```bash
npm run install:all
```
أو تثبيتها يدوياً في كل مجلد:
```bash
cd server
npm install

cd ../client
npm install
```

### 3. إعداد متغيرات البيئة (Environment Variables)
قم بنسخ ملف `.env.example` في مجلد `server` إلى `.env`:
```bash
cd server
cp .env.example .env
```
ثم قم بتعديل المفاتيح السرية (`JWT_SECRET`, `JWT_REFRESH_SECRET`, `ENCRYPTION_KEY`) بقيم قوية وفريدة.

### 4. تشغيل النظام (Running the Application)

- **تشغيل الخادم (Server):**
  ```bash
  npm run start:server
  ```
  *(يعمل الخادم افتراضياً على المنفذ `http://localhost:3000`)*

- **تشغيل الواجهة الأمامية (Client Web):**
  ```bash
  npm run start:client
  ```

- **تشغيل تطبيق سطح المكتب (Electron):**
  ```bash
  npm run electron:client
  ```

---

## 📁 هيكلية المشروع (Project Structure)

```text
lawyer_office/
├── client/              # تطبيق الواجهة الأمامية (React + Electron)
│   ├── src/             # شاشات ومكونات النظام
│   └── package.json
├── server/              # خادم الـ API وقاعدة البيانات
│   ├── database/        # الاتصال ومخططات SQLite
│   ├── routes/          # مسارات ونقاط النهاية للـ API
│   ├── middleware/      # التحقق والحماية
│   └── package.json
├── package.json         # أوامر التشغيل المجمعة
└── README.md
```

---

## 🔒 الأمان والبيانات الحساسة
- ملفات قواعد البيانات (`*.db`) وملفات البيئة الحقيقية (`.env`) وملفات النسخ الاحتياطي والوثائق المرفوعة مستثناة من التتبع بواسطة `.gitignore`.
