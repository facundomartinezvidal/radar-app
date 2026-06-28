/**
 * queries.test.ts
 * Unit tests for pure, side-effect-free exports from queries.ts.
 *
 * Run with:
 *   deno test supabase/functions/whatsapp-webhook/queries.test.ts
 *
 * These tests have NO side effects — no network, no Supabase, no Groq calls.
 * They verify:
 *   1. resolvePeriod — today, week (Mon–now), month, prev_month, year, custom,
 *      and undefined (defaults to month).
 *   2. formatAmount — ARS and USD formatting with Argentine locale separators.
 *
 * Fixed "now" used across all tests:
 *   Wednesday 2026-06-17T14:30:00.000Z
 *   UTC weekday: 3 (Wednesday), so Monday of this ISO week is 2026-06-15.
 */

import { assertEquals, assertStringIncludes } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  buildCategoryReply,
  buildTotalsReply,
  formatAmount,
  formatMovementLine,
  resolvePeriod,
} from './queries.ts';
import type { MovementRow } from './queries.ts';
import type { FinancialContext } from './finance_context.ts';

// ---------------------------------------------------------------------------
// Fixed "now" — Wednesday 17 June 2026, 14:30 UTC
// ---------------------------------------------------------------------------

const NOW = new Date('2026-06-17T14:30:00.000Z');

// ---------------------------------------------------------------------------
// resolvePeriod — today
// ---------------------------------------------------------------------------

Deno.test('resolvePeriod today: from = start of 2026-06-17, to = end of 2026-06-17', () => {
  const result = resolvePeriod('today', NOW);
  assertEquals(result.from, '2026-06-17T00:00:00.000Z');
  assertEquals(result.to, '2026-06-17T23:59:59.999Z');
  assertEquals(result.label, 'Hoy:');
});

// ---------------------------------------------------------------------------
// resolvePeriod — week (Mon 2026-06-15 … Wed 2026-06-17)
// ---------------------------------------------------------------------------

Deno.test('resolvePeriod week: from = Monday 2026-06-15, to = end of 2026-06-17', () => {
  // NOW is Wednesday → Monday is 2026-06-15
  const result = resolvePeriod('week', NOW);
  assertEquals(result.from, '2026-06-15T00:00:00.000Z');
  assertEquals(result.to, '2026-06-17T23:59:59.999Z');
  assertEquals(result.label, 'Esta semana:');
});

Deno.test('resolvePeriod week: when now is Monday, from = today', () => {
  const monday = new Date('2026-06-15T09:00:00.000Z'); // also Monday
  const result = resolvePeriod('week', monday);
  assertEquals(result.from, '2026-06-15T00:00:00.000Z');
  assertEquals(result.to, '2026-06-15T23:59:59.999Z');
});

Deno.test('resolvePeriod week: when now is Sunday, from = 6 days prior (Mon)', () => {
  // Sunday 2026-06-21
  const sunday = new Date('2026-06-21T20:00:00.000Z');
  const result = resolvePeriod('week', sunday);
  assertEquals(result.from, '2026-06-15T00:00:00.000Z'); // Monday 2026-06-15
  assertEquals(result.to, '2026-06-21T23:59:59.999Z');
});

// ---------------------------------------------------------------------------
// resolvePeriod — month (June 2026)
// ---------------------------------------------------------------------------

Deno.test('resolvePeriod month: from = 2026-06-01, to = 2026-06-30', () => {
  const result = resolvePeriod('month', NOW);
  assertEquals(result.from, '2026-06-01T00:00:00.000Z');
  assertEquals(result.to, '2026-06-30T23:59:59.999Z');
  assertEquals(result.label, 'Este mes:');
});

Deno.test('resolvePeriod month: February leap year ends on 29th', () => {
  const feb2028 = new Date('2028-02-14T12:00:00.000Z'); // 2028 is a leap year
  const result = resolvePeriod('month', feb2028);
  assertEquals(result.from, '2028-02-01T00:00:00.000Z');
  assertEquals(result.to, '2028-02-29T23:59:59.999Z');
});

Deno.test('resolvePeriod month: February non-leap year ends on 28th', () => {
  const feb2026 = new Date('2026-02-14T12:00:00.000Z'); // 2026 is NOT a leap year
  const result = resolvePeriod('month', feb2026);
  assertEquals(result.from, '2026-02-01T00:00:00.000Z');
  assertEquals(result.to, '2026-02-28T23:59:59.999Z');
});

// ---------------------------------------------------------------------------
// resolvePeriod — prev_month (May 2026)
// ---------------------------------------------------------------------------

Deno.test('resolvePeriod prev_month: from = 2026-05-01, to = 2026-05-31', () => {
  const result = resolvePeriod('prev_month', NOW);
  assertEquals(result.from, '2026-05-01T00:00:00.000Z');
  assertEquals(result.to, '2026-05-31T23:59:59.999Z');
  assertEquals(result.label, 'Mes pasado:');
});

Deno.test('resolvePeriod prev_month: January wraps to December of previous year', () => {
  const jan2026 = new Date('2026-01-15T12:00:00.000Z');
  const result = resolvePeriod('prev_month', jan2026);
  assertEquals(result.from, '2025-12-01T00:00:00.000Z');
  assertEquals(result.to, '2025-12-31T23:59:59.999Z');
});

// ---------------------------------------------------------------------------
// resolvePeriod — year
// ---------------------------------------------------------------------------

Deno.test('resolvePeriod year: from = 2026-01-01, to = 2026-12-31', () => {
  const result = resolvePeriod('year', NOW);
  assertEquals(result.from, '2026-01-01T00:00:00.000Z');
  assertEquals(result.to, '2026-12-31T23:59:59.999Z');
  assertEquals(result.label, 'Este año:');
});

// ---------------------------------------------------------------------------
// resolvePeriod — custom {from, to}
// ---------------------------------------------------------------------------

Deno.test('resolvePeriod custom: passthrough with start/end of day', () => {
  const result = resolvePeriod({ from: '2026-03-01', to: '2026-03-31' }, NOW);
  assertEquals(result.from, '2026-03-01T00:00:00.000Z');
  assertEquals(result.to, '2026-03-31T23:59:59.999Z');
});

Deno.test('resolvePeriod custom: single day range', () => {
  const result = resolvePeriod({ from: '2026-06-10', to: '2026-06-10' }, NOW);
  assertEquals(result.from, '2026-06-10T00:00:00.000Z');
  assertEquals(result.to, '2026-06-10T23:59:59.999Z');
});

// ---------------------------------------------------------------------------
// resolvePeriod — undefined defaults to month
// ---------------------------------------------------------------------------

Deno.test('resolvePeriod undefined: defaults to current month', () => {
  const result = resolvePeriod(undefined, NOW);
  // Same as 'month' with NOW
  assertEquals(result.from, '2026-06-01T00:00:00.000Z');
  assertEquals(result.to, '2026-06-30T23:59:59.999Z');
  assertEquals(result.label, 'Este mes:');
});

// ---------------------------------------------------------------------------
// formatAmount
// ---------------------------------------------------------------------------

Deno.test('formatAmount ARS integer: no decimal noise', () => {
  assertEquals(formatAmount(12345, 'ARS'), '$ 12.345,00');
});

Deno.test('formatAmount ARS with decimals', () => {
  assertEquals(formatAmount(12345.67, 'ARS'), '$ 12.345,67');
});

Deno.test('formatAmount ARS small amount (< 1000, no thousands sep)', () => {
  assertEquals(formatAmount(999.5, 'ARS'), '$ 999,50');
});

Deno.test('formatAmount ARS zero', () => {
  assertEquals(formatAmount(0, 'ARS'), '$ 0,00');
});

Deno.test('formatAmount ARS million', () => {
  assertEquals(formatAmount(1000000, 'ARS'), '$ 1.000.000,00');
});

Deno.test('formatAmount USD with decimals', () => {
  assertEquals(formatAmount(1234.56, 'USD'), 'USD 1.234,56');
});

Deno.test('formatAmount USD small amount', () => {
  assertEquals(formatAmount(50, 'USD'), 'USD 50,00');
});

Deno.test('formatAmount USD large amount', () => {
  assertEquals(formatAmount(1000000.99, 'USD'), 'USD 1.000.000,99');
});

// ---------------------------------------------------------------------------
// resolvePeriod — label spot checks for custom ranges
// ---------------------------------------------------------------------------

Deno.test('resolvePeriod custom label format: del MM/DD al MM/DD', () => {
  const result = resolvePeriod({ from: '2026-01-15', to: '2026-02-28' }, NOW);
  assertEquals(result.label, 'Del 01/15 al 02/28:');
});

// ---------------------------------------------------------------------------
// formatMovementLine
// ---------------------------------------------------------------------------

Deno.test('formatMovementLine: expense with description and category', () => {
  const row: MovementRow = {
    direction: 'expense',
    amount: 4500,
    currency: 'ARS',
    description: 'Almuerzo',
    category_name: 'Restaurante',
    occurred_at: '2026-06-17T14:00:00.000Z',
  };
  const line = formatMovementLine(row);
  assertEquals(line, '• 17/06 — gasto $ 4.500,00 — Almuerzo · Restaurante');
});

Deno.test('formatMovementLine: income without description or category', () => {
  const row: MovementRow = {
    direction: 'income',
    amount: 200000,
    currency: 'ARS',
    description: null,
    category_name: null,
    occurred_at: '2026-06-01T00:00:00.000Z',
  };
  const line = formatMovementLine(row);
  assertEquals(line, '• 01/06 — ingreso $ 200.000,00');
});

Deno.test('formatMovementLine: expense with description, no category', () => {
  const row: MovementRow = {
    direction: 'expense',
    amount: 50,
    currency: 'USD',
    description: 'Netflix',
    category_name: null,
    occurred_at: '2026-05-31T12:00:00.000Z',
  };
  const line = formatMovementLine(row);
  assertEquals(line, '• 31/05 — gasto USD 50,00 — Netflix');
});

Deno.test('formatMovementLine: expense with category, no description', () => {
  const row: MovementRow = {
    direction: 'expense',
    amount: 1000,
    currency: 'ARS',
    description: null,
    category_name: 'Supermercado',
    occurred_at: '2026-06-10T10:30:00.000Z',
  };
  const line = formatMovementLine(row);
  assertEquals(line, '• 10/06 — gasto $ 1.000,00 · Supermercado');
});

Deno.test('formatMovementLine: date-only occurred_at (no T part)', () => {
  const row: MovementRow = {
    direction: 'income',
    amount: 300000,
    currency: 'ARS',
    description: 'Sueldo',
    category_name: null,
    occurred_at: '2026-06-05',
  };
  const line = formatMovementLine(row);
  assertStringIncludes(line, '05/06');
  assertStringIncludes(line, 'ingreso');
  assertStringIncludes(line, '300.000,00');
  assertStringIncludes(line, 'Sueldo');
});

Deno.test('formatMovementLine: USD income', () => {
  const row: MovementRow = {
    direction: 'income',
    amount: 1500,
    currency: 'USD',
    description: 'Factura freelance',
    category_name: 'Trabajo',
    occurred_at: '2026-06-20T09:00:00.000Z',
  };
  const line = formatMovementLine(row);
  assertEquals(line, '• 20/06 — ingreso USD 1.500,00 — Factura freelance · Trabajo');
});

// ---------------------------------------------------------------------------
// buildTotalsReply
// ---------------------------------------------------------------------------

/** Minimal FinancialContext factory — only byCurrency and periodLabel are needed. */
function makeTotalsCtx(
  byCurrency: FinancialContext['byCurrency'],
  periodLabel = 'Este mes',
): FinancialContext {
  return {
    periodLabel,
    prevPeriodLabel: 'Mes pasado',
    primaryCurrency: 'ARS',
    byCurrency,
    topExpenseCategories: [],
    topIncomeCategories: [],
    recentMovements: [],
    prevExpensesByCurrency: [],
  };
}

Deno.test('buildTotalsReply: empty byCurrency → "No tenés movimientos en ese período."', () => {
  const ctx = makeTotalsCtx([]);
  assertEquals(buildTotalsReply(ctx), 'No tenés movimientos en ese período.');
});

Deno.test('buildTotalsReply: single ARS row → contains header, expenses, incomes, net', () => {
  const ctx = makeTotalsCtx([
    {
      currency: 'ARS',
      expenses: 45000,
      incomes: 250000,
      net: 205000,
      expenseCount: 12,
      incomeCount: 1,
    },
  ]);
  const reply = buildTotalsReply(ctx);
  assertStringIncludes(reply, '*Balance — Este mes*');
  assertStringIncludes(reply, 'gastos $ 45.000,00');
  assertStringIncludes(reply, 'ingresos $ 250.000,00');
  assertStringIncludes(reply, 'neto +$ 205.000,00');
});

Deno.test('buildTotalsReply: periodLabel appears verbatim in header', () => {
  const ctx = makeTotalsCtx(
    [
      {
        currency: 'ARS',
        expenses: 1000,
        incomes: 2000,
        net: 1000,
        expenseCount: 1,
        incomeCount: 1,
      },
    ],
    'Hoy',
  );
  assertStringIncludes(buildTotalsReply(ctx), '*Balance — Hoy*');
});

// ---------------------------------------------------------------------------
// buildCategoryReply
// ---------------------------------------------------------------------------

/** Helper to build a CategoryRow-like plain object for buildCategoryReply. */
function makeCatRow(
  name: string,
  total: number,
  index = 0,
): {
  category_id: string;
  category_name: string;
  color: string;
  icon: string;
  total: number;
  count: number;
} {
  return {
    category_id: `id-${index}`,
    category_name: name,
    color: '#0077B6',
    icon: 'shopping-cart',
    total,
    count: 1,
  };
}

Deno.test('buildCategoryReply: empty rows → "No tenés movimientos en ese período."', () => {
  assertEquals(
    buildCategoryReply([], 'ARS', 'Este mes:', 'gasto'),
    'No tenés movimientos en ese período.',
  );
});

Deno.test('buildCategoryReply: >5 rows → contains "• Otros:" and correct grand total', () => {
  const rows = [
    makeCatRow('Cat1', 100, 0),
    makeCatRow('Cat2', 90, 1),
    makeCatRow('Cat3', 80, 2),
    makeCatRow('Cat4', 70, 3),
    makeCatRow('Cat5', 60, 4),
    makeCatRow('Cat6', 50, 5),
  ];
  const reply = buildCategoryReply(rows, 'ARS', 'Este mes:', 'gasto');
  // Header
  assertStringIncludes(reply, '*Gastos por categoría (ARS) — Este mes:*');
  // "Otros" line for the 6th row
  assertStringIncludes(reply, '• Otros:');
  // Grand total = 100+90+80+70+60+50 = 450
  assertStringIncludes(reply, '*Total: $ 450,00*');
});

Deno.test('buildCategoryReply: kind "ingreso" → header contains "Ingresos por categoría"', () => {
  const rows = [makeCatRow('Sueldo', 250000, 0)];
  const reply = buildCategoryReply(rows, 'ARS', 'Este mes:', 'ingreso');
  assertStringIncludes(reply, '*Ingresos por categoría');
});

Deno.test('buildCategoryReply: exactly 5 rows → no "Otros" line', () => {
  const rows = [
    makeCatRow('A', 100, 0),
    makeCatRow('B', 90, 1),
    makeCatRow('C', 80, 2),
    makeCatRow('D', 70, 3),
    makeCatRow('E', 60, 4),
  ];
  const reply = buildCategoryReply(rows, 'ARS', 'Este mes:', 'gasto');
  assertEquals(reply.includes('Otros'), false);
  assertStringIncludes(reply, '*Total: $ 400,00*');
});

Deno.test('buildCategoryReply: USD currency → amounts use "USD" prefix', () => {
  const rows = [makeCatRow('Servicios', 50, 0)];
  const reply = buildCategoryReply(rows, 'USD', 'Este mes:', 'gasto');
  assertStringIncludes(reply, 'USD 50,00');
});
