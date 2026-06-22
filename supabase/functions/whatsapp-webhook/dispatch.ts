/**
 * dispatch.ts
 * Core message handler for the whatsapp-webhook edge function.
 *
 * `handleMessage` is the single entry point for every inbound Cloud API message.
 * It is called via `EdgeRuntime.waitUntil(...)` so the webhook can ack Meta
 * immediately (D3 in design.md) while this function completes asynchronously.
 *
 * Extension points are clearly marked with TODO comments so later tasks
 * can slot in link-code redemption (HU-26) and intent routing (HU-27/28/29)
 * without restructuring this file.
 */

import { sendText } from './graph.ts';
import {
  clearPending,
  getConversation,
  markProcessed,
  recordInbound,
  redeemLinkCode,
  resolveUser,
  unlinkUser,
} from './db.ts';
import { classifyIntent, LOW_CONFIDENCE_THRESHOLD } from './classify.ts';
import { handleCapture, handleConfirm } from './capture.ts';
import { handleQuery } from './queries.ts';
import { handleRecommendation } from './recommendations.ts';

// ---------------------------------------------------------------------------
// Types — Meta Cloud API message shape (subset we care about)
// ---------------------------------------------------------------------------

export interface WaContact {
  /** E.164 number WITHOUT leading '+' as provided by Meta ("wa_id") */
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
 * Normalises a Meta `wa_id` (digits only, no '+') to E.164 ('+' + digits).
 *
 * Meta always provides digits without a leading '+'.  Argentina numbers
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
  '• *Recomendaciones* — "dame un consejo de gastos" o "¿cómo vengo este mes?"\n' +
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
 *   1. Normalise the sender to E.164.
 *   2. `recordInbound` — idempotency guard; exit on duplicate.
 *   3. `resolveUser` — identify RADAR user from the E.164 number.
 *   4. Branch on linked / unlinked:
 *      a. Unlinked: check for a link code then send linking instructions.
 *      b. Linked: classify intent → route to capture/query/recommendation/unlink/help.
 *   5. `markProcessed` — update the message row status.
 *
 * All errors are caught and logged here so a single broken message never
 * kills the processing of subsequent messages in the same batch.
 *
 * @param message  The raw Cloud API message object.
 * @param contact  The Cloud API contact object for the sender.
 */
export async function handleMessage(message: WaMessage, contact: WaContact): Promise<void> {
  // Step 1: normalise sender to E.164
  const waNumber = toE164(contact.wa_id);
  const providerMessageId = message.id;

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

    // Step 3: resolve RADAR user from E.164 number
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
        await markProcessed(providerMessageId, 'processed', 'link');
        return;
      }

      await sendText(waNumber, UNLINKED_PROMPT);
      await markProcessed(providerMessageId, 'processed');
      return;
    }

    // ── LINKED number (user found) ─────────────────────────────────────────

    // Retrieve the conversation state for this user.
    // We load it before classification so the pending_action check doesn't
    // require an extra round-trip after the Groq call.
    const conversation = await getConversation(userId);

    // Classify intent from the text body.
    // Media messages without a text body get an empty string; they will
    // produce 'unknown' intent which routes to the help message until group 8
    // implements audio/image/pdf capture.
    const text = message.text?.body?.trim() ?? '';
    const classification = await classifyIntent(text);

    // ── Pending-action state machine ────────────────────────────────────────
    // When a pending_action exists, 'confirm' and 'cancel' short-circuit the
    // normal intent switch so the user can complete or discard the flow.
    const hasPending = conversation !== null && conversation.pendingAction !== null;

    if (hasPending && classification.intent === 'confirm') {
      await handleConfirm(userId, waNumber, conversation!);
      await markProcessed(providerMessageId, 'processed', 'confirm');
      return;
    }

    if (hasPending && classification.intent === 'cancel') {
      await clearPending(userId);
      await sendText(waNumber, 'Listo, lo cancelé.');
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
          await markProcessed(providerMessageId, 'processed', 'help');
        } else {
          await handleCapture(userId, waNumber, text, classification);
          await markProcessed(providerMessageId, 'processed', classification.intent);
        }
        break;

      case 'query':
        if (isLowConfidence) {
          await sendText(waNumber, HELP_MESSAGE);
          await markProcessed(providerMessageId, 'processed', 'help');
        } else {
          await handleQuery(userId, waNumber, classification);
          await markProcessed(providerMessageId, 'processed', 'query');
        }
        break;

      case 'recommendation':
        if (isLowConfidence) {
          await sendText(waNumber, HELP_MESSAGE);
          await markProcessed(providerMessageId, 'processed', 'help');
        } else {
          await handleRecommendation(userId, waNumber, classification);
          await markProcessed(providerMessageId, 'processed', 'recommendation');
        }
        break;

      case 'unlink':
        await unlinkUser(userId);
        await sendText(
          waNumber,
          'Desvinculé este número. Podés volver a vincularlo desde la app cuando quieras.',
        );
        await markProcessed(providerMessageId, 'processed', 'unlink');
        break;

      case 'help':
      case 'unknown':
      default:
        await sendText(waNumber, HELP_MESSAGE);
        await markProcessed(providerMessageId, 'processed', 'help');
        break;
    }
  } catch (err) {
    console.error('[dispatch] handleMessage error for', providerMessageId, err);
    // Best-effort: mark the message as failed so monitoring can detect it
    try {
      await markProcessed(providerMessageId, 'failed');
    } catch (markErr) {
      console.error('[dispatch] markProcessed(failed) also failed:', markErr);
    }
  }
}
