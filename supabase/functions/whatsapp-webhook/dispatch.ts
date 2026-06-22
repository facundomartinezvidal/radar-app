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
} from './db.ts';

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

const LINKED_PLACEHOLDER =
  'Pronto vas a poder registrar gastos, consultar movimientos y pedir recomendaciones.';

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
 *      b. Linked: placeholder help reply (intent routing added later).
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

    // Retrieve the conversation state for this user (used by later tasks)
    // We load it now so future intent-routing tasks can access it without
    // an extra round-trip.
    const conversation = await getConversation(userId);

    // TODO(intent-routing): HU-27/28/29 — replace the placeholder reply below
    // with a call to the intent classifier module.  Rough shape:
    //
    //   const classification = await classifyIntent(message, conversation);
    //
    //   switch (classification.intent) {
    //     case 'capture':   await handleCapture(userId, waNumber, message, classification, providerMessageId); return;
    //     case 'query':     await handleQuery(userId, waNumber, classification); break;
    //     case 'recommend': await handleRecommend(userId, waNumber); break;
    //     case 'confirm':   await handleConfirm(userId, waNumber, conversation); break;
    //     case 'cancel':    await handleCancel(userId, waNumber, conversation); break;
    //     case 'unlink':    await handleUnlink(userId, waNumber); break;
    //     case 'help':
    //     default:          await sendText(waNumber, HELP_MESSAGE); break;
    //   }
    //
    // The `conversation` variable and `clearPending` / `setPendingAction` in
    // db.ts are already in place for the state machine.

    // Suppress unused-variable warning until intent routing is wired
    void conversation;

    await sendText(waNumber, LINKED_PLACEHOLDER);
    await markProcessed(providerMessageId, 'processed', 'placeholder');
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
