/**
 * Zod schema for the OCR result returned by the `extract-receipt` edge function.
 *
 * Mirrors the edge function's `OcrResult` shape. Defensive parsing:
 * - Nullable fields use `.nullable().catch(null)` so an off-spec payload still parses.
 * - Confidence is clamped to [0, 1] via `.catch(0)`.
 */
import { z } from 'zod';

import { CURRENCIES } from '@/lib/schemas/expense';

/**
 * A single line item returned by the OCR edge function.
 * Fields are camelCase (edge function convention) and defensively coerced.
 */
export const ocrItemSchema = z.object({
  name: z.string().catch(''),
  quantity: z.number().nullable().catch(null),
  unitPrice: z.number().nullable().catch(null),
  lineTotal: z.number().nullable().catch(null),
});

export type OcrItem = z.infer<typeof ocrItemSchema>;

export const ocrResultSchema = z.object({
  /** Total amount extracted from the receipt. Null when not found. */
  amount: z.number().nullable().catch(null),
  /** Currency detected. Only 'ARS' or 'USD'. Null when not found. */
  currency: z.enum(CURRENCIES).nullable().catch(null),
  /**
   * Date of the receipt as an ISO 8601 date-only string (YYYY-MM-DD).
   * Null when not found or not a valid date.
   */
  occurredAt: z.string().nullable().catch(null),
  /** Merchant / business name. Null when not found. */
  merchant: z.string().nullable().catch(null),
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
   * Model confidence in the extraction. Clamped to [0, 1].
   * Defaults to 0 on parse failure.
   */
  confidence: z.number().min(0).max(1).catch(0),
  /**
   * Line items detected in the receipt. Empty array when none found or on
   * parse failure (defensive via `.catch([])`).
   */
  items: z.array(ocrItemSchema).catch([]),
});

export type OcrResult = z.infer<typeof ocrResultSchema>;
