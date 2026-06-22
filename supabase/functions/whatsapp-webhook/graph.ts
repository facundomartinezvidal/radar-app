/**
 * graph.ts
 * Meta Graph API v21.0 client for the WhatsApp Cloud API.
 *
 * Env vars consumed (read at call time, never cached at module level):
 *   WHATSAPP_ACCESS_TOKEN    — Bearer token for all Graph API calls
 *   WHATSAPP_PHONE_NUMBER_ID — Source phone number for outbound messages
 */

const GRAPH_API_BASE = 'https://graph.facebook.com/v21.0';

// ---------------------------------------------------------------------------
// sendText
// ---------------------------------------------------------------------------

/**
 * Sends a plain-text WhatsApp message via the Graph API.
 *
 * Errors are logged and swallowed so a reply failure never propagates to the
 * main dispatch path and never causes the webhook to return non-200 (which
 * would trigger a Meta retry storm).
 *
 * @param to   Recipient E.164 number (with leading '+').
 * @param body Message text content.
 */
export async function sendText(to: string, body: string): Promise<void> {
  const accessToken = Deno.env.get('WHATSAPP_ACCESS_TOKEN');
  const phoneNumberId = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID');

  if (!accessToken || !phoneNumberId) {
    console.error('[graph] sendText: WHATSAPP_ACCESS_TOKEN or WHATSAPP_PHONE_NUMBER_ID not set');
    return;
  }

  const url = `${GRAPH_API_BASE}/${phoneNumberId}/messages`;
  const payload = {
    messaging_product: 'whatsapp',
    to,
    type: 'text',
    text: { body },
  };

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '(unreadable)');
      console.error(`[graph] sendText failed: HTTP ${res.status} to=${to} — ${errText}`);
    }
  } catch (err) {
    console.error('[graph] sendText fetch error:', err);
  }
}

// ---------------------------------------------------------------------------
// fetchMediaBytes
// ---------------------------------------------------------------------------

export interface MediaResult {
  bytes: Uint8Array;
  mimeType: string;
}

/**
 * Downloads media identified by a Meta `media_id`.
 *
 * Steps:
 *   1. GET /{mediaId}?bearer → JSON with {url, mime_type}
 *   2. GET that URL with bearer → binary body
 *
 * Used by the capture module (added in a later task) to retrieve images,
 * audio, and PDFs sent to the bot.
 *
 * @throws Error if either Graph API call fails or the response is malformed.
 */
export async function fetchMediaBytes(mediaId: string): Promise<MediaResult> {
  const accessToken = Deno.env.get('WHATSAPP_ACCESS_TOKEN');
  if (!accessToken) {
    throw new Error('[graph] WHATSAPP_ACCESS_TOKEN not set');
  }

  // Step 1: resolve media URL + MIME type
  const metaRes = await fetch(`${GRAPH_API_BASE}/${mediaId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!metaRes.ok) {
    const body = await metaRes.text().catch(() => '(unreadable)');
    throw new Error(`[graph] fetchMediaBytes metadata failed: HTTP ${metaRes.status} — ${body}`);
  }

  const meta = (await metaRes.json()) as { url?: string; mime_type?: string };

  if (typeof meta.url !== 'string' || meta.url.length === 0) {
    throw new Error('[graph] fetchMediaBytes: no url in media metadata');
  }

  const mimeType =
    typeof meta.mime_type === 'string' && meta.mime_type.length > 0
      ? meta.mime_type
      : 'application/octet-stream';

  // Step 2: download binary content
  const contentRes = await fetch(meta.url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!contentRes.ok) {
    throw new Error(`[graph] fetchMediaBytes content fetch failed: HTTP ${contentRes.status}`);
  }

  const buffer = await contentRes.arrayBuffer();
  return { bytes: new Uint8Array(buffer), mimeType };
}
