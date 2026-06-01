/**
 * Unit tests for `lib/ocr.ts`.
 *
 * Covers:
 * - `normalizeName`    — diacritic / case normalization
 * - `matchCategory`    — exact / substring / null cases
 * - `mapOcrToPrefill`  — full mapping + edge cases
 * - `extractReceipt`   — success + error paths with mocked supabase
 */

import { OcrError, extractReceipt, mapOcrToPrefill, matchCategory, normalizeName } from '@/lib/ocr';
import type { OcrResult } from '@/lib/schemas/ocr';
import { supabase } from '@/lib/supabase';

// The global jest.setup.ts already mocks @/lib/supabase, but we need
// fine-grained control over `functions.invoke` per test, so we re-declare
// the mock here. The moduleNameMapper resolves `@/lib/supabase` to the same
// module that jest.setup.ts mocked, so we just augment it below.
jest.mock('@/lib/supabase', () => ({
  supabase: {
    functions: {
      invoke: jest.fn(),
    },
  },
}));

const mockInvoke = supabase.functions.invoke as jest.Mock;

// ---------------------------------------------------------------------------
// Minimal CategoryRow fixtures (only fields used by matchCategory)
// ---------------------------------------------------------------------------

const CATEGORIES = [
  {
    id: '1',
    name: 'Comida',
    color: '#FF0000',
    created_at: '2024-01-01T00:00:00Z',
    icon: 'utensils',
    slug: 'comida',
    sort_order: 1,
  },
  {
    id: '2',
    name: 'Transporte',
    color: '#0000FF',
    created_at: '2024-01-01T00:00:00Z',
    icon: 'car',
    slug: 'transporte',
    sort_order: 2,
  },
];

// ---------------------------------------------------------------------------
// normalizeName
// ---------------------------------------------------------------------------

describe('normalizeName', () => {
  it('lowercases ASCII strings', () => {
    expect(normalizeName('HELLO')).toBe('hello');
  });

  it('strips accents — simple vowel', () => {
    expect(normalizeName('Comída')).toBe('comida');
  });

  it('strips multiple diacritics', () => {
    expect(normalizeName('Ñoño')).toBe('nono');
  });

  it('trims leading and trailing whitespace', () => {
    expect(normalizeName('  pizza  ')).toBe('pizza');
  });

  it('handles already-normalized input unchanged', () => {
    expect(normalizeName('comida')).toBe('comida');
  });

  it('handles empty string', () => {
    expect(normalizeName('')).toBe('');
  });
});

// ---------------------------------------------------------------------------
// matchCategory
// ---------------------------------------------------------------------------

describe('matchCategory', () => {
  it('returns null when hint is null', () => {
    expect(matchCategory(null, CATEGORIES)).toBeNull();
  });

  it('returns null when hint is empty string', () => {
    expect(matchCategory('', CATEGORIES)).toBeNull();
  });

  it('returns null when no category matches the hint', () => {
    expect(matchCategory('Tecnología', CATEGORIES)).toBeNull();
  });

  it('returns the category id on exact normalized match (different case)', () => {
    expect(matchCategory('COMIDA', CATEGORIES)).toBe('1');
  });

  it('returns the category id on exact normalized match (with accent)', () => {
    // "Comída" normalizes to "comida" → matches "Comida"
    expect(matchCategory('Comída', CATEGORIES)).toBe('1');
  });

  it('returns the category id when the hint is a substring of the category name', () => {
    // "transpo" is contained in "transporte"
    expect(matchCategory('transpo', CATEGORIES)).toBe('2');
  });

  it('returns the category id when the category name is a substring of the hint', () => {
    // "Transporte Urbano" contains "Transporte"
    expect(matchCategory('Transporte Urbano', CATEGORIES)).toBe('2');
  });

  it('prefers exact match over substring when both apply', () => {
    const cats = [
      {
        id: 'exact',
        name: 'Comida',
        color: '#FF0000',
        created_at: '2024-01-01T00:00:00Z',
        icon: 'utensils',
        slug: 'comida',
        sort_order: 1,
      },
      {
        id: 'sub',
        name: 'Comida Rápida',
        color: '#FF0000',
        created_at: '2024-01-01T00:00:00Z',
        icon: 'utensils',
        slug: 'comida-rapida',
        sort_order: 2,
      },
    ];
    expect(matchCategory('Comida', cats)).toBe('exact');
  });

  it('returns null when categories array is empty', () => {
    expect(matchCategory('Comida', [])).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// mapOcrToPrefill
// ---------------------------------------------------------------------------

describe('mapOcrToPrefill', () => {
  const PAST_DATE = '2024-06-15';

  function makeResult(overrides: Partial<OcrResult> = {}): OcrResult {
    return {
      amount: 1500,
      currency: 'ARS',
      occurredAt: PAST_DATE,
      merchant: 'Burguer Palace',
      categoryHint: 'Comida',
      confidence: 0.9,
      ...overrides,
    };
  }

  it('maps a full result correctly', () => {
    const prefill = mapOcrToPrefill(makeResult(), CATEGORIES);
    expect(prefill.amount).toBe(1500);
    expect(prefill.currency).toBe('ARS');
    expect(prefill.description).toBe('Burguer Palace');
    expect(prefill.category_id).toBe('1');
    expect(prefill.occurred_at).toBe(PAST_DATE);
    expect(prefill.lowConfidence).toBe(false);
  });

  it('omits amount when amount is null', () => {
    const prefill = mapOcrToPrefill(makeResult({ amount: null }), CATEGORIES);
    expect(prefill.amount).toBeUndefined();
  });

  it('omits amount when amount is 0', () => {
    const prefill = mapOcrToPrefill(makeResult({ amount: 0 }), CATEGORIES);
    expect(prefill.amount).toBeUndefined();
  });

  it('omits amount when amount is negative', () => {
    const prefill = mapOcrToPrefill(makeResult({ amount: -100 }), CATEGORIES);
    expect(prefill.amount).toBeUndefined();
  });

  it('omits currency when currency is null (form defaults to ARS)', () => {
    const prefill = mapOcrToPrefill(makeResult({ currency: null }), CATEGORIES);
    expect(prefill.currency).toBeUndefined();
  });

  it('sets description to null when merchant is null', () => {
    const prefill = mapOcrToPrefill(makeResult({ merchant: null }), CATEGORIES);
    expect(prefill.description).toBeNull();
  });

  it('drops occurred_at when occurredAt is null', () => {
    const prefill = mapOcrToPrefill(makeResult({ occurredAt: null }), CATEGORIES);
    expect(prefill.occurred_at).toBeUndefined();
  });

  it('drops occurred_at when the date is in the future', () => {
    // Use a date far enough in the future that the test doesn't flap
    const prefill = mapOcrToPrefill(makeResult({ occurredAt: '2099-12-31' }), CATEGORIES);
    expect(prefill.occurred_at).toBeUndefined();
  });

  it('sets lowConfidence to true when confidence < 0.5', () => {
    const prefill = mapOcrToPrefill(makeResult({ confidence: 0.3 }), CATEGORIES);
    expect(prefill.lowConfidence).toBe(true);
  });

  it('sets lowConfidence to false when confidence is exactly 0.5', () => {
    const prefill = mapOcrToPrefill(makeResult({ confidence: 0.5 }), CATEGORIES);
    expect(prefill.lowConfidence).toBe(false);
  });

  it('sets category_id to null when categoryHint is null', () => {
    const prefill = mapOcrToPrefill(makeResult({ categoryHint: null }), CATEGORIES);
    expect(prefill.category_id).toBeNull();
  });

  it('sets category_id to null when categoryHint has no match', () => {
    const prefill = mapOcrToPrefill(makeResult({ categoryHint: 'Belleza' }), CATEGORIES);
    expect(prefill.category_id).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// extractReceipt
// ---------------------------------------------------------------------------

describe('extractReceipt', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const VALID_OCR_RESULT: OcrResult = {
    amount: 2500,
    currency: 'ARS',
    occurredAt: '2024-03-10',
    merchant: 'Supermercado Día',
    categoryHint: 'Supermercado',
    confidence: 0.85,
  };

  it('returns a parsed OcrResult on success', async () => {
    mockInvoke.mockResolvedValue({
      data: { data: VALID_OCR_RESULT },
      error: null,
    });

    const result = await extractReceipt('base64string', 'image/jpeg');
    expect(result).toMatchObject(VALID_OCR_RESULT);
  });

  it('calls supabase.functions.invoke with the correct function name and body', async () => {
    mockInvoke.mockResolvedValue({
      data: { data: VALID_OCR_RESULT },
      error: null,
    });

    await extractReceipt('mybase64', 'image/png');

    expect(mockInvoke).toHaveBeenCalledWith('extract-receipt', {
      body: { imageBase64: 'mybase64', mimeType: 'image/png' },
    });
  });

  it('throws OcrError with edge fn code + message when invoke returns a structured error', async () => {
    const edgeError = {
      code: 'OCR_TIMEOUT',
      message: 'No se pudo analizar el ticket. Ingresá los datos manualmente.',
    };

    mockInvoke.mockResolvedValue({
      data: null,
      error: { context: { error: edgeError } },
    });

    await expect(extractReceipt('base64', 'image/jpeg')).rejects.toMatchObject({
      name: 'OcrError',
      code: 'OCR_TIMEOUT',
      message: 'No se pudo analizar el ticket. Ingresá los datos manualmente.',
    });
  });

  it('throws OcrError with generic Spanish message when invoke error has no structured context', async () => {
    mockInvoke.mockResolvedValue({
      data: null,
      error: { message: 'Network failure' },
    });

    const err = await extractReceipt('base64', 'image/jpeg').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(OcrError);
    expect((err as OcrError).message).toMatch(/datos manualmente/);
  });

  it('throws OcrError when invoke returns a generic error object without context', async () => {
    mockInvoke.mockResolvedValue({
      data: null,
      error: {},
    });

    await expect(extractReceipt('base64', 'image/jpeg')).rejects.toBeInstanceOf(OcrError);
  });

  it('parses a result where some fields are null (defensive schema)', async () => {
    const partialResult = {
      amount: null,
      currency: null,
      occurredAt: null,
      merchant: null,
      categoryHint: null,
      confidence: 0.1,
    };

    mockInvoke.mockResolvedValue({
      data: { data: partialResult },
      error: null,
    });

    const result = await extractReceipt('base64', 'image/jpeg');
    expect(result.amount).toBeNull();
    expect(result.currency).toBeNull();
    expect(result.confidence).toBe(0.1);
  });
});
