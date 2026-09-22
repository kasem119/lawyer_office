import db from '../database/db.js';

export function canAccessCase(user, caseId) {
  if (user.role === 'admin') return true;
  return Boolean(db.prepare(`
    SELECT 1 FROM case_lawyers WHERE case_id = ? AND user_id = ?
    UNION
    SELECT 1 FROM cases WHERE id = ? AND lead_lawyer_id = ?
  `).get(caseId, user.id, caseId, user.id));
}

export function canManageCase(user, caseId) {
  if (user.role === 'admin') return true;
  const caseItem = db.prepare('SELECT lead_lawyer_id FROM cases WHERE id = ?').get(caseId);
  return Boolean(caseItem && caseItem.lead_lawyer_id === user.id);
}

export function canAccessClient(user, clientId) {
  if (user.role === 'admin') return true;
  return Boolean(db.prepare(`
    SELECT 1 FROM cases c
    LEFT JOIN case_lawyers cl ON cl.case_id = c.id
    WHERE c.client_id = ? AND (c.lead_lawyer_id = ? OR cl.user_id = ?)
    LIMIT 1
  `).get(clientId, user.id, user.id));
}

export function canAccessInvoice(user, invoice) {
  if (!invoice) return false;
  if (user.role === 'admin') return true;
  if (invoice.created_by === user.id) return true;
  return invoice.case_id ? canAccessCase(user, invoice.case_id) : false;
}

export function canChangeTaskStatus(user, task) {
  if (!task) return false;
  if (user.role === 'admin') return true;
  if (task.created_by === user.id || task.assigned_to === user.id) return true;
  return task.case_id ? canAccessCase(user, task.case_id) : false;
}

export function requireAdmin(req, res, next) {
  if (req.user && req.user.role === 'admin') {
    return next();
  }
  return res.status(403).json({ message: 'عفواً، هذه العملية مخصصة لمدير النظام فقط' });
}

export function requireCaseAccess(req, res, next) {
  const caseId = req.params.caseId || req.params.id || req.body.case_id || req.query.case_id;
  if (!caseId) return next();
  if (!canAccessCase(req.user, caseId)) {
    return res.status(403).json({ message: 'ليس لديك صلاحية الوصول لهذه القضية' });
  }

  next();
}
