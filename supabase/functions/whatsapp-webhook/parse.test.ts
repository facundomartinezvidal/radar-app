/**
 * parse.test.ts
 * Unit tests for the pure helpers in parse.ts.
 *
 * Run with:
 *   deno test supabase/functions/whatsapp-webhook/parse.test.ts
 *
 * These tests have NO side effects — no network, no Supabase, no env vars.
 * They can run in CI independently of jest-expo.
 */

import { assertEquals, assertNotEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { mediaTypeFromMime, parseTwilioForm } from './parse.ts';

// ---------------------------------------------------------------------------
// mediaTypeFromMime
// ---------------------------------------------------------------------------

Deno.test('mediaTypeFromMime: image/jpeg → image', () => {
  assertEquals(mediaTypeFromMime('image/jpeg'), 'image');
});

Deno.test('mediaTypeFromMime: image/png → image', () => {
  assertEquals(mediaTypeFromMime('image/png'), 'image');
});

Deno.test('mediaTypeFromMime: audio/ogg → audio', () => {
  assertEquals(mediaTypeFromMime('audio/ogg'), 'audio');
});

Deno.test('mediaTypeFromMime: audio/mpeg → audio', () => {
  assertEquals(mediaTypeFromMime('audio/mpeg'), 'audio');
});

Deno.test('mediaTypeFromMime: application/pdf → document', () => {
  assertEquals(mediaTypeFromMime('application/pdf'), 'document');
});

Deno.test('mediaTypeFromMime: undefined → document', () => {
  assertEquals(mediaTypeFromMime(undefined), 'document');
});

Deno.test('mediaTypeFromMime: empty string → document', () => {
  assertEquals(mediaTypeFromMime(''), 'document');
});

// ---------------------------------------------------------------------------
// parseTwilioForm — text message
// ---------------------------------------------------------------------------

Deno.test('parseTwilioForm: parses a text message correctly', () => {
  const params: Record<string, string> = {
    MessageSid: 'SM_TEXT_001',
    From: 'whatsapp:+5491166660428',
    To: 'whatsapp:+14155238886',
    Body: 'hola mundo',
    NumMedia: '0',
  };

  const result = parseTwilioForm(params);
  assertNotEquals(result, null);

  const { message, contact } = result!;
  assertEquals(message.id, 'SM_TEXT_001');
  assertEquals(message.type, 'text');
  assertEquals(message.text?.body, 'hola mundo');
  assertEquals(message.image, undefined);
  assertEquals(message.audio, undefined);
  assertEquals(message.document, undefined);
  assertEquals(contact.wa_id, '5491166660428');
});

// ---------------------------------------------------------------------------
// parseTwilioForm — From prefix stripping
// ---------------------------------------------------------------------------

Deno.test('parseTwilioForm: strips whatsapp: prefix from From', () => {
  const params: Record<string, string> = {
    MessageSid: 'SM_PREFIX_001',
    From: 'whatsapp:+5491166660428',
    Body: 'test',
    NumMedia: '0',
  };

  const result = parseTwilioForm(params);
  assertNotEquals(result, null);
  assertEquals(result!.message.from, '5491166660428');
  assertEquals(result!.contact.wa_id, '5491166660428');
});

// ---------------------------------------------------------------------------
// parseTwilioForm — image media
// ---------------------------------------------------------------------------

Deno.test('parseTwilioForm: parses an image message correctly', () => {
  const params: Record<string, string> = {
    MessageSid: 'SM_IMG_001',
    From: 'whatsapp:+5491166660428',
    Body: '',
    NumMedia: '1',
    MediaUrl0: 'https://api.twilio.com/2010-04-01/Accounts/AC123/Messages/SM_IMG_001/Media/ME123',
    MediaContentType0: 'image/jpeg',
  };

  const result = parseTwilioForm(params);
  assertNotEquals(result, null);

  const { message } = result!;
  assertEquals(message.type, 'image');
  assertEquals(
    message.image?.id,
    'https://api.twilio.com/2010-04-01/Accounts/AC123/Messages/SM_IMG_001/Media/ME123',
  );
  assertEquals(message.image?.mime_type, 'image/jpeg');
  assertEquals(message.audio, undefined);
  assertEquals(message.document, undefined);
});

// ---------------------------------------------------------------------------
// parseTwilioForm — audio media
// ---------------------------------------------------------------------------

Deno.test('parseTwilioForm: parses an audio message correctly', () => {
  const params: Record<string, string> = {
    MessageSid: 'SM_AUDIO_001',
    From: 'whatsapp:+5491166660428',
    Body: '',
    NumMedia: '1',
    MediaUrl0: 'https://api.twilio.com/2010-04-01/Accounts/AC123/Messages/SM_AUDIO_001/Media/ME456',
    MediaContentType0: 'audio/ogg',
  };

  const result = parseTwilioForm(params);
  assertNotEquals(result, null);

  const { message } = result!;
  assertEquals(message.type, 'audio');
  assertEquals(
    message.audio?.id,
    'https://api.twilio.com/2010-04-01/Accounts/AC123/Messages/SM_AUDIO_001/Media/ME456',
  );
  assertEquals(message.audio?.mime_type, 'audio/ogg');
  assertEquals(message.image, undefined);
  assertEquals(message.document, undefined);
});

// ---------------------------------------------------------------------------
// parseTwilioForm — PDF / document media
// ---------------------------------------------------------------------------

Deno.test('parseTwilioForm: parses a PDF as document type', () => {
  const params: Record<string, string> = {
    MessageSid: 'SM_PDF_001',
    From: 'whatsapp:+5491166660428',
    Body: '',
    NumMedia: '1',
    MediaUrl0: 'https://api.twilio.com/2010-04-01/Accounts/AC123/Messages/SM_PDF_001/Media/ME789',
    MediaContentType0: 'application/pdf',
  };

  const result = parseTwilioForm(params);
  assertNotEquals(result, null);

  const { message } = result!;
  assertEquals(message.type, 'document');
  assertEquals(
    message.document?.id,
    'https://api.twilio.com/2010-04-01/Accounts/AC123/Messages/SM_PDF_001/Media/ME789',
  );
  assertEquals(message.document?.mime_type, 'application/pdf');
  assertEquals(message.image, undefined);
  assertEquals(message.audio, undefined);
});

// ---------------------------------------------------------------------------
// parseTwilioForm — missing required fields
// ---------------------------------------------------------------------------

Deno.test('parseTwilioForm: returns null when MessageSid is missing', () => {
  const params: Record<string, string> = {
    From: 'whatsapp:+5491166660428',
    Body: 'hola',
    NumMedia: '0',
  };

  const result = parseTwilioForm(params);
  assertEquals(result, null);
});

Deno.test('parseTwilioForm: returns null when From is missing', () => {
  const params: Record<string, string> = {
    MessageSid: 'SM_NO_FROM_001',
    Body: 'hola',
    NumMedia: '0',
  };

  const result = parseTwilioForm(params);
  assertEquals(result, null);
});
