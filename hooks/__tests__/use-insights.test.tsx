/**
 * Tests for use-insights hooks.
 *
 * Verifies query wiring for chart hooks, trend composition, AI fallback, and
 * the disabled-when-null guard. We mock the repository, the edge-function
 * client, and the local heuristics to avoid touching supabase-js internals.
 * Pattern mirrors hooks/__tests__/use-incomes.test.tsx.
 */
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react-native';

import * as client from '@/lib/insights/client';
import * as heuristics from '@/lib/insights/heuristics';
import type {
  CategorySlice,
  ChartPoint,
  GenerateInsightsInput,
  Insight,
  Period,
} from '@/lib/insights/types';
import * as repo from '@/lib/repositories/insights';
import {
  insightKeys,
  useAiInsights,
  useExpenseByCategory,
  useExpenseByPeriod,
  useIncomeByPeriod,
  useTrend,
} from '../use-insights';

jest.mock('@/lib/repositories/insights');
jest.mock('@/lib/insights/client');
jest.mock('@/lib/insights/heuristics');

const mockedRepo = repo as jest.Mocked<typeof repo>;
const mockedClient = client as jest.Mocked<typeof client>;
const mockedHeuristics = heuristics as jest.Mocked<typeof heuristics>;

// ---------------------------------------------------------------------------
// QueryClient wrapper factory
// ---------------------------------------------------------------------------

function makeWrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
  return { wrapper, qc };
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const PERIOD: Period = {
  label: 'Este mes',
  from: '2026-06-01T00:00:00Z',
  to: '2026-06-30T23:59:59Z',
  bucket: 'day',
};

const CATEGORY_SLICE: CategorySlice = {
  categoryId: 'cat-1',
  name: 'Comida',
  color: '#EF4444',
  icon: 'utensils',
  total: 5000,
  count: 3,
};

const CHART_POINT_EXPENSE: ChartPoint = { bucket: '2026-06-01', total: 3000, count: 2 };
const CHART_POINT_INCOME: ChartPoint = { bucket: '2026-06-01', total: 8000, count: 1 };

const AI_INSIGHTS: Insight[] = [
  { kind: 'tip', title: 'Tip uno', body: 'Cuerpo del tip uno.' },
  { kind: 'warning', title: 'Warning dos', body: 'Cuerpo del warning dos.' },
];

const LOCAL_INSIGHTS: Insight[] = [
  { kind: 'warning', title: 'Gastaste más de lo que ingresó', body: 'Fallback local.' },
];

const GENERATE_INPUT: GenerateInsightsInput = {
  currency: 'ARS',
  period: { label: PERIOD.label, from: PERIOD.from, to: PERIOD.to },
  totals: { expenses: 5000, incomes: 8000, net: 3000 },
  byCategory: [{ name: 'Comida', total: 5000, pct: 100 }],
  trend: [{ bucket: '2026-06-01', expenses: 5000, incomes: 8000 }],
};

// ---------------------------------------------------------------------------
// Query key shape tests
// ---------------------------------------------------------------------------

describe('insightKeys', () => {
  it('all is ["insights"]', () => {
    expect(insightKeys.all).toEqual(['insights']);
  });

  it('byCategory includes currency and date range', () => {
    const key = insightKeys.byCategory('ARS', '2026-06-01', '2026-06-30');
    expect(key).toEqual(['insights', 'by-category', 'ARS', '2026-06-01', '2026-06-30']);
  });

  it('byPeriod includes currency, bucket, and date range', () => {
    const key = insightKeys.byPeriod('USD', 'month', '2026-06-01', '2026-06-30');
    expect(key).toEqual(['insights', 'by-period', 'USD', 'month', '2026-06-01', '2026-06-30']);
  });

  it('incomeByPeriod includes currency, bucket, and date range', () => {
    const key = insightKeys.incomeByPeriod('ARS', 'week', '2026-06-01', '2026-06-30');
    expect(key).toEqual([
      'insights',
      'income-by-period',
      'ARS',
      'week',
      '2026-06-01',
      '2026-06-30',
    ]);
  });

  it('ai includes currency and period label', () => {
    const key = insightKeys.ai('ARS', 'Este mes');
    expect(key).toEqual(['insights', 'ai', 'ARS', 'Este mes']);
  });
});

// ---------------------------------------------------------------------------
// useExpenseByCategory
// ---------------------------------------------------------------------------

describe('useExpenseByCategory', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns CategorySlice[] on success', async () => {
    mockedRepo.getExpenseByCategory.mockResolvedValueOnce({
      data: [CATEGORY_SLICE],
      error: null,
    });

    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useExpenseByCategory('ARS', PERIOD), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedRepo.getExpenseByCategory).toHaveBeenCalledWith('ARS', PERIOD.from, PERIOD.to);
    expect(result.current.data).toHaveLength(1);
    expect(result.current.data?.[0]).toEqual(CATEGORY_SLICE);
  });

  it('returns empty array when repo returns null data', async () => {
    mockedRepo.getExpenseByCategory.mockResolvedValueOnce({ data: null, error: null });

    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useExpenseByCategory('ARS', PERIOD), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([]);
  });

  it('enters error state when repo returns an error', async () => {
    mockedRepo.getExpenseByCategory.mockResolvedValueOnce({
      data: null,
      error: new Error('db error'),
    });

    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useExpenseByCategory('ARS', PERIOD), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toEqual(new Error('db error'));
  });
});

// ---------------------------------------------------------------------------
// useExpenseByPeriod
// ---------------------------------------------------------------------------

describe('useExpenseByPeriod', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns ChartPoint[] on success', async () => {
    mockedRepo.getExpenseByPeriod.mockResolvedValueOnce({
      data: [CHART_POINT_EXPENSE],
      error: null,
    });

    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useExpenseByPeriod('ARS', PERIOD), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedRepo.getExpenseByPeriod).toHaveBeenCalledWith(
      'ARS',
      PERIOD.bucket,
      PERIOD.from,
      PERIOD.to,
    );
    expect(result.current.data?.[0]).toEqual(CHART_POINT_EXPENSE);
  });

  it('enters error state when repo returns an error', async () => {
    mockedRepo.getExpenseByPeriod.mockResolvedValueOnce({
      data: null,
      error: new Error('rpc failed'),
    });

    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useExpenseByPeriod('ARS', PERIOD), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

// ---------------------------------------------------------------------------
// useIncomeByPeriod
// ---------------------------------------------------------------------------

describe('useIncomeByPeriod', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns ChartPoint[] on success', async () => {
    mockedRepo.getIncomeByPeriod.mockResolvedValueOnce({
      data: [CHART_POINT_INCOME],
      error: null,
    });

    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useIncomeByPeriod('ARS', PERIOD), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedRepo.getIncomeByPeriod).toHaveBeenCalledWith(
      'ARS',
      PERIOD.bucket,
      PERIOD.from,
      PERIOD.to,
    );
    expect(result.current.data?.[0]).toEqual(CHART_POINT_INCOME);
  });

  it('enters error state when repo returns an error', async () => {
    mockedRepo.getIncomeByPeriod.mockResolvedValueOnce({
      data: null,
      error: new Error('rpc failed'),
    });

    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useIncomeByPeriod('ARS', PERIOD), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

// ---------------------------------------------------------------------------
// useTrend
// ---------------------------------------------------------------------------

describe('useTrend', () => {
  beforeEach(() => jest.clearAllMocks());

  it('joins expense and income monthly buckets by bucket label', async () => {
    const expensePoints: ChartPoint[] = [
      { bucket: '2026-04-01', total: 4000, count: 2 },
      { bucket: '2026-05-01', total: 5000, count: 3 },
    ];
    const incomePoints: ChartPoint[] = [
      { bucket: '2026-04-01', total: 8000, count: 1 },
      { bucket: '2026-05-01', total: 9000, count: 1 },
    ];

    mockedRepo.getExpenseByPeriod.mockResolvedValueOnce({ data: expensePoints, error: null });
    mockedRepo.getIncomeByPeriod.mockResolvedValueOnce({ data: incomePoints, error: null });

    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useTrend('ARS', PERIOD), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const data = result.current.data;
    expect(data).toHaveLength(2);
    expect(data?.[0]).toEqual({ bucket: '2026-04-01', expenses: 4000, incomes: 8000 });
    expect(data?.[1]).toEqual({ bucket: '2026-05-01', expenses: 5000, incomes: 9000 });
  });

  it('fills incomes with 0 for buckets present only in expenses', async () => {
    const expensePoints: ChartPoint[] = [
      { bucket: '2026-04-01', total: 3000, count: 1 },
      { bucket: '2026-05-01', total: 2000, count: 1 },
    ];
    const incomePoints: ChartPoint[] = [{ bucket: '2026-05-01', total: 7000, count: 1 }];

    mockedRepo.getExpenseByPeriod.mockResolvedValueOnce({ data: expensePoints, error: null });
    mockedRepo.getIncomeByPeriod.mockResolvedValueOnce({ data: incomePoints, error: null });

    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useTrend('ARS', PERIOD), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const data = result.current.data;
    expect(data).toHaveLength(2);

    const apr = data?.find((p) => p.bucket === '2026-04-01');
    expect(apr).toEqual({ bucket: '2026-04-01', expenses: 3000, incomes: 0 });

    const may = data?.find((p) => p.bucket === '2026-05-01');
    expect(may).toEqual({ bucket: '2026-05-01', expenses: 2000, incomes: 7000 });
  });

  it('fills expenses with 0 for buckets present only in incomes', async () => {
    const expensePoints: ChartPoint[] = [{ bucket: '2026-05-01', total: 2000, count: 1 }];
    const incomePoints: ChartPoint[] = [
      { bucket: '2026-04-01', total: 8000, count: 1 },
      { bucket: '2026-05-01', total: 7000, count: 1 },
    ];

    mockedRepo.getExpenseByPeriod.mockResolvedValueOnce({ data: expensePoints, error: null });
    mockedRepo.getIncomeByPeriod.mockResolvedValueOnce({ data: incomePoints, error: null });

    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useTrend('ARS', PERIOD), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const apr = result.current.data?.find((p) => p.bucket === '2026-04-01');
    expect(apr).toEqual({ bucket: '2026-04-01', expenses: 0, incomes: 8000 });
  });

  it('returns data sorted ascending by bucket label', async () => {
    const expensePoints: ChartPoint[] = [
      { bucket: '2026-06-01', total: 1000, count: 1 },
      { bucket: '2026-04-01', total: 3000, count: 1 },
      { bucket: '2026-05-01', total: 2000, count: 1 },
    ];

    mockedRepo.getExpenseByPeriod.mockResolvedValueOnce({ data: expensePoints, error: null });
    mockedRepo.getIncomeByPeriod.mockResolvedValueOnce({ data: [], error: null });

    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useTrend('ARS', PERIOD), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const buckets = result.current.data?.map((p) => p.bucket);
    expect(buckets).toEqual(['2026-04-01', '2026-05-01', '2026-06-01']);
  });

  it('uses monthly bucket for both underlying queries regardless of period.bucket', async () => {
    mockedRepo.getExpenseByPeriod.mockResolvedValueOnce({ data: [], error: null });
    mockedRepo.getIncomeByPeriod.mockResolvedValueOnce({ data: [], error: null });

    const dayPeriod: Period = { ...PERIOD, bucket: 'day' };

    const { wrapper } = makeWrapper();
    renderHook(() => useTrend('ARS', dayPeriod), { wrapper });

    await waitFor(() => expect(mockedRepo.getExpenseByPeriod).toHaveBeenCalled());
    expect(mockedRepo.getExpenseByPeriod).toHaveBeenCalledWith(
      'ARS',
      'month',
      PERIOD.from,
      PERIOD.to,
    );
    expect(mockedRepo.getIncomeByPeriod).toHaveBeenCalledWith(
      'ARS',
      'month',
      PERIOD.from,
      PERIOD.to,
    );
  });

  it('reports isError when expense query fails', async () => {
    mockedRepo.getExpenseByPeriod.mockResolvedValueOnce({
      data: null,
      error: new Error('expense rpc failed'),
    });
    mockedRepo.getIncomeByPeriod.mockResolvedValueOnce({ data: [], error: null });

    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useTrend('ARS', PERIOD), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

// ---------------------------------------------------------------------------
// useAiInsights
// ---------------------------------------------------------------------------

describe('useAiInsights', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns insights from generateInsights when it resolves (happy path)', async () => {
    mockedClient.generateInsights.mockResolvedValueOnce(AI_INSIGHTS);

    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useAiInsights('ARS', PERIOD, GENERATE_INPUT), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(AI_INSIGHTS);
    expect(mockedHeuristics.buildLocalInsights).not.toHaveBeenCalled();
  });

  it('falls back to buildLocalInsights when generateInsights throws InsightsError', async () => {
    mockedClient.generateInsights.mockRejectedValueOnce(
      new client.InsightsError('NETWORK_ERROR', 'offline'),
    );
    mockedHeuristics.buildLocalInsights.mockReturnValueOnce(LOCAL_INSIGHTS);

    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useAiInsights('ARS', PERIOD, GENERATE_INPUT), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(LOCAL_INSIGHTS);
    expect(result.current.isError).toBe(false);
    expect(mockedHeuristics.buildLocalInsights).toHaveBeenCalledWith(GENERATE_INPUT);
  });

  it('falls back to buildLocalInsights when generateInsights throws a generic Error', async () => {
    mockedClient.generateInsights.mockRejectedValueOnce(new Error('timeout'));
    mockedHeuristics.buildLocalInsights.mockReturnValueOnce(LOCAL_INSIGHTS);

    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useAiInsights('ARS', PERIOD, GENERATE_INPUT), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.isError).toBe(false);
    expect(result.current.data).toEqual(LOCAL_INSIGHTS);
  });

  it('is disabled when input is null and does not call generateInsights', () => {
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useAiInsights('ARS', PERIOD, null), { wrapper });

    // Query must be idle (not loading) — enabled:false keeps it from firing.
    expect(result.current.fetchStatus).toBe('idle');
    expect(mockedClient.generateInsights).not.toHaveBeenCalled();
  });

  it('caches insights under the ai key keyed on currency + period label', async () => {
    mockedClient.generateInsights.mockResolvedValue(AI_INSIGHTS);

    const { wrapper, qc } = makeWrapper();
    const { result } = renderHook(() => useAiInsights('ARS', PERIOD, GENERATE_INPUT), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // The cache entry for the correct key must be present.
    const cached = qc.getQueryData(insightKeys.ai('ARS', 'Este mes'));
    expect(cached).toEqual(AI_INSIGHTS);
  });
});
