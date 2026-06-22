/**
 * render.test.ts
 * Unit tests for pure, side-effect-free exports from render.ts.
 *
 * Run with:
 *   deno test supabase/functions/whatsapp-webhook/render.test.ts
 *
 * These tests have NO side effects — no network, no Supabase, no Groq calls.
 * They verify:
 *   1. extractMoneyTokens          — ARS / USD / percentage regex matching
 *   2. outputUsesOnlyKnownFigures  — fabrication guard (KEY DATA-INTEGRITY TEST)
 *   3. withinLengthLimit           — character-length cap
 *
 * NOTE: renderFinancialAnswer is IO-bound (Groq) and is not tested here EXCEPT
 * for the env-guard fast-path when GROQ_API_KEY is unset (see below).
 */

import { assertEquals, assertStringIncludes } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import {
  extractMoneyTokens,
  outputUsesOnlyKnownFigures,
  renderFinancialAnswer,
  withinLengthLimit,
} from './render.ts';

// ---------------------------------------------------------------------------
// extractMoneyTokens
// ---------------------------------------------------------------------------

Deno.test('extractMoneyTokens: matches ARS, USD and percentage tokens', () => {
  const text = 'Tus gastos son $ 45.000,00 en ARS y USD 100,00 en dólares, cambió un -13,5%.';
  const tokens = extractMoneyTokens(text);
  // All three token types must appear
  assertEquals(
    tokens.some((t) => t.replace(/\s/g, '') === '$45.000,00'),
    true,
  );
  assertEquals(
    tokens.some((t) => t.replace(/\s/g, '') === 'USD100,00'),
    true,
  );
  assertEquals(
    tokens.some((t) => t === '-13,5%'),
    true,
  );
});

Deno.test('extractMoneyTokens: string with no monetary tokens returns empty array', () => {
  const text = 'No hay movimientos este mes.';
  assertEquals(extractMoneyTokens(text), []);
});

Deno.test('extractMoneyTokens: plain integers like "12 movimientos" are NOT matched', () => {
  const text = 'Registraste 12 movimientos y 3 ingresos.';
  assertEquals(extractMoneyTokens(text), []);
});

Deno.test('extractMoneyTokens: multiple ARS amounts are all captured', () => {
  const text = 'Gastos $ 18.000,00 y $ 9.000,00 este período.';
  const tokens = extractMoneyTokens(text);
  assertEquals(tokens.length >= 2, true);
});

// ---------------------------------------------------------------------------
// outputUsesOnlyKnownFigures — KEY DATA-INTEGRITY TESTS
// ---------------------------------------------------------------------------

Deno.test('outputUsesOnlyKnownFigures: all output figures present in context → true', () => {
  const context = 'gastos $ 45.000,00 · ingresos $ 250.000,00 · neto +$ 205.000,00';
  const output = 'Tus gastos del período son $ 45.000,00.';
  assertEquals(outputUsesOnlyKnownFigures(output, context), true);
});

Deno.test('outputUsesOnlyKnownFigures: REJECTS FABRICATED FIGURE NOT IN CONTEXT BLOCK', () => {
  // This is the key data-integrity guard: the LLM must not invent figures.
  const context = 'gastos $ 45.000,00 · ingresos $ 250.000,00';
  const fabricatedOutput = 'Tus gastos son $ 999.999,00 este mes.';
  assertEquals(outputUsesOnlyKnownFigures(fabricatedOutput, context), false);
});

Deno.test(
  'outputUsesOnlyKnownFigures: whitespace-normalisation — "$45.000,00" matches "$ 45.000,00"',
  () => {
    // Output has no space after $; context has a space — should still match after normalisation
    const context = 'gastos $ 45.000,00 este mes';
    const output = 'Gastos $45.000,00.';
    assertEquals(outputUsesOnlyKnownFigures(output, context), true);
  },
);

Deno.test(
  'outputUsesOnlyKnownFigures: output with no money tokens → true (nothing to verify)',
  () => {
    const context = 'gastos $ 45.000,00';
    const output = 'No tuviste movimientos este mes.';
    assertEquals(outputUsesOnlyKnownFigures(output, context), true);
  },
);

Deno.test(
  'outputUsesOnlyKnownFigures: fabricated percentage "+8,2%" not in context → false',
  () => {
    const context = 'gastos $ 45.000,00 · cambio -13,5%';
    const output = 'Tus gastos crecieron +8,2% este mes.';
    assertEquals(outputUsesOnlyKnownFigures(output, context), false);
  },
);

Deno.test('outputUsesOnlyKnownFigures: USD amount present in context → true', () => {
  const context = 'USD 100,00 en dólares';
  const output = 'Gastaste USD 100,00 en dólares.';
  assertEquals(outputUsesOnlyKnownFigures(output, context), true);
});

// ---------------------------------------------------------------------------
// withinLengthLimit
// ---------------------------------------------------------------------------

Deno.test('withinLengthLimit: short string → true', () => {
  assertEquals(withinLengthLimit('Hola'), true);
});

Deno.test('withinLengthLimit: string of length 1500 → false (exceeds default 1400)', () => {
  const long = 'a'.repeat(1500);
  assertEquals(withinLengthLimit(long), false);
});

Deno.test('withinLengthLimit: string of exactly 1400 chars → true (at limit)', () => {
  const exact = 'a'.repeat(1400);
  assertEquals(withinLengthLimit(exact), true);
});

Deno.test('withinLengthLimit: string of 1401 chars → false (one over limit)', () => {
  const oneOver = 'a'.repeat(1401);
  assertEquals(withinLengthLimit(oneOver), false);
});

Deno.test('withinLengthLimit: custom max respected', () => {
  assertEquals(withinLengthLimit('hello', 5), true);
  assertEquals(withinLengthLimit('hello!', 5), false);
});

// ---------------------------------------------------------------------------
// renderFinancialAnswer — env-guard fast-path (no network)
// ---------------------------------------------------------------------------

// NOTE: This test manipulates Deno.env, which requires --allow-env.  When the
// suite is run without that permission it is skipped automatically (rather than
// erroring) by querying the env permission up front.  Run it explicitly with:
//   deno test --no-check --allow-env supabase/functions/whatsapp-webhook/render.test.ts
const envPermission = Deno.permissions.querySync({ name: 'env' }).state;
Deno.test({
  name: 'renderFinancialAnswer: returns deterministicFallback when GROQ_API_KEY is unset',
  ignore: envPermission !== 'granted',
  async fn() {
    const original = Deno.env.get('GROQ_API_KEY');
    Deno.env.delete('GROQ_API_KEY');

    try {
      const result = await renderFinancialAnswer({
        contextBlock: 'x',
        userQuestion: 'y',
        deterministicFallback: 'FB',
      });
      assertEquals(result, 'FB');
    } finally {
      if (original !== undefined) {
        Deno.env.set('GROQ_API_KEY', original);
      }
    }
  },
});
