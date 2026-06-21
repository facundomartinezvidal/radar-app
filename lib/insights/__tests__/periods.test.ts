/**
 * Unit tests for lib/insights/periods.ts
 *
 * All tests inject `now = new Date(2026, 3, 15)` (April 15, 2026) for
 * determinism — no real clock is used.
 */
import { monthPeriod, presetPeriod, shiftMonth, trailingMonthsPeriod } from '../periods';

// Fixed reference: April 15, 2026
const NOW = new Date(2026, 3, 15);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** The ISO string for the first instant of a given local-time month. */
function expectMonthStart(year: number, month0: number): string {
  return new Date(year, month0, 1, 0, 0, 0, 0).toISOString();
}

/** The ISO string for the last instant of a given local-time month. */
function expectMonthEnd(year: number, month0: number): string {
  return new Date(year, month0 + 1, 0, 23, 59, 59, 999).toISOString();
}

// ---------------------------------------------------------------------------
// presetPeriod — this-month
// ---------------------------------------------------------------------------

describe('presetPeriod("this-month")', () => {
  const period = presetPeriod('this-month', NOW);

  it('returns label "Este mes"', () => {
    expect(period.label).toBe('Este mes');
  });

  it('from is the first instant of April 2026', () => {
    expect(period.from).toBe(expectMonthStart(2026, 3));
  });

  it('to is the last instant of April 2026', () => {
    expect(period.to).toBe(expectMonthEnd(2026, 3));
  });

  it('bucket is "week" (weekly bars are more useful than 30 daily bars)', () => {
    expect(period.bucket).toBe<'week'>('week');
  });
});

// ---------------------------------------------------------------------------
// presetPeriod — last-month
// ---------------------------------------------------------------------------

describe('presetPeriod("last-month")', () => {
  const period = presetPeriod('last-month', NOW);

  it('returns label "Mes pasado"', () => {
    expect(period.label).toBe('Mes pasado');
  });

  it('from is the first instant of March 2026', () => {
    expect(period.from).toBe(expectMonthStart(2026, 2));
  });

  it('to is the last instant of March 2026', () => {
    expect(period.to).toBe(expectMonthEnd(2026, 2));
  });

  it('bucket is "week" (weekly bars are more useful than 28–31 daily bars)', () => {
    expect(period.bucket).toBe<'week'>('week');
  });
});

// ---------------------------------------------------------------------------
// presetPeriod — last-3-months
// ---------------------------------------------------------------------------

describe('presetPeriod("last-3-months")', () => {
  const period = presetPeriod('last-3-months', NOW);

  it('returns label "Últimos 3 meses"', () => {
    expect(period.label).toBe('Últimos 3 meses');
  });

  it('from is the first instant of February 2026 (3 months back from April)', () => {
    // April (m=3) - 2 = February (m=1)
    expect(period.from).toBe(expectMonthStart(2026, 1));
  });

  it('to is the last instant of April 2026 (current month)', () => {
    expect(period.to).toBe(expectMonthEnd(2026, 3));
  });

  it('bucket is "month"', () => {
    expect(period.bucket).toBe<'month'>('month');
  });
});

// ---------------------------------------------------------------------------
// presetPeriod — this-year
// ---------------------------------------------------------------------------

describe('presetPeriod("this-year")', () => {
  const period = presetPeriod('this-year', NOW);

  it('returns label "Este año"', () => {
    expect(period.label).toBe('Este año');
  });

  it('from is the first instant of January 2026', () => {
    expect(period.from).toBe(expectMonthStart(2026, 0));
  });

  it('to is the last instant of current month (April 2026), not December', () => {
    // Clamped to current month — future months have no data
    expect(period.to).toBe(expectMonthEnd(2026, 3));
  });

  it('bucket is "month"', () => {
    expect(period.bucket).toBe<'month'>('month');
  });
});

// ---------------------------------------------------------------------------
// monthPeriod
// ---------------------------------------------------------------------------

describe('monthPeriod', () => {
  it('label for April 2026 is "Abril 2026"', () => {
    expect(monthPeriod(2026, 3).label).toBe('Abril 2026');
  });

  it('from is the first instant of April 2026', () => {
    expect(monthPeriod(2026, 3).from).toBe(expectMonthStart(2026, 3));
  });

  it('to is the last instant of April 2026', () => {
    expect(monthPeriod(2026, 3).to).toBe(expectMonthEnd(2026, 3));
  });

  it('bucket is "week" (weekly granularity for single-month navigation)', () => {
    expect(monthPeriod(2026, 3).bucket).toBe<'week'>('week');
  });

  it('label for January 2026 is "Enero 2026"', () => {
    expect(monthPeriod(2026, 0).label).toBe('Enero 2026');
  });

  it('label for December 2025 is "Diciembre 2025"', () => {
    expect(monthPeriod(2025, 11).label).toBe('Diciembre 2025');
  });
});

// ---------------------------------------------------------------------------
// shiftMonth — backward navigation
// ---------------------------------------------------------------------------

describe('shiftMonth — backward (delta = -1)', () => {
  it('April → March 2026', () => {
    const april = presetPeriod('this-month', NOW);
    const result = shiftMonth(april, -1, NOW);
    expect(result.label).toBe('Marzo 2026');
    expect(result.from).toBe(expectMonthStart(2026, 2));
    expect(result.to).toBe(expectMonthEnd(2026, 2));
  });

  it('January → December of the previous year', () => {
    const jan2026 = monthPeriod(2026, 0);
    const result = shiftMonth(jan2026, -1, NOW);
    expect(result.label).toBe('Diciembre 2025');
    expect(result.from).toBe(expectMonthStart(2025, 11));
    expect(result.to).toBe(expectMonthEnd(2025, 11));
  });
});

// ---------------------------------------------------------------------------
// shiftMonth — forward navigation (future clamp)
// ---------------------------------------------------------------------------

describe('shiftMonth — forward (delta = +1), future clamp', () => {
  it('current month (April) → clamps, stays April 2026', () => {
    const april = presetPeriod('this-month', NOW);
    const result = shiftMonth(april, 1, NOW);
    // Clamped — April is already the current month
    expect(result.label).toBe('Abril 2026');
    expect(result.from).toBe(expectMonthStart(2026, 3));
    expect(result.to).toBe(expectMonthEnd(2026, 3));
  });

  it('March → April 2026 (navigating forward to current month is allowed)', () => {
    const march = monthPeriod(2026, 2);
    const result = shiftMonth(march, 1, NOW);
    expect(result.label).toBe('Abril 2026');
  });

  it('February → March 2026 (past month, no clamp needed)', () => {
    const feb = monthPeriod(2026, 1);
    const result = shiftMonth(feb, 1, NOW);
    expect(result.label).toBe('Marzo 2026');
  });
});

// ---------------------------------------------------------------------------
// shiftMonth — year boundary: December → January
// ---------------------------------------------------------------------------

describe('shiftMonth — year boundary forward', () => {
  it('December 2025 → January 2026 is allowed (past month)', () => {
    const dec2025 = monthPeriod(2025, 11);
    // now=April 2026, so Jan 2026 is in the past — no clamp
    const result = shiftMonth(dec2025, 1, NOW);
    expect(result.label).toBe('Enero 2026');
    expect(result.from).toBe(expectMonthStart(2026, 0));
  });
});

// ---------------------------------------------------------------------------
// shiftMonth — year boundary with a different "now"
// ---------------------------------------------------------------------------

describe('shiftMonth — year boundary with now in next year', () => {
  it('December 2026 → January 2027 when now is January 2027', () => {
    const dec2026 = monthPeriod(2026, 11);
    const nowJan2027 = new Date(2027, 0, 10);
    const result = shiftMonth(dec2026, 1, nowJan2027);
    expect(result.label).toBe('Enero 2027');
    expect(result.from).toBe(expectMonthStart(2027, 0));
  });

  it('January 2026 → December 2025 when navigating backward (any now)', () => {
    const jan2026 = monthPeriod(2026, 0);
    const nowFeb2026 = new Date(2026, 1, 5);
    const result = shiftMonth(jan2026, -1, nowFeb2026);
    expect(result.label).toBe('Diciembre 2025');
  });
});

// ---------------------------------------------------------------------------
// trailingMonthsPeriod
// ---------------------------------------------------------------------------

// Fixed reference for trailing-months tests: June 21, 2026
const NOW_JUNE = new Date(2026, 5, 21);

describe('trailingMonthsPeriod', () => {
  it('label is "Últimos 6 meses" for default months=6', () => {
    const period = trailingMonthsPeriod(6, NOW_JUNE);
    expect(period.label).toBe('Últimos 6 meses');
  });

  it('bucket is "month"', () => {
    const period = trailingMonthsPeriod(6, NOW_JUNE);
    expect(period.bucket).toBe<'month'>('month');
  });

  it('from is January 1 2026 00:00:00 (5 months before June)', () => {
    // now = June 2026 (month index 5), trailing 6 → start at month 5-(6-1)=0 → January 2026
    const period = trailingMonthsPeriod(6, NOW_JUNE);
    expect(period.from).toBe(expectMonthStart(2026, 0));
  });

  it('to equals the injected now ISO string', () => {
    const period = trailingMonthsPeriod(6, NOW_JUNE);
    expect(period.to).toBe(NOW_JUNE.toISOString());
  });

  it('window spans 6 months: from Jan 2026 to Jun 2026', () => {
    const period = trailingMonthsPeriod(6, NOW_JUNE);
    const fromDate = new Date(period.from);
    expect(fromDate.getFullYear()).toBe(2026);
    expect(fromDate.getMonth()).toBe(0); // January
  });

  it('works for months=3 — from April 2026 (3 months back)', () => {
    const period = trailingMonthsPeriod(3, NOW_JUNE);
    expect(period.label).toBe('Últimos 3 meses');
    expect(period.from).toBe(expectMonthStart(2026, 3)); // April
  });

  it('crosses year boundary — months=6 with now=February 2026', () => {
    const nowFeb = new Date(2026, 1, 10); // February 2026 (month index 1)
    // start = month 1-(6-1) = -4 → ((-4 % 12) + 12) % 12 = 8 → September 2025
    const period = trailingMonthsPeriod(6, nowFeb);
    expect(period.from).toBe(expectMonthStart(2025, 8)); // September 2025
  });

  it('defaults months=6 when called without arguments (smoke test)', () => {
    // Just verify it doesn't throw and returns a period with bucket 'month'
    const period = trailingMonthsPeriod();
    expect(period.bucket).toBe('month');
    expect(period.label).toBe('Últimos 6 meses');
  });
});
