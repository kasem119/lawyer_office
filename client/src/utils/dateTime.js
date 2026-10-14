export const LIBYA_TIME_ZONE = 'Africa/Tripoli';

// SQLite CURRENT_TIMESTAMP is UTC but has no suffix. ISO timestamps already
// contain their offset and must not have another offset applied.
export function parseUtcTimestamp(value) {
  if (value instanceof Date) return value;
  if (typeof value !== 'string') return new Date(NaN);
  const normalized = value.trim().replace(' ', 'T');
  return new Date(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?$/.test(normalized) ? `${normalized}Z` : normalized);
}

export function formatLibyaTime(value) {
  const date = parseUtcTimestamp(value);
  if (!Number.isFinite(date.getTime())) return '—';
  return date.toLocaleTimeString('ar-LY', { timeZone: LIBYA_TIME_ZONE, hour: '2-digit', minute: '2-digit' });
}
