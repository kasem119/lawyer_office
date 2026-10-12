const statuses = new Set(['active', 'pending', 'closed', 'archived']);

export function validateCaseStatus(db, caseId, status) {
  if (!statuses.has(status)) {
    return 'حالة القضية غير صالحة';
  }
  if (status !== 'closed' && status !== 'archived') return null;
  if (db.prepare("SELECT id FROM tasks WHERE case_id = ? AND status != 'done' LIMIT 1").get(caseId)) {
    return 'لا يمكن إغلاق القضية لوجود مهام غير منجزة مرتبطة بها.';
  }
  if (db.prepare("SELECT id FROM events WHERE case_id = ? AND date >= date('now') LIMIT 1").get(caseId)) {
    return 'لا يمكن إغلاق القضية لوجود جلسات أو مواعيد قادمة مرتبطة بها.';
  }
  return null;
}

export function caseClosedAt(status) {
  return status === 'closed' || status === 'archived'
    ? new Date().toISOString().slice(0, 10)
    : null;
}
