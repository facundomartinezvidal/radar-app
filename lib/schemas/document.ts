/**
 * Zod schema for the document OCR result returned by the `extract-document` edge function.
 *
 * Mirrors the edge function's `DocumentResult` shape. Defensive parsing:
 * - Nullable fields use `.nullable().catch(null)` so an off-spec payload still parses.
 * - Enums use `.catch(<default>)` to coerce unrecognised values to safe defaults.
 * - Arrays use `.catch([])` so a missing or malformed field yields an empty array.
 */
import { z } from 'zod';

import { ocrItemSchema } from '@/lib/schemas/ocr';
import { CURRENCIES } from '@/lib/schemas/expense';

export const documentTransactionSchema = z.object({
  /** Transaction amount. Null when not detected. */
  amount: z.number().nullable().catch(null),
  /** Currency detected. Only 'ARS' or 'USD'. Null when not detected. */
  currency: z.enum(CURRENCIES).nullable().catch(null),
  /**
   * Date of the transaction as an ISO 8601 date-only string (YYYY-MM-DD).
   * Null when not found or not a valid date.
   */
  occurredAt: z.string().nullable().catch(null),
  /** Merchant name or counterparty. Null when not found. */
  merchant: z.string().nullable().catch(null),
  /**
   * Direction of the transaction.
   * 'expense' = money sent (default); 'income' = money received.
   */
  direction: z.enum(['expense', 'income']).catch('expense'),
  /**
   * Suggested category name in Spanish (e.g. "Comida", "Transporte").
   * Null when not found.
   */
  categoryHint: z.string().nullable().catch(null),
  /**
   * Suggested new category name when no existing category fits.
   * Only present when categoryHint is null. Null otherwise.
   */
  suggestedNewCategory: z.string().nullable().catch(null),
  /**
   * One-sentence explanation (≤160 chars, Spanish rioplatense) of why the
   * suggested category deserves its own slot. Non-null only when
   * suggestedNewCategory is non-null. Null on parse failure.
   */
  suggestedNewCategoryReason: z.string().nullable().catch(null),
  /**
   * Line items detected in this transaction. Empty array when none found or on
   * parse failure (defensive via `.catch([])`).
   */
  items: z.array(ocrItemSchema).catch([]),
});

export type DocumentTransaction = z.infer<typeof documentTransactionSchema>;

export const documentOcrResultSchema = z.object({
  /**
   * Classified document type. Defaults to 'unknown' on parse failure or
   * unrecognised value.
   */
  documentType: z
    .enum(['receipt', 'transfer', 'card_statement', 'screenshot', 'unknown'])
    .catch('unknown'),
  /**
   * Model confidence in the extraction. Clamped to [0, 1].
   * Defaults to 0 on parse failure.
   */
  confidence: z.number().min(0).max(1).catch(0),
  /**
   * True when the source PDF had more than 3 pages and was truncated.
   * Defaults to false on parse failure.
   */
  truncated: z.boolean().catch(false),
  /**
   * Extracted transactions. Empty array when none found or on parse failure.
   */
  transactions: z.array(documentTransactionSchema).catch([]),
});

export type DocumentOcrResult = z.infer<typeof documentOcrResultSchema>;
export type DocumentType = DocumentOcrResult['documentType'];
