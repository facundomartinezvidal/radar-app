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
import { clearPending, getConversation, markProcessed, recordInbound, resolveUser } from './db.ts';

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
// Reply helpers — messages sent to unlinked / linked users
// ---------------------------------------------------------------------------

const UNLINKED_PROMPT =
  'Hola 👋 Para usar el bot de RADAR, vinculá tu número desde la app: Perfil → WhatsApp.';

const LINKED_PLACEHOLDER =
  'Pronto vas a poder registrar gastos, consultar movimientos y pedir recomendaciones.';

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

      // TODO(link-flow): HU-26 — if `body` matches a link-code pattern
      // (e.g. /^[A-Z2-7]{6}$/i), call `redeem_link_code(body, waNumber)` here
      // and reply with the outcome-specific message.  The branch below is
      // intentionally left as a stub so Task 6.1 can fill it in cleanly:
      //
      //   if (isLinkCode(body)) {
      //     const outcome = await redeemLinkCode(body, waNumber);
      //     await sendText(waNumber, LINK_CODE_REPLIES[outcome]);
      //     await markProcessed(providerMessageId, 'processed', 'link_code');
      //     return;
      //   }

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
