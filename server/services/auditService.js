import db from '../database/db.js';

export function logActivity(userId, action, entityType, entityId, details) {
  try {
    const detailsJson = typeof details === 'string'
      ? JSON.stringify({ text: details })
      : JSON.stringify(details || {});

    db.prepare(`
      INSERT INTO activity_log (user_id, action, entity_type, entity_id, details_json)
      VALUES (?, ?, ?, ?, ?)
    `).run(userId, action, entityType, entityId, detailsJson);
  } catch (err) {
    console.error('Failed to log activity:', err.message);
  }
}
