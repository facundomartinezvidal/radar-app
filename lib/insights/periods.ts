/**
 * Pure date helpers for the Insights feature.
 *
 * No React, no Supabase, no I/O.
 *
 * Month boundaries follow the same local-time convention as `currentMonthRange()`
 * in `app/(protected)/(tabs)/index.tsx`:
 *   from = new Date(y, m, 1,  0,  0,  0,   0).toISOString()  — first instant of the month
 *   to   = new Date(y, m+1, 0, 23, 59, 59, 999).toISOString() — last instant of the month
 *
 * Every function that needs "now" accepts an optional `now: Date = new Date()`
 * parameter so tests can inject a fixed date without monkey-patching globals.
 */
import type { Bucket, Period, PeriodPresetId } from './types';

// ---------------------------------------------------------------------------
// Spanish month names (es-AR, sentence case)
// ---------------------------------------------------------------------------

const MONTH_NAMES: readonly string[] = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Build the ISO start instant for the first day of a given month (local time). */
function monthStart(year: number, monthIndex0: number): string {
  return new Date(year, monthIndex0, 1, 0, 0, 0, 0).toISOString();
}

/** Build the ISO end instant for the last day of a given month (local time). */
function monthEnd(year: number, monthIndex0: number): string {
  // day=0 of the NEXT month resolves to the last day of the current month.
  return new Date(year, monthIndex0 + 1, 0, 23, 59, 59, 999).toISOString();
}

/** Return true when `year`/`monthIndex0` is strictly after the current month. */
function isAfterCurrentMonth(year: number, monthIndex0: number, now: Date): boolean {
  const nowYear = now.getFullYear();
  const nowMonth = now.getMonth();
  return year > nowYear || (year === nowYear && monthIndex0 > nowMonth);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Compute a `Period` for a named preset.
 *
 * @param id - One of the four preset identifiers.
 * @param now - The reference point for "current month / year". Defaults to
 *              `new Date()` so callers in app code need not pass it; tests
 *              inject a fixed date for determinism.
 */
export function presetPeriod(id: PeriodPresetId, now: Date = new Date()): Period {
  const y = now.getFullYear();
  const m = now.getMonth(); // 0-based

  switch (id) {
    case 'this-month': {
      return {
        label: 'Este mes',
        from: monthStart(y, m),
        to: monthEnd(y, m),
        bucket: 'week',
      };
    }

    case 'last-month': {
      // Month before the current one — works even when m=0 (Jan → Dec prev year)
      const prevMonth = m === 0 ? 11 : m - 1;
      const prevYear = m === 0 ? y - 1 : y;
      return {
        label: 'Mes pasado',
        from: monthStart(prevYear, prevMonth),
        to: monthEnd(prevYear, prevMonth),
        bucket: 'week',
      };
    }

    case 'last-3-months': {
      // Start = first day of (currentMonth - 2); end = last day of current month.
      // Examples with now=April 2026: start=Feb 1, end=Apr 30.
      const startMonthRaw = m - 2;
      const startMonth = ((startMonthRaw % 12) + 12) % 12;
      const startYear = y + Math.floor(startMonthRaw / 12);
      return {
        label: 'Últimos 3 meses',
        from: monthStart(startYear, startMonth),
        to: monthEnd(y, m),
        bucket: 'month',
      };
    }

    case 'this-year': {
      // Jan 1 → end of current month (future months have no data, so clamp to now).
      return {
        label: 'Este año',
        from: monthStart(y, 0),
        to: monthEnd(y, m),
        bucket: 'month',
      };
    }
  }
}

/**
 * Build a `Period` for an explicit calendar month.
 *
 * @param year        - Full calendar year, e.g. 2026.
 * @param monthIndex0 - Zero-based month index (0 = January … 11 = December).
 */
export function monthPeriod(year: number, monthIndex0: number): Period {
  const monthName = MONTH_NAMES[monthIndex0];
  // MONTH_NAMES is always 12 entries; monthIndex0 is expected to be 0–11.
  // The non-null assertion is safe here — callers must pass a valid index.
  const label = `${monthName!} ${year}`;
  return {
    label,
    from: monthStart(year, monthIndex0),
    to: monthEnd(year, monthIndex0),
    bucket: 'week',
  };
}

/**
 * Navigate the month selector by `delta` months.
 *
 * Rules:
 * - `delta = -1` → previous month.
 * - `delta = +1` → next month; CLAMPED so the result is never a future month
 *   relative to `now`. If already at the current month and delta > 0, the same
 *   current-month period is returned unchanged.
 * - The incoming `period` is expected to be a single-month period produced by
 *   `monthPeriod` or `presetPeriod('this-month' | 'last-month')`.
 *
 * @param period - The current period to navigate from.
 * @param delta  - The number of months to move (+1 or -1 are the typical values).
 * @param now    - Reference point for the future clamp. Defaults to `new Date()`.
 */
export function shiftMonth(period: Period, delta: number, now: Date = new Date()): Period {
  // Derive the represented month from the `from` ISO string.
  const fromDate = new Date(period.from);
  const curYear = fromDate.getFullYear();
  const curMonth = fromDate.getMonth(); // 0-based

  const rawMonth = curMonth + delta;
  const targetMonth = ((rawMonth % 12) + 12) % 12;
  const targetYear = curYear + Math.floor(rawMonth / 12);

  // Clamp: never move forward past the current month.
  if (isAfterCurrentMonth(targetYear, targetMonth, now)) {
    // Return the current month (clamped).
    const nowYear = now.getFullYear();
    const nowMonth = now.getMonth();
    return monthPeriod(nowYear, nowMonth);
  }

  return monthPeriod(targetYear, targetMonth);
}

/**
 * Build a `Period` covering the trailing `months` calendar months up to `now`.
 *
 * @param months - Number of months to include (default 6). The window spans from
 *                 the first instant of the month `(months - 1)` months before the
 *                 current month through `now`.
 * @param now    - Reference point for "current month". Defaults to `new Date()`.
 *
 * @example
 *   // now = 2026-06-21
 *   trailingMonthsPeriod(6) // from = 2026-01-01 00:00:00, to = now, bucket = 'month'
 */
export function trailingMonthsPeriod(months = 6, now: Date = new Date()): Period {
  const nowYear = now.getFullYear();
  const nowMonth = now.getMonth(); // 0-based

  // First month of the window: (months - 1) months before the current month.
  const startMonthRaw = nowMonth - (months - 1);
  const startMonth = ((startMonthRaw % 12) + 12) % 12;
  const startYear = nowYear + Math.floor(startMonthRaw / 12);

  return {
    label: `Últimos ${months} meses`,
    from: monthStart(startYear, startMonth),
    to: now.toISOString(),
    bucket: 'month',
  };
}
