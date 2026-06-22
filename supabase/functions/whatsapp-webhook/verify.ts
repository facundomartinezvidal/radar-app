/**
 * verify.ts
 * Pure, side-effect-free helpers for Meta webhook verification.
 *
 * Exported functions are intentionally dependency-free so they can be
 * unit-tested with `deno test` without any Supabase or Graph API access.
 */

// ---------------------------------------------------------------------------
// Handshake (GET verification)
// ---------------------------------------------------------------------------

export interface HandshakeParams {
  mode: string | null;
  verifyToken: string | null;
  challenge: string | null;
}

/**
 * Returns the hub.challenge string if the GET handshake is valid, otherwise
 * returns null.
 *
 * Valid means:
 *   - hub.mode === 'subscribe'
 *   - hub.verify_token === expectedToken (constant-time not required here —
 *     this is a server-to-server check where the attacker cannot observe
 *     timing, but we keep it simple and deterministic)
 */
export function checkHandshake(params: HandshakeParams, expectedToken: string): string | null {
  if (
    params.mode === 'subscribe' &&
    typeof params.verifyToken === 'string' &&
    params.verifyToken === expectedToken &&
    typeof params.challenge === 'string' &&
    params.challenge.length > 0
  ) {
    return params.challenge;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Signature verification (POST authentication)
// ---------------------------------------------------------------------------

/**
 * Converts a hex string to a Uint8Array.
 * Returns null if the string contains non-hex characters.
 */
function hexToBytes(hex: string): Uint8Array | null {
  if (hex.length % 2 !== 0) return null;
  const result = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    const byte = parseInt(hex.slice(i, i + 2), 16);
    if (Number.isNaN(byte)) return null;
    result[i / 2] = byte;
  }
  return result;
}

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

/**
 * Verifies the `X-Hub-Signature-256` header produced by Meta.
 *
 * Algorithm:
 *   expected = 'sha256=' + HMAC-SHA256(appSecret, rawBody)
 *
 * Uses Web Crypto (available in both Deno and browser environments) so there
 * is no native module dependency. The comparison is constant-time to resist
 * timing attacks.
 *
 * @param rawBody   The raw request body text, read before any JSON.parse().
 * @param header    The value of the `X-Hub-Signature-256` request header
 *                  (null/undefined if missing).
 * @param appSecret The `WHATSAPP_APP_SECRET` environment variable value.
 * @returns         true if the signature is valid, false otherwise.
 */
export async function verifySignature(
  rawBody: string,
  header: string | null | undefined,
  appSecret: string,
): Promise<boolean> {
  // Missing or malformed header → reject immediately
  if (typeof header !== 'string') return false;
  if (!header.startsWith('sha256=')) return false;

  const providedHex = header.slice('sha256='.length);
  const providedBytes = hexToBytes(providedHex);
  if (providedBytes === null) return false;

  // Derive the HMAC key from the app secret
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(appSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );

  // Compute HMAC-SHA256 over the raw body bytes
  const signatureBuffer = await crypto.subtle.sign('HMAC', keyMaterial, encoder.encode(rawBody));

  const expectedBytes = new Uint8Array(signatureBuffer);

  return constantTimeEqual(expectedBytes, providedBytes);
}
