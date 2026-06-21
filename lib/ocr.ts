/**
 * Client-side OCR helpers.
 *
 * - `normalizeName`          — strips diacritics, lowercases, trims. Exported for tests.
 * - `matchCategory`          — finds the best-matching category ID from a hint string.
 * - `mapOcrToPrefill`        — maps an OcrResult to a partial expense-form pre-fill shape.
 * - `extractReceipt`         — calls the `extract-receipt` edge function via supabase-js.
 * - `mapDocumentToPrefill`   — maps a DocumentOcrResult to a DocumentPrefill shape.
 * - `partitionByDirection`   — splits DocumentTransactionPrefill[] by direction.
 * - `extractDocument`        — calls the `extract-document` edge function via supabase-js.
 */
import type { CategoryRow } from '@/lib/repositories/expenses';
import type { Currency, ExpenseItemInput } from '@/lib/schemas/expense';
import { type OcrItem, type OcrResult, ocrResultSchema } from '@/lib/schemas/ocr';
import {
  type DocumentOcrResult,
  type DocumentTransaction,
  type DocumentType,
  documentOcrResultSchema,
} from '@/lib/schemas/document';
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
  /** Suggested new-category name when OCR found no matching category. */
  suggestedCategoryName?: string | null;
  /** One-sentence reason why the suggested category deserves its own slot. */
  suggestedCategoryReason?: string | null;
  /** Receipt date as ISO 8601 (YYYY-MM-DD). Omitted when future or null. */
  occurred_at?: string;
  /** True when `confidence < 0.5` — the UI should warn the user to verify. */
  lowConfidence: boolean;
  /** Mapped line items from OCR. Omitted when none detected. */
  items?: ExpenseItemInput[];
}

// ---------------------------------------------------------------------------
// OCR item helpers
// ---------------------------------------------------------------------------

const MAX_ITEMS = 50;

/** Round a number to 2 decimal places. */
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Map OCR line items to `ExpenseItemInput` records ready for the expense form.
 *
 * Rules:
 * - Drop items whose name is empty/whitespace (edge fn already does this, but
 *   `ocrItemSchema` uses `.catch('')` so a garbage name coerces to '').
 * - `quantity`: use detected value when > 0; default to 1 otherwise.
 * - `unit_price`: pass through as-is (nullable).
 * - `line_total`: use detected value when non-null; else compute
 *   `round2(quantity * unitPrice)` when both are available; else 0.
 * - Cap result at 50 items.
 */
export function mapOcrItems(ocrItems: OcrItem[]): ExpenseItemInput[] {
  return ocrItems
    .filter((item) => item.name.trim().length > 0)
    .slice(0, MAX_ITEMS)
    .map((item) => {
      const quantity = item.quantity !== null && item.quantity > 0 ? item.quantity : 1;
      const unit_price = item.unitPrice;

      let line_total: number;
      if (item.lineTotal !== null) {
        line_total = item.lineTotal;
      } else if (unit_price !== null) {
        line_total = round2(quantity * unit_price);
      } else {
        line_total = 0;
      }

      return { name: item.name.trim(), quantity, unit_price, line_total };
    });
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

  if (prefill.category_id === null && result.suggestedNewCategory) {
    prefill.suggestedCategoryName = result.suggestedNewCategory;
    prefill.suggestedCategoryReason = result.suggestedNewCategoryReason ?? null;
  }

  if (result.occurredAt !== null) {
    const parsed = new Date(result.occurredAt);
    if (!Number.isNaN(parsed.getTime()) && parsed <= new Date()) {
      // The edge fn returns a date-only string (YYYY-MM-DD); the expense schema
      // requires a full ISO 8601 datetime with timezone offset. Normalise here
      // so the form's zod resolver never sees a bare date string.
      prefill.occurred_at = parsed.toISOString();
    }
  }

  const mappedItems = mapOcrItems(result.items);
  if (mappedItems.length > 0) {
    prefill.items = mappedItems;
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
export async function extractReceipt(
  imageBase64: string,
  mimeType: string,
  categoryNames: string[] = [],
): Promise<OcrResult> {
  const { data: invokeData, error: invokeError } = await supabase.functions.invoke(
    'extract-receipt',
    { body: { imageBase64, mimeType, categories: categoryNames } },
  );

  if (invokeError) {
    // supabase-js FunctionsFetchError indicates an offline / network-level
    // failure (device offline, function unreachable). Treat as retryable.
    const errorName = (invokeError as unknown as { name?: string }).name;
    if (
      errorName === 'FunctionsFetchError' ||
      (invokeError.constructor && invokeError.constructor.name === 'FunctionsFetchError')
    ) {
      throw new OcrError(
        'NETWORK_ERROR',
        'No se pudo analizar el ticket. Ingresá los datos manualmente.',
      );
    }

    // supabase-js FunctionsHttpError exposes the raw response body via
    // `.context` (when available). We try to read the edge function's
    // structured error from there.
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

// ---------------------------------------------------------------------------
// Document OCR — prefill interface
// ---------------------------------------------------------------------------

/**
 * Pre-fill shape for a single transaction extracted from a document.
 *
 * Mirrors `ReceiptPrefill` but adds `direction` and is scoped to one
 * transaction within a multi-transaction result.
 */
export interface DocumentTransactionPrefill {
  /** Whether money was sent (expense) or received (income). */
  direction: 'expense' | 'income';
  /** Detected transaction amount. Omitted when null or <= 0. */
  amount?: number;
  /** Detected currency. Omitted when null (form defaults to ARS). */
  currency?: Currency;
  /** Merchant name or counterparty used as the description. */
  description?: string | null;
  /** Matched category ID, or null when no match was found. */
  category_id?: string | null;
  /** Suggested new-category name when OCR found no matching category. */
  suggestedCategoryName?: string | null;
  /** One-sentence reason why the suggested category deserves its own slot. */
  suggestedCategoryReason?: string | null;
  /** Transaction date as ISO 8601 datetime. Omitted when future or null. */
  occurred_at?: string;
  /** True when overall document `confidence < 0.5` — the UI should warn the user. */
  lowConfidence: boolean;
  /** Mapped line items from OCR. Omitted when none detected. */
  items?: ExpenseItemInput[];
}

/**
 * Pre-fill shape for the full document result — wraps metadata + per-transaction data.
 */
export interface DocumentPrefill {
  documentType: DocumentType;
  truncated: boolean;
  confidence: number;
  transactions: DocumentTransactionPrefill[];
}

// ---------------------------------------------------------------------------
// Map DocumentOcrResult → DocumentPrefill
// ---------------------------------------------------------------------------

/**
 * Map a single `DocumentTransaction` to a `DocumentTransactionPrefill`.
 *
 * Mirrors `mapOcrToPrefill` for each transaction.
 */
function mapTransactionToPrefill(
  tx: DocumentTransaction,
  categories: CategoryRow[],
  lowConfidence: boolean,
): DocumentTransactionPrefill {
  const prefill: DocumentTransactionPrefill = {
    direction: tx.direction,
    lowConfidence,
  };

  if (tx.amount !== null && tx.amount > 0) {
    prefill.amount = tx.amount;
  }

  if (tx.currency !== null) {
    prefill.currency = tx.currency;
  }

  prefill.description = tx.merchant ?? null;

  prefill.category_id = matchCategory(tx.categoryHint, categories);

  if (prefill.category_id === null && tx.suggestedNewCategory) {
    prefill.suggestedCategoryName = tx.suggestedNewCategory;
    prefill.suggestedCategoryReason = tx.suggestedNewCategoryReason ?? null;
  }

  if (tx.occurredAt !== null) {
    const parsed = new Date(tx.occurredAt);
    if (!Number.isNaN(parsed.getTime()) && parsed <= new Date()) {
      prefill.occurred_at = parsed.toISOString();
    }
  }

  const mappedItems = mapOcrItems(tx.items);
  if (mappedItems.length > 0) {
    prefill.items = mappedItems;
  }

  return prefill;
}

/**
 * Map a validated `DocumentOcrResult` to a `DocumentPrefill`.
 *
 * - `lowConfidence` is derived from `result.confidence < 0.5` and applied to
 *   every transaction.
 * - Each transaction is mapped with the same rules as `mapOcrToPrefill`.
 */
export function mapDocumentToPrefill(
  result: DocumentOcrResult,
  categories: CategoryRow[],
): DocumentPrefill {
  const lowConfidence = result.confidence < 0.5;

  return {
    documentType: result.documentType,
    truncated: result.truncated,
    confidence: result.confidence,
    transactions: result.transactions.map((tx) =>
      mapTransactionToPrefill(tx, categories, lowConfidence),
    ),
  };
}

// ---------------------------------------------------------------------------
// Partition by direction
// ---------------------------------------------------------------------------

/**
 * Split an array of `DocumentTransactionPrefill` into expenses and incomes.
 */
export function partitionByDirection(transactions: DocumentTransactionPrefill[]): {
  expenses: DocumentTransactionPrefill[];
  incomes: DocumentTransactionPrefill[];
} {
  const expenses: DocumentTransactionPrefill[] = [];
  const incomes: DocumentTransactionPrefill[] = [];

  for (const tx of transactions) {
    if (tx.direction === 'income') {
      incomes.push(tx);
    } else {
      expenses.push(tx);
    }
  }

  return { expenses, incomes };
}

// ---------------------------------------------------------------------------
// extractDocument edge function invocation
// ---------------------------------------------------------------------------

/**
 * Call the `extract-document` Supabase edge function and return a validated
 * `DocumentOcrResult`.
 *
 * The edge function wraps its success payload as `{ data: DocumentResult }`,
 * so the invoke `data` field is `{ data: <doc> }` — we unwrap one level before
 * parsing.
 *
 * @throws {OcrError} on network / HTTP / parse failures.
 */
export async function extractDocument(input: {
  imageBase64?: string;
  pdfBase64?: string;
  mimeType: string;
  categoryNames?: string[];
}): Promise<DocumentOcrResult> {
  const { imageBase64, pdfBase64, mimeType, categoryNames } = input;

  const { data: invokeData, error: invokeError } = await supabase.functions.invoke(
    'extract-document',
    {
      body: {
        imageBase64,
        pdfBase64,
        mimeType,
        categories: categoryNames ?? [],
      },
    },
  );

  if (invokeError) {
    // supabase-js FunctionsFetchError indicates an offline / network-level
    // failure (device offline, function unreachable). Treat as retryable.
    const errorName = (invokeError as unknown as { name?: string }).name;
    if (
      errorName === 'FunctionsFetchError' ||
      (invokeError.constructor && invokeError.constructor.name === 'FunctionsFetchError')
    ) {
      throw new OcrError(
        'NETWORK_ERROR',
        'No se pudo analizar el documento. Ingresá los datos manualmente.',
      );
    }

    // supabase-js FunctionsHttpError exposes the raw response body via
    // `.context` (when available). We try to read the edge function's
    // structured error from there.
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
      'No se pudo analizar el documento. Ingresá los datos manualmente.',
    );
  }

  // The edge fn wraps its response as { data: DocumentResult }
  const rawDoc = (invokeData as { data?: unknown } | null)?.data;

  return documentOcrResultSchema.parse(rawDoc);
}
