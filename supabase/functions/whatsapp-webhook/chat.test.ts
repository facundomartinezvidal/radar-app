/**
 * chat.test.ts
 * Unit tests for pure, side-effect-free exports from chat.ts.
 *
 * Run with:
 *   deno test supabase/functions/whatsapp-webhook/chat.test.ts
 *
 * These tests have NO side effects — no network, no Supabase, no Groq calls.
 * They verify `buildChatContextBlock`, the only pure exported helper in chat.ts.
 *
 * `handleChat` itself is IO-bound (RPC + Groq) and is not testable here;
 * it is covered by integration tests (not in this file).
 */

import { assertEquals, assertStringIncludes } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { buildChatContextBlock } from './chat.ts';
import type { ChatContextData } from './chat.ts';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const FULL_DATA: ChatContextData = {
  periodLabel: 'Este mes:',
  totals: [
    { currency: 'ARS', total: 45000, count: 12 },
    { currency: 'USD', total: 100, count: 2 },
  ],
  topCategories: [
    { category_name: 'Supermercado', total: 18000, count: 5 },
    { category_name: 'Transporte', total: 9000, count: 4 },
    { category_name: 'Restaurante', total: 7500, count: 3 },
  ],
  recentMovements: [
    {
      direction: 'expense',
      amount: 3500,
      currency: 'ARS',
      description: 'Almuerzo',
      category_name: 'Restaurante',
      occurred_at: '2026-06-17T12:00:00.000Z',
    },
    {
      direction: 'income',
      amount: 250000,
      currency: 'ARS',
      description: 'Sueldo',
      category_name: null,
      occurred_at: '2026-06-01T00:00:00.000Z',
    },
  ],
};

const EMPTY_DATA: ChatContextData = {
  periodLabel: 'Este mes:',
  totals: [],
  topCategories: [],
  recentMovements: [],
};

// ---------------------------------------------------------------------------
// buildChatContextBlock — basic structure
// ---------------------------------------------------------------------------

Deno.test('buildChatContextBlock: includes period label (without colon)', () => {
  const block = buildChatContextBlock(FULL_DATA);
  assertStringIncludes(block, 'Período: Este mes');
});

Deno.test('buildChatContextBlock: includes totals for each currency', () => {
  const block = buildChatContextBlock(FULL_DATA);
  assertStringIncludes(block, 'ARS');
  assertStringIncludes(block, 'USD');
  assertStringIncludes(block, '45000.00');
  assertStringIncludes(block, '100.00');
});

Deno.test('buildChatContextBlock: includes top-category names', () => {
  const block = buildChatContextBlock(FULL_DATA);
  assertStringIncludes(block, 'Supermercado');
  assertStringIncludes(block, 'Transporte');
  assertStringIncludes(block, 'Restaurante');
});

Deno.test('buildChatContextBlock: includes recent movement descriptions', () => {
  const block = buildChatContextBlock(FULL_DATA);
  assertStringIncludes(block, 'Almuerzo');
  assertStringIncludes(block, 'Sueldo');
});

Deno.test('buildChatContextBlock: marks direction labels correctly', () => {
  const block = buildChatContextBlock(FULL_DATA);
  assertStringIncludes(block, 'gasto');
  assertStringIncludes(block, 'ingreso');
});

// ---------------------------------------------------------------------------
// buildChatContextBlock — empty / no-data cases
// ---------------------------------------------------------------------------

Deno.test('buildChatContextBlock: no totals → shows "sin datos" for totals', () => {
  const block = buildChatContextBlock(EMPTY_DATA);
  assertStringIncludes(block, 'sin datos');
});

Deno.test('buildChatContextBlock: no movements → shows "sin datos" for movements', () => {
  const block = buildChatContextBlock(EMPTY_DATA);
  // "sin datos" should appear at least twice (totals + movements)
  const matches = block.match(/sin datos/g) ?? [];
  assertEquals(matches.length >= 2, true);
});

Deno.test('buildChatContextBlock: no categories → section skipped', () => {
  const block = buildChatContextBlock(EMPTY_DATA);
  // With no categories the "Top categorías" line is not added
  assertEquals(block.includes('Top categorías'), false);
});

// ---------------------------------------------------------------------------
// buildChatContextBlock — max 5 categories cap
// ---------------------------------------------------------------------------

Deno.test('buildChatContextBlock: more than 5 categories → only first 5 included', () => {
  const manyCategories: ChatContextData = {
    ...FULL_DATA,
    topCategories: [
      { category_name: 'Cat1', total: 100, count: 1 },
      { category_name: 'Cat2', total: 90, count: 1 },
      { category_name: 'Cat3', total: 80, count: 1 },
      { category_name: 'Cat4', total: 70, count: 1 },
      { category_name: 'Cat5', total: 60, count: 1 },
      { category_name: 'Cat6', total: 50, count: 1 },
    ],
  };
  const block = buildChatContextBlock(manyCategories);
  assertStringIncludes(block, 'Cat1');
  assertStringIncludes(block, 'Cat5');
  // Cat6 must not appear
  assertEquals(block.includes('Cat6'), false);
});

// ---------------------------------------------------------------------------
// buildChatContextBlock — period label stripping
// ---------------------------------------------------------------------------

Deno.test('buildChatContextBlock: trailing colon is stripped from period label', () => {
  const block = buildChatContextBlock({ ...FULL_DATA, periodLabel: 'Este mes:' });
  assertStringIncludes(block, 'Período: Este mes');
  // Should not contain "Este mes:" with the colon still attached
  assertEquals(block.includes('Período: Este mes:'), false);
});

Deno.test('buildChatContextBlock: label without colon is kept as-is', () => {
  const block = buildChatContextBlock({ ...FULL_DATA, periodLabel: 'Hoy' });
  assertStringIncludes(block, 'Período: Hoy');
});

// ---------------------------------------------------------------------------
// buildChatContextBlock — movement date formatting
// ---------------------------------------------------------------------------

Deno.test('buildChatContextBlock: dates formatted as dd/mm', () => {
  const block = buildChatContextBlock(FULL_DATA);
  // 2026-06-17 → "17/06", 2026-06-01 → "01/06"
  assertStringIncludes(block, '17/06');
  assertStringIncludes(block, '01/06');
});

// ---------------------------------------------------------------------------
// buildChatContextBlock — return type is a non-empty string
// ---------------------------------------------------------------------------

Deno.test('buildChatContextBlock: always returns a non-empty string', () => {
  const block = buildChatContextBlock(EMPTY_DATA);
  assertEquals(typeof block, 'string');
  assertEquals(block.length > 0, true);
});
