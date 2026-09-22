import db from '../database/db.js';
import { sendToUser } from './websocketService.js';

export function createNotification({ userId, title, message, type = 'info', relatedEntityType = null, relatedEntityId = null }) {
  try {
    const stmt = db.prepare(`
      INSERT INTO notifications (user_id, title, message, type, related_entity_type, related_entity_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const res = stmt.run(userId, title, message, type, relatedEntityType, relatedEntityId);
    
    // Dispatch real-time WebSocket event to the user
    sendToUser(userId, 'NEW_NOTIFICATION', {
      id: res.lastInsertRowid,
      user_id: userId,
      title,
      message,
      type,
      related_entity_type: relatedEntityType,
      related_entity_id: relatedEntityId,
      is_read: 0,
      created_at: new Date().toISOString()
    });

    return res.lastInsertRowid;
  } catch (err) {
    console.error('Notification creation failed:', err);
  }
}
