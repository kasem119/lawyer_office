export function normalizeWhatsAppPhone(phone) {
  const invalidPhone = () => new Error('رقم الهاتف غير صالح للمشاركة عبر واتساب. أدخل رقمًا ليبيًا مثل 0912345678 أو رقمًا دوليًا مع رمز الدولة مثل +218912345678.');
  const value = String(phone ?? '').trim()
    .replace(/[٠-٩]/g, digit => String(digit.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, digit => String(digit.charCodeAt(0) - 0x06f0))
    .replace(/[\s()\-\u200e\u200f\u061c]/g, '');
  if (!/^\+?\d+$/.test(value)) throw invalidPhone();

  const international = value.startsWith('+') || value.startsWith('00');
  let digits = value.replace(/^\+|^00/, '');
  if (!international && /^09\d{8}$/.test(digits)) {
    digits = `218${digits.slice(1)}`;
  } else if (!international && /^9\d{8}$/.test(digits)) {
    digits = `218${digits}`;
  }
  // A local trunk zero sometimes remains after the Libyan country code.
  if (/^2180\d{9}$/.test(digits)) digits = `218${digits.slice(4)}`;
  if (digits.startsWith('218') && !/^218\d{9}$/.test(digits)) throw invalidPhone();
  if (!/^[1-9]\d{7,14}$/.test(digits)) throw invalidPhone();
  // Other countries' local numbers need an explicit country code.
  if (!international && !digits.startsWith('218') && digits.length < 10) throw invalidPhone();
  return digits;
}

export function getWhatsAppUrl(phone, message) {
  return `https://wa.me/${normalizeWhatsAppPhone(phone)}?text=${encodeURIComponent(message)}`;
}
