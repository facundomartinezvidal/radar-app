/**
 * verify.test.ts
 * Unit tests for the pure helpers in verify.ts.
 *
 * Run with:
 *   deno test supabase/functions/whatsapp-webhook/verify.test.ts
 *
 * These tests have NO side effects — no network, no Supabase, no env vars.
 * They can run in CI independently of jest-expo.
 *
 * Test vector (HMAC-SHA256):
 *   key  : "test_secret"
 *   body : "hello world"
 *   hex  : c8aa85c632a6677847fd213e8181d39d62905dff3b8a925c9b7bb38eb3829029
 *   header: "sha256=c8aa85c632a6677847fd213e8181d39d62905dff3b8a925c9b7bb38eb3829029"
 *
 * Vector independently verified by:
 *   node -e "require('crypto').createHmac('sha256','test_secret').update('hello world').digest('hex')"
 *   → c8aa85c632a6677847fd213e8181d39d62905dff3b8a925c9b7bb38eb3829029
 */

import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { checkHandshake, verifySignature } from './verify.ts';

// ---------------------------------------------------------------------------
// Known test vector
// ---------------------------------------------------------------------------

// key: "test_secret", message: "hello world"
// computed via: echo -n "hello world" | openssl dgst -sha256 -hmac "test_secret"
const TEST_SECRET = 'test_secret';
const TEST_BODY = 'hello world';
// Verified: node -e "require('crypto').createHmac('sha256','test_secret').update('hello world').digest('hex')"
// deno-fmt-ignore
const EXPECTED_HEX = 'c8aa85c632a6677847fd213e8181d39d62905dff3b8a925c9b7bb38eb3829029';
const VALID_HEADER = `sha256=${EXPECTED_HEX}`;

// ---------------------------------------------------------------------------
// verifySignature
// ---------------------------------------------------------------------------

Deno.test('verifySignature: accepts a valid signature', async () => {
  const result = await verifySignature(TEST_BODY, VALID_HEADER, TEST_SECRET);
  assertEquals(result, true);
});

Deno.test('verifySignature: rejects a tampered body', async () => {
  const result = await verifySignature('hello world!', VALID_HEADER, TEST_SECRET);
  assertEquals(result, false);
});

Deno.test('verifySignature: rejects a wrong secret', async () => {
  const result = await verifySignature(TEST_BODY, VALID_HEADER, 'wrong_secret');
  assertEquals(result, false);
});

Deno.test('verifySignature: rejects a tampered hex digest', async () => {
  const tamperedHeader = 'sha256=0000000000000000000000000000000000000000000000000000000000000000';
  const result = await verifySignature(TEST_BODY, tamperedHeader, TEST_SECRET);
  assertEquals(result, false);
});

Deno.test('verifySignature: rejects a null header', async () => {
  const result = await verifySignature(TEST_BODY, null, TEST_SECRET);
  assertEquals(result, false);
});

Deno.test('verifySignature: rejects a header missing the sha256= prefix', async () => {
  const result = await verifySignature(TEST_BODY, EXPECTED_HEX, TEST_SECRET);
  assertEquals(result, false);
});

Deno.test('verifySignature: rejects an empty body with original header', async () => {
  const result = await verifySignature('', VALID_HEADER, TEST_SECRET);
  assertEquals(result, false);
});

Deno.test('verifySignature: handles an empty body with its own correct header', async () => {
  // Compute the expected HMAC for an empty body independently
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(TEST_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(''));
  const hex = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  const header = `sha256=${hex}`;

  const result = await verifySignature('', header, TEST_SECRET);
  assertEquals(result, true);
});

Deno.test('verifySignature: handles non-hex characters in header gracefully', async () => {
  const result = await verifySignature(TEST_BODY, 'sha256=gg!invalid', TEST_SECRET);
  assertEquals(result, false);
});

Deno.test('verifySignature: handles odd-length hex string gracefully', async () => {
  const result = await verifySignature(TEST_BODY, 'sha256=abc', TEST_SECRET);
  assertEquals(result, false);
});

// ---------------------------------------------------------------------------
// checkHandshake
// ---------------------------------------------------------------------------

const TOKEN = 'my_verify_token';

Deno.test('checkHandshake: returns challenge on valid subscribe + correct token', () => {
  const result = checkHandshake(
    { mode: 'subscribe', verifyToken: TOKEN, challenge: 'abc123' },
    TOKEN,
  );
  assertEquals(result, 'abc123');
});

Deno.test('checkHandshake: returns null when mode is not subscribe', () => {
  const result = checkHandshake(
    { mode: 'unsubscribe', verifyToken: TOKEN, challenge: 'abc123' },
    TOKEN,
  );
  assertEquals(result, null);
});

Deno.test('checkHandshake: returns null when verify_token is wrong', () => {
  const result = checkHandshake(
    { mode: 'subscribe', verifyToken: 'wrong', challenge: 'abc123' },
    TOKEN,
  );
  assertEquals(result, null);
});

Deno.test('checkHandshake: returns null when verify_token is null', () => {
  const result = checkHandshake(
    { mode: 'subscribe', verifyToken: null, challenge: 'abc123' },
    TOKEN,
  );
  assertEquals(result, null);
});

Deno.test('checkHandshake: returns null when challenge is null', () => {
  const result = checkHandshake({ mode: 'subscribe', verifyToken: TOKEN, challenge: null }, TOKEN);
  assertEquals(result, null);
});

Deno.test('checkHandshake: returns null when challenge is empty string', () => {
  const result = checkHandshake({ mode: 'subscribe', verifyToken: TOKEN, challenge: '' }, TOKEN);
  assertEquals(result, null);
});

Deno.test('checkHandshake: returns null when all params are null', () => {
  const result = checkHandshake({ mode: null, verifyToken: null, challenge: null }, TOKEN);
  assertEquals(result, null);
});

Deno.test('checkHandshake: echoes challenge verbatim (no mutation)', () => {
  const challenge = '  spaces and special!@#  ';
  const result = checkHandshake({ mode: 'subscribe', verifyToken: TOKEN, challenge }, TOKEN);
  assertEquals(result, challenge);
});
