/**
 * Unit tests for `lib/insights/client.ts`.
 *
 * Covers:
 * - `generateInsights` — success unwrap, invoke error paths, malformed response,
 *   invalid-entry filtering, >4 cap.
 */

import { InsightsError, generateInsights } from '@/lib/insights/client';
import type { GenerateInsightsInput, Insight } from '@/lib/insights/types';
import { supabase } from '@/lib/supabase';

// Mirror the mock pattern used in lib/__tests__/ocr.test.ts.
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

const MINIMAL_INPUT: GenerateInsightsInput = {
  currency: 'ARS',
  period: { label: 'Este mes', from: '2026-06-01T00:00:00Z', to: '2026-06-30T23:59:59Z' },
  totals: { expenses: 50000, incomes: 80000, net: 30000 },
  byCategory: [{ name: 'Comida', total: 20000, pct: 40 }],
  trend: [{ bucket: '2026-06', expenses: 50000, incomes: 80000 }],
};

const VALID_INSIGHTS: Insight[] = [
  { kind: 'positive', title: 'Buen ahorro este mes', body: 'Gastaste menos de lo que ingresaste.' },
  {
    kind: 'tip',
    title: 'Reducí gastos en Comida',
    body: 'Comida representa el 40 % de tus gastos.',
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeInvokeSuccess(insights: unknown) {
  return { data: { data: { insights } }, error: null };
}

// ---------------------------------------------------------------------------
// Success path
// ---------------------------------------------------------------------------

describe('generateInsights — success', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns the insights array on a well-formed response', async () => {
    mockInvoke.mockResolvedValue(makeInvokeSuccess(VALID_INSIGHTS));

    const result = await generateInsights(MINIMAL_INPUT);

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ kind: 'positive', title: 'Buen ahorro este mes' });
    expect(result[1]).toMatchObject({ kind: 'tip' });
  });

  it('calls invoke with the function name "generate-insights" and the input as body', async () => {
    mockInvoke.mockResolvedValue(makeInvokeSuccess(VALID_INSIGHTS));

    await generateInsights(MINIMAL_INPUT);

    expect(mockInvoke).toHaveBeenCalledWith('generate-insights', { body: MINIMAL_INPUT });
  });

  it('returns an empty array when the edge function returns an empty insights list', async () => {
    mockInvoke.mockResolvedValue(makeInvokeSuccess([]));

    const result = await generateInsights(MINIMAL_INPUT);

    expect(result).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Invoke error paths
// ---------------------------------------------------------------------------

describe('generateInsights — invoke errors', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('throws InsightsError with UPSTREAM_ERROR when invoke returns a generic error', async () => {
    mockInvoke.mockResolvedValue({
      data: null,
      error: { message: 'Internal Server Error' },
    });

    await expect(generateInsights(MINIMAL_INPUT)).rejects.toMatchObject({
      name: 'InsightsError',
      code: 'UPSTREAM_ERROR',
    });
  });

  it('throws InsightsError with NETWORK_ERROR when invoke error name is FunctionsFetchError', async () => {
    const fetchError = Object.assign(new Error('Failed to fetch'), {
      name: 'FunctionsFetchError',
    });

    mockInvoke.mockResolvedValue({ data: null, error: fetchError });

    const err = await generateInsights(MINIMAL_INPUT).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(InsightsError);
    expect((err as InsightsError).code).toBe('NETWORK_ERROR');
  });

  it('throws InsightsError with NETWORK_ERROR when invoke error constructor name is FunctionsFetchError', async () => {
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

    const err = await generateInsights(MINIMAL_INPUT).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(InsightsError);
    expect((err as InsightsError).code).toBe('NETWORK_ERROR');
  });

  it('throws InsightsError with the edge fn code when invoke error has structured context', async () => {
    mockInvoke.mockResolvedValue({
      data: null,
      error: {
        context: {
          error: { code: 'UNAUTHENTICATED', message: 'JWT inválido o expirado.' },
        },
      },
    });

    const err = await generateInsights(MINIMAL_INPUT).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(InsightsError);
    expect((err as InsightsError).code).toBe('UNAUTHENTICATED');
    expect((err as InsightsError).message).toBe('JWT inválido o expirado.');
  });

  it('throws InsightsError with UPSTREAM_ERROR when error has no message field', async () => {
    mockInvoke.mockResolvedValue({ data: null, error: {} });

    const err = await generateInsights(MINIMAL_INPUT).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(InsightsError);
    expect((err as InsightsError).code).toBe('UPSTREAM_ERROR');
  });
});

// ---------------------------------------------------------------------------
// Malformed response
// ---------------------------------------------------------------------------

describe('generateInsights — malformed response', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('throws InsightsError with PARSE_ERROR when insights field is missing', async () => {
    mockInvoke.mockResolvedValue({ data: { data: {} }, error: null });

    await expect(generateInsights(MINIMAL_INPUT)).rejects.toMatchObject({
      name: 'InsightsError',
      code: 'PARSE_ERROR',
    });
  });

  it('throws InsightsError with PARSE_ERROR when insights is not an array (string)', async () => {
    mockInvoke.mockResolvedValue({ data: { data: { insights: 'bad' } }, error: null });

    await expect(generateInsights(MINIMAL_INPUT)).rejects.toMatchObject({
      name: 'InsightsError',
      code: 'PARSE_ERROR',
    });
  });

  it('throws InsightsError with PARSE_ERROR when data wrapper is null', async () => {
    mockInvoke.mockResolvedValue({ data: null, error: null });

    await expect(generateInsights(MINIMAL_INPUT)).rejects.toMatchObject({
      name: 'InsightsError',
      code: 'PARSE_ERROR',
    });
  });

  it('throws InsightsError with PARSE_ERROR when inner data key is missing', async () => {
    mockInvoke.mockResolvedValue({ data: { insights: VALID_INSIGHTS }, error: null });

    await expect(generateInsights(MINIMAL_INPUT)).rejects.toMatchObject({
      name: 'InsightsError',
      code: 'PARSE_ERROR',
    });
  });
});

// ---------------------------------------------------------------------------
// Filtering and capping
// ---------------------------------------------------------------------------

describe('generateInsights — filtering and capping', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('drops entries with an invalid kind', async () => {
    const raw = [
      { kind: 'positive', title: 'OK', body: 'All good.' },
      { kind: 'unknown_kind', title: 'Bad kind', body: 'Should be dropped.' },
    ];
    mockInvoke.mockResolvedValue(makeInvokeSuccess(raw));

    const result = await generateInsights(MINIMAL_INPUT);

    expect(result).toHaveLength(1);
    expect(result[0]?.kind).toBe('positive');
  });

  it('drops entries where title is not a string', async () => {
    const raw = [
      { kind: 'tip', title: 42, body: 'Missing title.' },
      { kind: 'neutral', title: 'Valid', body: 'OK.' },
    ];
    mockInvoke.mockResolvedValue(makeInvokeSuccess(raw));

    const result = await generateInsights(MINIMAL_INPUT);

    expect(result).toHaveLength(1);
    expect(result[0]?.title).toBe('Valid');
  });

  it('drops entries where body is not a string', async () => {
    const raw = [
      { kind: 'warning', title: 'Alerta', body: null },
      { kind: 'tip', title: 'Consejo', body: 'Todo bien.' },
    ];
    mockInvoke.mockResolvedValue(makeInvokeSuccess(raw));

    const result = await generateInsights(MINIMAL_INPUT);

    expect(result).toHaveLength(1);
    expect(result[0]?.kind).toBe('tip');
  });

  it('drops non-object entries in the insights array', async () => {
    const raw = ['not an object', 42, { kind: 'neutral', title: 'OK', body: 'Fine.' }];
    mockInvoke.mockResolvedValue(makeInvokeSuccess(raw));

    const result = await generateInsights(MINIMAL_INPUT);

    expect(result).toHaveLength(1);
  });

  it('caps the result at 4 when the edge fn returns more than 4 insights', async () => {
    const raw: Insight[] = Array.from({ length: 7 }, (_, i) => ({
      kind: 'tip' as const,
      title: `Insight ${i + 1}`,
      body: `Body ${i + 1}`,
    }));
    mockInvoke.mockResolvedValue(makeInvokeSuccess(raw));

    const result = await generateInsights(MINIMAL_INPUT);

    expect(result).toHaveLength(4);
    expect(result[0]?.title).toBe('Insight 1');
    expect(result[3]?.title).toBe('Insight 4');
  });

  it('returns exactly 4 when exactly 4 valid insights are returned', async () => {
    const raw: Insight[] = Array.from({ length: 4 }, (_, i) => ({
      kind: 'warning' as const,
      title: `W ${i + 1}`,
      body: `Body ${i + 1}`,
    }));
    mockInvoke.mockResolvedValue(makeInvokeSuccess(raw));

    const result = await generateInsights(MINIMAL_INPUT);

    expect(result).toHaveLength(4);
  });

  it('applies filtering before capping — invalid entries count against the cap budget', async () => {
    // 3 valid + 5 invalid = 8 raw. After filter: 3 valid, all under cap.
    const raw = [
      ...Array.from({ length: 5 }, () => ({ kind: 'bad_kind', title: 'X', body: 'Y' })),
      { kind: 'tip', title: 'A', body: 'A body.' },
      { kind: 'positive', title: 'B', body: 'B body.' },
      { kind: 'neutral', title: 'C', body: 'C body.' },
    ];
    mockInvoke.mockResolvedValue(makeInvokeSuccess(raw));

    const result = await generateInsights(MINIMAL_INPUT);

    expect(result).toHaveLength(3);
  });
});
