/**
 * twilio.ts
 * Twilio Messages API client for the WhatsApp bot.
 *
 * Replaces graph.ts (Meta Graph API v21.0) with Twilio's REST API.
 * Media is fetched via a single Basic-auth GET of the Twilio MediaUrl
 * (Twilio delivers ready-to-download URLs — no two-step resolution needed).
 *
 * Env vars consumed (read at call time, never cached at module level):
 *   TWILIO_ACCOUNT_SID     — Twilio account SID (AC...)
 *   TWILIO_AUTH_TOKEN      — Twilio auth token for Basic-auth
 *   TWILIO_WHATSAPP_FROM   — Source number in whatsapp:+1... format
 */

// ---------------------------------------------------------------------------
// sendText
// ---------------------------------------------------------------------------

/**
 * Sends a plain-text WhatsApp message via the Twilio Messages API.
 *
 * Errors are logged and swallowed so a reply failure never propagates to the
 * main dispatch path and never causes the webhook to return non-200 (which
 * would trigger a Twilio retry).
 *
 * @param to   Recipient E.164 number (with leading '+').
 * @param body Message text content.
 */
export async function sendText(to: string, body: string): Promise<void> {
  const sid = Deno.env.get('TWILIO_ACCOUNT_SID');
  const token = Deno.env.get('TWILIO_AUTH_TOKEN');
  const from = Deno.env.get('TWILIO_WHATSAPP_FROM');

  if (!sid || !token || !from) {
    console.error(
      '[twilio] sendText: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, or TWILIO_WHATSAPP_FROM not set',
    );
    return;
  }

  // Twilio WhatsApp recipient: the number arrives as E.164 (e.g. +5491166660428).
  // Prepend the whatsapp: scheme — no 549→15 transform needed (Twilio normalises AR numbers).
  const whatsappTo = `whatsapp:${to}`;

  const url = `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`;

  // Hard timeout so a hung Twilio fetch can never stall the whole handler.
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15_000);

  try {
    const res = await fetch(url, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        Authorization: `Basic ${btoa(`${sid}:${token}`)}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ From: from, To: whatsappTo, Body: body }).toString(),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '(unreadable)');
      console.error(`[twilio] sendText failed: HTTP ${res.status} to=${whatsappTo} — ${errText}`);
    }
  } catch (err) {
    console.error('[twilio] sendText fetch error:', err);
  } finally {
    clearTimeout(timeoutId);
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
 * Downloads media from a Twilio MediaUrl using Basic-auth.
 *
 * Twilio delivers a ready-to-download URL in `MediaUrl{i}` — no two-step
 * metadata resolution is needed (unlike the Meta Graph API).
 *
 * The callers pass `message.{image,audio,document}.id`, which on this branch
 * carries the Twilio MediaUrl assigned by parseTwilioForm.
 *
 * @param mediaUrl The Twilio media download URL (from MediaUrl0, MediaUrl1, …).
 * @throws Error if credentials are missing or the HTTP response is not 2xx.
 */
export async function fetchMediaBytes(mediaUrl: string): Promise<MediaResult> {
  const sid = Deno.env.get('TWILIO_ACCOUNT_SID');
  const token = Deno.env.get('TWILIO_AUTH_TOKEN');

  if (!sid || !token) {
    throw new Error('[twilio] TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN not set');
  }

  const res = await fetch(mediaUrl, {
    headers: {
      Authorization: `Basic ${btoa(`${sid}:${token}`)}`,
    },
  });

  if (!res.ok) {
    throw new Error(`[twilio] fetchMediaBytes failed: HTTP ${res.status} url=${mediaUrl}`);
  }

  const mimeType = res.headers.get('content-type') ?? 'application/octet-stream';

  return { bytes: new Uint8Array(await res.arrayBuffer()), mimeType };
}
