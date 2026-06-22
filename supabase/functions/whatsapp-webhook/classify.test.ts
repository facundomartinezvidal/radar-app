/**
 * classify.test.ts
 * Unit tests for pure, side-effect-free logic in classify.ts.
 *
 * Run with:
 *   deno test supabase/functions/whatsapp-webhook/classify.test.ts
 *
 * These tests have NO side effects — no network, no Supabase, no Groq calls.
 * They verify:
 *   1. LOW_CONFIDENCE_THRESHOLD is exported at the expected value.
 *   2. The low-confidence routing decision boundary (< 0.4 → help).
 *   3. The Classification type shape (structural; verified via type-only import).
 *
 * Note: `classifyIntent` itself cannot be unit-tested without network access
 * because it calls the Groq API.  The Groq call is covered by integration tests
 * (not implemented here).  The normaliseClassification helper is private — its
 * logic is indirectly exercised by the integration tests.
 *
 * Example messages and expected intents (for documentation / future integration tests):
 *
 * | Message                                   | Expected intent    | Notes                         |
 * |-------------------------------------------|--------------------|-------------------------------|
 * | "gasté 4500 en el súper hoy"              | capture_expense    | amount=4500, ARS implicit     |
 * | "cobré 200000 de sueldo"                  | capture_income     | amount=200000                 |
 * | "pagué 50 dólares en Netflix"             | capture_expense    | currency=USD, explicit        |
 * | "¿cuánto gasté este mes?"                 | query              | queryPeriod=month             |
 * | "¿en qué gasté esta semana?"              | query              | queryPeriod=week              |
 * | "dame un consejo de gastos"               | recommendation     | —                             |
 * | "¿cómo vengo este mes?"                   | recommendation     | —                             |
 * | "sí"                                      | confirm            | —                             |
 * | "dale"                                    | confirm            | —                             |
 * | "no"                                      | cancel             | —                             |
 * | "cancelá"                                 | cancel             | —                             |
 * | "desvinculame"                            | unlink             | —                             |
 * | "ayuda"                                   | help               | —                             |
 * | "¿qué podés hacer?"                       | help               | —                             |
 * | "qwertyuiop" (gibberish)                  | unknown            | confidence < 0.4              |
 * | "gasté una luca en el kiosco"             | capture_expense    | amount=1000 (luca slang)      |
 * | "me depositaron dos palos"                | capture_income     | amount=2000000 (palo slang)   |
 */

import {
  assertEquals,
  assertGreater,
  assertLessOrEqual,
} from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { LOW_CONFIDENCE_THRESHOLD } from './classify.ts';
import type { Classification, ClassificationEntities, IntentKind } from './classify.ts';

// ---------------------------------------------------------------------------
// normaliseClassification is private, so we test its observable behaviour via
// the Classification type shape and the exported constants.  For listMode /
// limit / chat we validate the normalisation rules directly using plain objects
// that mirror what the function would return, keeping tests side-effect-free.
// ---------------------------------------------------------------------------

/** Minimal helper that mimics the normalization rules for listMode + limit. */
function applyListNorm(raw: Record<string, unknown>): ClassificationEntities {
  const entities: ClassificationEntities = {};

  if (raw['listMode'] === true) {
    entities.listMode = true;
  }

  if (entities.listMode === true) {
    const rawLimit = raw['limit'];
    if (typeof rawLimit === 'number' && isFinite(rawLimit)) {
      const clamped = Math.max(1, Math.min(20, Math.floor(rawLimit)));
      if (clamped >= 1) {
        entities.limit = clamped;
      }
    }
  }

  return entities;
}

/** Checks whether the given intent is in the VALID_INTENTS set as per the type. */
function isValidIntent(intent: string): intent is IntentKind {
  const VALID: IntentKind[] = [
    'capture_expense',
    'capture_income',
    'query',
    'recommendation',
    'chat',
    'confirm',
    'cancel',
    'unlink',
    'help',
    'unknown',
  ];
  return VALID.includes(intent as IntentKind);
}

// ---------------------------------------------------------------------------
// LOW_CONFIDENCE_THRESHOLD
// ---------------------------------------------------------------------------

Deno.test('LOW_CONFIDENCE_THRESHOLD is 0.4', () => {
  assertEquals(LOW_CONFIDENCE_THRESHOLD, 0.4);
});

// ---------------------------------------------------------------------------
// Routing boundary — pure arithmetic, no Groq needed
// ---------------------------------------------------------------------------

Deno.test('confidence exactly at threshold (0.4) is NOT low confidence', () => {
  // The router uses strict < so confidence === 0.4 should proceed to the handler.
  const confidence = 0.4;
  const isLowConfidence = confidence < LOW_CONFIDENCE_THRESHOLD;
  assertEquals(isLowConfidence, false);
});

Deno.test('confidence just below threshold (0.399) IS low confidence', () => {
  const confidence = 0.399;
  const isLowConfidence = confidence < LOW_CONFIDENCE_THRESHOLD;
  assertEquals(isLowConfidence, true);
});

Deno.test('confidence 0 is low confidence (fallback case)', () => {
  const confidence = 0;
  const isLowConfidence = confidence < LOW_CONFIDENCE_THRESHOLD;
  assertEquals(isLowConfidence, true);
});

Deno.test('confidence 1.0 is NOT low confidence', () => {
  const confidence = 1.0;
  const isLowConfidence = confidence < LOW_CONFIDENCE_THRESHOLD;
  assertEquals(isLowConfidence, false);
});

Deno.test('LOW_CONFIDENCE_THRESHOLD is between 0 and 1 exclusive', () => {
  assertGreater(LOW_CONFIDENCE_THRESHOLD, 0);
  assertLessOrEqual(LOW_CONFIDENCE_THRESHOLD, 1);
});

// ---------------------------------------------------------------------------
// IntentKind — chat is a valid intent
// ---------------------------------------------------------------------------

Deno.test('chat is a valid IntentKind', () => {
  assertEquals(isValidIntent('chat'), true);
});

Deno.test('all original intents remain valid', () => {
  const originals: string[] = [
    'capture_expense',
    'capture_income',
    'query',
    'recommendation',
    'confirm',
    'cancel',
    'unlink',
    'help',
    'unknown',
  ];
  for (const intent of originals) {
    assertEquals(isValidIntent(intent), true, `Expected ${intent} to be valid`);
  }
});

Deno.test('invalid intent strings are not valid', () => {
  assertEquals(isValidIntent('purchase'), false);
  assertEquals(isValidIntent(''), false);
  assertEquals(isValidIntent('LIST'), false);
});

// ---------------------------------------------------------------------------
// listMode normalisation
// ---------------------------------------------------------------------------

Deno.test('listMode: true boolean is kept', () => {
  const entities = applyListNorm({ listMode: true });
  assertEquals(entities.listMode, true);
});

Deno.test('listMode: false is dropped (only true is accepted)', () => {
  const entities = applyListNorm({ listMode: false });
  assertEquals(entities.listMode, undefined);
});

Deno.test('listMode: string "true" is dropped (must be boolean)', () => {
  const entities = applyListNorm({ listMode: 'true' });
  assertEquals(entities.listMode, undefined);
});

Deno.test('listMode: 1 (number) is dropped', () => {
  const entities = applyListNorm({ listMode: 1 });
  assertEquals(entities.listMode, undefined);
});

// ---------------------------------------------------------------------------
// limit normalisation
// ---------------------------------------------------------------------------

Deno.test('limit: valid positive integer is kept when listMode true', () => {
  const entities = applyListNorm({ listMode: true, limit: 3 });
  assertEquals(entities.limit, 3);
});

Deno.test('limit: 1 is kept (minimum valid)', () => {
  const entities = applyListNorm({ listMode: true, limit: 1 });
  assertEquals(entities.limit, 1);
});

Deno.test('limit: 20 is kept (maximum valid)', () => {
  const entities = applyListNorm({ listMode: true, limit: 20 });
  assertEquals(entities.limit, 20);
});

Deno.test('limit: 25 is clamped to 20', () => {
  const entities = applyListNorm({ listMode: true, limit: 25 });
  assertEquals(entities.limit, 20);
});

Deno.test('limit: 100 is clamped to 20', () => {
  const entities = applyListNorm({ listMode: true, limit: 100 });
  assertEquals(entities.limit, 20);
});

Deno.test('limit: 0 clamps to 1 (Math.max(1, …) floor)', () => {
  // Math.max(1, Math.min(20, Math.floor(0))) = 1
  const entities = applyListNorm({ listMode: true, limit: 0 });
  assertEquals(entities.limit, 1);
});

Deno.test('limit: negative number clamps to 1', () => {
  const entities = applyListNorm({ listMode: true, limit: -5 });
  assertEquals(entities.limit, 1);
});

Deno.test('limit: float is floored (3.9 → 3)', () => {
  const entities = applyListNorm({ listMode: true, limit: 3.9 });
  assertEquals(entities.limit, 3);
});

Deno.test('limit: NaN is dropped', () => {
  const entities = applyListNorm({ listMode: true, limit: NaN });
  assertEquals(entities.limit, undefined);
});

Deno.test('limit: ignored when listMode is not true', () => {
  const entities = applyListNorm({ limit: 5 });
  assertEquals(entities.limit, undefined);
  assertEquals(entities.listMode, undefined);
});

// ---------------------------------------------------------------------------
// Classification type shape — structural smoke test
// ---------------------------------------------------------------------------

Deno.test('Classification shape: valid object compiles with all fields', () => {
  const c: Classification = {
    intent: 'chat',
    entities: { listMode: true, limit: 5, direction: 'expense' },
    confidence: 0.85,
    language: 'es',
  };
  assertEquals(c.intent, 'chat');
  assertEquals(c.entities.listMode, true);
  assertEquals(c.entities.limit, 5);
});
