/**
 * dispatch.test.ts
 * Unit tests for pure helpers exported from dispatch.ts.
 *
 * Run with:
 *   deno test supabase/functions/whatsapp-webhook/dispatch.test.ts
 *
 * These tests have NO side effects — no network, no Supabase, no env vars.
 * They exercise only `looksLikeLinkCode`, which is a pure synchronous function.
 *
 * Alphabet: base32 minus ambiguous glyphs 0/O/1/I/L → A-H J-K M-N P-Z 2-9 (27 chars)
 * Regex used internally: /^[A-HJ-KM-NP-Z2-9]{6}$/  (tested via toUpperCase())
 */

import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { looksLikeLinkCode } from './dispatch.ts';

// ---------------------------------------------------------------------------
// Valid codes — should return true
// ---------------------------------------------------------------------------

Deno.test('looksLikeLinkCode: accepts a valid uppercase code', () => {
  assertEquals(looksLikeLinkCode('ABCDEF'), true);
});

Deno.test('looksLikeLinkCode: accepts a valid lowercase code (case-insensitive)', () => {
  assertEquals(looksLikeLinkCode('abcdef'), true);
});

Deno.test('looksLikeLinkCode: accepts a mixed-case code', () => {
  assertEquals(looksLikeLinkCode('AbCdEf'), true);
});

Deno.test('looksLikeLinkCode: accepts a code with digits from the allowed range (2-9)', () => {
  assertEquals(looksLikeLinkCode('234567'), true);
});

Deno.test('looksLikeLinkCode: accepts a code with digits 2-9 and letters', () => {
  assertEquals(looksLikeLinkCode('A2B3C4'), true);
});

Deno.test('looksLikeLinkCode: accepts all boundary characters (A, H, J, N, P, Z)', () => {
  assertEquals(looksLikeLinkCode('AHJNPZ'), true);
});

Deno.test('looksLikeLinkCode: accepts boundary digits 2 and 9', () => {
  assertEquals(looksLikeLinkCode('222999'), true);
});

Deno.test('looksLikeLinkCode: accepts a realistic code sample', () => {
  // From the migration: alphabet ABCDEFGHJKMNPQRSTUVWXYZ23456789
  assertEquals(looksLikeLinkCode('MQ7R2X'), true);
});

// ---------------------------------------------------------------------------
// Invalid codes — should return false
// ---------------------------------------------------------------------------

Deno.test('looksLikeLinkCode: rejects the ambiguous digit 0', () => {
  assertEquals(looksLikeLinkCode('A0BCDE'), false);
});

Deno.test('looksLikeLinkCode: rejects the ambiguous letter O (uppercase)', () => {
  assertEquals(looksLikeLinkCode('ABCOEF'), false);
});

Deno.test('looksLikeLinkCode: rejects the ambiguous letter o (lowercase)', () => {
  assertEquals(looksLikeLinkCode('abcoel'), false);
});

Deno.test('looksLikeLinkCode: rejects the ambiguous digit 1', () => {
  assertEquals(looksLikeLinkCode('A1BCDE'), false);
});

Deno.test('looksLikeLinkCode: rejects the ambiguous letter I (uppercase)', () => {
  assertEquals(looksLikeLinkCode('ABICDE'), false);
});

Deno.test('looksLikeLinkCode: rejects the ambiguous letter i (lowercase)', () => {
  assertEquals(looksLikeLinkCode('abicde'), false);
});

Deno.test('looksLikeLinkCode: rejects the ambiguous letter L (uppercase)', () => {
  assertEquals(looksLikeLinkCode('ABLCDE'), false);
});

Deno.test('looksLikeLinkCode: rejects the ambiguous letter l (lowercase)', () => {
  assertEquals(looksLikeLinkCode('ablcde'), false);
});

Deno.test('looksLikeLinkCode: rejects a 5-char string (too short)', () => {
  assertEquals(looksLikeLinkCode('ABCDE'), false);
});

Deno.test('looksLikeLinkCode: rejects a 7-char string (too long)', () => {
  assertEquals(looksLikeLinkCode('ABCDEFG'), false);
});

Deno.test('looksLikeLinkCode: rejects an empty string', () => {
  assertEquals(looksLikeLinkCode(''), false);
});

Deno.test('looksLikeLinkCode: rejects a string with a space in the middle', () => {
  // Body is already trimmed before looksLikeLinkCode — internal spaces are invalid
  assertEquals(looksLikeLinkCode('AB CD'), false);
});

Deno.test('looksLikeLinkCode: rejects a string with a leading space', () => {
  assertEquals(looksLikeLinkCode(' ABCDE'), false);
});

Deno.test('looksLikeLinkCode: rejects special characters', () => {
  assertEquals(looksLikeLinkCode('AB!DEF'), false);
});

Deno.test('looksLikeLinkCode: rejects a typical non-code message ("hola")', () => {
  assertEquals(looksLikeLinkCode('hola'), false);
});

Deno.test('looksLikeLinkCode: rejects a typical non-code message with numbers', () => {
  assertEquals(looksLikeLinkCode('100 pesos'), false);
});
