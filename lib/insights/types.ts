/**
 * Shared type contract for the Insights feature.
 *
 * This module is pure TypeScript — no React, no Supabase, no I/O.
 * All downstream modules (periods, heuristics, client, hooks, components)
 * import from here.
 */

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

export type Currency = 'ARS' | 'USD';

/** Chart bucketing granularity — matches the Postgres `date_trunc` argument. */
export type Bucket = 'day' | 'week' | 'month';

// ---------------------------------------------------------------------------
// Period
// ---------------------------------------------------------------------------

export type PeriodPresetId = 'this-month' | 'last-month' | 'last-3-months' | 'this-year';

export interface Period {
  /** Human-readable label in es-AR, e.g. "Este mes", "Abril 2026". */
  label: string;
  /** ISO datetime string — inclusive lower bound of the period. */
  from: string;
  /** ISO datetime string — inclusive upper bound of the period. */
  to: string;
  /** Granularity to use when bucketing chart data for this period. */
  bucket: Bucket;
}

// ---------------------------------------------------------------------------
// Insights
// ---------------------------------------------------------------------------

export type InsightKind = 'warning' | 'tip' | 'positive' | 'neutral';

export interface InsightCta {
  label: string;
  route?: string;
}

export interface Insight {
  kind: InsightKind;
  /** Heading — must be ≤ 48 characters. */
  title: string;
  /** Body copy — must be ≤ 160 characters. */
  body: string;
  cta?: InsightCta;
}

// ---------------------------------------------------------------------------
// Chart data shapes
// ---------------------------------------------------------------------------

/** One point in a bucketed chart series. */
export interface ChartPoint {
  bucket: string;
  total: number;
  count?: number;
}

/** One slice of the category donut. */
export interface CategorySlice {
  /** `null` for uncategorized expenses. */
  categoryId: string | null;
  name: string;
  color: string;
  icon: string;
  total: number;
  count: number;
}

// ---------------------------------------------------------------------------
// GenerateInsightsInput — shared by the edge function and the local heuristics
// ---------------------------------------------------------------------------

export interface GenerateInsightsInput {
  currency: Currency;
  period: { label: string; from: string; to: string };
  totals: { expenses: number; incomes: number; net: number };
  byCategory: { name: string; total: number; pct: number }[];
  trend: { bucket: string; expenses: number; incomes: number }[];
  prevPeriodExpenses?: number;
}
