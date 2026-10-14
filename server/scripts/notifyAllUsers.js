/**
 * سكريبت: إرسال إشعار لجميع المستخدمين بأن الإشعارات متاحة الآن
 * التشغيل: node scripts/notifyAllUsers.js
 */

import db from '../database/db.js';
import { createNotification } from '../services/notificationService.js';

const TITLE   = '🔔 الإشعارات متاحة الآن!';
const MESSAGE = 'يمكنك الآن تفعيل إشعارات الجهاز لتصلك التنبيهات حتى عند إغلاق التطبيق. '
              + 'اضغط على أيقونة الجرس 🔔 في الأعلى ثم اختر «تفعيل إشعارات هذا الجهاز».';

const users = db.prepare(`
  SELECT id FROM users
  WHERE is_active = 1
    AND role IN ('admin', 'lawyer')
`).all();

if (!users.length) {
  console.log('لا يوجد مستخدمون نشطون.');
  process.exit(0);
}

let sent = 0;
for (const { id } of users) {
  try {
    createNotification({ userId: id, title: TITLE, message: MESSAGE, type: 'info' });
    sent++;
    console.log(`✅ أُرسل الإشعار للمستخدم #${id}`);
  } catch (err) {
    console.error(`❌ فشل إرسال الإشعار للمستخدم #${id}:`, err.message);
  }
}

console.log(`\n✔ تم الإرسال لـ ${sent} من ${users.length} مستخدم.`);
