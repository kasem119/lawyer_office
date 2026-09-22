import cron from 'node-cron';
import db from '../database/db.js';
import { createNotification } from './notificationService.js';

export function initReminderCron() {
  // Every hour: Check for events in the next 24 hours
  cron.schedule('0 * * * *', () => {
    try {
      const now = new Date().toISOString().split('T')[0];
      const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      
      const events = db.prepare(`
        SELECT id, title, user_id, date 
        FROM events 
        WHERE date > ? AND date <= ?
      `).all(now, tomorrow);
      
      events.forEach(event => {
        // Prevent duplicate notification today
        const today = new Date().toISOString().split('T')[0];
        const existing = db.prepare(`
          SELECT id FROM notifications 
          WHERE user_id = ? AND related_entity_type = 'event' AND related_entity_id = ? AND DATE(created_at) = ?
        `).get(event.user_id, event.id, today);
        
        if (!existing) {
          createNotification({
            userId: event.user_id,
            title: 'تذكير بموعد قادم',
            message: `تذكير: لديك موعد قادم "${event.title}" غداً`,
            type: 'warning',
            relatedEntityType: 'event',
            relatedEntityId: event.id
          });
        }
      });
    } catch (err) {
      console.error('[Reminder Cron] Error in event reminder:', err);
    }
  });

  // Every morning at 8 AM: Check for due tasks today and overdue tasks
  cron.schedule('0 8 * * *', () => {
    try {
      const today = new Date().toISOString().split('T')[0];

      // Tasks due today
      const dueTasks = db.prepare(`
        SELECT id, title, assigned_to 
        FROM tasks 
        WHERE due_date = ? AND status != 'done'
      `).all(today);

      dueTasks.forEach(task => {
        const existing = db.prepare(`
          SELECT id FROM notifications 
          WHERE user_id = ? AND related_entity_type = 'task' AND related_entity_id = ? AND DATE(created_at) = ?
        `).get(task.assigned_to, task.id, today);
        
        if (!existing) {
          createNotification({
            userId: task.assigned_to,
            title: 'مهمة مستحقة اليوم',
            message: `لديك مهمة مستحقة اليوم: ${task.title}`,
            type: 'info',
            relatedEntityType: 'task',
            relatedEntityId: task.id
          });
        }
      });

      // Overdue tasks
      const overdueTasks = db.prepare(`
        SELECT id, title, assigned_to 
        FROM tasks 
        WHERE due_date < ? AND status != 'done'
      `).all(today);

      overdueTasks.forEach(task => {
        const existing = db.prepare(`
          SELECT id FROM notifications 
          WHERE user_id = ? AND related_entity_type = 'task' AND related_entity_id = ? AND type = 'warning' AND DATE(created_at) = ?
        `).get(task.assigned_to, task.id, today);
        
        if (!existing) {
          createNotification({
            userId: task.assigned_to,
            title: 'مهمة متأخرة',
            message: `تحذير: مهمة متأخرة عن موعدها "${task.title}"`,
            type: 'warning',
            relatedEntityType: 'task',
            relatedEntityId: task.id
          });
        }
      });
    } catch (err) {
      console.error('[Reminder Cron] Error in task reminder:', err);
    }
  });

  console.log('[Reminder Cron] ✅ تم تفعيل التذكيرات التلقائية');
}
