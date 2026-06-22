/**
 * whatsapp-webhook/index.ts
 * Supabase Edge Function — Twilio WhatsApp webhook entrypoint.
 *
 * Handles:
 *   POST    — Inbound message processing (signature verified, idempotent)
 *   OPTIONS — CORS preflight
 *
 * Security model:
 *   - verify_jwt = false (no Supabase JWT on this function — Twilio calls it)
 *   - POST: guarded by HMAC-SHA1 of the full request URL + sorted form params
 *     using TWILIO_AUTH_TOKEN (X-Twilio-Signature header). Body is read as raw
 *     text before URLSearchParams parse so the bytes match what Twilio signed.
 *
 * Inbound format: application/x-www-form-urlencoded
 *   From, Body, NumMedia, MediaUrl{i}, MediaContentType{i}, MessageSid
 *
 * Ack format: empty TwiML <Response/> (200 text/xml)
 *   Twilio considers any 2xx a successful delivery acknowledgement.
 *
 * Processing model:
 *   Messages are awaited inline before the TwiML ack is returned.
 *   Twilio tolerates multi-second webhook latency, and the MessageSid
 *   idempotency guard (provider_message_id UNIQUE) makes any Twilio
 *   timeout-retry a no-op (isNew=false → skip), so a slow message can never
 *   be processed or replied to twice. (The Supabase isolate tears down after
 *   the Response resolves, so background work via waitUntil would be killed.)
 *
 * Env vars consumed:
 *   TWILIO_ACCOUNT_SID       — Twilio account SID (AC...)
 *   TWILIO_AUTH_TOKEN        — Twilio auth token (signature verification + API auth)
 *   TWILIO_WHATSAPP_FROM     — Source number in whatsapp:+1... format
 *   SUPABASE_URL             — injected by runtime
 *   SUPABASE_SERVICE_ROLE_KEY— injected by runtime
 *
 * Module layout:
 *   verify.ts   — pure Twilio HMAC-SHA1 signature helpers (unit-testable)
 *   twilio.ts   — Twilio Messages API client (sendText, fetchMediaBytes)
 *   parse.ts    — pure Twilio form-payload parser (unit-testable)
 *   db.ts       — service-role Supabase helpers (recordInbound, resolveUser …)
 *   dispatch.ts — handleMessage: idempotency → identity → reply routing
 */

import { corsHeaders } from '../_shared/cors.ts';
import { validateTwilioSignature } from './verify.ts';
import { parseTwilioForm } from './parse.ts';
import { handleMessage } from './dispatch.ts';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function jsonError(status: number, message: string): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** Empty TwiML ack — Twilio requires a 2xx with valid XML (or empty body). */
const TWIML_ACK = '<?xml version="1.0" encoding="UTF-8"?><Response></Response>';

// ---------------------------------------------------------------------------
// Main router
// ---------------------------------------------------------------------------

Deno.serve(async (req: Request): Promise<Response> => {
  // ── OPTIONS — CORS preflight ────────────────────────────────────────────
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  // ── POST — Inbound event from Twilio ───────────────────────────────────
  if (req.method === 'POST') {
    // Read the raw body text so the bytes match what Twilio signed
    let rawBody: string;
    try {
      rawBody = await req.text();
    } catch (err) {
      console.error('[webhook] Failed to read request body:', err);
      return jsonError(400, 'Bad request body');
    }

    // Parse form params for signature verification and message extraction
    const params = Object.fromEntries(new URLSearchParams(rawBody));

    // Verify X-Twilio-Signature HMAC-SHA1 before any further processing
    const authToken = Deno.env.get('TWILIO_AUTH_TOKEN') ?? '';
    const header = req.headers.get('x-twilio-signature');

    let valid: boolean;
    try {
      valid = await validateTwilioSignature(req.url, params, header, authToken);
    } catch (err) {
      console.error('[webhook] Signature verification threw:', err);
      return jsonError(500, 'Signature verification error');
    }

    if (!valid) {
      console.warn('[webhook] POST rejected — invalid or missing X-Twilio-Signature');
      return new Response('Forbidden', { status: 403 });
    }

    // Parse the verified Twilio form payload into provider-agnostic shapes
    const parsed = parseTwilioForm(params);

    // Await inline — see processing model note in the file header above.
    if (parsed !== null) {
      await handleMessage(parsed.message, parsed.contact);
    }

    // Always ack with empty TwiML — Twilio requires a 2xx response
    return new Response(TWIML_ACK, {
      status: 200,
      headers: { 'Content-Type': 'text/xml' },
    });
  }

  // ── Any other method ────────────────────────────────────────────────────
  return new Response('Method Not Allowed', { status: 405 });
});
