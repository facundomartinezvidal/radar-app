/**
 * Pure recurrence-date utilities — zero side effects, no Supabase dependency.
 *
 * Mirrors the semantics of the SQL `advance_occurrence` function defined in
 * supabase/migrations/20260608144623_income_recurrence_functions_fix_strict.sql
 * exactly. All calendar arithmetic is done on YYYY-MM-DD string components
 * (parsed to integer y/m/d) to avoid timezone pitfalls with the Date object.
 *
 * Used by the client to compute `day_of_month` and `next_run_on` when creating
 * or previewing a recurrence rule — no backfill, first occurrence is in the future.
 */
import { type Frequency } from '@/lib/schemas/income-recurrence';

export type { Frequency };

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Parse a YYYY-MM-DD string into { y, m, d } integers (1-based). */
function parseDate(date: string): { y: number; m: number; d: number } {
  const [ys, ms, ds] = date.split('-');
  return { y: parseInt(ys!, 10), m: parseInt(ms!, 10), d: parseInt(ds!, 10) };
}

/** Format y/m/d integers back to YYYY-MM-DD. Zero-pads month and day. */
function formatDate(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** Number of days in a given month (1-based). Accounts for leap years. */
function daysInMonth(y: number, m: number): number {
  // Day 0 of month m+1 is the last day of month m.
  return new Date(y, m, 0).getDate();
}

/** Add `n` calendar days to a YYYY-MM-DD string. */
function addDays(date: string, n: number): string {
  const { y, m, d } = parseDate(date);
  // Use UTC to avoid DST shifts — only care about calendar date.
  const ts = Date.UTC(y, m - 1, d + n);
  const dt = new Date(ts);
  return formatDate(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
}

/** Compare two YYYY-MM-DD strings lexicographically (works because ISO order). */
function isAfter(a: string, b: string): boolean {
  return a > b;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Return the day-of-month component (1..31) of a YYYY-MM-DD string.
 *
 * Used to populate `income_recurrences.day_of_month` when the user picks
 * a start date — call this client-side before saving.
 */
export function dayOfMonthFrom(startDate: string): number {
  return parseDate(startDate).d;
}

/**
 * Advance a recurrence date by exactly one period.
 *
 * Matches the SQL `advance_occurrence(p_current, p_freq, p_dom, p_start)` function:
 *
 * - `weekly`   → current + 7 days
 * - `biweekly` → current + 14 days
 * - `monthly`  → first day of the month after `current`, then snap to
 *                `min(dayOfMonth ?? day(startDate), daysInThatMonth)`.
 *                `dayOfMonth` is the anchor — it is NOT inherited from the
 *                previous clamped value, preventing drift.
 * - `yearly`   → year(current)+1, same month/day as `startDate`, with Feb-29
 *                clamped to Feb-28 on non-leap years.
 *
 * @param current     Current occurrence date as YYYY-MM-DD.
 * @param freq        Recurrence frequency.
 * @param dayOfMonth  Desired anchor day for monthly rules (1..31 or null).
 *                    Null means "inherit day from startDate" — mirrors p_dom IS NULL
 *                    in the SQL COALESCE(p_dom::int, extract(day from p_start)::int).
 * @param startDate   The original start date — used for day anchor on monthly (when
 *                    dayOfMonth is null) and for month/day anchor on yearly.
 */
export function advanceOccurrence(
  current: string,
  freq: Frequency,
  dayOfMonth: number | null,
  startDate: string,
): string {
  switch (freq) {
    case 'weekly':
      return addDays(current, 7);

    case 'biweekly':
      return addDays(current, 14);

    case 'monthly': {
      const { y: cy, m: cm } = parseDate(current);
      const { d: sd } = parseDate(startDate);

      // First day of the month after current
      const nextM = cm === 12 ? 1 : cm + 1;
      const nextY = cm === 12 ? cy + 1 : cy;

      // Desired day: explicit anchor OR day of startDate (mirrors COALESCE in SQL)
      const desiredDay = dayOfMonth ?? sd;

      // Clamp to last day of that next month (handles Feb-28/29, Apr-30, etc.)
      const maxDay = daysInMonth(nextY, nextM);
      const actualDay = Math.min(desiredDay, maxDay);

      return formatDate(nextY, nextM, actualDay);
    }

    case 'yearly': {
      const { y: cy } = parseDate(current);
      const { m: sm, d: sd } = parseDate(startDate);

      const nextY = cy + 1;

      // Clamp start-date's day to that month in the next year
      const maxDay = daysInMonth(nextY, sm);
      const actualDay = Math.min(sd, maxDay);

      return formatDate(nextY, sm, actualDay);
    }
  }
}

/**
 * Return the first occurrence date strictly AFTER `today`.
 *
 * Algorithm:
 * 1. If `startDate > today` → return `startDate` immediately (first run is in the future).
 * 2. Otherwise advance from `startDate` one period at a time until the result is > today.
 *
 * `today` is injected so callers can control it (and so tests are deterministic —
 * never call `new Date()` here).
 *
 * @param startDate   Recurrence start date (YYYY-MM-DD).
 * @param freq        Recurrence frequency.
 * @param today       Reference "today" date (YYYY-MM-DD). First future occurrence must be > this.
 */
export function firstFutureOccurrence(startDate: string, freq: Frequency, today: string): string {
  // dayOfMonth anchor: day of the startDate itself (same as SQL COALESCE default)
  const domAnchor = dayOfMonthFrom(startDate);

  // If startDate is strictly in the future, it is the first occurrence.
  if (isAfter(startDate, today)) {
    return startDate;
  }

  // Walk forward from startDate until we pass today.
  let current = startDate;
  do {
    current = advanceOccurrence(current, freq, domAnchor, startDate);
  } while (!isAfter(current, today));

  return current;
}
