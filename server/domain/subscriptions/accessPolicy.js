export const TRIAL_DAYS = 30;
export function trialEndsAt(start = new Date()) {
  return new Date(start.getTime() + TRIAL_DAYS * 86400000).toISOString();
}
function timestamp(value) {
  if (!value) return NaN;
  const text = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return Date.parse(text + 'T23:59:59.999Z');
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(text)) return Date.parse(text.replace(' ', 'T') + 'Z');
  return Date.parse(text);
}
export function officeAccessError(tenant, role, now = Date.now()) {
  if (role === 'super_admin') return null;
  if (!tenant) return { code: 'OFFICE_UNAVAILABLE', message: 'حساب المكتب غير موجود' };
  if (tenant.is_active === 0 || tenant.status === 'suspended') return { code: 'OFFICE_SUSPENDED', message: 'تم إيقاف حساب المكتب. يرجى التواصل مع مالك المنصة.' };
  const trial = ['trial', 'free'].includes(tenant.plan);
  let end = trial ? (tenant.trial_ends_at || tenant.subscription_ends_at) : tenant.subscription_ends_at;
  if (!end && trial) {
    const start = timestamp(tenant.created_at);
    if (Number.isFinite(start)) end = new Date(start + TRIAL_DAYS * 86400000).toISOString();
  }
  if (['expired', 'cancelled', 'inactive'].includes(tenant.status) || (end && (!Number.isFinite(timestamp(end)) || timestamp(end) <= now)) || (trial && !end)) {
    return { code: 'SUBSCRIPTION_EXPIRED', message: trial
      ? 'انتهت الفترة التجريبية للمكتب. يرجى التواصل مع مالك المنصة لتفعيل الاشتراك.'
      : 'انتهت صلاحية اشتراك المكتب. يرجى التواصل مع مالك المنصة لتجديد الاشتراك.' };
  }
  return null;
}
