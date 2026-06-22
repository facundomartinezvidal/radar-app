/**
 * capture.test.ts
 * Unit tests for pure helpers exported from capture.ts.
 *
 * Run with:
 *   deno test supabase/functions/whatsapp-webhook/capture.test.ts
 *
 * These tests have NO side effects — no network, no Supabase, no Groq calls.
 * They verify:
 *   1. entitiesToRow — currency default ARS, USD explicit, amount passthrough,
 *      description fallback chain (description → merchant → fallbackText).
 *   2. documentTxToRow — direction, currency default, category resolution,
 *      null returned for zero/negative amounts.
 *   3. resolveCategoryId — exact match, contains match, no match.
 *   4. isMissingAmount — predicate for absent amount.
 *   5. isNonPositive — predicate for zero/negative amount.
 */

import { assertEquals, assertStrictEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  documentTxToRow,
  entitiesToRow,
  isMissingAmount,
  isNonPositive,
  resolveCategoryId,
  type CategoryEntry,
} from './capture.ts';
import type { ClassificationEntities } from './classify.ts';

// ---------------------------------------------------------------------------
// isMissingAmount
// ---------------------------------------------------------------------------

Deno.test('isMissingAmount: returns true when amount is undefined', () => {
  assertEquals(isMissingAmount(undefined), true);
});

Deno.test('isMissingAmount: returns false when amount is a positive number', () => {
  assertEquals(isMissingAmount(4500), false);
});

Deno.test('isMissingAmount: returns false when amount is 0 (present, just non-positive)', () => {
  // 0 is "present" but handled by isNonPositive — isMissingAmount only checks absence
  assertEquals(isMissingAmount(0), false);
});

// ---------------------------------------------------------------------------
// isNonPositive
// ---------------------------------------------------------------------------

Deno.test('isNonPositive: returns true for zero', () => {
  assertEquals(isNonPositive(0), true);
});

Deno.test('isNonPositive: returns true for negative number', () => {
  assertEquals(isNonPositive(-100), true);
});

Deno.test('isNonPositive: returns false for positive number', () => {
  assertEquals(isNonPositive(4500), false);
});

Deno.test('isNonPositive: returns false for very small positive number', () => {
  assertEquals(isNonPositive(0.01), false);
});

// ---------------------------------------------------------------------------
// entitiesToRow — currency default ARS
// ---------------------------------------------------------------------------

Deno.test('entitiesToRow: defaults currency to ARS when not present in entities', () => {
  const entities: ClassificationEntities = { amount: 4500 };
  const row = entitiesToRow(entities, 'expense', 'gasté 4500 en el súper');
  assertEquals(row.currency, 'ARS');
});

Deno.test('entitiesToRow: uses USD when explicitly stated in entities', () => {
  const entities: ClassificationEntities = { amount: 50, currency: 'USD' };
  const row = entitiesToRow(entities, 'expense', 'gasté 50 dólares');
  assertEquals(row.currency, 'USD');
});

// ---------------------------------------------------------------------------
// entitiesToRow — amount passthrough
// ---------------------------------------------------------------------------

Deno.test('entitiesToRow: passes through the amount unchanged', () => {
  const entities: ClassificationEntities = { amount: 12345.67 };
  const row = entitiesToRow(entities, 'expense', 'fallback');
  assertEquals(row.amount, 12345.67);
});

// ---------------------------------------------------------------------------
// entitiesToRow — direction
// ---------------------------------------------------------------------------

Deno.test('entitiesToRow: uses intentDirection=expense when entities.direction absent', () => {
  const entities: ClassificationEntities = { amount: 1000 };
  const row = entitiesToRow(entities, 'expense', '');
  assertEquals(row.direction, 'expense');
});

Deno.test('entitiesToRow: uses intentDirection=income when entities.direction absent', () => {
  const entities: ClassificationEntities = { amount: 200000 };
  const row = entitiesToRow(entities, 'income', '');
  assertEquals(row.direction, 'income');
});

Deno.test('entitiesToRow: entities.direction overrides intentDirection', () => {
  // Even if intent is capture_expense, a clear direction in entities wins
  const entities: ClassificationEntities = { amount: 500, direction: 'income' };
  const row = entitiesToRow(entities, 'expense', '');
  assertEquals(row.direction, 'income');
});

// ---------------------------------------------------------------------------
// entitiesToRow — description fallback chain
// ---------------------------------------------------------------------------

Deno.test('entitiesToRow: uses entities.description when present', () => {
  const entities: ClassificationEntities = {
    amount: 100,
    description: 'Compra en Carrefour',
    merchant: 'Carrefour',
  };
  const row = entitiesToRow(entities, 'expense', 'fallback text');
  assertEquals(row.description, 'Compra en Carrefour');
});

Deno.test('entitiesToRow: falls back to entities.merchant when description absent', () => {
  const entities: ClassificationEntities = { amount: 100, merchant: 'Rappi' };
  const row = entitiesToRow(entities, 'expense', 'fallback text');
  assertEquals(row.description, 'Rappi');
});

Deno.test('entitiesToRow: falls back to fallbackText when description and merchant absent', () => {
  const entities: ClassificationEntities = { amount: 100 };
  const row = entitiesToRow(entities, 'expense', 'gasté cien pesos');
  assertEquals(row.description, 'gasté cien pesos');
});

Deno.test('entitiesToRow: description is null when entities and fallbackText are all empty', () => {
  const entities: ClassificationEntities = { amount: 100 };
  const row = entitiesToRow(entities, 'expense', '');
  assertEquals(row.description, null);
});

// ---------------------------------------------------------------------------
// entitiesToRow — occurred_at
// ---------------------------------------------------------------------------

Deno.test('entitiesToRow: passes through occurredAt as occurred_at', () => {
  const entities: ClassificationEntities = { amount: 100, occurredAt: '2026-06-21' };
  const row = entitiesToRow(entities, 'expense', '');
  assertEquals(row.occurred_at, '2026-06-21');
});

Deno.test('entitiesToRow: occurred_at is null when occurredAt absent', () => {
  const entities: ClassificationEntities = { amount: 100 };
  const row = entitiesToRow(entities, 'expense', '');
  assertEquals(row.occurred_at, null);
});

// ---------------------------------------------------------------------------
// resolveCategoryId
// ---------------------------------------------------------------------------

const SAMPLE_CATEGORIES: CategoryEntry[] = [
  { id: 'cat-food', name: 'Comida' },
  { id: 'cat-super', name: 'Supermercado' },
  { id: 'cat-transport', name: 'Transporte' },
  { id: 'cat-health', name: 'Salud' },
];

Deno.test('resolveCategoryId: exact match (case-insensitive)', () => {
  assertEquals(resolveCategoryId('comida', SAMPLE_CATEGORIES), 'cat-food');
});

Deno.test('resolveCategoryId: exact match uppercase', () => {
  assertEquals(resolveCategoryId('COMIDA', SAMPLE_CATEGORIES), 'cat-food');
});

Deno.test('resolveCategoryId: contains match when hint is substring of category name', () => {
  // "super" is contained in "Supermercado"
  assertEquals(resolveCategoryId('super', SAMPLE_CATEGORIES), 'cat-super');
});

Deno.test('resolveCategoryId: contains match when category name is substring of hint', () => {
  // "Salud mental" contains "Salud"
  assertEquals(resolveCategoryId('Salud mental', SAMPLE_CATEGORIES), 'cat-health');
});

Deno.test('resolveCategoryId: returns null when no match', () => {
  assertEquals(resolveCategoryId('Viajes', SAMPLE_CATEGORIES), null);
});

Deno.test('resolveCategoryId: returns null for empty categories', () => {
  assertEquals(resolveCategoryId('Comida', []), null);
});

// ---------------------------------------------------------------------------
// documentTxToRow — direction
// ---------------------------------------------------------------------------

const BASE_TX = {
  amount: 1500,
  currency: 'ARS' as const,
  occurredAt: '2026-06-21',
  merchant: 'Carrefour',
  direction: 'expense' as const,
  categoryHint: null,
  suggestedNewCategory: null,
  suggestedNewCategoryReason: null,
  items: [],
};

Deno.test('documentTxToRow: maps direction=expense', () => {
  const row = documentTxToRow(BASE_TX, []);
  assertEquals(row?.direction, 'expense');
});

Deno.test('documentTxToRow: maps direction=income', () => {
  const tx = { ...BASE_TX, direction: 'income' as const };
  const row = documentTxToRow(tx, []);
  assertEquals(row?.direction, 'income');
});

// ---------------------------------------------------------------------------
// documentTxToRow — currency default
// ---------------------------------------------------------------------------

Deno.test('documentTxToRow: defaults currency to ARS when null', () => {
  const tx = { ...BASE_TX, currency: null };
  const row = documentTxToRow(tx, []);
  assertEquals(row?.currency, 'ARS');
});

Deno.test('documentTxToRow: passes through USD currency', () => {
  const tx = { ...BASE_TX, currency: 'USD' as const };
  const row = documentTxToRow(tx, []);
  assertEquals(row?.currency, 'USD');
});

// ---------------------------------------------------------------------------
// documentTxToRow — category resolution
// ---------------------------------------------------------------------------

Deno.test('documentTxToRow: resolves category_id from categoryHint', () => {
  const tx = { ...BASE_TX, categoryHint: 'Comida' };
  const row = documentTxToRow(tx, SAMPLE_CATEGORIES);
  assertEquals(row?.category_id, 'cat-food');
});

Deno.test('documentTxToRow: category_id is null when categoryHint is null', () => {
  const tx = { ...BASE_TX, categoryHint: null };
  const row = documentTxToRow(tx, SAMPLE_CATEGORIES);
  assertEquals(row?.category_id, null);
});

Deno.test('documentTxToRow: category_id is null when hint has no match', () => {
  const tx = { ...BASE_TX, categoryHint: 'Viajes' };
  const row = documentTxToRow(tx, SAMPLE_CATEGORIES);
  assertEquals(row?.category_id, null);
});

// ---------------------------------------------------------------------------
// documentTxToRow — zero and negative amount rejection
// ---------------------------------------------------------------------------

Deno.test('documentTxToRow: returns null when amount is null', () => {
  const tx = { ...BASE_TX, amount: null };
  assertStrictEquals(documentTxToRow(tx, []), null);
});

Deno.test('documentTxToRow: returns null when amount is zero', () => {
  const tx = { ...BASE_TX, amount: 0 };
  assertStrictEquals(documentTxToRow(tx, []), null);
});

Deno.test('documentTxToRow: returns null when amount is negative', () => {
  const tx = { ...BASE_TX, amount: -100 };
  assertStrictEquals(documentTxToRow(tx, []), null);
});

Deno.test('documentTxToRow: maps description from merchant field', () => {
  const tx = { ...BASE_TX, merchant: 'Dia%' };
  const row = documentTxToRow(tx, []);
  assertEquals(row?.description, 'Dia%');
});

Deno.test('documentTxToRow: description is null when merchant is null', () => {
  const tx = { ...BASE_TX, merchant: null };
  const row = documentTxToRow(tx, []);
  assertEquals(row?.description, null);
});

// ---------------------------------------------------------------------------
// documentTxToRow — occurred_at
// ---------------------------------------------------------------------------

Deno.test('documentTxToRow: passes through occurredAt as occurred_at', () => {
  const row = documentTxToRow(BASE_TX, []);
  assertEquals(row?.occurred_at, '2026-06-21');
});

Deno.test('documentTxToRow: occurred_at is null when occurredAt is null', () => {
  const tx = { ...BASE_TX, occurredAt: null };
  const row = documentTxToRow(tx, []);
  assertEquals(row?.occurred_at, null);
});
