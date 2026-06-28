/**
 * finance_context.ts
 * Shared financial context assembler for the WhatsApp bot.
 *
 * Exports:
 *   assembleFinancialContext  — IO; fetches user data via SECURITY DEFINER RPCs
 *                               and returns a typed FinancialContext object.
 *   buildFinancialContextBlock — PURE; converts a FinancialContext into an
 *                                exact-figures text block for LLM consumption.
 *                                The LLM copies this block verbatim — it must
 *                                NEVER compute figures itself.
 *   computeMoMPercent         — PURE helper; exported for unit testing.
 *   formatSignedAmount        — PURE helper; exported for unit testing.
 *   formatPercent             — PURE helper; exported for unit testing.
 *
 * Design notes:
 *   - All monetary figures (net balance, MoM %) are computed deterministically
 *     here before the LLM ever sees them.  This is the single source of truth.
 *   - All parallel RPC fetches use Promise.all; on any RPC error assembleFinancialContext
 *     throws so the caller can fall back to a deterministic template.
 *   - buildFinancialContextBlock is PURE and never throws; it emits "sin datos"
 *     sentinels for empty collections rather than raising.
 *   - Numeric values from Supabase numeric columns are coerced with Number() to
 *     handle the string-decimal representation returned by pg_catalog.
 *
 * Env vars consumed (via serviceClient() in db.ts):
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import { serviceClient } from './db.ts';
import {
  formatAmount,
  formatMovementLine,
  resolvePeriod,
  type MovementRow,
  type ResolvedPeriod,
} from './queries.ts';

// ---------------------------------------------------------------------------
// Internal RPC row types
// ---------------------------------------------------------------------------

interface TotalsRow {
  currency: string;
  total: number | string;
  count: number | string;
}

interface CategoryRow {
  category_id: string;
  category_name: string;
  color: string;
  icon: string;
  total: number | string;
  count: number | string;
}

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface CurrencyTotals {
  currency: string;
  expenses: number;
  incomes: number;
  /** incomes - expenses; computed here, never by the LLM */
  net: number;
  expenseCount: number;
  incomeCount: number;
}

export interface ContextCategory {
  name: string;
  total: number;
}

export interface FinancialContext {
  /** Period label WITHOUT trailing ':' e.g. "Este mes" */
  periodLabel: string;
  /** Previous period label WITHOUT trailing ':' e.g. "Mes pasado" */
  prevPeriodLabel: string;
  /** Currency used for category breakdowns (default 'ARS') */
  primaryCurrency: string;
  /** Merged expense+income rows per currency; sorted ARS → USD → alphabetical */
  byCurrency: CurrencyTotals[];
  /** Top expense categories (primaryCurrency, max 5) */
  topExpenseCategories: ContextCategory[];
  /** Top income categories — only populated when opts.includeIncomeCategories; else [] */
  topIncomeCategories: ContextCategory[];
  /** Recent movements — only populated when opts.includeMovements; else [] */
  recentMovements: MovementRow[];
  /** Previous-period expense totals per currency (for MoM line) */
  prevExpensesByCurrency: { currency: string; total: number }[];
}

export interface AssembleOpts {
  /** Primary currency for category breakdown; default 'ARS' */
  currency?: string;
  /** Whether to fetch recent movements (chat = true, totals query = false) */
  includeMovements?: boolean;
  /** Number of recent movements to fetch; default 10 */
  movementLimit?: number;
  /** Whether to fetch income-by-category; default false */
  includeIncomeCategories?: boolean;
}

// ---------------------------------------------------------------------------
// Private: previous-period resolver
// Lifted from recommendations.ts (resolvePrevPeriod) — NOT exported.
// ---------------------------------------------------------------------------

/**
 * Given the from-timestamp of the current period, resolves the previous
 * calendar month's bounds.
 *
 * Adds one day to the from date to guard against UTC midnight edge-cases where
 * the first of the month at 00:00:00Z could drift to the previous month.
 */
function resolvePrevPeriod(currentFrom: string): ResolvedPeriod {
  const fromDate = new Date(currentFrom);
  fromDate.setUTCDate(fromDate.getUTCDate() + 1);
  return resolvePeriod('prev_month', fromDate);
}

// ---------------------------------------------------------------------------
// Pure helpers — exported for unit testing
// ---------------------------------------------------------------------------

/**
 * Computes month-over-month percentage change.
 *
 * Returns null when prev === 0 (avoids division-by-zero; caller should omit
 * the MoM line rather than display Infinity or NaN).
 *
 * Returns a raw (unrounded) number; use formatPercent for display.
 */
export function computeMoMPercent(current: number, prev: number): number | null {
  if (prev === 0) return null;
  return ((current - prev) / prev) * 100;
}

/**
 * Formats a net amount with an explicit sign prefix.
 *   net > 0  → "+$ 205.000,00"  or "+USD 100,00"
 *   net < 0  → "-$ 205.000,00"  or "-USD 100,00"
 *   net === 0 → "+$ 0,00"
 */
export function formatSignedAmount(net: number, currency: string): string {
  const sign = net < 0 ? '-' : '+';
  return `${sign}${formatAmount(Math.abs(net), currency)}`;
}

/**
 * Formats a raw percentage to 1 decimal place with Argentine comma separator.
 *
 *   -13.46 → "-13,5%"
 *    8.2   → "+8,2%"
 *    0     → "+0,0%"
 */
export function formatPercent(pct: number): string {
  const rounded = Math.abs(pct).toFixed(1).replace('.', ',');
  const sign = pct < 0 ? '-' : '+';
  return `${sign}${rounded}%`;
}

// ---------------------------------------------------------------------------
// Private: currency sort helper
// ---------------------------------------------------------------------------

/** Sorts currencies: ARS first, USD second, then alphabetical. */
function compareCurrency(a: string, b: string): number {
  if (a === b) return 0;
  if (a === 'ARS') return -1;
  if (b === 'ARS') return 1;
  if (a === 'USD') return -1;
  if (b === 'USD') return 1;
  return a.localeCompare(b);
}

// ---------------------------------------------------------------------------
// assembleFinancialContext
// ---------------------------------------------------------------------------

/**
 * Fetches a user's financial data via parallel SECURITY DEFINER RPC calls and
 * returns a fully-assembled FinancialContext object.
 *
 * Net balance and month-over-month % are computed here — the LLM must not
 * compute them from the raw figures.
 *
 * Throws on any RPC error; the caller is responsible for catching and falling
 * back to a deterministic template reply.
 *
 * @param userId  RADAR user UUID.
 * @param period  Pre-resolved period (from/to ISO timestamps + label).
 * @param opts    Optional configuration for category/movement inclusion.
 */
export async function assembleFinancialContext(
  userId: string,
  period: ResolvedPeriod,
  opts?: AssembleOpts,
): Promise<FinancialContext> {
  const primaryCurrency = opts?.currency ?? 'ARS';
  const includeMovements = opts?.includeMovements ?? false;
  const movementLimit = opts?.movementLimit ?? 10;
  const includeIncomeCategories = opts?.includeIncomeCategories ?? false;

  const prevPeriod = resolvePrevPeriod(period.from);
  const db = serviceClient();

  // Build the base parallel fetch array (always 4 calls)
  const basePromises = [
    db.rpc('get_personal_totals_for', {
      p_user_id: userId,
      p_from: period.from,
      p_to: period.to,
    }),
    db.rpc('get_income_totals_for', {
      p_user_id: userId,
      p_from: period.from,
      p_to: period.to,
    }),
    db.rpc('get_expense_by_category_for', {
      p_user_id: userId,
      p_currency: primaryCurrency,
      p_from: period.from,
      p_to: period.to,
    }),
    db.rpc('get_personal_totals_for', {
      p_user_id: userId,
      p_from: prevPeriod.from,
      p_to: prevPeriod.to,
    }),
  ] as const;

  // Conditional calls (indices 4 and 5)
  const movementsPromise = includeMovements
    ? db.rpc('get_recent_movements_for', {
        p_user_id: userId,
        p_limit: movementLimit,
        p_direction: null,
      })
    : Promise.resolve({ data: [], error: null });

  const incomeCatPromise = includeIncomeCategories
    ? db.rpc('get_income_by_category_for', {
        p_user_id: userId,
        p_currency: primaryCurrency,
        p_from: period.from,
        p_to: period.to,
      })
    : Promise.resolve({ data: [], error: null });

  const [expTotalsRes, incTotalsRes, expCatRes, prevExpTotalsRes, movRes, incCatRes] =
    await Promise.all([...basePromises, movementsPromise, incomeCatPromise]);

  // Throw on any RPC error so the caller can fall back
  if (expTotalsRes.error) throw new Error(`get_personal_totals_for: ${expTotalsRes.error.message}`);
  if (incTotalsRes.error) throw new Error(`get_income_totals_for: ${incTotalsRes.error.message}`);
  if (expCatRes.error) throw new Error(`get_expense_by_category_for: ${expCatRes.error.message}`);
  if (prevExpTotalsRes.error)
    throw new Error(`get_personal_totals_for (prev): ${prevExpTotalsRes.error.message}`);
  if (movRes.error) throw new Error(`get_recent_movements_for: ${movRes.error.message}`);
  if (incCatRes.error) throw new Error(`get_income_by_category_for: ${incCatRes.error.message}`);

  const expTotalsRows = (expTotalsRes.data ?? []) as TotalsRow[];
  const incTotalsRows = (incTotalsRes.data ?? []) as TotalsRow[];
  const expCatRows = (expCatRes.data ?? []) as CategoryRow[];
  const prevExpTotalsRows = (prevExpTotalsRes.data ?? []) as TotalsRow[];
  const movementRows = (movRes.data ?? []) as MovementRow[];
  const incCatRows = (incCatRes.data ?? []) as CategoryRow[];

  // ── Merge expense + income totals into byCurrency ─────────────────────────
  // Collect all currencies from both lists
  const currencySet = new Set<string>();
  for (const r of expTotalsRows) currencySet.add(r.currency);
  for (const r of incTotalsRows) currencySet.add(r.currency);

  const byCurrency: CurrencyTotals[] = Array.from(currencySet)
    .sort(compareCurrency)
    .map((cur) => {
      const expRow = expTotalsRows.find((r) => r.currency === cur);
      const incRow = incTotalsRows.find((r) => r.currency === cur);
      const expenses = expRow ? Number(expRow.total) : 0;
      const incomes = incRow ? Number(incRow.total) : 0;
      return {
        currency: cur,
        expenses,
        incomes,
        net: incomes - expenses,
        expenseCount: expRow ? Number(expRow.count) : 0,
        incomeCount: incRow ? Number(incRow.count) : 0,
      };
    });

  // ── Category breakdowns ───────────────────────────────────────────────────
  const topExpenseCategories: ContextCategory[] = expCatRows.slice(0, 5).map((r) => ({
    name: r.category_name,
    total: Number(r.total),
  }));

  const topIncomeCategories: ContextCategory[] = includeIncomeCategories
    ? incCatRows.slice(0, 5).map((r) => ({
        name: r.category_name,
        total: Number(r.total),
      }))
    : [];

  // ── Previous-period expense totals ────────────────────────────────────────
  const prevExpensesByCurrency = prevExpTotalsRows.map((r) => ({
    currency: r.currency,
    total: Number(r.total),
  }));

  // ── Strip trailing ':' from labels ───────────────────────────────────────
  const periodLabel = period.label.replace(/:$/, '');
  const prevPeriodLabel = prevPeriod.label.replace(/:$/, '');

  return {
    periodLabel,
    prevPeriodLabel,
    primaryCurrency,
    byCurrency,
    topExpenseCategories,
    topIncomeCategories,
    recentMovements: movementRows,
    prevExpensesByCurrency,
  };
}

// ---------------------------------------------------------------------------
// buildFinancialContextBlock — PURE
// ---------------------------------------------------------------------------

/**
 * Builds the exact-figures text block that the LLM will copy verbatim into its
 * reply.  Every monetary value and percentage is pre-formatted here; the LLM
 * must reproduce these strings without recomputing them.
 *
 * Never throws.  Missing data is represented by sentinel strings
 * ("sin datos", omitted lines) rather than exceptions.
 *
 * @param ctx  Assembled FinancialContext from assembleFinancialContext.
 * @returns    Multi-line string joined with '\n'.
 */
export function buildFinancialContextBlock(ctx: FinancialContext): string {
  const lines: string[] = [];

  // ── Header ────────────────────────────────────────────────────────────────
  lines.push(`Período: ${ctx.periodLabel}`);
  lines.push(`Período anterior: ${ctx.prevPeriodLabel}`);

  // ── Balance por moneda ────────────────────────────────────────────────────
  lines.push('Balance por moneda:');
  if (ctx.byCurrency.length === 0) {
    lines.push('- sin datos');
  } else {
    for (const row of ctx.byCurrency) {
      lines.push(
        `- ${row.currency}: gastos ${formatAmount(row.expenses, row.currency)} (${row.expenseCount} mov.) · ` +
          `ingresos ${formatAmount(row.incomes, row.currency)} (${row.incomeCount} mov.) · ` +
          `neto ${formatSignedAmount(row.net, row.currency)}`,
      );
    }
  }

  // ── Top categorías de gasto ───────────────────────────────────────────────
  if (ctx.topExpenseCategories.length > 0) {
    const catStr = ctx.topExpenseCategories
      .map((c) => `${c.name} ${formatAmount(c.total, ctx.primaryCurrency)}`)
      .join('; ');
    lines.push(`Top categorías de gasto (${ctx.primaryCurrency}): ${catStr}`);
  }

  // ── Top categorías de ingreso ─────────────────────────────────────────────
  if (ctx.topIncomeCategories.length > 0) {
    const incCatStr = ctx.topIncomeCategories
      .map((c) => `${c.name} ${formatAmount(c.total, ctx.primaryCurrency)}`)
      .join('; ');
    lines.push(`Top categorías de ingreso (${ctx.primaryCurrency}): ${incCatStr}`);
  }

  // ── Comparación MoM ───────────────────────────────────────────────────────
  const curRow = ctx.byCurrency.find((r) => r.currency === ctx.primaryCurrency);
  const curExp = curRow?.expenses ?? 0;
  const prevRow = ctx.prevExpensesByCurrency.find((r) => r.currency === ctx.primaryCurrency);
  const prevExp = prevRow?.total ?? 0;
  const mom = computeMoMPercent(curExp, prevExp);

  if (mom !== null) {
    lines.push(
      `Comparación gastos ${ctx.primaryCurrency} vs ${ctx.prevPeriodLabel}: ` +
        `este período ${formatAmount(curExp, ctx.primaryCurrency)} / ` +
        `anterior ${formatAmount(prevExp, ctx.primaryCurrency)} (${formatPercent(mom)})`,
    );
  }

  // ── Últimos movimientos ───────────────────────────────────────────────────
  if (ctx.recentMovements.length === 0) {
    lines.push('Últimos movimientos: sin datos');
  } else {
    lines.push('Últimos movimientos:');
    for (const row of ctx.recentMovements) {
      lines.push(formatMovementLine(row));
    }
  }

  return lines.join('\n');
}
