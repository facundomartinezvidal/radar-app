/**
 * Unit tests for `lib/ocr.ts`.
 *
 * Covers:
 * - `ocrResultSchema`   — items field: present / missing / garbage / item coercion
 * - `normalizeName`     — diacritic / case normalization
 * - `matchCategory`     — exact / substring / null cases
 * - `mapOcrItems`       — OCR → ExpenseItemInput mapping rules
 * - `mapOcrToPrefill`   — full mapping + edge cases + items wiring
 * - `extractReceipt`    — success + error paths with mocked supabase
 */

import {
  OcrError,
  extractReceipt,
  mapOcrItems,
  mapOcrToPrefill,
  matchCategory,
  normalizeName,
} from '@/lib/ocr';
import { createExpenseSchema } from '@/lib/schemas/expense';
import { ocrResultSchema } from '@/lib/schemas/ocr';
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
    updated_at: '2024-01-01T00:00:00Z',
    icon: 'utensils',
    slug: 'comida',
    sort_order: 1,
    user_id: null,
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
  },
];

// ---------------------------------------------------------------------------
// ocrResultSchema — items field
// ---------------------------------------------------------------------------

describe('ocrResultSchema — items', () => {
  const BASE_PAYLOAD = {
    amount: 1000,
    currency: 'ARS',
    occurredAt: '2026-05-01',
    merchant: 'Tienda',
    categoryHint: 'Comida',
    confidence: 0.8,
  };

  it('parses a payload that includes a valid items array', () => {
    const payload = {
      ...BASE_PAYLOAD,
      items: [{ name: 'Empanada', quantity: 3, unitPrice: 200, lineTotal: 600 }],
    };
    const result = ocrResultSchema.parse(payload);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      name: 'Empanada',
      quantity: 3,
      unitPrice: 200,
      lineTotal: 600,
    });
  });

  it('defaults items to [] when field is missing from payload', () => {
    const result = ocrResultSchema.parse(BASE_PAYLOAD);
    expect(result.items).toEqual([]);
  });

  it('coerces items to [] when value is a non-array (e.g. "garbage")', () => {
    const result = ocrResultSchema.parse({ ...BASE_PAYLOAD, items: 'garbage' });
    expect(result.items).toEqual([]);
  });

  it('coerces a non-numeric quantity in an item to null via catch', () => {
    const payload = {
      ...BASE_PAYLOAD,
      items: [{ name: 'Soda', quantity: 'dos', unitPrice: 150, lineTotal: 300 }],
    };
    const result = ocrResultSchema.parse(payload);
    expect(result.items[0]?.quantity).toBeNull();
  });

  it('coerces a non-numeric unitPrice in an item to null via catch', () => {
    const payload = {
      ...BASE_PAYLOAD,
      items: [{ name: 'Soda', quantity: 1, unitPrice: 'caro', lineTotal: 300 }],
    };
    const result = ocrResultSchema.parse(payload);
    expect(result.items[0]?.unitPrice).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// ocrResultSchema — suggestedNewCategory field
// ---------------------------------------------------------------------------

describe('ocrResultSchema — suggestedNewCategory', () => {
  const BASE_PAYLOAD = {
    amount: 1000,
    currency: 'ARS',
    occurredAt: '2026-05-01',
    merchant: 'Farmacia Norte',
    categoryHint: null,
    confidence: 0.7,
    items: [],
  };

  it('parses suggestedNewCategory when present as a string', () => {
    const result = ocrResultSchema.parse({ ...BASE_PAYLOAD, suggestedNewCategory: 'Farmacia' });
    expect(result.suggestedNewCategory).toBe('Farmacia');
  });

  it('defaults suggestedNewCategory to null when missing from payload (catch)', () => {
    const result = ocrResultSchema.parse(BASE_PAYLOAD);
    expect(result.suggestedNewCategory).toBeNull();
  });

  it('coerces an off-spec value (number) to null via catch', () => {
    const result = ocrResultSchema.parse({ ...BASE_PAYLOAD, suggestedNewCategory: 42 });
    expect(result.suggestedNewCategory).toBeNull();
  });

  it('coerces an off-spec value (boolean) to null via catch', () => {
    const result = ocrResultSchema.parse({ ...BASE_PAYLOAD, suggestedNewCategory: true });
    expect(result.suggestedNewCategory).toBeNull();
  });

  it('preserves null when explicitly null', () => {
    const result = ocrResultSchema.parse({ ...BASE_PAYLOAD, suggestedNewCategory: null });
    expect(result.suggestedNewCategory).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// mapOcrItems
// ---------------------------------------------------------------------------

describe('mapOcrItems', () => {
  it('maps valid items to ExpenseItemInput records', () => {
    const result = mapOcrItems([
      { name: 'Milanesa', quantity: 2, unitPrice: 1500, lineTotal: 3000 },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      name: 'Milanesa',
      quantity: 2,
      unit_price: 1500,
      line_total: 3000,
    });
  });

  it('drops items whose name is empty or whitespace-only', () => {
    const result = mapOcrItems([
      { name: '', quantity: 1, unitPrice: 100, lineTotal: 100 },
      { name: '   ', quantity: 1, unitPrice: 200, lineTotal: 200 },
      { name: 'Valid', quantity: 1, unitPrice: 300, lineTotal: 300 },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0]?.name).toBe('Valid');
  });

  it('defaults quantity to 1 when null', () => {
    const result = mapOcrItems([{ name: 'Item', quantity: null, unitPrice: 100, lineTotal: null }]);
    expect(result[0]?.quantity).toBe(1);
  });

  it('defaults quantity to 1 when 0', () => {
    const result = mapOcrItems([{ name: 'Item', quantity: 0, unitPrice: 100, lineTotal: null }]);
    expect(result[0]?.quantity).toBe(1);
  });

  it('computes line_total from qty × unitPrice when lineTotal is null', () => {
    const result = mapOcrItems([{ name: 'Pan', quantity: 3, unitPrice: 150, lineTotal: null }]);
    expect(result[0]?.line_total).toBe(450);
  });

  it('uses detected lineTotal when it is non-null (wins over computed)', () => {
    const result = mapOcrItems([{ name: 'Pan', quantity: 3, unitPrice: 150, lineTotal: 999 }]);
    expect(result[0]?.line_total).toBe(999);
  });

  it('sets line_total to 0 when both lineTotal and unitPrice are null', () => {
    const result = mapOcrItems([
      { name: 'Misterio', quantity: 2, unitPrice: null, lineTotal: null },
    ]);
    expect(result[0]?.line_total).toBe(0);
  });

  it('caps the result at 50 items when input has more than 50', () => {
    const items = Array.from({ length: 60 }, (_, i) => ({
      name: `Item ${i + 1}`,
      quantity: 1,
      unitPrice: 100,
      lineTotal: 100,
    }));
    const result = mapOcrItems(items);
    expect(result).toHaveLength(50);
  });

  it('returns an empty array when all items have empty names', () => {
    const result = mapOcrItems([
      { name: '', quantity: 1, unitPrice: 100, lineTotal: 100 },
      { name: '  ', quantity: 1, unitPrice: 50, lineTotal: 50 },
    ]);
    expect(result).toEqual([]);
  });

  it('rounds line_total to 2 decimal places when computing from qty × unitPrice', () => {
    // 3 × 0.1 = 0.30000000000000004 in JS float; should round to 0.3
    const result = mapOcrItems([
      { name: 'Caramelo', quantity: 3, unitPrice: 0.1, lineTotal: null },
    ]);
    expect(result[0]?.line_total).toBe(0.3);
  });
});

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
        updated_at: '2024-01-01T00:00:00Z',
        icon: 'utensils',
        slug: 'comida',
        sort_order: 1,
        user_id: null,
      },
      {
        id: 'sub',
        name: 'Comida Rápida',
        color: '#FF0000',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        icon: 'utensils',
        slug: 'comida-rapida',
        sort_order: 2,
        user_id: null,
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
      suggestedNewCategory: null,
      confidence: 0.9,
      items: [],
      ...overrides,
    };
  }

  it('maps a full result correctly', () => {
    const prefill = mapOcrToPrefill(makeResult(), CATEGORIES);
    expect(prefill.amount).toBe(1500);
    expect(prefill.currency).toBe('ARS');
    expect(prefill.description).toBe('Burguer Palace');
    expect(prefill.category_id).toBe('1');
    // The impl converts the bare date to a full ISO datetime string so it
    // satisfies createExpenseSchema's z.string().datetime({ offset: true }).
    expect(prefill.occurred_at).toBe(new Date(PAST_DATE).toISOString());
    expect(prefill.lowConfidence).toBe(false);
  });

  it('occurred_at passes createExpenseSchema validation', () => {
    const prefill = mapOcrToPrefill(makeResult(), CATEGORIES);
    const result = createExpenseSchema.pick({ occurred_at: true }).safeParse({
      occurred_at: prefill.occurred_at,
    });
    expect(result.success).toBe(true);
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

  it('maps items into prefill.items when OCR returns non-empty items', () => {
    const result = makeResult({
      items: [{ name: 'Empanada', quantity: 2, unitPrice: 300, lineTotal: 600 }],
    });
    const prefill = mapOcrToPrefill(result, CATEGORIES);
    expect(prefill.items).toHaveLength(1);
    expect(prefill.items?.[0]).toEqual({
      name: 'Empanada',
      quantity: 2,
      unit_price: 300,
      line_total: 600,
    });
  });

  it('omits prefill.items when OCR items array is empty', () => {
    const result = makeResult({ items: [] });
    const prefill = mapOcrToPrefill(result, CATEGORIES);
    expect(prefill.items).toBeUndefined();
  });

  it('omits prefill.items when all OCR items have empty names (filtered out)', () => {
    const result = makeResult({
      items: [{ name: '', quantity: 1, unitPrice: 100, lineTotal: 100 }],
    });
    const prefill = mapOcrToPrefill(result, CATEGORIES);
    expect(prefill.items).toBeUndefined();
  });

  it('does not set suggestedCategoryName when categoryHint matches a category', () => {
    // categoryHint = 'Comida' matches CATEGORIES[0], so category_id is set
    const result = makeResult({ categoryHint: 'Comida', suggestedNewCategory: 'Farmacia' });
    const prefill = mapOcrToPrefill(result, CATEGORIES);
    expect(prefill.category_id).toBe('1');
    expect(prefill.suggestedCategoryName).toBeUndefined();
  });

  it('sets suggestedCategoryName when no match AND suggestedNewCategory is present', () => {
    // categoryHint does not match anything, suggestedNewCategory is returned
    const result = makeResult({
      categoryHint: 'Belleza',
      suggestedNewCategory: 'Peluquería',
    });
    const prefill = mapOcrToPrefill(result, CATEGORIES);
    expect(prefill.category_id).toBeNull();
    expect(prefill.suggestedCategoryName).toBe('Peluquería');
  });

  it('does not set suggestedCategoryName when no match and suggestedNewCategory is null', () => {
    const result = makeResult({
      categoryHint: 'Belleza',
      suggestedNewCategory: null,
    });
    const prefill = mapOcrToPrefill(result, CATEGORIES);
    expect(prefill.category_id).toBeNull();
    expect(prefill.suggestedCategoryName).toBeUndefined();
  });

  it('does not set suggestedCategoryName when categoryHint is null and suggestedNewCategory is null', () => {
    const result = makeResult({ categoryHint: null, suggestedNewCategory: null });
    const prefill = mapOcrToPrefill(result, CATEGORIES);
    expect(prefill.category_id).toBeNull();
    expect(prefill.suggestedCategoryName).toBeUndefined();
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
    suggestedNewCategory: null,
    confidence: 0.85,
    items: [],
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
      body: { imageBase64: 'mybase64', mimeType: 'image/png', categories: [] },
    });
  });

  it('forwards categoryNames as categories in the invoke body', async () => {
    mockInvoke.mockResolvedValue({
      data: { data: VALID_OCR_RESULT },
      error: null,
    });

    const names = ['Comida', 'Transporte', 'Mascotas'];
    await extractReceipt('base64string', 'image/jpeg', names);

    expect(mockInvoke).toHaveBeenCalledWith('extract-receipt', {
      body: { imageBase64: 'base64string', mimeType: 'image/jpeg', categories: names },
    });
  });

  it('sends categories as empty array when categoryNames is omitted (default)', async () => {
    mockInvoke.mockResolvedValue({
      data: { data: VALID_OCR_RESULT },
      error: null,
    });

    await extractReceipt('base64string', 'image/jpeg');

    expect(mockInvoke).toHaveBeenCalledWith('extract-receipt', {
      body: expect.objectContaining({ categories: [] }),
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

  it('throws OcrError with code NETWORK_ERROR when invoke returns a FunctionsFetchError by name', async () => {
    const fetchError = Object.assign(new Error('Failed to fetch'), {
      name: 'FunctionsFetchError',
    });

    mockInvoke.mockResolvedValue({
      data: null,
      error: fetchError,
    });

    const err = await extractReceipt('base64', 'image/jpeg').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(OcrError);
    expect((err as OcrError).code).toBe('NETWORK_ERROR');
    expect((err as OcrError).message).toMatch(/datos manualmente/);
  });

  it('throws OcrError with code NETWORK_ERROR when invoke error constructor name is FunctionsFetchError', async () => {
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

    const err = await extractReceipt('base64', 'image/jpeg').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(OcrError);
    expect((err as OcrError).code).toBe('NETWORK_ERROR');
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
