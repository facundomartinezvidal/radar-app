/**
 * dispatch.ts
 * Core message handler for the whatsapp-webhook edge function.
 *
 * `handleMessage` is the single entry point for every inbound Twilio message.
 * Messages are awaited inline before the TwiML ack is returned so the Supabase
 * isolate does not tear down mid-flight (D3 in design.md).
 *
 * Extension points are clearly marked with TODO comments so later tasks
 * can slot in link-code redemption (HU-26) and intent routing (HU-27/28/29)
 * without restructuring this file.
 */

import { fetchMediaBytes, sendText } from './twilio.ts';
import {
  clearPending,
  countRecentInbound,
  getConversation,
  markProcessed,
  recordInbound,
  redeemLinkCode,
  resolveUser,
  unlinkUser,
} from './db.ts';
import { classifyIntent, LOW_CONFIDENCE_THRESHOLD } from './classify.ts';
import { handleCapture, handleConfirm, handleMediaCapture } from './capture.ts';
import { transcribeAudio } from './transcribe.ts';
import { handleQuery } from './queries.ts';
import { handleRecommendation } from './recommendations.ts';
import { handleChat } from './chat.ts';

// ---------------------------------------------------------------------------
// Rate-limit configuration
// ---------------------------------------------------------------------------

/**
 * Maximum number of inbound messages accepted from a single number within
 * RATE_LIMIT_WINDOW_SECONDS before the bot throttles the sender.
 *
 * Chosen conservatively to allow quick back-and-forth (question + clarification
 * + confirm ≈ 3–4 messages) without burning Groq/Graph API quota on floods.
 */
const RATE_LIMIT_MAX_PER_WINDOW = 8;

/** Window length in seconds for the per-number rate-limit check. */
const RATE_LIMIT_WINDOW_SECONDS = 60;

// ---------------------------------------------------------------------------
// Supported message types
// ---------------------------------------------------------------------------

/**
 * Message types that the bot can meaningfully handle.
 *
 * Meta Cloud API may deliver other types (sticker, location, contacts,
 * reaction, button, order, unsupported, …).  Any type not in this set is
 * politely rejected to avoid crashing on unexpected shapes.
 */
const SUPPORTED_TYPES = new Set(['text', 'audio', 'image', 'document']);

/**
 * Returns true when the message type is one the bot can process.
 *
 * Exported for Deno unit tests — pure, no side effects.
 */
export function isSupportedType(type: string): boolean {
  return SUPPORTED_TYPES.has(type);
}

// ---------------------------------------------------------------------------
// Types — Meta Cloud API message shape (subset we care about)
// ---------------------------------------------------------------------------

export interface WaContact {
  /** E.164 number WITHOUT leading '+' (wa_id, digits only — matches Twilio's From after stripping whatsapp: and +) */
  wa_id: string;
  profile?: { name?: string };
}

export interface WaMessage {
  id: string;
  from: string;
  type: string;
  timestamp: string;
  text?: { body: string };
  image?: { id: string; mime_type: string; caption?: string };
  audio?: { id: string; mime_type: string };
  document?: { id: string; mime_type: string; filename?: string };
}

// ---------------------------------------------------------------------------
// E.164 normalisation
// ---------------------------------------------------------------------------

/**
 * Normalises a `wa_id` (digits only, no '+') to E.164 ('+' + digits).
 *
 * Both Meta and Twilio provide digits without a leading '+'.  Argentina numbers
 * (549...) and international numbers both follow this pattern.
 */
function toE164(waId: string): string {
  const digits = waId.replace(/\D/g, '');
  return `+${digits}`;
}

// ---------------------------------------------------------------------------
// Link-code detection
// ---------------------------------------------------------------------------

/**
 * Returns true when `s` (after uppercasing) looks like a 6-char link code.
 *
 * The code alphabet is base32 minus ambiguous glyphs 0/O/1/I/L:
 *   A-H J-K M-N P-Z 2-9  (27 chars × 6 positions)
 *
 * Character class breakdown (all uppercase after toUpperCase()):
 *   A-H  — skips I
 *   J-K  — skips L
 *   M-N  — skips nothing (O excluded separately)
 *   P-Z  — skips nothing (O is before P)
 *   2-9  — skips 0 and 1
 *
 * Exported so it can be unit-tested independently of the DB layer.
 */
export function looksLikeLinkCode(s: string): boolean {
  return /^[A-HJ-KM-NP-Z2-9]{6}$/.test(s.toUpperCase());
}

// ---------------------------------------------------------------------------
// Reply helpers — messages sent to unlinked / linked users
// ---------------------------------------------------------------------------

const UNLINKED_PROMPT =
  'Hola 👋 Para usar el bot de RADAR, vinculá tu número desde la app: Perfil → WhatsApp.';

/**
 * Help message sent for 'help', 'unknown', and low-confidence intents.
 * Listed capabilities mirror the three solution pillars from the product spec.
 */
const HELP_MESSAGE =
  '¡Hola! Soy el bot de RADAR 🤖\n\nPodés pedirme:\n' +
  '• *Registrar gastos e ingresos* — "gasté 5000 en el súper" o enviá una foto/PDF\n' +
  '• *Consultar tus movimientos* — "¿cuánto gasté este mes?" o "¿en qué gasté esta semana?"\n' +
  '• *Ver tus últimos movimientos* — "mostrá mis últimos 5 gastos" o "cuál fue mi último ingreso"\n' +
  '• *Recomendaciones* — "dame un consejo de gastos" o "¿cómo vengo este mes?"\n' +
  '• *Hablar de tus finanzas* — "¿en qué se me va la plata?" o "¿gasto mucho en comida?"\n' +
  '• *Desvincular* — "desvinculame"\n\n' +
  'También podés hablar por audio 🎙️';

/** Outcome-specific replies for link-code redemption (HU-26). */
const LINK_CODE_REPLIES: Record<string, string> = {
  linked:
    '✅ Listo, vinculé este número a tu cuenta RADAR. Ya podés registrar gastos y consultar tus movimientos.',
  expired: 'Ese código venció. Generá uno nuevo en la app (Perfil → WhatsApp).',
  reused: 'Ese código ya no es válido. Generá uno nuevo en la app (Perfil → WhatsApp).',
  invalid:
    'No reconozco ese código. Copialo exactamente como aparece en la app (Perfil → WhatsApp).',
  already_linked:
    'Este número ya está vinculado a otra cuenta. Desvinculalo primero para usarlo en otra.',
};

// ---------------------------------------------------------------------------
// handleMessage — main async handler
// ---------------------------------------------------------------------------

/**
 * Processes a single inbound WhatsApp message end-to-end.
 *
 * Steps:
 *   0. Guard: ignore messages without a usable individual sender wa_id.
 *   1. Normalise the sender to E.164.
 *   2. `recordInbound` — idempotency guard; exit on duplicate.
 *   3. Per-number rate limit — throttle bursts above RATE_LIMIT_MAX_PER_WINDOW.
 *   4. Unsupported type guard — reject stickers, locations, reactions, etc.
 *   5. `resolveUser` — identify RADAR user from the E.164 number.
 *   6. Branch on linked / unlinked:
 *      a. Unlinked: check for a link code then send linking instructions.
 *      b. Linked: classify intent → route to capture/query/recommendation/unlink/help.
 *   7. `markProcessed` — update the message row status.
 *
 * All errors are caught and logged here so a single broken message never
 * kills the processing of subsequent messages in the same batch.
 * The outer try/catch guarantees no unhandled rejection escapes into
 * EdgeRuntime.waitUntil — any unexpected error marks the message 'failed'
 * and optionally sends a generic error reply if no reply has been sent yet.
 *
 * @param message  The raw Cloud API message object.
 * @param contact  The Cloud API contact object for the sender.
 */
export async function handleMessage(message: WaMessage, contact: WaContact): Promise<void> {
  // Step 0: defensive group/non-individual guard.
  // Meta Cloud API only delivers individual-chat messages to the messages webhook,
  // but guard against any malformed or unexpected payload where wa_id is missing
  // or clearly non-user (empty string). Groups are not delivered via this webhook
  // (Meta non-goal confirmed), but a missing wa_id would produce an invalid E.164.
  if (!contact.wa_id || !/^\d+$/.test(contact.wa_id)) {
    console.warn('[dispatch] ignored: missing or non-numeric wa_id', contact.wa_id);
    return;
  }

  // Step 1: normalise sender to E.164
  const waNumber = toE164(contact.wa_id);
  const providerMessageId = message.id;

  // Track whether we have already replied in this invocation so the error
  // catch-all can decide whether to send the generic error message.
  let replied = false;

  try {
    // Step 2: idempotency — skip if we've already processed this message id
    const isNew = await recordInbound({
      providerMessageId,
      waNumber,
      body: message.text?.body ?? null,
      numMedia: ['image', 'audio', 'document'].includes(message.type) ? 1 : 0,
    });

    if (!isNew) {
      console.info('[dispatch] duplicate message ignored:', providerMessageId);
      return;
    }

    // Step 3: per-number rate limit.
    // Count inbound rows for this number in the last window; if the sender is
    // flooding, reply once with a throttle message and stop processing.
    // The current message is already recorded (step 2) so the count includes it.
    const recentCount = await countRecentInbound(waNumber, RATE_LIMIT_WINDOW_SECONDS);
    if (recentCount > RATE_LIMIT_MAX_PER_WINDOW) {
      console.warn(
        '[dispatch] rate limit exceeded for',
        waNumber,
        `(${recentCount} messages in ${RATE_LIMIT_WINDOW_SECONDS}s)`,
      );
      await sendText(waNumber, 'Esperá un momento 🙏, estás enviando mensajes muy rápido.');
      replied = true;
      await markProcessed(providerMessageId, 'failed', 'throttled');
      return;
    }

    // Step 4: unsupported message type guard.
    // Stickers, locations, contacts, reactions, buttons, etc. would fall through
    // to the text path with an empty effectiveText, or crash on unexpected shapes.
    // Reply politely and mark processed so the message is not retried.
    if (!isSupportedType(message.type)) {
      console.info('[dispatch] unsupported message type:', message.type, 'from', waNumber);
      await sendText(waNumber, 'Por ahora puedo con texto, audios, fotos y PDFs.');
      replied = true;
      await markProcessed(providerMessageId, 'processed', 'unsupported_type');
      return;
    }

    // Step 5: resolve RADAR user from E.164 number
    const userId = await resolveUser(waNumber);

    if (userId === null) {
      // ── UNLINKED number ─────────────────────────────────────────────────

      const body = message.text?.body?.trim() ?? '';

      if (looksLikeLinkCode(body)) {
        // Attempt to redeem the code: uppercase before passing to the RPC so
        // the DB comparison is case-insensitive at the call site.
        const result = await redeemLinkCode(body.toUpperCase(), waNumber);
        const reply = LINK_CODE_REPLIES[result.status];
        await sendText(waNumber, reply);
        replied = true;
        await markProcessed(providerMessageId, 'processed', 'link');
        return;
      }

      await sendText(waNumber, UNLINKED_PROMPT);
      replied = true;
      await markProcessed(providerMessageId, 'processed');
      return;
    }

    // ── LINKED number (user found) ─────────────────────────────────────────

    // Retrieve the conversation state for this user.
    // We load it before classification so the pending_action check doesn't
    // require an extra round-trip after the Groq call.
    const conversation = await getConversation(userId);

    // ── Media-type branching ─────────────────────────────────────────────────
    // Image and document messages go directly to handleMediaCapture (no intent
    // classification needed — the media itself determines the flow).
    // Audio messages are transcribed first, then the transcript feeds the text
    // classification pipeline below.
    // Text messages fall through to the existing classifyIntent path.

    if (message.type === 'image' || message.type === 'document') {
      await handleMediaCapture(userId, waNumber, message);
      replied = true;
      await markProcessed(providerMessageId, 'processed', 'media_capture');
      return;
    }

    // Audio path: transcribe → use transcript as text for classifyIntent
    let effectiveText = message.text?.body?.trim() ?? '';

    if (message.type === 'audio' && message.audio?.id) {
      try {
        const { bytes, mimeType } = await fetchMediaBytes(message.audio.id);
        const transcript = await transcribeAudio(bytes, mimeType);
        const trimmed = transcript.trim();
        if (!trimmed) {
          // Empty transcript — cannot proceed
          await sendText(
            waNumber,
            'No pude entender el audio, escribime el gasto o mandá una foto.',
          );
          replied = true;
          await markProcessed(providerMessageId, 'failed');
          return;
        }
        effectiveText = trimmed;
      } catch (audioErr) {
        console.error('[dispatch] audio transcription failed:', audioErr);
        await sendText(waNumber, 'No pude entender el audio, escribime el gasto o mandá una foto.');
        replied = true;
        await markProcessed(providerMessageId, 'failed');
        return;
      }
    }

    // Classify intent from the effective text (original text or audio transcript).
    const text = effectiveText;
    const classification = await classifyIntent(text);

    // ── Pending-action state machine ────────────────────────────────────────
    // When a pending_action exists, 'confirm' and 'cancel' short-circuit the
    // normal intent switch so the user can complete or discard the flow.
    const hasPending = conversation !== null && conversation.pendingAction !== null;

    if (hasPending && classification.intent === 'confirm') {
      await handleConfirm(userId, waNumber, conversation!);
      replied = true;
      await markProcessed(providerMessageId, 'processed', 'confirm');
      return;
    }

    if (hasPending && classification.intent === 'cancel') {
      await clearPending(userId);
      await sendText(waNumber, 'Listo, lo cancelé.');
      replied = true;
      await markProcessed(providerMessageId, 'processed', 'cancel');
      return;
    }

    // ── Low-confidence guard ─────────────────────────────────────────────────
    // If the model is not confident enough about a write intent, fall back to
    // help so we don't create a pending transaction the user didn't ask for.
    const isLowConfidence = classification.confidence < LOW_CONFIDENCE_THRESHOLD;

    // ── Intent router ────────────────────────────────────────────────────────
    switch (classification.intent) {
      case 'capture_expense':
      case 'capture_income':
        if (isLowConfidence) {
          await sendText(waNumber, HELP_MESSAGE);
          replied = true;
          await markProcessed(providerMessageId, 'processed', 'help');
        } else {
          await handleCapture(userId, waNumber, text, classification);
          replied = true;
          await markProcessed(providerMessageId, 'processed', classification.intent);
        }
        break;

      case 'query':
        if (isLowConfidence) {
          await sendText(waNumber, HELP_MESSAGE);
          replied = true;
          await markProcessed(providerMessageId, 'processed', 'help');
        } else {
          await handleQuery(userId, waNumber, classification);
          replied = true;
          await markProcessed(providerMessageId, 'processed', 'query');
        }
        break;

      case 'recommendation':
        if (isLowConfidence) {
          await sendText(waNumber, HELP_MESSAGE);
          replied = true;
          await markProcessed(providerMessageId, 'processed', 'help');
        } else {
          await handleRecommendation(userId, waNumber, classification);
          replied = true;
          await markProcessed(providerMessageId, 'processed', 'recommendation');
        }
        break;

      case 'chat':
        if (isLowConfidence) {
          await sendText(waNumber, HELP_MESSAGE);
          replied = true;
          await markProcessed(providerMessageId, 'processed', 'help');
        } else {
          await handleChat(userId, waNumber, text, classification);
          replied = true;
          await markProcessed(providerMessageId, 'processed', 'chat');
        }
        break;

      case 'unlink':
        await unlinkUser(userId);
        await sendText(
          waNumber,
          'Desvinculé este número. Podés volver a vincularlo desde la app cuando quieras.',
        );
        replied = true;
        await markProcessed(providerMessageId, 'processed', 'unlink');
        break;

      case 'help':
      case 'unknown':
      default:
        await sendText(waNumber, HELP_MESSAGE);
        replied = true;
        await markProcessed(providerMessageId, 'processed', 'help');
        break;
    }
  } catch (err) {
    console.error('[dispatch] handleMessage error for', providerMessageId, err);
    // Best-effort: mark the message as failed so monitoring can detect it.
    // This catch-all ensures no unhandled rejection escapes into
    // EdgeRuntime.waitUntil, which would silently swallow errors.
    try {
      await markProcessed(providerMessageId, 'failed');
    } catch (markErr) {
      console.error('[dispatch] markProcessed(failed) also failed:', markErr);
    }
    // Send a generic error reply only if we haven't already replied in this
    // invocation — avoids double-messaging when a downstream handler replied
    // and then failed to markProcessed.
    if (!replied) {
      try {
        await sendText(waNumber, 'Tuve un problema procesando tu mensaje, probá de nuevo.');
      } catch (replyErr) {
        console.error('[dispatch] error reply also failed:', replyErr);
      }
    }
  }
}
