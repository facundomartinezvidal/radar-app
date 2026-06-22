/**
 * verify.ts
 * Pure, side-effect-free helpers for Twilio webhook signature verification.
 *
 * Exported functions are intentionally dependency-free so they can be
 * unit-tested with `deno test` without any Supabase or Twilio API access.
 *
 * Algorithm: HMAC-SHA1
 *   signature = base64(HMAC-SHA1(authToken, url + sortedParamPairs))
 *
 * Reference: https://www.twilio.com/docs/usage/webhooks/webhooks-security
 */

// ---------------------------------------------------------------------------
// Constant-time comparison (private helper)
// ---------------------------------------------------------------------------

/**
 * Constant-time comparison of two Uint8Arrays.
 *
 * Returns true only if both arrays have the same length and every byte
 * matches. Always reads all bytes of the shorter array to prevent
 * timing-based length leakage.
 */
function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    // Bitwise OR accumulates any difference without early exit.
    diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
  }
  return diff === 0;
}

// ---------------------------------------------------------------------------
// Twilio signature base string
// ---------------------------------------------------------------------------

/**
 * Builds the Twilio signature base string for HMAC-SHA1 computation.
 *
 * Algorithm (pure, no side effects):
 *   base = url + for each param key sorted ascending: key + value
 *
 * No separators between key/value pairs — this matches the Twilio spec exactly.
 *
 * @param url    The full request URL (including query string if any).
 * @param params The parsed form params from the request body (or query string).
 * @returns      The base string to be signed.
 */
export function buildTwilioSignatureBase(url: string, params: Record<string, string>): string {
  const sorted = Object.keys(params).sort();
  let base = url;
  for (const key of sorted) {
    base += key + (params[key] ?? '');
  }
  return base;
}

// ---------------------------------------------------------------------------
// Twilio signature validation
// ---------------------------------------------------------------------------

/**
 * Validates the `X-Twilio-Signature` header produced by Twilio.
 *
 * Algorithm:
 *   expected = base64(HMAC-SHA1(authToken, buildTwilioSignatureBase(url, params)))
 *
 * Uses Web Crypto (available in both Deno and browser environments) so there
 * is no native module dependency. The comparison is constant-time to resist
 * timing attacks (compares raw base64 ASCII bytes via TextEncoder).
 *
 * @param url       The full request URL Twilio posted to.
 * @param params    The parsed form-encoded body params.
 * @param header    The value of the `X-Twilio-Signature` request header
 *                  (null/undefined if missing).
 * @param authToken The `TWILIO_AUTH_TOKEN` environment variable value.
 * @returns         true if the signature is valid, false otherwise.
 */
export async function validateTwilioSignature(
  url: string,
  params: Record<string, string>,
  header: string | null | undefined,
  authToken: string,
): Promise<boolean> {
  // Missing or non-string header → reject immediately
  if (typeof header !== 'string') return false;

  const base = buildTwilioSignatureBase(url, params);

  // Derive HMAC-SHA1 key from the auth token
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(authToken),
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign'],
  );

  // Compute HMAC-SHA1 over the base string
  const signatureBuffer = await crypto.subtle.sign('HMAC', keyMaterial, encoder.encode(base));

  // Base64-encode the resulting bytes
  const expected = btoa(String.fromCharCode(...new Uint8Array(signatureBuffer)));

  // Constant-time comparison over raw ASCII bytes of the base64 strings
  return constantTimeEqual(encoder.encode(expected), encoder.encode(header));
}
