/**
 * Unit tests for the pure income-recurrence utilities.
 *
 * Each assertion is cross-checked against the SQL `advance_occurrence` smoke
 * tests that were verified against the remote Supabase function in migration
 * 20260608144623_income_recurrence_functions_fix_strict.sql.
 *
 * No Supabase dependency — these are pure functions.
 */
import { advanceOccurrence, dayOfMonthFrom, firstFutureOccurrence } from '../income-recurrence';

// ---------------------------------------------------------------------------
// dayOfMonthFrom
// ---------------------------------------------------------------------------

describe('dayOfMonthFrom', () => {
  it('returns 29 for 2026-04-29', () => {
    expect(dayOfMonthFrom('2026-04-29')).toBe(29);
  });

  it('returns 1 for 2026-01-01', () => {
    expect(dayOfMonthFrom('2026-01-01')).toBe(1);
  });

  it('returns 31 for 2026-01-31', () => {
    expect(dayOfMonthFrom('2026-01-31')).toBe(31);
  });

  it('returns 28 for 2025-02-28', () => {
    expect(dayOfMonthFrom('2025-02-28')).toBe(28);
  });

  it('returns 29 for 2024-02-29 (leap year)', () => {
    expect(dayOfMonthFrom('2024-02-29')).toBe(29);
  });
});

// ---------------------------------------------------------------------------
// advanceOccurrence — weekly
// ---------------------------------------------------------------------------

describe('advanceOccurrence — weekly', () => {
  it('advances 7 days (SQL smoke test)', () => {
    expect(advanceOccurrence('2026-03-01', 'weekly', null, '2026-01-01')).toBe('2026-03-08');
  });

  it('advances across a month boundary', () => {
    expect(advanceOccurrence('2026-01-28', 'weekly', null, '2026-01-01')).toBe('2026-02-04');
  });

  it('advances across a year boundary', () => {
    expect(advanceOccurrence('2025-12-29', 'weekly', null, '2025-01-01')).toBe('2026-01-05');
  });
});

// ---------------------------------------------------------------------------
// advanceOccurrence — biweekly
// ---------------------------------------------------------------------------

describe('advanceOccurrence — biweekly', () => {
  it('advances 14 days (SQL smoke test)', () => {
    expect(advanceOccurrence('2026-03-01', 'biweekly', null, '2026-01-01')).toBe('2026-03-15');
  });

  it('advances across a month boundary', () => {
    expect(advanceOccurrence('2026-01-25', 'biweekly', null, '2026-01-01')).toBe('2026-02-08');
  });
});

// ---------------------------------------------------------------------------
// advanceOccurrence — monthly
// ---------------------------------------------------------------------------

describe('advanceOccurrence — monthly', () => {
  it('clamps Jan-31 → Feb-28 in a non-leap year (SQL smoke test)', () => {
    // anchor=31, Feb 2026 has 28 days → clamp to 28
    expect(advanceOccurrence('2026-01-31', 'monthly', 31, '2026-01-31')).toBe('2026-02-28');
  });

  it('restores the full anchor after a clamped month — no drift (SQL smoke test)', () => {
    // previous was clamped to Feb-28 but anchor is still 31 → Mar has 31 days → Mar-31
    expect(advanceOccurrence('2026-02-28', 'monthly', 31, '2026-01-31')).toBe('2026-03-31');
  });

  it('clamps Jan-31 → Feb-29 in a leap year (2028)', () => {
    expect(advanceOccurrence('2028-01-31', 'monthly', 31, '2028-01-31')).toBe('2028-02-29');
  });

  it('rolls Dec → Jan of the next year', () => {
    expect(advanceOccurrence('2026-12-15', 'monthly', 15, '2026-12-15')).toBe('2027-01-15');
  });

  it('rolls Dec-31 → Jan-31 of the next year', () => {
    expect(advanceOccurrence('2026-12-31', 'monthly', 31, '2026-12-31')).toBe('2027-01-31');
  });

  it('clamps Apr-30 anchor to Apr-30 (April has 30 days)', () => {
    expect(advanceOccurrence('2026-03-31', 'monthly', 31, '2026-03-31')).toBe('2026-04-30');
  });

  it('uses startDate day as anchor when dayOfMonth is null', () => {
    // startDate day = 15; current = 2026-03-15 → next = 2026-04-15
    expect(advanceOccurrence('2026-03-15', 'monthly', null, '2026-01-15')).toBe('2026-04-15');
  });

  it('null anchor clamps correctly: startDate day=31, next month Feb', () => {
    expect(advanceOccurrence('2026-01-31', 'monthly', null, '2026-01-31')).toBe('2026-02-28');
  });
});

// ---------------------------------------------------------------------------
// advanceOccurrence — yearly
// ---------------------------------------------------------------------------

describe('advanceOccurrence — yearly', () => {
  it('clamps Feb-29 → Feb-28 on non-leap year (SQL smoke test)', () => {
    // 2024 is leap; 2025 is not → clamp to Feb-28
    expect(advanceOccurrence('2024-02-29', 'yearly', 29, '2024-02-29')).toBe('2025-02-28');
  });

  it('preserves Feb-29 when next year IS a leap year', () => {
    // 2028 is leap → Feb-29 is valid
    expect(advanceOccurrence('2027-02-28', 'yearly', null, '2028-02-29')).toBe('2028-02-29');
  });

  it('anchors to startDate month/day regardless of current date month/day', () => {
    // startDate = Jun-15 → next year Jun-15
    expect(advanceOccurrence('2026-06-15', 'yearly', null, '2025-06-15')).toBe('2027-06-15');
  });

  it('rolls year correctly at Dec-31', () => {
    expect(advanceOccurrence('2026-12-31', 'yearly', null, '2026-12-31')).toBe('2027-12-31');
  });
});

// ---------------------------------------------------------------------------
// firstFutureOccurrence
// ---------------------------------------------------------------------------

describe('firstFutureOccurrence', () => {
  it('returns startDate when it is strictly in the future', () => {
    // startDate > today → first occurrence IS the startDate
    expect(firstFutureOccurrence('2026-07-01', 'monthly', '2026-06-08')).toBe('2026-07-01');
  });

  it('monthly: start in the past advances to first date > today (SQL smoke test)', () => {
    // start=2026-04-29, freq=monthly, today=2026-06-08
    // 2026-04-29 → 2026-05-29 → 2026-06-29 (> 2026-06-08) ✓
    expect(firstFutureOccurrence('2026-04-29', 'monthly', '2026-06-08')).toBe('2026-06-29');
  });

  it('today exactly on an occurrence → advances to next', () => {
    // start=2026-05-15, freq=monthly, today=2026-06-15
    // 2026-05-15 → 2026-06-15 — NOT after today → advance again → 2026-07-15
    expect(firstFutureOccurrence('2026-05-15', 'monthly', '2026-06-15')).toBe('2026-07-15');
  });

  it('weekly: start in the past, multiple advances needed', () => {
    // start=2026-06-01 (Mon), today=2026-06-08
    // 2026-06-01 → 06-08 (not strictly after 06-08) → 06-15 ✓
    expect(firstFutureOccurrence('2026-06-01', 'weekly', '2026-06-08')).toBe('2026-06-15');
  });

  it('biweekly: start in the past', () => {
    // start=2026-05-01, today=2026-06-08
    // 05-01 → 05-15 → 05-29 → 06-12 (> 06-08) ✓
    expect(firstFutureOccurrence('2026-05-01', 'biweekly', '2026-06-08')).toBe('2026-06-12');
  });

  it('yearly: start in the past, same year occurrence already passed → next year', () => {
    // start=2026-01-10, freq=yearly, today=2026-06-08
    // 2026-01-10 → 2027-01-10 ✓
    expect(firstFutureOccurrence('2026-01-10', 'yearly', '2026-06-08')).toBe('2027-01-10');
  });

  it('yearly: start is in the future → returns startDate', () => {
    expect(firstFutureOccurrence('2027-03-01', 'yearly', '2026-06-08')).toBe('2027-03-01');
  });

  it('monthly: clamp propagates correctly through firstFutureOccurrence', () => {
    // start=2026-01-31, today=2026-02-28 → next after Feb-28 is Mar-31
    expect(firstFutureOccurrence('2026-01-31', 'monthly', '2026-02-28')).toBe('2026-03-31');
  });
});
