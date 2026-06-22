/**
 * capture.ts
 * Handles expense/income capture intents for the WhatsApp bot (HU-27).
 *
 * Exports (public, called by dispatch.ts):
 *   handleCapture      — text path: entities → pending row → confirm prompt
 *   handleConfirm      — confirm path: call import_transactions_for → clear
 *   handleMediaCapture — image/document path: fetch bytes → extract-document → pending
 *
 * Pure helpers (exported for unit tests in capture.test.ts):
 *   entitiesToRow      — ClassificationEntities + fallback text → ImportTransactionRow
 *   documentTxToRow    — DocumentTransaction + category index → ImportTransactionRow
 *   isMissingAmount    — predicate: amount field absent or non-positive
 *   isNonPositive      — predicate: amount present but ≤ 0
 */

import { fetchMediaBytes, sendText } from './twilio.ts';
import type { Classification, ClassificationEntities } from './classify.ts';
import {
  clearPending,
  serviceClient,
  setPendingAction,
  type ConversationRow,
  type PendingAction,
  type PendingActionKind,
} from './db.ts';
import type { WaMessage } from './dispatch.ts';

// ---------------------------------------------------------------------------
// Row shape — matches import_transactions_for p_rows element
// ---------------------------------------------------------------------------

export interface ImportTransactionRow {
  direction: 'expense' | 'income';
  amount: number;
  currency: 'ARS' | 'USD';
  category_id: string | null;
  description: string | null;
  occurred_at: string | null;
}

// ---------------------------------------------------------------------------
// DocumentTransaction shape returned by extract-document
// ---------------------------------------------------------------------------

interface DocumentTransaction {
  amount: number | null;
  currency: 'ARS' | 'USD' | null;
  occurredAt: string | null;
  merchant: string | null;
  direction: 'expense' | 'income';
  categoryHint: string | null;
  suggestedNewCategory: string | null;
  suggestedNewCategoryReason: string | null;
  items: unknown[];
}

interface DocumentResult {
  documentType: string;
  confidence: number;
  truncated: boolean;
  transactions: DocumentTransaction[];
}

// ---------------------------------------------------------------------------
// Category index (id → name lookup, used for category resolution)
// ---------------------------------------------------------------------------

export interface CategoryEntry {
  id: string;
  name: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Pending action expires in 30 minutes from now. */
const PENDING_TTL_MS = 30 * 60 * 1000;

/** OCR confidence below this value triggers a "not sure" warning. */
const LOW_OCR_CONFIDENCE = 0.5;

// ---------------------------------------------------------------------------
// Pure helper: isMissingAmount
//
// Returns true when amount is absent or not a usable number.
// Used to decide whether to ask a clarifying question instead of writing.
// ---------------------------------------------------------------------------

/** Returns true when amount is not present in entities (needs clarification). */
export function isMissingAmount(amount: number | undefined): boolean {
  return amount === undefined || amount === null;
}

// ---------------------------------------------------------------------------
// Pure helper: isNonPositive
//
// Returns true when amount is present but ≤ 0 (invalid, must be rejected).
// ---------------------------------------------------------------------------

/** Returns true when amount is present but zero or negative. */
export function isNonPositive(amount: number): boolean {
  return amount <= 0;
}

// ---------------------------------------------------------------------------
// Pure helper: entitiesToRow
//
// Maps a ClassificationEntities bag (from classifyIntent) to a single
// ImportTransactionRow.  Called for the text and audio capture paths.
//
// Rules:
//   - direction: capture_expense → 'expense'; capture_income → 'income';
//     entities.direction overrides when present.
//   - currency: default 'ARS' when absent from entities.
//   - description: entities.description || entities.merchant || fallbackText.
//   - occurred_at: entities.occurredAt (ISO date string) or null (RPC uses now()).
//   - amount: passed through — caller must validate before calling this.
//   - category_id: null here; resolved by the async caller via resolveCategoryId.
// ---------------------------------------------------------------------------

export function entitiesToRow(
  entities: ClassificationEntities,
  intentDirection: 'expense' | 'income',
  fallbackText: string,
): Omit<ImportTransactionRow, 'amount' | 'category_id'> & { amount: number } {
  const direction: 'expense' | 'income' = entities.direction ?? intentDirection;
  const currency: 'ARS' | 'USD' = entities.currency ?? 'ARS';
  const description =
    entities.description?.trim() ||
    entities.merchant?.trim() ||
    fallbackText.trim().slice(0, 200) ||
    null;
  const occurred_at = entities.occurredAt ?? null;

  return {
    direction,
    amount: entities.amount as number, // caller validates presence + positivity
    currency,
    description,
    occurred_at,
  };
}

// ---------------------------------------------------------------------------
// Pure helper: documentTxToRow
//
// Maps a DocumentTransaction (from extract-document) to an ImportTransactionRow.
// Resolves category_id from the category index using a case-insensitive
// exact-or-contains match against categoryHint.
//
// Rules:
//   - currency: default 'ARS' when null.
//   - description: merchant or null.
//   - occurred_at: occurredAt string or null.
//   - category_id: resolved from categoryIndex; null when no match.
// ---------------------------------------------------------------------------

export function documentTxToRow(
  tx: DocumentTransaction,
  categoryIndex: CategoryEntry[],
): ImportTransactionRow | null {
  // amount must be positive; skip null or non-positive rows
  if (tx.amount === null || tx.amount <= 0) {
    return null;
  }

  const direction: 'expense' | 'income' = tx.direction;
  const amount = tx.amount;
  const currency: 'ARS' | 'USD' = tx.currency ?? 'ARS';
  const description = tx.merchant?.trim() || null;
  const occurred_at = tx.occurredAt ?? null;
  const category_id = tx.categoryHint ? resolveCategoryId(tx.categoryHint, categoryIndex) : null;

  return { direction, amount, currency, category_id, description, occurred_at };
}

// ---------------------------------------------------------------------------
// Pure helper: resolveCategoryId
//
// Case-insensitive exact match first, then contains match.
// Returns null when no match found.
// ---------------------------------------------------------------------------

export function resolveCategoryId(hint: string, categories: CategoryEntry[]): string | null {
  const lower = hint.toLowerCase();

  // 1. Exact match
  const exact = categories.find((c) => c.name.toLowerCase() === lower);
  if (exact) return exact.id;

  // 2. Contains match
  const contains = categories.find(
    (c) => c.name.toLowerCase().includes(lower) || lower.includes(c.name.toLowerCase()),
  );
  if (contains) return contains.id;

  return null;
}

// ---------------------------------------------------------------------------
// Internal: load user categories
// ---------------------------------------------------------------------------

async function loadUserCategories(userId: string): Promise<CategoryEntry[]> {
  const db = serviceClient();
  const { data, error } = await db.from('categories').select('id, name').eq('user_id', userId);

  if (error) {
    console.error('[capture] loadUserCategories failed:', error.message);
    return [];
  }

  return (data ?? []) as CategoryEntry[];
}

// ---------------------------------------------------------------------------
// Internal: build expires_at ISO string (now + 30 min)
// ---------------------------------------------------------------------------

function buildExpiresAt(): string {
  return new Date(Date.now() + PENDING_TTL_MS).toISOString();
}

// ---------------------------------------------------------------------------
// Internal: format currency amount for display
// ---------------------------------------------------------------------------

function formatAmount(amount: number, currency: 'ARS' | 'USD'): string {
  // Tabular-style: 2 decimal places for USD, 0 for ARS whole numbers
  if (currency === 'USD') {
    return `USD ${amount.toFixed(2)}`;
  }
  const rounded = Math.round(amount);
  return `ARS ${rounded.toLocaleString('es-AR')}`;
}

// ---------------------------------------------------------------------------
// Internal: build confirm summary reply for a single row
// ---------------------------------------------------------------------------

function buildSingleConfirmText(row: ImportTransactionRow): string {
  const dirLabel = row.direction === 'expense' ? 'gasto' : 'ingreso';
  const amountStr = formatAmount(row.amount, row.currency);
  const descLine = row.description ? `\n  Descripción: ${row.description}` : '';
  return (
    `Registré un ${dirLabel}:\n  Monto: *${amountStr}*${descLine}\n\n` +
    `¿Confirmás? Respondé *sí* para guardar o *no* para cancelar.`
  );
}

// ---------------------------------------------------------------------------
// Internal: build confirm summary reply for multiple rows (card statement)
// ---------------------------------------------------------------------------

function buildMultiConfirmText(rows: ImportTransactionRow[], lowConfidence: boolean): string {
  const n = rows.length;
  const totalByKey: Record<string, number> = {};
  for (const row of rows) {
    const key = row.currency;
    totalByKey[key] = (totalByKey[key] ?? 0) + row.amount;
  }
  const totalsStr = Object.entries(totalByKey)
    .map(([cur, tot]) => formatAmount(tot, cur as 'ARS' | 'USD'))
    .join(' + ');

  const warning = lowConfidence
    ? 'No estoy seguro de estos datos, revisá antes de confirmar:\n\n'
    : '';

  return (
    `${warning}Detecté *${n} movimiento${n !== 1 ? 's' : ''}* por ${totalsStr}.\n` +
    `¿Los importo todos? Respondé *sí* para guardar o *no* para cancelar.`
  );
}

// ---------------------------------------------------------------------------
// handleCapture — TEXT path
// ---------------------------------------------------------------------------

/**
 * Processes a text (or audio-transcribed) capture intent.
 *
 * Validates amount → resolves category → stores pending → sends confirm prompt.
 * On missing amount: asks clarifying question and stores a clarify pending so
 * the conversation remains coherent (minimal: re-ask; no amount-merge).
 * On zero/negative amount: rejects immediately.
 */
export async function handleCapture(
  userId: string,
  waNumber: string,
  text: string,
  classification: Classification,
): Promise<void> {
  const intentDirection: 'expense' | 'income' =
    classification.intent === 'capture_income' ? 'income' : 'expense';
  const entities: ClassificationEntities = classification.entities;

  // -- Validation: missing amount
  if (isMissingAmount(entities.amount)) {
    const questionLabel = intentDirection === 'expense' ? 'gasto' : 'ingreso';
    await sendText(waNumber, `¿De cuánto fue el ${questionLabel}?`);
    // Store a clarify pending so we know the user is mid-capture
    // (minimal: just re-prompt; no entity-merge logic required by spec)
    await setPendingAction(
      userId,
      waNumber,
      { kind: 'expense', payload: { clarify: true, entities, intentDirection } },
      'expense' satisfies PendingActionKind,
      buildExpiresAt(),
    );
    return;
  }

  // -- Validation: zero or negative
  if (isNonPositive(entities.amount!)) {
    await sendText(waNumber, 'El monto tiene que ser mayor a cero.');
    return;
  }

  // -- Build row (partial — no category_id yet)
  const partial = entitiesToRow(entities, intentDirection, text);

  // -- Resolve category
  const categories = await loadUserCategories(userId);
  const category_id = entities.categoryHint
    ? resolveCategoryId(entities.categoryHint, categories)
    : null;

  const row: ImportTransactionRow = { ...partial, category_id };

  // -- Store pending action
  const pendingKind: PendingActionKind = intentDirection === 'income' ? 'income' : 'expense';
  const action: PendingAction = {
    kind: pendingKind,
    payload: { rows: [row] },
  };
  await setPendingAction(userId, waNumber, action, pendingKind, buildExpiresAt());

  // -- Reply with confirm prompt
  await sendText(waNumber, buildSingleConfirmText(row));
}

// ---------------------------------------------------------------------------
// handleConfirm — CONFIRM path
// ---------------------------------------------------------------------------

/**
 * Confirms a pending transaction stored in conversation state.
 *
 * Checks expiry → calls import_transactions_for RPC → clearPending → reply count.
 * On RPC error → friendly Spanish reply → clearPending.
 */
export async function handleConfirm(
  userId: string,
  waNumber: string,
  conversation: ConversationRow,
): Promise<void> {
  const pending = conversation.pendingAction;
  const expiresAt = conversation.expiresAt;

  // -- Check expiry
  if (!pending || (expiresAt && new Date(expiresAt) < new Date())) {
    await clearPending(userId);
    await sendText(waNumber, 'Esa operación expiró, mandámela de nuevo.');
    return;
  }

  // -- Extract rows from payload
  const payload = pending.payload as { rows?: ImportTransactionRow[] };
  const rows = payload.rows;

  if (!rows || rows.length === 0) {
    await clearPending(userId);
    await sendText(waNumber, 'No hay nada pendiente para confirmar.');
    return;
  }

  // -- Call import_transactions_for RPC
  const db = serviceClient();
  const { data, error } = await db.rpc('import_transactions_for', {
    p_user_id: userId,
    p_rows: rows,
  });

  // Always clear pending after one attempt (prevents double-write on retry)
  await clearPending(userId);

  if (error) {
    console.error('[capture] import_transactions_for failed:', error.message);
    // Surface friendly message; the error.message from the RPC will be in Spanish
    // (e.g. "Monto inválido en una de las filas") — pass it through.
    const friendlyMsg = error.message.includes('Monto')
      ? 'No pude registrar el movimiento: el monto no es válido.'
      : error.message.includes('Moneda')
        ? 'No pude registrar el movimiento: la moneda no es válida.'
        : error.message.includes('Direcci')
          ? 'No pude registrar el movimiento: la dirección no es válida.'
          : 'No pude registrar el movimiento. Intentalo de nuevo.';
    await sendText(waNumber, friendlyMsg);
    return;
  }

  const count = typeof data === 'number' ? data : rows.length;
  await sendText(waNumber, `✅ Listo, registré ${count} movimiento${count !== 1 ? 's' : ''}.`);
}

// ---------------------------------------------------------------------------
// handleMediaCapture — IMAGE / DOCUMENT path
// ---------------------------------------------------------------------------

/**
 * Processes an image or PDF media message.
 *
 * Fetches bytes → calls extract-document edge fn → maps transactions → pending.
 * On fetch or extract failure → replies and does NOT create a pending action.
 */
export async function handleMediaCapture(
  userId: string,
  waNumber: string,
  message: WaMessage,
): Promise<void> {
  const mediaId = message.image?.id ?? message.document?.id;
  if (!mediaId) {
    await sendText(waNumber, 'No pude descargar el archivo, reenvialo.');
    return;
  }

  // -- Fetch media bytes
  let mediaBytes: Uint8Array;
  let mediaMimeType: string;

  try {
    const result = await fetchMediaBytes(mediaId);
    mediaBytes = result.bytes;
    mediaMimeType = result.mimeType;
  } catch (fetchErr) {
    console.error('[capture] fetchMediaBytes failed:', fetchErr);
    await sendText(waNumber, 'No pude descargar el archivo, reenvialo.');
    return;
  }

  // -- Load user categories for the extract-document categories param
  const categories = await loadUserCategories(userId);
  const categoryNames = categories.map((c) => c.name);

  // -- Base64 encode
  const base64 = btoa(String.fromCharCode(...mediaBytes));

  // -- Determine image vs PDF
  const isPdf =
    mediaMimeType === 'application/pdf' || message.document?.mime_type === 'application/pdf';

  const requestBody = isPdf
    ? { pdfBase64: base64, mimeType: mediaMimeType, categories: categoryNames }
    : { imageBase64: base64, mimeType: mediaMimeType, categories: categoryNames };

  // -- Call extract-document edge function
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const internalSecret = Deno.env.get('WHATSAPP_INTERNAL_SECRET');

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('[capture] SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set');
    await sendText(waNumber, 'No pude procesar el documento, probá de nuevo.');
    return;
  }

  let extractResponse: Response;
  try {
    const extractHeaders: Record<string, string> = {
      Authorization: `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json',
    };
    if (internalSecret) {
      extractHeaders['x-whatsapp-internal-secret'] = internalSecret;
    }

    extractResponse = await fetch(`${supabaseUrl}/functions/v1/extract-document`, {
      method: 'POST',
      headers: extractHeaders,
      body: JSON.stringify(requestBody),
    });
  } catch (fetchErr) {
    console.error('[capture] extract-document fetch failed:', fetchErr);
    await sendText(waNumber, 'No pude procesar el documento, probá de nuevo.');
    return;
  }

  if (!extractResponse.ok) {
    const errText = await extractResponse.text().catch(() => '(unreadable)');
    console.error('[capture] extract-document non-2xx:', extractResponse.status, '—', errText);
    await sendText(waNumber, 'No pude procesar el documento, probá de nuevo.');
    return;
  }

  let extractData: { data?: DocumentResult };
  try {
    extractData = (await extractResponse.json()) as { data?: DocumentResult };
  } catch (parseErr) {
    console.error('[capture] extract-document JSON parse failed:', parseErr);
    await sendText(waNumber, 'No pude procesar el documento, probá de nuevo.');
    return;
  }

  const result = extractData.data;
  if (!result || !Array.isArray(result.transactions) || result.transactions.length === 0) {
    await sendText(
      waNumber,
      'No encontré transacciones en el documento. Ingresá los datos manualmente.',
    );
    return;
  }

  // -- Map transactions → rows (skip invalid amounts)
  const rows: ImportTransactionRow[] = result.transactions
    .map((tx) => documentTxToRow(tx, categories))
    .filter((r): r is ImportTransactionRow => r !== null);

  if (rows.length === 0) {
    await sendText(
      waNumber,
      'No pude leer los montos del documento. Ingresá los datos manualmente.',
    );
    return;
  }

  const lowConfidence = result.confidence < LOW_OCR_CONFIDENCE;

  // -- Store pending action
  const isMulti = rows.length > 1;
  const pendingKind: PendingActionKind = isMulti ? 'multi_import' : 'expense';
  const action: PendingAction = {
    kind: pendingKind,
    payload: { rows },
  };
  await setPendingAction(userId, waNumber, action, pendingKind, buildExpiresAt());

  // -- Build reply
  let replyText: string;
  if (isMulti) {
    replyText = buildMultiConfirmText(rows, lowConfidence);
  } else {
    const singleSummary = buildSingleConfirmText(rows[0]);
    if (lowConfidence) {
      replyText = `No estoy seguro de estos datos, revisá:\n\n${singleSummary}`;
    } else {
      replyText = singleSummary;
    }
  }

  await sendText(waNumber, replyText);
}
