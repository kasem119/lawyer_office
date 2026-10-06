import db from '../database/db.js';

export function canAccessCase(user, caseId) {
  if (!user || !caseId) return false;
  const tenantId = user.tenant_id || 1;
  if (user.role === 'admin' || user.role === 'super_admin') {
    const caseItem = db.prepare('SELECT id FROM cases WHERE id = ? AND tenant_id = ?').get(caseId, tenantId);
    return Boolean(caseItem);
  }
  return Boolean(db.prepare(`
    SELECT 1 FROM case_lawyers cl
    JOIN cases c ON cl.case_id = c.id
    WHERE cl.case_id = ? AND cl.user_id = ? AND c.tenant_id = ?
    UNION
    SELECT 1 FROM cases WHERE id = ? AND lead_lawyer_id = ? AND tenant_id = ?
  `).get(caseId, user.id, tenantId, caseId, user.id, tenantId));
}

export function canManageCase(user, caseId) {
  if (!user || !caseId) return false;
  const tenantId = user.tenant_id || 1;
  const caseItem = db.prepare('SELECT lead_lawyer_id, tenant_id FROM cases WHERE id = ? AND tenant_id = ?').get(caseId, tenantId);
  if (!caseItem) return false;
  if (user.role === 'admin' || user.role === 'super_admin') return true;
  return caseItem.lead_lawyer_id === user.id;
}

export function canAccessClient(user, clientId) {
  if (!user || !clientId) return false;
  const tenantId = user.tenant_id || 1;
  const clientItem = db.prepare('SELECT id FROM clients WHERE id = ? AND tenant_id = ?').get(clientId, tenantId);
  if (!clientItem) return false;
  if (user.role === 'admin' || user.role === 'super_admin') return true;
  return Boolean(db.prepare(`
    SELECT 1 FROM cases c
    LEFT JOIN case_lawyers cl ON cl.case_id = c.id
    WHERE c.client_id = ? AND c.tenant_id = ? AND (c.lead_lawyer_id = ? OR cl.user_id = ?)
    LIMIT 1
  `).get(clientId, tenantId, user.id, user.id));
}

export function canAccessInvoice(user, invoice) {
  if (!invoice || !user) return false;
  const tenantId = user.tenant_id || 1;
  if (invoice.tenant_id && Number(invoice.tenant_id) !== Number(tenantId)) return false;
  if (user.role === 'admin' || user.role === 'super_admin') return true;
  if (invoice.created_by === user.id) return true;
  return invoice.case_id ? canAccessCase(user, invoice.case_id) : false;
}

export function canChangeTaskStatus(user, task) {
  if (!task || !user) return false;
  const tenantId = user.tenant_id || 1;
  if (task.tenant_id && Number(task.tenant_id) !== Number(tenantId)) return false;
  if (user.role === 'admin' || user.role === 'super_admin') return true;
  if (task.created_by === user.id || task.assigned_to === user.id) return true;
  return task.case_id ? canAccessCase(user, task.case_id) : false;
}

export function requireAdmin(req, res, next) {
  if (req.user && req.user.role === 'admin') {
    return next();
  }
  return res.status(403).json({ message: 'عفواً، هذه العملية مخصصة لمدير النظام فقط' });
}

// Platform owners administer the SaaS platform, not an individual office.
// Keep this explicit so a route cannot accidentally grant office data access
// merely because a super-admin account has a tenant_id.
export function requireOfficeAccount(req, res, next) {
  if (req.user?.role === 'super_admin') {
    return res.status(403).json({ message: 'حساب مالك المنصة لا يملك صلاحية الوصول إلى بيانات المكاتب. استخدم لوحة إدارة المنصة.' });
  }
  return next();
}

export function requireSuperAdmin(req, res, next) {
  if (req.user && req.user.role === 'super_admin') {
    return next();
  }
  return res.status(403).json({ message: 'عفواً، هذه العملية مخصصة لمالك المنصة الرئيسي فقط' });
}

export function requireCaseAccess(req, res, next) {
  const caseId = req.params.caseId || req.params.id || req.body.case_id || req.query.case_id;
  if (!caseId) return next();
  if (!canAccessCase(req.user, caseId)) {
    return res.status(403).json({ message: 'ليس لديك صلاحية الوصول لهذه القضية' });
  }

  next();
}
