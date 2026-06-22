/**
 * verify.test.ts
 * Unit tests for the pure helpers in verify.ts (Twilio transport).
 *
 * Run with:
 *   deno test supabase/functions/whatsapp-webhook/verify.test.ts
 *
 * These tests have NO side effects — no network, no Supabase, no env vars.
 * They can run in CI independently of jest-expo.
 *
 * Test vectors:
 *
 * Vector A — RADAR-shaped (used for accept/reject tests):
 *   authToken : "test_auth_token"
 *   url       : "https://miiorhmqxdqsowqxnpii.supabase.co/functions/v1/whatsapp-webhook"
 *   params    : { Body:"hola", From:"whatsapp:+5491166660428",
 *                 MessageSid:"SM123", NumMedia:"0", To:"whatsapp:+14155238886" }
 *   signature : "rkUIEXuKWlT7YQIL/iGsrHYbRUU="
 *
 * Vector B — canonical Twilio example (base-string shape assertion):
 *   authToken : "12345"
 *   url       : "https://mycompany.com/myapp.php?foo=1&bar=2"
 *   params    : { Digits:"1234", To:"+18005551212", From:"+14158675310",
 *                 Caller:"+14158675309", ApiVersion:"2010-04-01" }
 *   base      : "https://mycompany.com/myapp.php?foo=1&bar=2ApiVersion2010-04-01Caller+14158675309Digits1234From+14158675310To+18005551212"
 *   signature : "/6X2bhpB7zoU3kTYbLulsxk19Lk="
 *
 * All vectors independently verified by:
 *   node -e "const c=require('crypto'); \
 *     const base='<base>'; \
 *     console.log(c.createHmac('sha1','<token>').update(base).digest('base64'))"
 */

import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { buildTwilioSignatureBase, validateTwilioSignature } from './verify.ts';

// ---------------------------------------------------------------------------
// Vector A — RADAR-shaped
// ---------------------------------------------------------------------------

const VECTOR_A_TOKEN = 'test_auth_token';
const VECTOR_A_URL = 'https://miiorhmqxdqsowqxnpii.supabase.co/functions/v1/whatsapp-webhook';
const VECTOR_A_PARAMS: Record<string, string> = {
  Body: 'hola',
  From: 'whatsapp:+5491166660428',
  MessageSid: 'SM123',
  NumMedia: '0',
  To: 'whatsapp:+14155238886',
};
const VECTOR_A_SIG = 'rkUIEXuKWlT7YQIL/iGsrHYbRUU=';

// ---------------------------------------------------------------------------
// Vector B — canonical Twilio example
// ---------------------------------------------------------------------------

const VECTOR_B_TOKEN = '12345';
const VECTOR_B_URL = 'https://mycompany.com/myapp.php?foo=1&bar=2';
const VECTOR_B_PARAMS: Record<string, string> = {
  Digits: '1234',
  To: '+18005551212',
  From: '+14158675310',
  Caller: '+14158675309',
  ApiVersion: '2010-04-01',
};
const VECTOR_B_BASE =
  'https://mycompany.com/myapp.php?foo=1&bar=2ApiVersion2010-04-01Caller+14158675309Digits1234From+14158675310To+18005551212';
const VECTOR_B_SIG = '/6X2bhpB7zoU3kTYbLulsxk19Lk=';

// ---------------------------------------------------------------------------
// buildTwilioSignatureBase
// ---------------------------------------------------------------------------

Deno.test('buildTwilioSignatureBase: produces correct base string (Vector B)', () => {
  const result = buildTwilioSignatureBase(VECTOR_B_URL, VECTOR_B_PARAMS);
  assertEquals(result, VECTOR_B_BASE);
});

Deno.test('buildTwilioSignatureBase: sorts params ascending by key', () => {
  const result = buildTwilioSignatureBase('https://example.com/', { z: 'last', a: 'first' });
  assertEquals(result, 'https://example.com/afirstzlast');
});

Deno.test('buildTwilioSignatureBase: empty params returns url only', () => {
  const result = buildTwilioSignatureBase('https://example.com/', {});
  assertEquals(result, 'https://example.com/');
});

// ---------------------------------------------------------------------------
// validateTwilioSignature — Vector A accept/reject cases
// ---------------------------------------------------------------------------

Deno.test('validateTwilioSignature: accepts a valid signature (Vector A)', async () => {
  const result = await validateTwilioSignature(
    VECTOR_A_URL,
    VECTOR_A_PARAMS,
    VECTOR_A_SIG,
    VECTOR_A_TOKEN,
  );
  assertEquals(result, true);
});

Deno.test('validateTwilioSignature: rejects a tampered param value', async () => {
  const tampered = { ...VECTOR_A_PARAMS, Body: 'chau' };
  const result = await validateTwilioSignature(
    VECTOR_A_URL,
    tampered,
    VECTOR_A_SIG,
    VECTOR_A_TOKEN,
  );
  assertEquals(result, false);
});

Deno.test('validateTwilioSignature: rejects a wrong authToken', async () => {
  const result = await validateTwilioSignature(
    VECTOR_A_URL,
    VECTOR_A_PARAMS,
    VECTOR_A_SIG,
    'wrong_token',
  );
  assertEquals(result, false);
});

Deno.test('validateTwilioSignature: rejects a null header', async () => {
  const result = await validateTwilioSignature(VECTOR_A_URL, VECTOR_A_PARAMS, null, VECTOR_A_TOKEN);
  assertEquals(result, false);
});

Deno.test('validateTwilioSignature: rejects a tampered signature', async () => {
  const result = await validateTwilioSignature(
    VECTOR_A_URL,
    VECTOR_A_PARAMS,
    'AAAAAAAAAAAAAAAAAAAAAAAAAAA=',
    VECTOR_A_TOKEN,
  );
  assertEquals(result, false);
});

// ---------------------------------------------------------------------------
// validateTwilioSignature — Vector B (canonical Twilio example)
// ---------------------------------------------------------------------------

Deno.test('validateTwilioSignature: accepts valid signature (Vector B)', async () => {
  const result = await validateTwilioSignature(
    VECTOR_B_URL,
    VECTOR_B_PARAMS,
    VECTOR_B_SIG,
    VECTOR_B_TOKEN,
  );
  assertEquals(result, true);
});

// ---------------------------------------------------------------------------
// validateTwilioSignature — edge cases
// ---------------------------------------------------------------------------

Deno.test('validateTwilioSignature: rejects undefined header', async () => {
  const result = await validateTwilioSignature(
    VECTOR_A_URL,
    VECTOR_A_PARAMS,
    undefined,
    VECTOR_A_TOKEN,
  );
  assertEquals(result, false);
});
