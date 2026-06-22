/**
 * finance_context.test.ts
 * Unit tests for pure, side-effect-free exports from finance_context.ts.
 *
 * Run with:
 *   deno test supabase/functions/whatsapp-webhook/finance_context.test.ts
 *
 * These tests have NO side effects — no network, no Supabase, no Groq calls.
 * They verify:
 *   1. formatPercent       — sign, rounding, Argentine comma decimal
 *   2. formatSignedAmount  — sign prefix + formatAmount delegation
 *   3. computeMoMPercent   — percentage calculation, division-by-zero guard
 *   4. buildFinancialContextBlock — full context block output format
 */

import { assertEquals, assertStringIncludes } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  buildFinancialContextBlock,
  computeMoMPercent,
  formatPercent,
  formatSignedAmount,
} from './finance_context.ts';
import type { FinancialContext } from './finance_context.ts';
import type { MovementRow } from './queries.ts';

// ---------------------------------------------------------------------------
// formatPercent
// ---------------------------------------------------------------------------

Deno.test('formatPercent: negative value rounds to one decimal with minus sign', () => {
  // -13.46 → rounds to -13.5 → "-13,5%"
  assertEquals(formatPercent(-13.46), '-13,5%');
});

Deno.test('formatPercent: positive value rounds to one decimal with plus sign', () => {
  // 8.2 → "+8,2%"
  assertEquals(formatPercent(8.2), '+8,2%');
});

Deno.test('formatPercent: zero returns "+0,0%"', () => {
  assertEquals(formatPercent(0), '+0,0%');
});

Deno.test('formatPercent: positive value rounding up (13.46 → "+13,5%")', () => {
  // 13.46 rounds to 13.5
  assertEquals(formatPercent(13.46), '+13,5%');
});

// ---------------------------------------------------------------------------
// formatSignedAmount
// ---------------------------------------------------------------------------

Deno.test('formatSignedAmount: positive ARS starts with "+$ "', () => {
  const result = formatSignedAmount(205000, 'ARS');
  assertEquals(result.startsWith('+$ '), true);
  assertStringIncludes(result, '205.000,00');
});

Deno.test('formatSignedAmount: negative ARS starts with "-$ "', () => {
  const result = formatSignedAmount(-45000, 'ARS');
  assertEquals(result.startsWith('-$ '), true);
  assertStringIncludes(result, '45.000,00');
});

Deno.test('formatSignedAmount: negative USD is "-USD 100,00"', () => {
  assertEquals(formatSignedAmount(-100, 'USD'), '-USD 100,00');
});

Deno.test('formatSignedAmount: zero ARS is "+$ 0,00"', () => {
  assertEquals(formatSignedAmount(0, 'ARS'), '+$ 0,00');
});

// ---------------------------------------------------------------------------
// computeMoMPercent
// ---------------------------------------------------------------------------

Deno.test('computeMoMPercent: 45000 vs 52000 → negative value close to -13.46', () => {
  const result = computeMoMPercent(45000, 52000);
  // (45000 - 52000) / 52000 * 100 = -13.461...
  assertEquals(result !== null, true);
  assertEquals(result! < 0, true);
  // Should be between -14 and -13
  assertEquals(result! > -14, true);
  assertEquals(result! < -13, true);
});

Deno.test('computeMoMPercent: prev = 0 returns null (avoids division-by-zero)', () => {
  assertEquals(computeMoMPercent(45000, 0), null);
  assertEquals(computeMoMPercent(0, 0), null);
});

Deno.test('computeMoMPercent: current 110 vs prev 100 → 10 (exact)', () => {
  assertEquals(computeMoMPercent(110, 100), 10);
});

// ---------------------------------------------------------------------------
// buildFinancialContextBlock — fixtures
// ---------------------------------------------------------------------------

/** Full context with two currencies and all optional sections populated. */
const FULL_CTX: FinancialContext = {
  periodLabel: 'Este mes',
  prevPeriodLabel: 'Mes pasado',
  primaryCurrency: 'ARS',
  byCurrency: [
    {
      currency: 'ARS',
      expenses: 45000,
      incomes: 250000,
      net: 205000, // 250000 - 45000
      expenseCount: 12,
      incomeCount: 1,
    },
    {
      currency: 'USD',
      expenses: 100,
      incomes: 0,
      net: -100, // 0 - 100
      expenseCount: 2,
      incomeCount: 0,
    },
  ],
  topExpenseCategories: [
    { name: 'Supermercado', total: 18000 },
    { name: 'Transporte', total: 9000 },
  ],
  topIncomeCategories: [],
  recentMovements: [],
  prevExpensesByCurrency: [{ currency: 'ARS', total: 52000 }],
};

/** Completely empty context — no byCurrency, no categories, no movements, no prev. */
const EMPTY_CTX: FinancialContext = {
  periodLabel: 'Este mes',
  prevPeriodLabel: 'Mes pasado',
  primaryCurrency: 'ARS',
  byCurrency: [],
  topExpenseCategories: [],
  topIncomeCategories: [],
  recentMovements: [],
  prevExpensesByCurrency: [],
};

// ---------------------------------------------------------------------------
// buildFinancialContextBlock — full context assertions
// ---------------------------------------------------------------------------

Deno.test('buildFinancialContextBlock: contains period labels', () => {
  const block = buildFinancialContextBlock(FULL_CTX);
  assertStringIncludes(block, 'Período: Este mes');
  assertStringIncludes(block, 'Período anterior: Mes pasado');
});

Deno.test('buildFinancialContextBlock: contains ARS balance figures', () => {
  const block = buildFinancialContextBlock(FULL_CTX);
  // expenses 45000
  assertStringIncludes(block, '$ 45.000,00');
  // incomes 250000
  assertStringIncludes(block, '$ 250.000,00');
  // net +205000
  assertStringIncludes(block, '+$ 205.000,00');
});

Deno.test('buildFinancialContextBlock: contains USD net "-USD 100,00"', () => {
  const block = buildFinancialContextBlock(FULL_CTX);
  assertStringIncludes(block, '-USD 100,00');
});

Deno.test('buildFinancialContextBlock: contains top expense category header', () => {
  const block = buildFinancialContextBlock(FULL_CTX);
  assertStringIncludes(block, 'Top categorías de gasto (ARS)');
});

Deno.test('buildFinancialContextBlock: contains Supermercado expense category with amount', () => {
  const block = buildFinancialContextBlock(FULL_CTX);
  assertStringIncludes(block, 'Supermercado $ 18.000,00');
});

Deno.test('buildFinancialContextBlock: contains MoM line with -13,5% (45000 vs 52000)', () => {
  const block = buildFinancialContextBlock(FULL_CTX);
  // MoM line must mention the percentage and previous total
  assertStringIncludes(block, '-13,5%');
  assertStringIncludes(block, 'anterior $ 52.000,00');
});

Deno.test('buildFinancialContextBlock: empty movements → "Últimos movimientos: sin datos"', () => {
  const block = buildFinancialContextBlock(FULL_CTX);
  assertStringIncludes(block, 'Últimos movimientos: sin datos');
});

// ---------------------------------------------------------------------------
// buildFinancialContextBlock — empty context
// ---------------------------------------------------------------------------

Deno.test('buildFinancialContextBlock (empty ctx): balance section shows "- sin datos"', () => {
  const block = buildFinancialContextBlock(EMPTY_CTX);
  assertStringIncludes(block, '- sin datos');
});

Deno.test('buildFinancialContextBlock (empty ctx): movements section shows "sin datos"', () => {
  const block = buildFinancialContextBlock(EMPTY_CTX);
  assertStringIncludes(block, 'Últimos movimientos: sin datos');
});

Deno.test('buildFinancialContextBlock (empty ctx): no "Top categorías" section', () => {
  const block = buildFinancialContextBlock(EMPTY_CTX);
  assertEquals(block.includes('Top categorías'), false);
});

Deno.test(
  'buildFinancialContextBlock (empty ctx): no "Comparación" section (prev = 0 → MoM null)',
  () => {
    const block = buildFinancialContextBlock(EMPTY_CTX);
    assertEquals(block.includes('Comparación'), false);
  },
);

// ---------------------------------------------------------------------------
// buildFinancialContextBlock — income categories present
// ---------------------------------------------------------------------------

Deno.test('buildFinancialContextBlock: income categories appear in block', () => {
  const ctx: FinancialContext = {
    ...FULL_CTX,
    topIncomeCategories: [{ name: 'Sueldo', total: 250000 }],
  };
  const block = buildFinancialContextBlock(ctx);
  assertStringIncludes(block, 'Top categorías de ingreso (ARS): Sueldo $ 250.000,00');
});

// ---------------------------------------------------------------------------
// buildFinancialContextBlock — movements present
// ---------------------------------------------------------------------------

Deno.test('buildFinancialContextBlock: with movements each line starts with "• "', () => {
  const movement: MovementRow = {
    direction: 'expense',
    amount: 4500,
    currency: 'ARS',
    description: 'Almuerzo',
    category_name: 'Restaurante',
    occurred_at: '2026-06-17T14:00:00.000Z',
  };
  const ctx: FinancialContext = {
    ...FULL_CTX,
    recentMovements: [movement],
  };
  const block = buildFinancialContextBlock(ctx);
  // Movement lines are formatted by formatMovementLine which starts with "• "
  assertStringIncludes(block, '• ');
  // Should not say "sin datos" for movements
  assertEquals(block.includes('Últimos movimientos: sin datos'), false);
});

// ---------------------------------------------------------------------------
// buildFinancialContextBlock — 5-category cap (builder renders all provided)
// ---------------------------------------------------------------------------

Deno.test('buildFinancialContextBlock: renders all 5 provided top-expense categories', () => {
  const ctx: FinancialContext = {
    ...FULL_CTX,
    topExpenseCategories: [
      { name: 'Cat1', total: 100 },
      { name: 'Cat2', total: 90 },
      { name: 'Cat3', total: 80 },
      { name: 'Cat4', total: 70 },
      { name: 'Cat5', total: 60 },
    ],
  };
  const block = buildFinancialContextBlock(ctx);
  assertStringIncludes(block, 'Cat1');
  assertStringIncludes(block, 'Cat2');
  assertStringIncludes(block, 'Cat3');
  assertStringIncludes(block, 'Cat4');
  assertStringIncludes(block, 'Cat5');
});
