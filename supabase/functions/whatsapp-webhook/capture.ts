/**
 * capture.ts
 * Handles expense/income capture intents for the WhatsApp bot.
 *
 * Exports:
 *   handleCapture  — called when intent is 'capture_expense' or 'capture_income'
 *   handleConfirm  — called when a pending_action exists and intent is 'confirm'
 *
 * STUB IMPLEMENTATION — to be completed by group 8.
 * // TODO(group-8): implement full capture pipeline:
 *   - text → entities already classified, build pending transaction row
 *   - audio → fetchMediaBytes + Groq Whisper transcription + text pipeline
 *   - image/document → fetchMediaBytes + call extract-document edge fn
 *   - setPendingAction to store the pending row with 15-min expiry
 *   - on confirm: call import_transactions_for RPC + clearPending + reply count
 *   - validation: reject zero/negative amounts, default currency to ARS, clarify missing amount
 */

import { sendText } from './graph.ts';
import type { Classification } from './classify.ts';
import type { ConversationRow } from './db.ts';

/**
 * Initiates a capture flow from a natural-language message.
 *
 * Groups 8 will replace this body with the real pipeline:
 *   text → classify entities → ask for missing amount → setPendingAction
 *   audio → transcribe → text pipeline
 *   image/pdf → extract-document → setPendingAction
 *
 * @param userId         RADAR user UUID (caller already verified linked).
 * @param waNumber       Sender E.164 number (for replies).
 * @param text           Original message text (used for re-classification context).
 * @param classification Pre-classified intent + entities from classify.ts.
 */
export async function handleCapture(
  userId: string,
  waNumber: string,
  text: string,
  classification: Classification,
): Promise<void> {
  // TODO(group-8): implement full text/audio/image/pdf capture pipeline
  console.info(
    '[capture] handleCapture stub — userId:',
    userId,
    'text:',
    text,
    'intent:',
    classification.intent,
  );
  await sendText(waNumber, 'Estoy procesando tu captura... (función en construcción)');
}

/**
 * Confirms a pending transaction stored in conversation state.
 *
 * Groups 8 will replace this body with the real confirmation logic:
 *   check expiry → call import_transactions_for RPC → clearPending → reply
 *
 * @param userId       RADAR user UUID.
 * @param waNumber     Sender E.164 number (for replies).
 * @param conversation Current conversation state including the pending_action.
 */
export async function handleConfirm(
  userId: string,
  waNumber: string,
  conversation: ConversationRow,
): Promise<void> {
  // TODO(group-8): check pendingAction expiry, call import_transactions_for RPC,
  // call clearPending, reply with inserted count
  console.info(
    '[capture] handleConfirm stub — userId:',
    userId,
    'pendingKind:',
    conversation.pendingKind,
  );
  await sendText(waNumber, 'Estoy confirmando tu operación... (función en construcción)');
}
