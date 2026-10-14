import cron from 'node-cron';
import db from '../database/db.js';
import { createNotification } from './notificationService.js';

export const REMINDER_TIME_ZONE = 'Africa/Tripoli';
export const REMINDER_SCHEDULE = '0 8,18 * * *';
const dayFormatter = new Intl.DateTimeFormat('en-CA', { timeZone: REMINDER_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' });
const hourFormatter = new Intl.DateTimeFormat('en-GB', { timeZone: REMINDER_TIME_ZONE, hour: '2-digit', hourCycle: 'h23' });
const localDay = date => dayFormatter.format(date);
const dayAfter = (day, count) => {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + count);
  return date.toISOString().slice(0, 10);
};
function alreadyNotified(userId, entity, entityId, today, prefix) {
  return db.prepare(`SELECT created_at FROM notifications WHERE user_id=?
    AND related_entity_type=? AND related_entity_id=? AND title LIKE ?
    AND substr(created_at,1,10) IN (?,?)`).all(userId, entity, entityId, `${prefix}%`, today, dayAfter(today, -1))
    .some(row => {
      const value = row.created_at.replace(' ', 'T');
      const date = new Date(/(?:Z|[+-]\d{2}:\d{2})$/.test(value) ? value : `${value}Z`);
      return Number.isFinite(date.getTime()) && localDay(date) === today;
    });
}

/**
 * Returns a list of user IDs who should be notified about an event:
 * - The event creator
 * - The case lead lawyer (if linked to a case)
 * - All lawyers assigned to the case in case_lawyers
 */
export function getEventRecipients(eventId) {
  try {
    const event = db.prepare(`
      SELECT e.id, e.user_id, e.case_id, c.lead_lawyer_id
      FROM events e
      LEFT JOIN cases c ON c.id = e.case_id
      WHERE e.id = ?
    `).get(eventId);

    if (!event) return [];

    const recipientIds = new Set();
    if (event.user_id) recipientIds.add(event.user_id);
    if (event.lead_lawyer_id) recipientIds.add(event.lead_lawyer_id);

    if (event.case_id) {
      const assigned = db.prepare(`
        SELECT user_id FROM case_lawyers WHERE case_id = ?
      `).all(event.case_id);

      assigned.forEach(row => {
        if (row.user_id) recipientIds.add(row.user_id);
      });
    }

    return Array.from(recipientIds);
  } catch (err) {
    console.error('[Reminder Cron] Error finding event recipients:', err);
    return [];
  }
}

/**
 * Checks and triggers reminders for:
 * 1. Court sessions & events today and tomorrow
 * 2. Tasks due today, tomorrow, and overdue
 */
export function checkRemindersNow(now = new Date()) {
  try {
    const hour = Number(hourFormatter.format(now));
    if (hour < 8) return; // Never dispatch scheduled reminders overnight.
    const prefix = hour >= 18 ? '🌙 تذكير مسائي: ' : '☀️ تذكير صباحي: ';
    const today = localDay(now);
    const addDays = days => dayAfter(today, days);
    const tomorrow = addDays(1);
    const in2Days = addDays(2);
    const in3Days = addDays(3);
    const in1Week = addDays(7);
    const in2Weeks = addDays(14);

    // ==========================================
    // 1. تذكيرات جلسات ومواعيد المحاكم
    // ==========================================
    const upcomingEvents = db.prepare(`
      SELECT e.id, e.title, e.date, e.time, e.event_type as type, e.user_id, e.case_id,
             c.title as case_title, c.case_number
      FROM events e
      LEFT JOIN cases c ON c.id = e.case_id
      WHERE e.date IN (?, ?, ?, ?, ?, ?)
    `).all(today, tomorrow, in2Days, in3Days, in1Week, in2Weeks);

    upcomingEvents.forEach(event => {
      const isCourt = event.type === 'court_date' || event.type === 'court' || (event.title && event.title.includes('جلسة'));

      const timeStr = event.time ? ` الساعة ${event.time}` : '';
      const caseStr = event.case_title ? ` في قضية "${event.case_title}"` : '';

      let title = '';
      let message = '';
      let notifType = 'info';

      if (event.date === today) {
        notifType = 'urgent';
        if (isCourt) {
          title = '🔴 تنبيه عاجل: موعد جلسة محكمة اليوم!';
          message = `تذكير بموعد جلسة محكمة اليوم: "${event.title}"${timeStr}${caseStr}. يرجى التجهيز والحضور.`;
        } else {
          title = '📌 تذكير: لديك موعد اليوم';
          message = `موعد اليوم: "${event.title}"${timeStr}${caseStr}.`;
        }
      } else if (event.date === tomorrow) {
        notifType = 'warning';
        if (isCourt) {
          title = '⚖️ تذكير: موعد جلسة محكمة غداً';
          message = `تذكير بموعد جلسة محكمة غداً: "${event.title}"${timeStr}${caseStr}. يرجى مراجعة المستندات والتنسيق.`;
        } else {
          title = '⏰ تذكير بموعد قادم غداً';
          message = `تذكير بموعد غداً: "${event.title}"${timeStr}${caseStr}.`;
        }
      } else {
        let dayStr = '';
        if (event.date === in2Days) dayStr = 'بعد يومين';
        else if (event.date === in3Days) dayStr = 'بعد 3 أيام';
        else if (event.date === in1Week) dayStr = 'بعد أسبوع';
        else if (event.date === in2Weeks) dayStr = 'بعد أسبوعين';

        if (isCourt) {
          title = `⚖️ تذكير مبكر: جلسة محكمة ${dayStr}`;
          message = `تذكير بموعد جلسة محكمة ${dayStr}: "${event.title}"${timeStr}${caseStr}. يرجى التحضير مسبقاً.`;
        } else {
          title = `📅 تذكير بموعد قادم ${dayStr}`;
          message = `تذكير بموعد ${dayStr}: "${event.title}"${timeStr}${caseStr}.`;
        }
      }

      // إرسال الإشعار لجميع المحامين المعنيين بالجلسة والقضية
      const recipients = getEventRecipients(event.id);
      recipients.forEach(userId => {
        const existing = alreadyNotified(userId, 'event', event.id, today, prefix);

        if (!existing) {
          createNotification({
            userId,
            title: prefix + title,
            message,
            type: notifType,
            relatedEntityType: 'event',
            relatedEntityId: event.id,
            createdAt: now.toISOString()
          });
        }
      });
    });

    // ==========================================
    // 2. تذكيرات المهام (مستحقة اليوم، غداً، ومتأخرة)
    // ==========================================
    const tasks = db.prepare(`
      SELECT t.id, t.title, t.due_date, t.assigned_to, t.status,
             c.title as case_title
      FROM tasks t
      LEFT JOIN cases c ON c.id = t.case_id
      WHERE t.status != 'done' AND t.assigned_to IS NOT NULL
        AND (t.due_date <= ? OR t.due_date = ?)
    `).all(today, tomorrow);

    tasks.forEach(task => {
      const isOverdue = task.due_date < today;
      const isDueToday = task.due_date === today;
      const isDueTomorrow = task.due_date === tomorrow;

      const notifType = isOverdue ? 'warning' : isDueToday ? 'info' : 'info';

      const existing = alreadyNotified(task.assigned_to, 'task', task.id, today, prefix);

      if (!existing) {
        let title = '';
        let message = '';
        const caseStr = task.case_title ? ` (قضية: "${task.case_title}")` : '';

        if (isOverdue) {
          title = '⚠️ مهمة متأخرة عن موعدها';
          message = `تحذير: المهمة "${task.title}"${caseStr} متأخرة عن تاريخ استحقاقها (${task.due_date}). يرجى إنهائها فوراً.`;
        } else if (isDueToday) {
          title = '📋 مهمة مستحقة اليوم';
          message = `تذكير: لديك مهمة مستحقة اليوم: "${task.title}"${caseStr}.`;
        } else if (isDueTomorrow) {
          title = '⏰ مهمة مستحقة غداً';
          message = `تذكير مسبق: المهمة "${task.title}"${caseStr} تستحق الإنجاز غداً.`;
        }

        if (title && message) {
          createNotification({
            userId: task.assigned_to,
            title: prefix + title,
            message,
            type: notifType,
            relatedEntityType: 'task',
            relatedEntityId: task.id,
            createdAt: now.toISOString()
          });
        }
      }
    });

  } catch (err) {
    console.error('[Reminder Cron] Error running checkRemindersNow:', err);
  }
}

export function initReminderCron() {
  if (process.env.NODE_ENV === 'test') return;
  return cron.schedule(REMINDER_SCHEDULE, () => checkRemindersNow(), { timezone: REMINDER_TIME_ZONE });
}
