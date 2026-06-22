/**
 * whatsapp-webhook/index.ts
 * Supabase Edge Function — Meta WhatsApp Cloud API webhook entrypoint.
 *
 * Handles:
 *   GET  — Meta verification handshake (hub.mode/hub.verify_token/hub.challenge)
 *   POST — Inbound message processing (signature verified, idempotent, async)
 *   OPTIONS — CORS preflight
 *
 * Security model:
 *   - verify_jwt = false (no Supabase JWT on this function — Meta calls it)
 *   - GET: guarded by WHATSAPP_VERIFY_TOKEN
 *   - POST: guarded by HMAC-SHA256 of raw body using WHATSAPP_APP_SECRET
 *     (X-Hub-Signature-256 header). Body is read as raw text BEFORE JSON parse
 *     so the bytes match what Meta signed.
 *
 * Env vars consumed:
 *   WHATSAPP_VERIFY_TOKEN    — shared secret for the GET handshake
 *   WHATSAPP_APP_SECRET      — Meta app secret for POST signature verification
 *   WHATSAPP_ACCESS_TOKEN    — Bearer token for outbound Graph API calls
 *   WHATSAPP_PHONE_NUMBER_ID — Source phone number id for outbound messages
 *   SUPABASE_URL             — injected by runtime
 *   SUPABASE_SERVICE_ROLE_KEY— injected by runtime
 *
 * Module layout:
 *   verify.ts   — pure GET-handshake + HMAC helpers (unit-testable)
 *   graph.ts    — Meta Graph API v21.0 client (sendText, fetchMediaBytes)
 *   db.ts       — service-role Supabase helpers (recordInbound, resolveUser …)
 *   dispatch.ts — handleMessage: idempotency → identity → reply routing
 */

import { corsHeaders } from '../_shared/cors.ts';
import { checkHandshake, verifySignature } from './verify.ts';
import { handleMessage, type WaContact, type WaMessage } from './dispatch.ts';

// ---------------------------------------------------------------------------
// Types — Meta Cloud API payload shapes
// ---------------------------------------------------------------------------

interface WaValue {
  messaging_product?: string;
  metadata?: { display_phone_number?: string; phone_number_id?: string };
  contacts?: WaContact[];
  messages?: WaMessage[];
  statuses?: unknown[];
  errors?: unknown[];
}

interface WaChange {
  value?: WaValue;
  field?: string;
}

interface WaEntry {
  id?: string;
  changes?: WaChange[];
}

interface WaPayload {
  object?: string;
  entry?: WaEntry[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function jsonError(status: number, message: string): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

// ---------------------------------------------------------------------------
// Main router
// ---------------------------------------------------------------------------

Deno.serve(async (req: Request): Promise<Response> => {
  // ── OPTIONS — CORS preflight ────────────────────────────────────────────
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  // ── GET — Meta verification handshake ──────────────────────────────────
  if (req.method === 'GET') {
    const url = new URL(req.url);
    const verifyToken = Deno.env.get('WHATSAPP_VERIFY_TOKEN') ?? '';

    const challenge = checkHandshake(
      {
        mode: url.searchParams.get('hub.mode'),
        verifyToken: url.searchParams.get('hub.verify_token'),
        challenge: url.searchParams.get('hub.challenge'),
      },
      verifyToken,
    );

    if (challenge === null) {
      console.warn('[webhook] GET handshake rejected — token mismatch or missing params');
      return new Response('Forbidden', { status: 403 });
    }

    // Echo the challenge verbatim as plain text (Meta requirement)
    return new Response(challenge, {
      status: 200,
      headers: { 'Content-Type': 'text/plain' },
    });
  }

  // ── POST — Inbound event from Meta ─────────────────────────────────────
  if (req.method === 'POST') {
    // Read the raw body text BEFORE JSON.parse so the bytes match what Meta signed
    let rawBody: string;
    try {
      rawBody = await req.text();
    } catch (err) {
      console.error('[webhook] Failed to read request body:', err);
      return jsonError(400, 'Bad request body');
    }

    // Verify X-Hub-Signature-256 HMAC before any further processing (D risk in design.md)
    const appSecret = Deno.env.get('WHATSAPP_APP_SECRET') ?? '';
    const signatureHeader = req.headers.get('x-hub-signature-256');

    let signatureValid: boolean;
    try {
      signatureValid = await verifySignature(rawBody, signatureHeader, appSecret);
    } catch (err) {
      console.error('[webhook] Signature verification threw:', err);
      return jsonError(500, 'Signature verification error');
    }

    if (!signatureValid) {
      console.warn('[webhook] POST rejected — invalid or missing X-Hub-Signature-256');
      return new Response('Forbidden', { status: 403 });
    }

    // Parse the verified payload
    let payload: WaPayload;
    try {
      payload = JSON.parse(rawBody) as WaPayload;
    } catch (err) {
      console.error('[webhook] JSON parse error after signature OK:', err);
      return jsonError(400, 'Invalid JSON payload');
    }

    // Extract messages from all entries/changes; ack immediately if none found
    // (e.g. delivery/read status events — per D5 / spec "Status callback is ignored")
    const messages: Array<{ message: WaMessage; contact: WaContact }> = [];

    for (const entry of payload.entry ?? []) {
      for (const change of entry.changes ?? []) {
        const value = change.value;
        if (!value?.messages?.length) {
          // Status/delivery event or other non-message change — ignore
          continue;
        }

        // Build a contact map for O(1) lookup by wa_id
        const contactMap = new Map<string, WaContact>();
        for (const c of value.contacts ?? []) {
          if (c.wa_id) contactMap.set(c.wa_id, c);
        }

        for (const msg of value.messages) {
          const contact = contactMap.get(msg.from) ?? { wa_id: msg.from };
          messages.push({ message: msg, contact });
        }
      }
    }

    // Ack Meta immediately — D3 in design.md.
    // All actual processing (DB writes, Groq calls, Graph API replies) happens
    // asynchronously inside EdgeRuntime.waitUntil so Meta's ack window is met
    // regardless of Groq latency.
    if (messages.length > 0) {
      const processingPromise = Promise.all(
        messages.map(({ message, contact }) => handleMessage(message, contact)),
      );

      // EdgeRuntime.waitUntil keeps the isolate alive until the promise settles
      // without blocking the 200 response to Meta.
      (EdgeRuntime as { waitUntil: (p: Promise<unknown>) => void }).waitUntil(processingPromise);
    }

    return new Response('OK', { status: 200 });
  }

  // ── Any other method ────────────────────────────────────────────────────
  return new Response('Method Not Allowed', { status: 405 });
});
