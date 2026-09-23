/**
 * Centralized Date & Timezone Utilities for Despensa Stock
 *
 * Primary Timezone: America/Argentina/Buenos_Aires (ART, UTC-3)
 *
 * CRITICAL ARCHITECTURAL RULES:
 * 1. NEVER modify raw Firestore documents or historical timestamps.
 * 2. Pure calendar dates ('YYYY-MM-DD') represent a full calendar day and MUST NOT
 *    drift due to timezone conversions (e.g., '2026-09-20' -> '20/09/2026', never 19/09 or 21/09).
 * 3. Real timestamps (ISO strings, Date instances, Firestore Timestamps) MUST be
 *    evaluated in Argentina local time (America/Argentina/Buenos_Aires).
 * 4. Filters (HOY, AYER, ESTA SEMANA, ESTE MES) MUST evaluate boundaries in Argentina local time,
 *    preventing night-time operations from drifting into the wrong day.
 */

export const ARGENTINA_TIMEZONE = 'America/Argentina/Buenos_Aires';

const argentinaDateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: ARGENTINA_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const argentinaDateTimeFormatter = new Intl.DateTimeFormat('es-AR', {
  timeZone: ARGENTINA_TIMEZONE,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

const argentinaDateTimeWithSecondsFormatter = new Intl.DateTimeFormat('es-AR', {
  timeZone: ARGENTINA_TIMEZONE,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
});

/**
 * Extracts a Date object safely from various formats (string, Date, Firestore Timestamp).
 */
export function parseDateInput(value?: any): Date | null {
  if (!value) return null;
  if (value instanceof Date) {
    return isNaN(value.getTime()) ? null : value;
  }
  if (typeof value === 'object' && typeof value.toDate === 'function') {
    try {
      const d = value.toDate();
      return d instanceof Date && !isNaN(d.getTime()) ? d : null;
    } catch {
      return null;
    }
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    // If it's pure YYYY-MM-DD, parse as noon UTC to avoid any midnight edge cases
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      const [y, m, d] = trimmed.split('-').map(Number);
      return new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
    }
    const parsed = new Date(trimmed);
    return isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
}

/**
 * Converts any timestamp, ISO string, Date, or Firestore Timestamp into 'YYYY-MM-DD'
 * evaluated strictly in Argentina timezone.
 *
 * If the input is ALREADY a pure 'YYYY-MM-DD' string, it is returned directly without alteration.
 */
export function toArgentinaDateString(input?: any): string {
  if (!input) return '';
  if (typeof input === 'string') {
    const trimmed = input.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      return trimmed;
    }
    // If it's an ISO string or other date representation
    const d = new Date(trimmed);
    if (!isNaN(d.getTime())) {
      return argentinaDateFormatter.format(d);
    }
    return trimmed;
  }
  if (input instanceof Date) {
    if (isNaN(input.getTime())) return '';
    return argentinaDateFormatter.format(input);
  }
  if (typeof input === 'object' && typeof input.toDate === 'function') {
    try {
      const d = input.toDate();
      if (d instanceof Date && !isNaN(d.getTime())) {
        return argentinaDateFormatter.format(d);
      }
    } catch {
      return '';
    }
  }
  return '';
}

/**
 * Returns today's calendar date in Argentina as 'YYYY-MM-DD'.
 */
export function getArgentinaToday(): string {
  return argentinaDateFormatter.format(new Date());
}

/**
 * Returns yesterday's calendar date in Argentina as 'YYYY-MM-DD'.
 */
export function getArgentinaYesterday(): string {
  const todayStr = getArgentinaToday();
  const [y, m, d] = todayStr.split('-').map(Number);
  const dateObj = new Date(Date.UTC(y, m - 1, d - 1, 12, 0, 0));
  const prevY = dateObj.getUTCFullYear();
  const prevM = String(dateObj.getUTCMonth() + 1).padStart(2, '0');
  const prevD = String(dateObj.getUTCDate()).padStart(2, '0');
  return `${prevY}-${prevM}-${prevD}`;
}

/**
 * Returns the calendar date in Argentina N days ago as 'YYYY-MM-DD'.
 */
export function getArgentinaDaysAgo(days: number): string {
  const todayStr = getArgentinaToday();
  const [y, m, d] = todayStr.split('-').map(Number);
  const dateObj = new Date(Date.UTC(y, m - 1, d - days, 12, 0, 0));
  const prevY = dateObj.getUTCFullYear();
  const prevM = String(dateObj.getUTCMonth() + 1).padStart(2, '0');
  const prevD = String(dateObj.getUTCDate()).padStart(2, '0');
  return `${prevY}-${prevM}-${prevD}`;
}

/**
 * Returns the 1st of the current month in Argentina as 'YYYY-MM-DD'.
 */
export function getArgentinaFirstOfMonth(): string {
  const todayStr = getArgentinaToday();
  const [y, m] = todayStr.split('-');
  return `${y}-${m}-01`;
}

/**
 * Returns the current month prefix in Argentina as 'YYYY-MM'.
 */
export function getArgentinaCurrentMonth(): string {
  return getArgentinaToday().substring(0, 7);
}

/**
 * Formats a pure date ('YYYY-MM-DD') or timestamp into 'DD/MM/YYYY'.
 *
 * Guarantees:
 * - '2026-09-20' -> '20/09/2026'
 * - '2026-09-21' -> '21/09/2026'
 * Never shifts by timezone.
 */
export function formatLocalDate(value?: any): string {
  if (!value) return 'Fecha no disponible';
  if (typeof value === 'string') {
    const trimmed = value.trim();
    const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (match) {
      const [, y, m, d] = match;
      return `${d}/${m}/${y}`;
    }
  }

  const d = parseDateInput(value);
  if (!d) return typeof value === 'string' ? value : 'Fecha no disponible';

  // Format in Argentina timezone
  const argDateStr = argentinaDateFormatter.format(d); // 'YYYY-MM-DD'
  const [y, m, day] = argDateStr.split('-');
  return `${day}/${m}/${y}`;
}

/**
 * Formats an instant in time (ISO string, Date, Timestamp) into 'DD/MM/YYYY HH:mm'
 * in America/Argentina/Buenos_Aires.
 *
 * If only a pure 'YYYY-MM-DD' string is provided (no time available),
 * it gracefully outputs 'DD/MM/YYYY'.
 */
export function formatLocalDateTime(value?: any): string {
  if (!value) return 'Fecha no disponible';
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      return formatLocalDate(trimmed);
    }
  }

  const d = parseDateInput(value);
  if (!d) return typeof value === 'string' ? value : 'Fecha no disponible';

  try {
    return argentinaDateTimeFormatter.format(d);
  } catch {
    return formatLocalDate(value);
  }
}

/**
 * Formats an operation having possibly both a calendar date ('date') and a creation timestamp ('createdAt').
 *
 * Rule:
 * 1. If 'createdAt' is available (real instant), format in Argentina timezone (gives exact day & time).
 * 2. If only 'date' is available, format as 'DD/MM/YYYY' without shifting.
 */
export function formatOperationDateTime(dateStr?: string | null, createdIso?: string | null): string {
  if (createdIso) {
    return formatLocalDateTime(createdIso);
  }
  if (dateStr) {
    if (dateStr.includes('T') || dateStr.includes(':')) {
      return formatLocalDateTime(dateStr);
    }
    return formatLocalDate(dateStr);
  }
  return 'Fecha no disponible';
}

/**
 * Returns UTC Date boundaries for a calendar day YYYY-MM-DD in Argentina timezone (UTC-3).
 * Example: '2026-09-20' -> start: 2026-09-20T03:00:00.000Z, end: 2026-09-21T02:59:59.999Z
 */
export function getArgentinaDayRange(dateStr: string): { start: Date; end: Date } {
  const clean = toArgentinaDateString(dateStr);
  const start = new Date(`${clean}T00:00:00.000-03:00`);
  const end = new Date(`${clean}T23:59:59.999-03:00`);
  return { start, end };
}

/**
 * Checks if a record's instant or calendar date falls within a given start/end Date range (in Argentina time).
 */
export function isWithinArgentinaRange(
  recordDate: any,
  start: Date,
  end: Date
): boolean {
  if (!recordDate) return false;
  
  // If it's a pure YYYY-MM-DD string
  if (typeof recordDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(recordDate.trim())) {
    const range = getArgentinaDayRange(recordDate.trim());
    return range.end >= start && range.start <= end;
  }

  const d = parseDateInput(recordDate);
  if (!d) return false;
  return d >= start && d <= end;
}

