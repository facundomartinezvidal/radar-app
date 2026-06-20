/**
 * TanStack Query hooks for the Insights screen.
 *
 * One central place that maps repository functions to query keys.
 * Screens import these hooks, never the repo directly.
 * Mirrors the pattern established in hooks/use-expenses.ts and hooks/use-incomes.ts.
 */
import { useQueries, useQuery } from '@tanstack/react-query';

import { generateInsights } from '@/lib/insights/client';
import { buildLocalInsights } from '@/lib/insights/heuristics';
import type {
  Bucket,
  CategorySlice,
  ChartPoint,
  Currency,
  GenerateInsightsInput,
  Insight,
  Period,
} from '@/lib/insights/types';
import {
  getExpenseByCategory,
  getExpenseByPeriod,
  getIncomeByPeriod,
} from '@/lib/repositories/insights';

// ---------------------------------------------------------------------------
// Query key factory
// ---------------------------------------------------------------------------

export const insightKeys = {
  all: ['insights'] as const,
  byCategory: (currency: Currency, from?: string, to?: string) =>
    [...insightKeys.all, 'by-category', currency, from, to] as const,
  byPeriod: (currency: Currency, bucket: Bucket, from?: string, to?: string) =>
    [...insightKeys.all, 'by-period', currency, bucket, from, to] as const,
  incomeByPeriod: (currency: Currency, bucket: Bucket, from?: string, to?: string) =>
    [...insightKeys.all, 'income-by-period', currency, bucket, from, to] as const,
  ai: (currency: Currency, periodLabel: string) =>
    [...insightKeys.all, 'ai', currency, periodLabel] as const,
};

// ---------------------------------------------------------------------------
// Chart hooks
// ---------------------------------------------------------------------------

/**
 * Expense totals grouped by category for the active period and currency.
 * Returns `CategorySlice[]` for the donut chart.
 */
export function useExpenseByCategory(currency: Currency, period: Period) {
  return useQuery<CategorySlice[]>({
    queryKey: insightKeys.byCategory(currency, period.from, period.to),
    queryFn: async () => {
      const { data, error } = await getExpenseByCategory(currency, period.from, period.to);
      if (error) throw error;
      return data ?? [];
    },
  });
}

/**
 * Expense totals bucketed by the period's granularity for the bar chart.
 * Returns `ChartPoint[]`.
 */
export function useExpenseByPeriod(currency: Currency, period: Period) {
  return useQuery<ChartPoint[]>({
    queryKey: insightKeys.byPeriod(currency, period.bucket, period.from, period.to),
    queryFn: async () => {
      const { data, error } = await getExpenseByPeriod(
        currency,
        period.bucket,
        period.from,
        period.to,
      );
      if (error) throw error;
      return data ?? [];
    },
  });
}

/**
 * Income totals bucketed by the period's granularity.
 * Returns `ChartPoint[]`.
 */
export function useIncomeByPeriod(currency: Currency, period: Period) {
  return useQuery<ChartPoint[]>({
    queryKey: insightKeys.incomeByPeriod(currency, period.bucket, period.from, period.to),
    queryFn: async () => {
      const { data, error } = await getIncomeByPeriod(
        currency,
        period.bucket,
        period.from,
        period.to,
      );
      if (error) throw error;
      return data ?? [];
    },
  });
}

// ---------------------------------------------------------------------------
// Trend data shape
// ---------------------------------------------------------------------------

export interface TrendPoint {
  bucket: string;
  expenses: number;
  incomes: number;
}

// ---------------------------------------------------------------------------
// useTrend
// ---------------------------------------------------------------------------

/**
 * Composes monthly expense and income buckets into a joined trend series.
 *
 * Uses `useQueries` to fire two parallel monthly queries (one for expenses,
 * one for incomes), then joins the results by `bucket`, filling any missing
 * side with 0. Sorted ascending by bucket label.
 *
 * The joined array is keyed on monthly granularity regardless of the period's
 * own `bucket` — monthly bucketing is what the trend chart needs.
 */
export function useTrend(currency: Currency, period: Period) {
  const results = useQueries({
    queries: [
      {
        queryKey: insightKeys.byPeriod(currency, 'month', period.from, period.to),
        queryFn: async (): Promise<ChartPoint[]> => {
          const { data, error } = await getExpenseByPeriod(
            currency,
            'month',
            period.from,
            period.to,
          );
          if (error) throw error;
          return data ?? [];
        },
      },
      {
        queryKey: insightKeys.incomeByPeriod(currency, 'month', period.from, period.to),
        queryFn: async (): Promise<ChartPoint[]> => {
          const { data, error } = await getIncomeByPeriod(
            currency,
            'month',
            period.from,
            period.to,
          );
          if (error) throw error;
          return data ?? [];
        },
      },
    ],
  });

  const [expensesQuery, incomesQuery] = results;

  const isLoading = expensesQuery.isLoading || incomesQuery.isLoading;
  const isError = expensesQuery.isError || incomesQuery.isError;
  const error = expensesQuery.error ?? incomesQuery.error;
  const isSuccess = expensesQuery.isSuccess && incomesQuery.isSuccess;

  const data: TrendPoint[] | undefined = isSuccess
    ? (() => {
        const expensePoints = expensesQuery.data ?? [];
        const incomePoints = incomesQuery.data ?? [];

        // Build a map keyed by bucket; merge both sides.
        const map = new Map<string, TrendPoint>();

        for (const point of expensePoints) {
          map.set(point.bucket, {
            bucket: point.bucket,
            expenses: point.total,
            incomes: 0,
          });
        }

        for (const point of incomePoints) {
          const existing = map.get(point.bucket);
          if (existing) {
            existing.incomes = point.total;
          } else {
            map.set(point.bucket, {
              bucket: point.bucket,
              expenses: 0,
              incomes: point.total,
            });
          }
        }

        return Array.from(map.values()).sort((a, b) => a.bucket.localeCompare(b.bucket));
      })()
    : undefined;

  return { data, isLoading, isError, isSuccess, error };
}

// ---------------------------------------------------------------------------
// useAiInsights
// ---------------------------------------------------------------------------

/**
 * Fetches AI-generated insights from the `generate-insights` edge function.
 *
 * Resilience contract: any failure (InsightsError, network, timeout) silently
 * falls back to `buildLocalInsights`. The query is NEVER put in error state
 * — if even the local fallback throws (which it should not), we return [].
 *
 * Caching: 1-hour staleTime per (currency, period.label) key to limit Groq cost.
 * Disabled when `input` is null (aggregates not yet available).
 */
export function useAiInsights(
  currency: Currency,
  period: Period,
  input: GenerateInsightsInput | null,
) {
  return useQuery<Insight[]>({
    queryKey: insightKeys.ai(currency, period.label),
    staleTime: 1000 * 60 * 60, // 1 hour
    gcTime: 1000 * 60 * 60 * 6, // 6 hours
    enabled: input !== null,
    queryFn: async () => {
      try {
        return await generateInsights(input!);
      } catch {
        return buildLocalInsights(input!);
      }
    },
  });
}
