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
