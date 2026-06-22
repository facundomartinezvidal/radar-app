/**
 * recommendations.test.ts
 * Unit tests for the pure, side-effect-free exports from recommendations.ts.
 *
 * Run with:
 *   deno test supabase/functions/whatsapp-webhook/recommendations.test.ts
 *
 * These tests have NO side effects — no network, no Supabase, no Groq calls.
 * They verify:
 *   1. buildInsightsPayload — pct calculation, net derivation, trend merging,
 *      prevPeriodExpenses passthrough, currency filtering.
 *   2. isInsufficientData   — empty → true, any activity → false.
 *
 * Fixed period used across all tests:
 *   June 2026 (current month) — from 2026-06-01T00:00:00.000Z to 2026-06-30T23:59:59.999Z
 */

import { assertEquals, assertAlmostEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { buildInsightsPayload, isInsufficientData } from './recommendations.ts';

// ---------------------------------------------------------------------------
// Fixed period for all tests
// ---------------------------------------------------------------------------

const PERIOD = {
  from: '2026-06-01T00:00:00.000Z',
  to: '2026-06-30T23:59:59.999Z',
  label: 'Este mes:',
};

// ---------------------------------------------------------------------------
// Helpers — minimal row factories
// ---------------------------------------------------------------------------

function totalsRow(currency: string, total: number) {
  return { currency, total, count: 1 };
}

function categoryRow(name: string, total: number) {
  return { category_id: 'uuid', category_name: name, color: '#888', icon: 'Tag', total, count: 1 };
}

function periodRow(bucket: string, total: number) {
  return { bucket, total, count: 1 };
}

// ---------------------------------------------------------------------------
// 1. buildInsightsPayload — currency field
// ---------------------------------------------------------------------------

Deno.test('buildInsightsPayload: currency is forwarded verbatim', () => {
  const payload = buildInsightsPayload([], [], [], [], [], 'USD', PERIOD);
  assertEquals(payload.currency, 'USD');
});

Deno.test('buildInsightsPayload: ARS currency forwarded', () => {
  const payload = buildInsightsPayload([], [], [], [], [], 'ARS', PERIOD);
  assertEquals(payload.currency, 'ARS');
});

// ---------------------------------------------------------------------------
// 2. buildInsightsPayload — period shape
// ---------------------------------------------------------------------------

Deno.test('buildInsightsPayload: period label/from/to are forwarded', () => {
  const payload = buildInsightsPayload([], [], [], [], [], 'ARS', PERIOD);
  assertEquals(payload.period.label, 'Este mes:');
  assertEquals(payload.period.from, '2026-06-01T00:00:00.000Z');
  assertEquals(payload.period.to, '2026-06-30T23:59:59.999Z');
});

// ---------------------------------------------------------------------------
// 3. buildInsightsPayload — totals: expenses, incomes, net
// ---------------------------------------------------------------------------

Deno.test('buildInsightsPayload: totals expenses taken from matching currency row', () => {
  const totals = [totalsRow('ARS', 50_000), totalsRow('USD', 200)];
  const payload = buildInsightsPayload(totals, [], [], [], [], 'ARS', PERIOD);
  assertEquals(payload.totals.expenses, 50_000);
});

Deno.test('buildInsightsPayload: totals expenses = 0 when no matching currency row', () => {
  const totals = [totalsRow('USD', 200)];
  const payload = buildInsightsPayload(totals, [], [], [], [], 'ARS', PERIOD);
  assertEquals(payload.totals.expenses, 0);
});

Deno.test('buildInsightsPayload: incomes derived from income period rows (sum)', () => {
  const incPeriod = [periodRow('2026-06-01', 30_000), periodRow('2026-06-15', 20_000)];
  const payload = buildInsightsPayload([], [], [], incPeriod, [], 'ARS', PERIOD);
  assertEquals(payload.totals.incomes, 50_000);
});

Deno.test('buildInsightsPayload: net = incomes - expenses', () => {
  const totals = [totalsRow('ARS', 40_000)];
  const incPeriod = [periodRow('2026-06-01', 60_000)];
  const payload = buildInsightsPayload(totals, [], [], incPeriod, [], 'ARS', PERIOD);
  assertEquals(payload.totals.net, 20_000);
});

Deno.test('buildInsightsPayload: negative net when expenses > incomes', () => {
  const totals = [totalsRow('ARS', 80_000)];
  const incPeriod = [periodRow('2026-06-01', 50_000)];
  const payload = buildInsightsPayload(totals, [], [], incPeriod, [], 'ARS', PERIOD);
  assertEquals(payload.totals.net, -30_000);
});

Deno.test('buildInsightsPayload: all totals are 0 when no rows', () => {
  const payload = buildInsightsPayload([], [], [], [], [], 'ARS', PERIOD);
  assertEquals(payload.totals.expenses, 0);
  assertEquals(payload.totals.incomes, 0);
  assertEquals(payload.totals.net, 0);
});

// ---------------------------------------------------------------------------
// 4. buildInsightsPayload — byCategory pct calculation
// ---------------------------------------------------------------------------

Deno.test('buildInsightsPayload: byCategory pct sums to 100 for two equal categories', () => {
  const cats = [categoryRow('Comida', 10_000), categoryRow('Transporte', 10_000)];
  const payload = buildInsightsPayload([], cats, [], [], [], 'ARS', PERIOD);
  assertEquals(payload.byCategory.length, 2);
  assertAlmostEquals(payload.byCategory[0].pct, 50, 0.001);
  assertAlmostEquals(payload.byCategory[1].pct, 50, 0.001);
});

Deno.test('buildInsightsPayload: byCategory pct proportional to totals', () => {
  // 75% / 25% split
  const cats = [categoryRow('Comida', 3_000), categoryRow('Ropa', 1_000)];
  const payload = buildInsightsPayload([], cats, [], [], [], 'ARS', PERIOD);
  assertAlmostEquals(payload.byCategory[0].pct, 75, 0.001);
  assertAlmostEquals(payload.byCategory[1].pct, 25, 0.001);
});

Deno.test('buildInsightsPayload: byCategory pct = 0 when sumExpenses = 0', () => {
  // Rows with 0 totals — shouldn't happen in practice but must not divide by zero
  const cats = [categoryRow('Comida', 0)];
  const payload = buildInsightsPayload([], cats, [], [], [], 'ARS', PERIOD);
  assertEquals(payload.byCategory[0].pct, 0);
});

Deno.test('buildInsightsPayload: byCategory name forwarded from category_name', () => {
  const cats = [categoryRow('Supermercado', 5_000)];
  const payload = buildInsightsPayload([], cats, [], [], [], 'ARS', PERIOD);
  assertEquals(payload.byCategory[0].name, 'Supermercado');
  assertEquals(payload.byCategory[0].total, 5_000);
});

Deno.test('buildInsightsPayload: byCategory is empty when no rows', () => {
  const payload = buildInsightsPayload([], [], [], [], [], 'ARS', PERIOD);
  assertEquals(payload.byCategory, []);
});

// ---------------------------------------------------------------------------
// 5. buildInsightsPayload — trend merging
// ---------------------------------------------------------------------------

Deno.test('buildInsightsPayload: trend merges expense and income period rows by bucket', () => {
  const expRows = [periodRow('2026-06-01', 20_000)];
  const incRows = [periodRow('2026-06-01', 50_000)];
  const payload = buildInsightsPayload([], [], expRows, incRows, [], 'ARS', PERIOD);
  assertEquals(payload.trend.length, 1);
  assertEquals(payload.trend[0].bucket, '2026-06-01');
  assertEquals(payload.trend[0].expenses, 20_000);
  assertEquals(payload.trend[0].incomes, 50_000);
});

Deno.test('buildInsightsPayload: trend keeps separate buckets for different dates', () => {
  const expRows = [periodRow('2026-05-01', 10_000), periodRow('2026-06-01', 30_000)];
  const incRows = [periodRow('2026-06-01', 45_000)];
  const payload = buildInsightsPayload([], [], expRows, incRows, [], 'ARS', PERIOD);
  assertEquals(payload.trend.length, 2);
  // Sorted by bucket
  assertEquals(payload.trend[0].bucket, '2026-05-01');
  assertEquals(payload.trend[0].expenses, 10_000);
  assertEquals(payload.trend[0].incomes, 0);
  assertEquals(payload.trend[1].bucket, '2026-06-01');
  assertEquals(payload.trend[1].expenses, 30_000);
  assertEquals(payload.trend[1].incomes, 45_000);
});

Deno.test('buildInsightsPayload: trend is sorted by bucket ascending', () => {
  // Provide rows out of order
  const expRows = [periodRow('2026-06-01', 5_000), periodRow('2026-05-01', 8_000)];
  const payload = buildInsightsPayload([], [], expRows, [], [], 'ARS', PERIOD);
  assertEquals(payload.trend[0].bucket, '2026-05-01');
  assertEquals(payload.trend[1].bucket, '2026-06-01');
});

Deno.test('buildInsightsPayload: trend income-only bucket has expenses = 0', () => {
  const incRows = [periodRow('2026-06-01', 40_000)];
  const payload = buildInsightsPayload([], [], [], incRows, [], 'ARS', PERIOD);
  assertEquals(payload.trend[0].expenses, 0);
  assertEquals(payload.trend[0].incomes, 40_000);
});

Deno.test('buildInsightsPayload: trend is empty when no period rows', () => {
  const payload = buildInsightsPayload([], [], [], [], [], 'ARS', PERIOD);
  assertEquals(payload.trend, []);
});

// ---------------------------------------------------------------------------
// 6. buildInsightsPayload — prevPeriodExpenses
// ---------------------------------------------------------------------------

Deno.test('buildInsightsPayload: prevPeriodExpenses extracted from matching currency row', () => {
  const prevTotals = [totalsRow('ARS', 35_000), totalsRow('USD', 100)];
  const payload = buildInsightsPayload([], [], [], [], prevTotals, 'ARS', PERIOD);
  assertEquals(payload.prevPeriodExpenses, 35_000);
});

Deno.test('buildInsightsPayload: prevPeriodExpenses omitted when no prev rows', () => {
  const payload = buildInsightsPayload([], [], [], [], [], 'ARS', PERIOD);
  assertEquals(payload.prevPeriodExpenses, undefined);
});

Deno.test('buildInsightsPayload: prevPeriodExpenses omitted when currency not in prev rows', () => {
  const prevTotals = [totalsRow('USD', 50)];
  const payload = buildInsightsPayload([], [], [], [], prevTotals, 'ARS', PERIOD);
  assertEquals(payload.prevPeriodExpenses, undefined);
});

Deno.test('buildInsightsPayload: prevPeriodExpenses = 0 when prev row total is 0', () => {
  const prevTotals = [totalsRow('ARS', 0)];
  const payload = buildInsightsPayload([], [], [], [], prevTotals, 'ARS', PERIOD);
  assertEquals(payload.prevPeriodExpenses, 0);
});

// ---------------------------------------------------------------------------
// 7. buildInsightsPayload — numeric coercion (Supabase returns strings for numeric)
// ---------------------------------------------------------------------------

Deno.test('buildInsightsPayload: numeric columns coerced from string to number', () => {
  // Supabase returns numeric(10,2) as string e.g. "12345.67"
  const totals = [{ currency: 'ARS', total: '12345.67' as unknown as number, count: 1 }];
  const cats = [{ ...categoryRow('Comida', '5000.00' as unknown as number) }];
  const expRows = [{ bucket: '2026-06-01', total: '8000.50' as unknown as number, count: 2 }];
  const payload = buildInsightsPayload(totals, cats, expRows, [], [], 'ARS', PERIOD);
  assertEquals(payload.totals.expenses, 12345.67);
  assertEquals(payload.byCategory[0].total, 5000);
  assertEquals(payload.trend[0].expenses, 8000.5);
});

// ---------------------------------------------------------------------------
// 8. isInsufficientData
// ---------------------------------------------------------------------------

Deno.test('isInsufficientData: true when both expenses and incomes are 0', () => {
  const payload = buildInsightsPayload([], [], [], [], [], 'ARS', PERIOD);
  assertEquals(isInsufficientData(payload), true);
});

Deno.test('isInsufficientData: false when expenses > 0', () => {
  const totals = [totalsRow('ARS', 1_000)];
  const payload = buildInsightsPayload(totals, [], [], [], [], 'ARS', PERIOD);
  assertEquals(isInsufficientData(payload), false);
});

Deno.test('isInsufficientData: false when incomes > 0 (even with no expenses)', () => {
  const incRows = [periodRow('2026-06-01', 5_000)];
  const payload = buildInsightsPayload([], [], [], incRows, [], 'ARS', PERIOD);
  assertEquals(isInsufficientData(payload), false);
});

Deno.test('isInsufficientData: false when both expenses and incomes > 0', () => {
  const totals = [totalsRow('ARS', 20_000)];
  const incRows = [periodRow('2026-06-01', 30_000)];
  const payload = buildInsightsPayload(totals, [], [], incRows, [], 'ARS', PERIOD);
  assertEquals(isInsufficientData(payload), false);
});
