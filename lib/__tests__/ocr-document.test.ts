/**
 * Unit tests for the document-OCR additions to `lib/ocr.ts`.
 *
 * Covers:
 * - `mapDocumentToPrefill` — single expense, single income, card_statement (N transactions),
 *   category match + suggestion, items mapping, future-date stripping, lowConfidence threshold,
 *   truncated passthrough
 * - `partitionByDirection` — splits by direction
 * - `extractDocument` — success (mocked supabase.functions.invoke) + error mapping
 *   (FunctionsFetchError, PDF_CONVERT_ERROR via context.error, generic)
 */

import { OcrError, extractDocument, mapDocumentToPrefill, partitionByDirection } from '@/lib/ocr';
import type { DocumentOcrResult } from '@/lib/schemas/document';
import { supabase } from '@/lib/supabase';

// Mirror the mock used in ocr.test.ts
jest.mock('@/lib/supabase', () => ({
  supabase: {
    functions: {
      invoke: jest.fn(),
    },
  },
}));

const mockInvoke = supabase.functions.invoke as jest.Mock;

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const CATEGORIES = [
  {
    id: '1',
    name: 'Comida',
    color: '#FF0000',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    icon: 'utensils',
    slug: 'comida',
    sort_order: 1,
    user_id: null,
    kind: 'expense',
  },
  {
    id: '2',
    name: 'Transporte',
    color: '#0000FF',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    icon: 'car',
    slug: 'transporte',
    sort_order: 2,
    user_id: null,
    kind: 'expense',
  },
];

const PAST_DATE = '2024-06-15';

function makeDocResult(overrides: Partial<DocumentOcrResult> = {}): DocumentOcrResult {
  return {
    documentType: 'receipt',
    confidence: 0.9,
    truncated: false,
    transactions: [
      {
        amount: 1500,
        currency: 'ARS',
        occurredAt: PAST_DATE,
        merchant: 'Burger Palace',
        direction: 'expense',
        categoryHint: 'Comida',
        suggestedNewCategory: null,
        suggestedNewCategoryReason: null,
        items: [],
      },
    ],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// mapDocumentToPrefill — single expense transaction
// ---------------------------------------------------------------------------

describe('mapDocumentToPrefill — single expense', () => {
  it('maps a full single-expense result correctly', () => {
    const prefill = mapDocumentToPrefill(makeDocResult(), CATEGORIES);
    expect(prefill.documentType).toBe('receipt');
    expect(prefill.confidence).toBe(0.9);
    expect(prefill.truncated).toBe(false);
    expect(prefill.transactions).toHaveLength(1);

    const tx = prefill.transactions[0]!;
    expect(tx.direction).toBe('expense');
    expect(tx.amount).toBe(1500);
    expect(tx.currency).toBe('ARS');
    expect(tx.description).toBe('Burger Palace');
    expect(tx.category_id).toBe('1');
    expect(tx.occurred_at).toBe(new Date(PAST_DATE).toISOString());
    expect(tx.lowConfidence).toBe(false);
  });

  it('omits amount when amount is null', () => {
    const result = makeDocResult({
      transactions: [{ ...makeDocResult().transactions[0]!, amount: null }],
    });
    const prefill = mapDocumentToPrefill(result, CATEGORIES);
    expect(prefill.transactions[0]?.amount).toBeUndefined();
  });

  it('omits amount when amount is 0', () => {
    const result = makeDocResult({
      transactions: [{ ...makeDocResult().transactions[0]!, amount: 0 }],
    });
    const prefill = mapDocumentToPrefill(result, CATEGORIES);
    expect(prefill.transactions[0]?.amount).toBeUndefined();
  });

  it('omits amount when amount is negative', () => {
    const result = makeDocResult({
      transactions: [{ ...makeDocResult().transactions[0]!, amount: -100 }],
    });
    const prefill = mapDocumentToPrefill(result, CATEGORIES);
    expect(prefill.transactions[0]?.amount).toBeUndefined();
  });

  it('omits currency when currency is null', () => {
    const result = makeDocResult({
      transactions: [{ ...makeDocResult().transactions[0]!, currency: null }],
    });
    const prefill = mapDocumentToPrefill(result, CATEGORIES);
    expect(prefill.transactions[0]?.currency).toBeUndefined();
  });

  it('sets description to null when merchant is null', () => {
    const result = makeDocResult({
      transactions: [{ ...makeDocResult().transactions[0]!, merchant: null }],
    });
    const prefill = mapDocumentToPrefill(result, CATEGORIES);
    expect(prefill.transactions[0]?.description).toBeNull();
  });

  it('drops occurred_at when occurredAt is null', () => {
    const result = makeDocResult({
      transactions: [{ ...makeDocResult().transactions[0]!, occurredAt: null }],
    });
    const prefill = mapDocumentToPrefill(result, CATEGORIES);
    expect(prefill.transactions[0]?.occurred_at).toBeUndefined();
  });

  it('sets category_id to null when categoryHint has no match', () => {
    const result = makeDocResult({
      transactions: [{ ...makeDocResult().transactions[0]!, categoryHint: 'Tecnología' }],
    });
    const prefill = mapDocumentToPrefill(result, CATEGORIES);
    expect(prefill.transactions[0]?.category_id).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// mapDocumentToPrefill — single income transaction
// ---------------------------------------------------------------------------

describe('mapDocumentToPrefill — single income', () => {
  it('maps an income transaction carrying the income direction', () => {
    const result = makeDocResult({
      transactions: [
        {
          amount: 50000,
          currency: 'ARS',
          occurredAt: PAST_DATE,
          merchant: 'Cliente SA',
          direction: 'income',
          categoryHint: null,
          suggestedNewCategory: null,
          suggestedNewCategoryReason: null,
          items: [],
        },
      ],
    });
    const prefill = mapDocumentToPrefill(result, CATEGORIES);
    const tx = prefill.transactions[0]!;
    expect(tx.direction).toBe('income');
    expect(tx.amount).toBe(50000);
    expect(tx.description).toBe('Cliente SA');
  });
});

// ---------------------------------------------------------------------------
// mapDocumentToPrefill — card_statement (N transactions)
// ---------------------------------------------------------------------------

describe('mapDocumentToPrefill — card_statement with N transactions', () => {
  it('maps all transactions from a card_statement', () => {
    const result = makeDocResult({
      documentType: 'card_statement',
      confidence: 0.92,
      truncated: false,
      transactions: [
        {
          amount: 1000,
          currency: 'ARS',
          occurredAt: PAST_DATE,
          merchant: 'Tienda A',
          direction: 'expense',
          categoryHint: 'Comida',
          suggestedNewCategory: null,
          suggestedNewCategoryReason: null,
          items: [],
        },
        {
          amount: 5000,
          currency: 'ARS',
          occurredAt: PAST_DATE,
          merchant: 'Empresa X',
          direction: 'income',
          categoryHint: null,
          suggestedNewCategory: null,
          suggestedNewCategoryReason: null,
          items: [],
        },
        {
          amount: 2500,
          currency: 'USD',
          occurredAt: PAST_DATE,
          merchant: 'Tienda B',
          direction: 'expense',
          categoryHint: 'Transporte',
          suggestedNewCategory: null,
          suggestedNewCategoryReason: null,
          items: [],
        },
      ],
    });

    const prefill = mapDocumentToPrefill(result, CATEGORIES);
    expect(prefill.documentType).toBe('card_statement');
    expect(prefill.transactions).toHaveLength(3);
    expect(prefill.transactions[0]?.direction).toBe('expense');
    expect(prefill.transactions[0]?.category_id).toBe('1');
    expect(prefill.transactions[1]?.direction).toBe('income');
    expect(prefill.transactions[2]?.currency).toBe('USD');
    expect(prefill.transactions[2]?.category_id).toBe('2');
  });

  it('passes truncated: true through to DocumentPrefill', () => {
    const result = makeDocResult({
      documentType: 'card_statement',
      truncated: true,
      transactions: [],
    });
    const prefill = mapDocumentToPrefill(result, CATEGORIES);
    expect(prefill.truncated).toBe(true);
  });

  it('returns an empty transactions array when result has no transactions', () => {
    const result = makeDocResult({ transactions: [] });
    const prefill = mapDocumentToPrefill(result, CATEGORIES);
    expect(prefill.transactions).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// mapDocumentToPrefill — category match + suggestion
// ---------------------------------------------------------------------------

describe('mapDocumentToPrefill — category match + suggestion', () => {
  it('sets category_id when categoryHint matches a category', () => {
    const result = makeDocResult({
      transactions: [{ ...makeDocResult().transactions[0]!, categoryHint: 'Transporte' }],
    });
    const prefill = mapDocumentToPrefill(result, CATEGORIES);
    expect(prefill.transactions[0]?.category_id).toBe('2');
    expect(prefill.transactions[0]?.suggestedCategoryName).toBeUndefined();
  });

  it('sets suggestedCategoryName when no match AND suggestedNewCategory is present', () => {
    const result = makeDocResult({
      transactions: [
        {
          ...makeDocResult().transactions[0]!,
          categoryHint: 'Belleza',
          suggestedNewCategory: 'Peluquería',
          suggestedNewCategoryReason: 'Gasto en peluquería.',
        },
      ],
    });
    const prefill = mapDocumentToPrefill(result, CATEGORIES);
    expect(prefill.transactions[0]?.category_id).toBeNull();
    expect(prefill.transactions[0]?.suggestedCategoryName).toBe('Peluquería');
    expect(prefill.transactions[0]?.suggestedCategoryReason).toBe('Gasto en peluquería.');
  });

  it('does not set suggestedCategoryName when category matched', () => {
    const result = makeDocResult({
      transactions: [
        {
          ...makeDocResult().transactions[0]!,
          categoryHint: 'Comida',
          suggestedNewCategory: 'OtraCategoria',
        },
      ],
    });
    const prefill = mapDocumentToPrefill(result, CATEGORIES);
    expect(prefill.transactions[0]?.category_id).toBe('1');
    expect(prefill.transactions[0]?.suggestedCategoryName).toBeUndefined();
  });

  it('does not set suggestedCategoryName when suggestedNewCategory is null', () => {
    const result = makeDocResult({
      transactions: [
        {
          ...makeDocResult().transactions[0]!,
          categoryHint: 'NoExiste',
          suggestedNewCategory: null,
        },
      ],
    });
    const prefill = mapDocumentToPrefill(result, CATEGORIES);
    expect(prefill.transactions[0]?.category_id).toBeNull();
    expect(prefill.transactions[0]?.suggestedCategoryName).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// mapDocumentToPrefill — items mapping
// ---------------------------------------------------------------------------

describe('mapDocumentToPrefill — items mapping', () => {
  it('maps items into prefill.items when OCR returns non-empty items', () => {
    const result = makeDocResult({
      transactions: [
        {
          ...makeDocResult().transactions[0]!,
          items: [{ name: 'Empanada', quantity: 2, unitPrice: 300, lineTotal: 600 }],
        },
      ],
    });
    const prefill = mapDocumentToPrefill(result, CATEGORIES);
    expect(prefill.transactions[0]?.items).toHaveLength(1);
    expect(prefill.transactions[0]?.items?.[0]).toEqual({
      name: 'Empanada',
      quantity: 2,
      unit_price: 300,
      line_total: 600,
    });
  });

  it('omits prefill.items when OCR items array is empty', () => {
    const prefill = mapDocumentToPrefill(makeDocResult(), CATEGORIES);
    expect(prefill.transactions[0]?.items).toBeUndefined();
  });

  it('omits prefill.items when all OCR items have empty names', () => {
    const result = makeDocResult({
      transactions: [
        {
          ...makeDocResult().transactions[0]!,
          items: [{ name: '', quantity: 1, unitPrice: 100, lineTotal: 100 }],
        },
      ],
    });
    const prefill = mapDocumentToPrefill(result, CATEGORIES);
    expect(prefill.transactions[0]?.items).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// mapDocumentToPrefill — future-date stripping
// ---------------------------------------------------------------------------

describe('mapDocumentToPrefill — future-date stripping', () => {
  it('drops occurred_at when the date is in the future', () => {
    const result = makeDocResult({
      transactions: [{ ...makeDocResult().transactions[0]!, occurredAt: '2099-12-31' }],
    });
    const prefill = mapDocumentToPrefill(result, CATEGORIES);
    expect(prefill.transactions[0]?.occurred_at).toBeUndefined();
  });

  it('keeps occurred_at for a valid past date', () => {
    const result = makeDocResult({
      transactions: [{ ...makeDocResult().transactions[0]!, occurredAt: PAST_DATE }],
    });
    const prefill = mapDocumentToPrefill(result, CATEGORIES);
    expect(prefill.transactions[0]?.occurred_at).toBe(new Date(PAST_DATE).toISOString());
  });
});

// ---------------------------------------------------------------------------
// mapDocumentToPrefill — lowConfidence threshold
// ---------------------------------------------------------------------------

describe('mapDocumentToPrefill — lowConfidence threshold', () => {
  it('sets lowConfidence true on all transactions when confidence < 0.5', () => {
    const result = makeDocResult({
      confidence: 0.3,
      transactions: [
        makeDocResult().transactions[0]!,
        { ...makeDocResult().transactions[0]!, merchant: 'Otro' },
      ],
    });
    const prefill = mapDocumentToPrefill(result, CATEGORIES);
    expect(prefill.transactions[0]?.lowConfidence).toBe(true);
    expect(prefill.transactions[1]?.lowConfidence).toBe(true);
  });

  it('sets lowConfidence false on all transactions when confidence >= 0.5', () => {
    const result = makeDocResult({ confidence: 0.5 });
    const prefill = mapDocumentToPrefill(result, CATEGORIES);
    expect(prefill.transactions[0]?.lowConfidence).toBe(false);
  });

  it('sets lowConfidence false when confidence is exactly 0.5', () => {
    const result = makeDocResult({ confidence: 0.5 });
    const prefill = mapDocumentToPrefill(result, CATEGORIES);
    expect(prefill.transactions[0]?.lowConfidence).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// partitionByDirection
// ---------------------------------------------------------------------------

describe('partitionByDirection', () => {
  it('puts direction=expense into expenses array', () => {
    const { expenses, incomes } = partitionByDirection([
      { direction: 'expense', lowConfidence: false },
    ]);
    expect(expenses).toHaveLength(1);
    expect(incomes).toHaveLength(0);
  });

  it('puts direction=income into incomes array', () => {
    const { expenses, incomes } = partitionByDirection([
      { direction: 'income', lowConfidence: false },
    ]);
    expect(expenses).toHaveLength(0);
    expect(incomes).toHaveLength(1);
  });

  it('splits a mixed array correctly', () => {
    const { expenses, incomes } = partitionByDirection([
      { direction: 'expense', lowConfidence: false },
      { direction: 'income', lowConfidence: false },
      { direction: 'expense', lowConfidence: true },
      { direction: 'income', lowConfidence: false },
    ]);
    expect(expenses).toHaveLength(2);
    expect(incomes).toHaveLength(2);
  });

  it('returns empty arrays for an empty input', () => {
    const { expenses, incomes } = partitionByDirection([]);
    expect(expenses).toEqual([]);
    expect(incomes).toEqual([]);
  });

  it('returns all in expenses when all are expenses', () => {
    const txs = Array.from({ length: 5 }, () => ({
      direction: 'expense' as const,
      lowConfidence: false,
    }));
    const { expenses, incomes } = partitionByDirection(txs);
    expect(expenses).toHaveLength(5);
    expect(incomes).toHaveLength(0);
  });

  it('returns all in incomes when all are incomes', () => {
    const txs = Array.from({ length: 3 }, () => ({
      direction: 'income' as const,
      lowConfidence: false,
    }));
    const { expenses, incomes } = partitionByDirection(txs);
    expect(expenses).toHaveLength(0);
    expect(incomes).toHaveLength(3);
  });
});

// ---------------------------------------------------------------------------
// extractDocument
// ---------------------------------------------------------------------------

describe('extractDocument', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const VALID_DOC_RESULT: DocumentOcrResult = {
    documentType: 'receipt',
    confidence: 0.88,
    truncated: false,
    transactions: [
      {
        amount: 2500,
        currency: 'ARS',
        occurredAt: '2024-03-10',
        merchant: 'Supermercado Día',
        direction: 'expense',
        categoryHint: 'Supermercado',
        suggestedNewCategory: null,
        suggestedNewCategoryReason: null,
        items: [],
      },
    ],
  };

  it('returns a parsed DocumentOcrResult on success', async () => {
    mockInvoke.mockResolvedValue({
      data: { data: VALID_DOC_RESULT },
      error: null,
    });

    const result = await extractDocument({ imageBase64: 'base64string', mimeType: 'image/jpeg' });
    expect(result).toMatchObject(VALID_DOC_RESULT);
  });

  it('calls supabase.functions.invoke with "extract-document" and correct body for image', async () => {
    mockInvoke.mockResolvedValue({
      data: { data: VALID_DOC_RESULT },
      error: null,
    });

    await extractDocument({
      imageBase64: 'mybase64',
      mimeType: 'image/png',
      categoryNames: ['Comida', 'Transporte'],
    });

    expect(mockInvoke).toHaveBeenCalledWith('extract-document', {
      body: {
        imageBase64: 'mybase64',
        pdfBase64: undefined,
        mimeType: 'image/png',
        categories: ['Comida', 'Transporte'],
      },
    });
  });

  it('calls supabase.functions.invoke with pdfBase64 for a PDF document', async () => {
    mockInvoke.mockResolvedValue({
      data: { data: VALID_DOC_RESULT },
      error: null,
    });

    await extractDocument({ pdfBase64: 'pdfbase64', mimeType: 'application/pdf' });

    expect(mockInvoke).toHaveBeenCalledWith('extract-document', {
      body: {
        imageBase64: undefined,
        pdfBase64: 'pdfbase64',
        mimeType: 'application/pdf',
        categories: [],
      },
    });
  });

  it('sends categories as empty array when categoryNames is omitted', async () => {
    mockInvoke.mockResolvedValue({
      data: { data: VALID_DOC_RESULT },
      error: null,
    });

    await extractDocument({ imageBase64: 'base64string', mimeType: 'image/jpeg' });

    expect(mockInvoke).toHaveBeenCalledWith(
      'extract-document',
      expect.objectContaining({
        body: expect.objectContaining({ categories: [] }),
      }),
    );
  });

  it('throws OcrError with NETWORK_ERROR when invoke returns a FunctionsFetchError by name', async () => {
    const fetchError = Object.assign(new Error('Failed to fetch'), {
      name: 'FunctionsFetchError',
    });

    mockInvoke.mockResolvedValue({ data: null, error: fetchError });

    const err = await extractDocument({ imageBase64: 'base64', mimeType: 'image/jpeg' }).catch(
      (e: unknown) => e,
    );
    expect(err).toBeInstanceOf(OcrError);
    expect((err as OcrError).code).toBe('NETWORK_ERROR');
    expect((err as OcrError).message).toMatch(/datos manualmente/);
  });

  it('throws OcrError with NETWORK_ERROR when invoke error constructor name is FunctionsFetchError', async () => {
    class FunctionsFetchError extends Error {
      constructor(message: string) {
        super(message);
        this.name = 'FunctionsFetchError';
      }
    }

    mockInvoke.mockResolvedValue({
      data: null,
      error: new FunctionsFetchError('network unreachable'),
    });

    const err = await extractDocument({ imageBase64: 'base64', mimeType: 'image/jpeg' }).catch(
      (e: unknown) => e,
    );
    expect(err).toBeInstanceOf(OcrError);
    expect((err as OcrError).code).toBe('NETWORK_ERROR');
  });

  it('throws OcrError with PDF_CONVERT_ERROR code when edge fn returns that structured error', async () => {
    const edgeError = {
      code: 'PDF_CONVERT_ERROR',
      message: 'No pudimos leer el PDF. Probá con una captura.',
    };

    mockInvoke.mockResolvedValue({
      data: null,
      error: { context: { error: edgeError } },
    });

    await expect(
      extractDocument({ pdfBase64: 'base64', mimeType: 'application/pdf' }),
    ).rejects.toMatchObject({
      name: 'OcrError',
      code: 'PDF_CONVERT_ERROR',
      message: 'No pudimos leer el PDF. Probá con una captura.',
    });
  });

  it('throws OcrError with edge fn code + message for any structured error', async () => {
    const edgeError = {
      code: 'DOC_TIMEOUT',
      message: 'El análisis tardó demasiado.',
    };

    mockInvoke.mockResolvedValue({
      data: null,
      error: { context: { error: edgeError } },
    });

    await expect(
      extractDocument({ imageBase64: 'base64', mimeType: 'image/jpeg' }),
    ).rejects.toMatchObject({
      name: 'OcrError',
      code: 'DOC_TIMEOUT',
      message: 'El análisis tardó demasiado.',
    });
  });

  it('throws OcrError with OCR_ERROR when invoke error has no structured context', async () => {
    mockInvoke.mockResolvedValue({
      data: null,
      error: { message: 'Internal Server Error' },
    });

    const err = await extractDocument({ imageBase64: 'base64', mimeType: 'image/jpeg' }).catch(
      (e: unknown) => e,
    );
    expect(err).toBeInstanceOf(OcrError);
    expect((err as OcrError).code).toBe('OCR_ERROR');
    expect((err as OcrError).message).toMatch(/datos manualmente/);
  });

  it('throws OcrError when invoke returns an empty error object', async () => {
    mockInvoke.mockResolvedValue({ data: null, error: {} });

    await expect(
      extractDocument({ imageBase64: 'base64', mimeType: 'image/jpeg' }),
    ).rejects.toBeInstanceOf(OcrError);
  });

  it('parses a result with all-null transaction fields via defensive schema', async () => {
    const partialResult: DocumentOcrResult = {
      documentType: 'unknown',
      confidence: 0.1,
      truncated: false,
      transactions: [
        {
          amount: null,
          currency: null,
          occurredAt: null,
          merchant: null,
          direction: 'expense',
          categoryHint: null,
          suggestedNewCategory: null,
          suggestedNewCategoryReason: null,
          items: [],
        },
      ],
    };

    mockInvoke.mockResolvedValue({
      data: { data: partialResult },
      error: null,
    });

    const result = await extractDocument({ imageBase64: 'base64', mimeType: 'image/jpeg' });
    expect(result.transactions[0]?.amount).toBeNull();
    expect(result.transactions[0]?.currency).toBeNull();
    expect(result.transactions[0]?.direction).toBe('expense');
  });
});
