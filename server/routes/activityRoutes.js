import express from 'express';
import db from '../database/db.js';
import { authenticateToken } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/permissions.js';

const router = express.Router();

function getTenantId(req) {
  return req.user.tenant_id || 1;
}

function activityScope(alias = 'activity_log') {
  return `(${alias}.tenant_id = ? OR (${alias}.tenant_id IS NULL AND EXISTS (
    SELECT 1 FROM users scope_user WHERE scope_user.id = ${alias}.user_id AND scope_user.tenant_id = ?
  )))`;
}

// Require authentication and admin privileges for all activity log endpoints
router.use(authenticateToken);
router.use(requireAdmin);

/**
 * GET /api/activities
 * List activity logs with pagination, filtering, and user details (Tenant scoped)
 */
router.get('/', (req, res, next) => {
  try {
    const tenantId = getTenantId(req);
    const {
      page = 1,
      limit = 20,
      user_id,
      entity_type,
      action,
      from_date,
      to_date,
      search
    } = req.query;

    const whereClauses = [activityScope('a')];
    const params = [tenantId, tenantId];

    // Filter by user_id
    if (user_id && user_id !== 'all') {
      whereClauses.push('a.user_id = ?');
      params.push(Number(user_id));
    }

    // Filter by entity_type
    if (entity_type && entity_type !== 'all') {
      whereClauses.push('LOWER(a.entity_type) = LOWER(?)');
      params.push(entity_type);
    }

    // Filter by action
    if (action && action !== 'all') {
      const act = action.trim().toUpperCase();
      if (['CREATE', 'UPDATE', 'DELETE', 'VIEW', 'LOGIN', 'LOGOUT'].includes(act)) {
        whereClauses.push('(UPPER(a.action) = ? OR UPPER(a.action) LIKE ?)');
        params.push(act, `${act}_%`);
      } else {
        whereClauses.push('(UPPER(a.action) = ? OR UPPER(a.action) LIKE ?)');
        params.push(act, `%${act}%`);
      }
    }

    // Filter by date range
    if (from_date) {
      whereClauses.push("DATE(a.created_at) >= DATE(?)");
      params.push(from_date);
    }

    if (to_date) {
      whereClauses.push("DATE(a.created_at) <= DATE(?)");
      params.push(to_date);
    }

    // Filter by search text (in details_json, action, or user name)
    if (search && search.trim()) {
      whereClauses.push('(a.details_json LIKE ? OR a.action LIKE ? OR u.name LIKE ?)');
      const searchTerm = `%${search.trim()}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    const whereSql = `WHERE ${whereClauses.join(' AND ')}`;

    // Total count query
    const countQuery = `
      SELECT COUNT(*) as total
      FROM activity_log a
      LEFT JOIN users u ON a.user_id = u.id
      ${whereSql}
    `;
    const countResult = db.prepare(countQuery).get(...params);
    const total = countResult ? countResult.total : 0;

    // Pagination calculations
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const offset = (pageNum - 1) * limitNum;
    const totalPages = Math.ceil(total / limitNum) || 1;

    // Fetch paginated data
    const dataQuery = `
      SELECT 
        a.id,
        a.user_id,
        a.action,
        a.entity_type,
        a.entity_id,
        a.details_json,
        a.created_at,
        u.name as user_name,
        u.email as user_email,
        u.role as user_role
      FROM activity_log a
      LEFT JOIN users u ON a.user_id = u.id
      ${whereSql}
      ORDER BY a.created_at DESC, a.id DESC
      LIMIT ? OFFSET ?
    `;

    const activities = db.prepare(dataQuery).all(...params, limitNum, offset);

    res.json({
      success: true,
      activities,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages
      }
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/activities/stats
 * Activity statistics including counts by period, entity type, action, and top users (Tenant scoped)
 */
router.get('/stats', (req, res, next) => {
  try {
    const tenantId = getTenantId(req);

    // Total count
    const totalRow = db.prepare(`SELECT COUNT(*) as count FROM activity_log WHERE ${activityScope()}`).get(tenantId, tenantId);
    const total = totalRow ? totalRow.count : 0;

    // Today's count
    const todayRow = db.prepare(`SELECT COUNT(*) as count FROM activity_log WHERE ${activityScope()} AND DATE(created_at) = DATE('now')`).get(tenantId, tenantId);
    const today = todayRow ? todayRow.count : 0;

    // This week's count (last 7 days)
    const thisWeekRow = db.prepare(`SELECT COUNT(*) as count FROM activity_log WHERE ${activityScope()} AND DATE(created_at) >= DATE('now', '-7 days')`).get(tenantId, tenantId);
    const thisWeek = thisWeekRow ? thisWeekRow.count : 0;

    // This month's count
    const thisMonthRow = db.prepare(`SELECT COUNT(*) as count FROM activity_log WHERE ${activityScope()} AND strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now')`).get(tenantId, tenantId);
    const thisMonth = thisMonthRow ? thisMonthRow.count : 0;

    // Breakdown by entity_type
    const byEntityType = db.prepare(`
      SELECT entity_type, COUNT(*) as count
      FROM activity_log
      WHERE ${activityScope()}
      GROUP BY entity_type
      ORDER BY count DESC
    `).all(tenantId, tenantId);

    // Breakdown by action
    const byAction = db.prepare(`
      SELECT action, COUNT(*) as count
      FROM activity_log
      WHERE ${activityScope()}
      GROUP BY action
      ORDER BY count DESC
      LIMIT 10
    `).all(tenantId, tenantId);

    // Most active users
    const topUsers = db.prepare(`
      SELECT 
        a.user_id,
        u.name as user_name,
        u.email as user_email,
        u.role as user_role,
        COUNT(*) as count
      FROM activity_log a
      LEFT JOIN users u ON a.user_id = u.id
      WHERE ${activityScope('a')}
      GROUP BY a.user_id
      ORDER BY count DESC
      LIMIT 5
    `).all(tenantId, tenantId);

    res.json({
      success: true,
      stats: {
        total,
        today,
        thisWeek,
        thisMonth,
        byEntityType,
        byAction,
        topUsers
      }
    });
  } catch (err) {
    next(err);
  }
});

export default router;
