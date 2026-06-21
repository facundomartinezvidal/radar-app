/**
 * Insights repository — thin wrappers over the three aggregation RPCs.
 *
 * Every function returns `{ data, error }` mirroring the RepoResult contract
 * from expenses.ts. RLS enforces ownership; RPCs are SECURITY INVOKER so they
 * run under the authenticated caller's context.
 */
import type { PostgrestError } from '@supabase/supabase-js';

import { supabase } from '@/lib/supabase';
import type { Bucket, CategorySlice, ChartPoint, Currency } from '@/lib/insights/types';

// Re-export the shared result type so callers need only one import.
export interface RepoResult<T> {
  data: T | null;
  error: PostgrestError | Error | null;
}

// ---------------------------------------------------------------------------
// getExpenseByCategory
// ---------------------------------------------------------------------------

/**
 * Returns per-category expense totals for the authenticated user scoped to the
 * given currency and optional date range.
 *
 * Delegates to `get_expense_by_category` which applies share-aware logic:
 * personal expenses contribute their full `amount`; group expenses contribute
 * only the caller's `share_amount` from `expense_splits`.
 */
export async function getExpenseByCategory(
  currency: Currency,
  from?: string,
  to?: string,
): Promise<RepoResult<CategorySlice[]>> {
  const { data, error } = await supabase.rpc('get_expense_by_category', {
    p_currency: currency,
    p_from: from,
    p_to: to,
  });

  if (error || !data) return { data: null, error };

  return {
    data: (
      data as {
        category_id: string;
        category_name: string;
        color: string;
        icon: string;
        total: number;
        count: number;
      }[]
    ).map((row) => ({
      categoryId: row.category_id,
      name: row.category_name,
      color: row.color,
      icon: row.icon,
      total: Number(row.total),
      count: Number(row.count),
    })),
    error: null,
  };
}

// ---------------------------------------------------------------------------
// getExpenseByPeriod
// ---------------------------------------------------------------------------

/**
 * Returns expense totals bucketed by the given granularity for the authenticated
 * user, scoped to the given currency and optional date range.
 *
 * Delegates to `get_expense_by_period` which applies the same share-aware logic
 * as `get_expense_by_category`.
 */
export async function getExpenseByPeriod(
  currency: Currency,
  bucket: Bucket,
  from?: string,
  to?: string,
): Promise<RepoResult<ChartPoint[]>> {
  const { data, error } = await supabase.rpc('get_expense_by_period', {
    p_currency: currency,
    p_bucket: bucket,
    p_from: from,
    p_to: to,
  });

  if (error || !data) return { data: null, error };

  return {
    data: (data as { bucket: string; total: number; count: number }[]).map((row) => ({
      bucket: row.bucket,
      total: Number(row.total),
      count: Number(row.count),
    })),
    error: null,
  };
}

// ---------------------------------------------------------------------------
// getIncomeByPeriod
// ---------------------------------------------------------------------------

/**
 * Returns income totals bucketed by the given granularity for the authenticated
 * user, scoped to the given currency and optional date range.
 *
 * Delegates to `get_income_by_period`.
 */
export async function getIncomeByPeriod(
  currency: Currency,
  bucket: Bucket,
  from?: string,
  to?: string,
): Promise<RepoResult<ChartPoint[]>> {
  const { data, error } = await supabase.rpc('get_income_by_period', {
    p_currency: currency,
    p_bucket: bucket,
    p_from: from,
    p_to: to,
  });

  if (error || !data) return { data: null, error };

  return {
    data: (data as { bucket: string; total: number; count: number }[]).map((row) => ({
      bucket: row.bucket,
      total: Number(row.total),
      count: Number(row.count),
    })),
    error: null,
  };
}
