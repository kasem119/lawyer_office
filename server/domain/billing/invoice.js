// Pure billing rules: no HTTP, SQL, environment or delivery dependencies.
export const invoiceStatuses = Object.freeze(['draft', 'sent', 'paid', 'overdue', 'cancelled']);
export function invoiceTotal(items = []) {
  return items.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);
}
export function validateInvoiceInput({ items, status }) {
  if (status !== undefined && !invoiceStatuses.includes(status)) return 'حالة الفاتورة غير صالحة';
  if (items !== undefined && (!Array.isArray(items) || items.some(item =>
    !item || typeof item.description !== 'string' || !item.description.trim() ||
    typeof item.quantity !== 'number' || !Number.isFinite(item.quantity) || item.quantity <= 0 ||
    typeof item.unit_price !== 'number' || !Number.isFinite(item.unit_price) || item.unit_price < 0 ||
    !Number.isFinite(item.quantity * item.unit_price)
  ) || !Number.isFinite(invoiceTotal(items)))) return 'بنود الفاتورة يجب أن تحتوي وصفًا وكمية موجبة وسعرًا صالحًا';
  return null;
}
export function nextInvoiceNumber(numbers, year) {
  const prefix = `INV-${year}-`;
  const last = numbers.reduce((max, number) => {
    if (!number.startsWith(prefix)) return max;
    const suffix = number.slice(prefix.length);
    return /^\d+$/.test(suffix) ? Math.max(max, Number(suffix)) : max;
  }, 0);
  return `${prefix}${String(last + 1).padStart(3, '0')}`;
}
