/**
 * Client-side OCR helpers.
 *
 * - `normalizeName`     — strips diacritics, lowercases, trims. Exported for tests.
 * - `matchCategory`     — finds the best-matching category ID from a hint string.
 * - `mapOcrToPrefill`   — maps an OcrResult to a partial expense-form pre-fill shape.
 * - `extractReceipt`    — calls the `extract-receipt` edge function via supabase-js.
 */
import type { CategoryRow } from '@/lib/repositories/expenses';
import type { Currency } from '@/lib/schemas/expense';
import { type OcrResult, ocrResultSchema } from '@/lib/schemas/ocr';
import { supabase } from '@/lib/supabase';

// ---------------------------------------------------------------------------
// Error type
// ---------------------------------------------------------------------------

/** Error thrown by `extractReceipt` when the edge function returns non-2xx or
 *  when the supabase-js invocation itself fails.
 */
export class OcrError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'OcrError';
    this.code = code;
  }
}

// ---------------------------------------------------------------------------
// Public interface for the prefill shape
// ---------------------------------------------------------------------------

export interface ReceiptPrefill {
  /** Detected expense amount. Omitted when null or <= 0. */
  amount?: number;
  /** Detected currency. Omitted when null (form defaults to ARS). */
  currency?: Currency;
  /** Detected merchant name used as the expense description. */
  description?: string | null;
  /** Matched category ID, or null when no match was found. */
  category_id?: string | null;
  /** Receipt date as ISO 8601 (YYYY-MM-DD). Omitted when future or null. */
  occurred_at?: string;
  /** True when `confidence < 0.5` — the UI should warn the user to verify. */
  lowConfidence: boolean;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Normalize a string for fuzzy category matching:
 * lowercase, strip diacritics (NFD decomposition + remove combining marks), trim.
 *
 * Exported so unit tests can exercise it directly.
 */
export function normalizeName(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

/**
 * Find the category ID that best matches a hint string.
 *
 * Strategy (in order):
 * 1. Exact normalized match (hint === category.name after normalization).
 * 2. Substring match: normalized hint contains normalized name, OR normalized name contains normalized hint.
 *
 * Returns the matching category `id`, or `null` when no hint is given or no
 * match is found.
 */
export function matchCategory(hint: string | null, categories: CategoryRow[]): string | null {
  if (!hint || hint.trim() === '') return null;

  const normalizedHint = normalizeName(hint);

  // 1. Exact match
  const exact = categories.find((c) => normalizeName(c.name) === normalizedHint);
  if (exact) return exact.id;

  // 2. Substring match (either direction)
  const substring = categories.find((c) => {
    const normalizedName = normalizeName(c.name);
    return normalizedHint.includes(normalizedName) || normalizedName.includes(normalizedHint);
  });
  if (substring) return substring.id;

  return null;
}

// ---------------------------------------------------------------------------
// Map OcrResult → ReceiptPrefill
// ---------------------------------------------------------------------------

/**
 * Map a validated `OcrResult` to a partial expense-form pre-fill.
 *
 * Rules:
 * - `amount`: only set when > 0.
 * - `currency`: set only when detected (form defaults to ARS otherwise).
 * - `description`: set to `merchant` (may be null).
 * - `category_id`: resolved via `matchCategory`.
 * - `occurred_at`: set only when the edge fn returned a non-null, non-future date.
 *   The edge fn already strips future dates, but we defend again here.
 * - `lowConfidence`: true when `confidence < 0.5`.
 */
export function mapOcrToPrefill(result: OcrResult, categories: CategoryRow[]): ReceiptPrefill {
  const prefill: ReceiptPrefill = {
    lowConfidence: result.confidence < 0.5,
  };

  if (result.amount !== null && result.amount > 0) {
    prefill.amount = result.amount;
  }

  if (result.currency !== null) {
    prefill.currency = result.currency;
  }

  prefill.description = result.merchant ?? null;

  prefill.category_id = matchCategory(result.categoryHint, categories);

  if (result.occurredAt !== null) {
    const parsed = new Date(result.occurredAt);
    if (!Number.isNaN(parsed.getTime()) && parsed <= new Date()) {
      // The edge fn returns a date-only string (YYYY-MM-DD); the expense schema
      // requires a full ISO 8601 datetime with timezone offset. Normalise here
      // so the form's zod resolver never sees a bare date string.
      prefill.occurred_at = parsed.toISOString();
    }
  }

  return prefill;
}

// ---------------------------------------------------------------------------
// Edge function invocation
// ---------------------------------------------------------------------------

/**
 * Call the `extract-receipt` Supabase edge function and return a validated
 * `OcrResult`.
 *
 * The edge function wraps its success payload as `{ data: OcrResult }`, so the
 * invoke `data` field is `{ data: <ocr> }` — we unwrap one level before
 * parsing.
 *
 * @throws {OcrError} on network / HTTP / parse failures.
 */
export async function extractReceipt(imageBase64: string, mimeType: string): Promise<OcrResult> {
  const { data: invokeData, error: invokeError } = await supabase.functions.invoke(
    'extract-receipt',
    { body: { imageBase64, mimeType } },
  );

  if (invokeError) {
    // supabase-js FunctionsHttpError / FunctionsFetchError exposes the raw
    // response body via `.context` (when available). We try to read the edge
    // function's structured error from there.
    const context = (invokeError as unknown as { context?: unknown }).context;
    if (context && typeof context === 'object') {
      const edgeError = (context as { error?: { code?: string; message?: string } }).error;
      if (edgeError?.code && edgeError?.message) {
        throw new OcrError(edgeError.code, edgeError.message);
      }
    }

    // Generic fallback
    throw new OcrError(
      'OCR_ERROR',
      'No se pudo analizar el ticket. Ingresá los datos manualmente.',
    );
  }

  // The edge fn wraps its response as { data: OcrResult }
  const rawOcr = (invokeData as { data?: unknown } | null)?.data;

  return ocrResultSchema.parse(rawOcr);
}
