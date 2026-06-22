/**
 * parse.ts
 * Pure, side-effect-free parser for Twilio inbound WhatsApp form payloads.
 *
 * Exported functions are intentionally dependency-free so they can be
 * unit-tested with `deno test` without any Supabase or Twilio API access.
 *
 * Twilio delivers inbound WhatsApp messages as application/x-www-form-urlencoded
 * with fields: From, Body, NumMedia, MediaUrl{i}, MediaContentType{i}, MessageSid.
 */

import type { WaContact, WaMessage } from './dispatch.ts';

// ---------------------------------------------------------------------------
// mediaTypeFromMime
// ---------------------------------------------------------------------------

/**
 * Maps a MIME type string to a WaMessage media type discriminant.
 *
 *   image/*   → 'image'
 *   audio/*   → 'audio'
 *   anything else → 'document'
 */
export function mediaTypeFromMime(mime: string | undefined): 'image' | 'audio' | 'document' {
  if (!mime) return 'document';
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('audio/')) return 'audio';
  return 'document';
}

// ---------------------------------------------------------------------------
// parseTwilioForm
// ---------------------------------------------------------------------------

/**
 * Parses the form params from a Twilio inbound WhatsApp webhook POST into the
 * provider-agnostic WaMessage / WaContact shapes used by dispatch.ts.
 *
 * Key normalisation rules:
 *   - E.164: strip the `whatsapp:` prefix Twilio prepends to `From`.
 *   - wa_id: E.164 without the leading `+` (digits only) — matches Meta's format.
 *   - Media: the Twilio MediaUrl is stored as `message.{image|audio|document}.id`
 *     so `fetchMediaBytes(message.{...}.id)` works transparently in dispatch/capture.
 *   - No 549→15 transform — Twilio normalises Argentine numbers natively.
 *
 * Returns null when the payload is missing required fields (MessageSid or From).
 *
 * @param params  Parsed URLSearchParams as a plain Record.
 * @returns       { message, contact } or null.
 */
export function parseTwilioForm(
  params: Record<string, string>,
): { message: WaMessage; contact: WaContact } | null {
  if (!params.MessageSid || !params.From) return null;

  // Strip the whatsapp: scheme Twilio prepends to From (e.g. "whatsapp:+5491166660428")
  const e164 = params.From.replace(/^whatsapp:/, '');

  // wa_id is digits only (no leading '+') — mirrors Meta's wa_id format
  const waId = e164.replace(/^\+/, '').replace(/\D/g, '');
  if (!waId) return null;

  const numMedia = parseInt(params.NumMedia ?? '0', 10) || 0;

  // Determine message type
  const type: string = numMedia > 0 ? mediaTypeFromMime(params.MediaContentType0) : 'text';

  // Build the base message object
  const message: WaMessage = {
    id: params.MessageSid,
    from: waId,
    type,
    timestamp: params.Timestamp ?? '',
    text: params.Body ? { body: params.Body } : undefined,
  };

  // Attach the media field when present; the MediaUrl becomes the `.id` field
  // so fetchMediaBytes(message.{image|audio|document}.id) works transparently.
  if (numMedia > 0) {
    const mediaUrl = params.MediaUrl0 ?? '';
    const mimeType = params.MediaContentType0 ?? '';

    if (type === 'image') {
      message.image = { id: mediaUrl, mime_type: mimeType };
    } else if (type === 'audio') {
      message.audio = { id: mediaUrl, mime_type: mimeType };
    } else {
      message.document = { id: mediaUrl, mime_type: mimeType };
    }
  }

  const contact: WaContact = { wa_id: waId };

  return { message, contact };
}
