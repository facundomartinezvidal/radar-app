/**
 * recommendations.ts
 * Handles recommendation/insights intents for the WhatsApp bot.
 *
 * Exports:
 *   handleRecommendation  — called when intent is 'recommendation'
 *   buildInsightsPayload  — pure helper; exported for unit testing
 *
 * Flow:
 *   1. Resolve period (current month by default; respects queryPeriod entity).
 *   2. Determine currency (entities.currency || 'ARS').
 *   3. Gather aggregates via SECURITY DEFINER RPCs (service-role client):
 *        get_personal_totals_for       → expenses / incomes / net
 *        get_expense_by_category_for   → byCategory with pct
 *        get_expense_by_period_for     → trend expenses per bucket
 *        get_income_by_period_for      → trend incomes per bucket
 *        get_personal_totals_for (prev period) → prevPeriodExpenses
 *   4. Guard: if both expenses and incomes are 0 → graceful "no data" reply.
 *   5. POST to generate-insights edge function.
 *   6. Format top 1–3 insights as WhatsApp bold-title + body messages.
 *   7. Fallback on generate-insights error → "no disponible ahora" reply.
 *
 * All operations are READ-ONLY.
 *
 * Env vars consumed (injected by Supabase runtime):
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   WHATSAPP_INTERNAL_SECRET
 */

import { sendText } from './graph.ts';
import { serviceClient } from './db.ts';
import { resolvePeriod, type ResolvedPeriod } from './queries.ts';
import type { Classification, QueryPeriod } from './classify.ts';

// ---------------------------------------------------------------------------
// Internal RPC row types
// ---------------------------------------------------------------------------

interface TotalsRow {
  currency: string;
  total: number;
  count: number;
}

interface CategoryRow {
  category_id: string;
  category_name: string;
  color: string;
  icon: string;
  total: number;
  count: number;
}

interface PeriodRow {
  bucket: string;
  total: number;
  count: number;
}

// ---------------------------------------------------------------------------
// generate-insights response types
// ---------------------------------------------------------------------------

interface Insight {
  kind: 'warning' | 'tip' | 'positive' | 'neutral';
  title: string;
  body: string;
  cta?: { label: string; route: string | null };
}

interface InsightsResponse {
  data: { insights: Insight[] };
}

// ---------------------------------------------------------------------------
// InsightsPayload — matches generate-insights RequestBody exactly
// ---------------------------------------------------------------------------

export interface InsightsPayload {
  currency: 'ARS' | 'USD';
  period: { label: string; from: string; to: string };
  totals: { expenses: number; incomes: number; net: number };
  byCategory: { name: string; total: number; pct: number }[];
  trend: { bucket: string; expenses: number; incomes: number }[];
  prevPeriodExpenses?: number;
}

// ---------------------------------------------------------------------------
// Pure payload builder — exported for testing
// ---------------------------------------------------------------------------

/**
 * Assembles the generate-insights request body from the raw RPC results.
 *
 * - `totalsRows`: rows from get_personal_totals_for for the current period.
 *   Only the row matching `currency` is used.
 * - `categoryRows`: rows from get_expense_by_category_for; pct is computed
 *   as total / sumExpenses * 100 (0 when sumExpenses = 0).
 * - `expensePeriodRows`: rows from get_expense_by_period_for.
 * - `incomePeriodRows`: rows from get_income_by_period_for.
 * - `prevTotalsRows`: rows from get_personal_totals_for for the previous period;
 *   only the row matching `currency` is extracted.
 * - `currency`: 'ARS' | 'USD'.
 * - `period`: resolved period (from resolvePeriod).
 *
 * All numeric values are coerced to numbers via Number() to handle the string
 * decimals that Supabase/pg_catalog returns for numeric columns.
 */
export function buildInsightsPayload(
  totalsRows: TotalsRow[],
  categoryRows: CategoryRow[],
  expensePeriodRows: PeriodRow[],
  incomePeriodRows: PeriodRow[],
  prevTotalsRows: TotalsRow[],
  currency: 'ARS' | 'USD',
  period: ResolvedPeriod,
): InsightsPayload {
  // --- totals ---
  const totalsRow = totalsRows.find((r) => r.currency === currency);
  const expenses = totalsRow ? Number(totalsRow.total) : 0;

  // Incomes come from the income period rows (sum of all buckets)
  // but we also use get_personal_totals_for which only tracks expenses table.
  // The generate-insights fn accepts incomes in totals; we derive it from
  // the income period rows so we have consistent data.
  const incomesTotal = incomePeriodRows.reduce((acc, r) => acc + Number(r.total), 0);
  const net = incomesTotal - expenses;

  // --- byCategory ---
  const sumExpenses = categoryRows.reduce((acc, r) => acc + Number(r.total), 0);
  const byCategory = categoryRows.map((r) => ({
    name: r.category_name,
    total: Number(r.total),
    pct: sumExpenses > 0 ? (Number(r.total) / sumExpenses) * 100 : 0,
  }));

  // --- trend ---
  // Merge expense and income period rows by bucket key (ISO date string).
  const trendMap = new Map<string, { expenses: number; incomes: number }>();

  for (const r of expensePeriodRows) {
    const key = String(r.bucket);
    const entry = trendMap.get(key) ?? { expenses: 0, incomes: 0 };
    entry.expenses += Number(r.total);
    trendMap.set(key, entry);
  }

  for (const r of incomePeriodRows) {
    const key = String(r.bucket);
    const entry = trendMap.get(key) ?? { expenses: 0, incomes: 0 };
    entry.incomes += Number(r.total);
    trendMap.set(key, entry);
  }

  const trend = Array.from(trendMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([bucket, vals]) => ({ bucket, ...vals }));

  // --- prevPeriodExpenses ---
  const prevRow = prevTotalsRows.find((r) => r.currency === currency);
  const prevPeriodExpenses = prevRow !== undefined ? Number(prevRow.total) : undefined;

  const payload: InsightsPayload = {
    currency,
    period: { label: period.label, from: period.from, to: period.to },
    totals: { expenses, incomes: incomesTotal, net },
    byCategory,
    trend,
  };

  if (prevPeriodExpenses !== undefined) {
    payload.prevPeriodExpenses = prevPeriodExpenses;
  }

  return payload;
}

// ---------------------------------------------------------------------------
// Insufficient-data predicate — exported for testing
// ---------------------------------------------------------------------------

/**
 * Returns true when the payload has no meaningful data (both totals are 0
 * and there are no trend entries), indicating the period has no activity.
 */
export function isInsufficientData(payload: InsightsPayload): boolean {
  return payload.totals.expenses === 0 && payload.totals.incomes === 0;
}

// ---------------------------------------------------------------------------
// Previous-period bounds helper
// ---------------------------------------------------------------------------

/**
 * Given a current-period resolved period, computes the previous calendar month's
 * bounds using resolvePeriod with 'prev_month' and a reference date inside the
 * current month.
 *
 * For simplicity (the bot deals in current/prev month), we always resolve
 * the previous calendar month regardless of the actual period kind.
 */
function resolvePrevPeriod(currentFrom: string): ResolvedPeriod {
  // Parse the from date of the current period to a Date inside that month
  const fromDate = new Date(currentFrom);
  // Add a day to ensure we are well inside the month (avoids UTC edge-case
  // where the first of the month at 00:00:00Z could drift to the previous month).
  fromDate.setUTCDate(fromDate.getUTCDate() + 1);
  return resolvePeriod('prev_month', fromDate);
}

// ---------------------------------------------------------------------------
// Reply formatter
// ---------------------------------------------------------------------------

/**
 * Formats 1–3 top insights into a WhatsApp-friendly multi-line string.
 * Each insight is formatted as: *title*\nbody
 * Multiple insights are separated by a blank line.
 */
function formatInsightsReply(insights: Insight[]): string {
  const top = insights.slice(0, 3);
  return top.map((ins) => `*${ins.title}*\n${ins.body}`).join('\n\n');
}

// ---------------------------------------------------------------------------
// handleRecommendation
// ---------------------------------------------------------------------------

/**
 * Produces spending recommendations for a linked user by aggregating their
 * data via SECURITY DEFINER RPCs and calling the generate-insights edge fn.
 *
 * @param userId         RADAR user UUID (caller already verified linked).
 * @param waNumber       Sender E.164 number (for replies).
 * @param classification Pre-classified intent + entities (period/currency hints).
 */
export async function handleRecommendation(
  userId: string,
  waNumber: string,
  classification: Classification,
): Promise<void> {
  const { queryPeriod, currency: entityCurrency } = classification.entities;

  const currency: 'ARS' | 'USD' = entityCurrency ?? 'ARS';
  const period = resolvePeriod(queryPeriod as QueryPeriod | undefined, new Date());
  const prevPeriod = resolvePrevPeriod(period.from);

  const db = serviceClient();

  // ── Gather aggregates in parallel ─────────────────────────────────────────
  let totalsRows: TotalsRow[];
  let categoryRows: CategoryRow[];
  let expensePeriodRows: PeriodRow[];
  let incomePeriodRows: PeriodRow[];
  let prevTotalsRows: TotalsRow[];

  try {
    const [totalsRes, catRes, expPeriodRes, incPeriodRes, prevTotalsRes] = await Promise.all([
      db.rpc('get_personal_totals_for', {
        p_user_id: userId,
        p_from: period.from,
        p_to: period.to,
      }),
      db.rpc('get_expense_by_category_for', {
        p_user_id: userId,
        p_currency: currency,
        p_from: period.from,
        p_to: period.to,
      }),
      db.rpc('get_expense_by_period_for', {
        p_user_id: userId,
        p_currency: currency,
        p_bucket: 'month',
        p_from: period.from,
        p_to: period.to,
      }),
      db.rpc('get_income_by_period_for', {
        p_user_id: userId,
        p_currency: currency,
        p_bucket: 'month',
        p_from: period.from,
        p_to: period.to,
      }),
      db.rpc('get_personal_totals_for', {
        p_user_id: userId,
        p_from: prevPeriod.from,
        p_to: prevPeriod.to,
      }),
    ]);

    if (totalsRes.error) throw new Error(`get_personal_totals_for: ${totalsRes.error.message}`);
    if (catRes.error) throw new Error(`get_expense_by_category_for: ${catRes.error.message}`);
    if (expPeriodRes.error)
      throw new Error(`get_expense_by_period_for: ${expPeriodRes.error.message}`);
    if (incPeriodRes.error)
      throw new Error(`get_income_by_period_for: ${incPeriodRes.error.message}`);
    if (prevTotalsRes.error)
      throw new Error(`get_personal_totals_for (prev): ${prevTotalsRes.error.message}`);

    totalsRows = (totalsRes.data ?? []) as TotalsRow[];
    categoryRows = (catRes.data ?? []) as CategoryRow[];
    expensePeriodRows = (expPeriodRes.data ?? []) as PeriodRow[];
    incomePeriodRows = (incPeriodRes.data ?? []) as PeriodRow[];
    prevTotalsRows = (prevTotalsRes.data ?? []) as TotalsRow[];
  } catch (rpcErr) {
    console.error('[recommendations] RPC error:', rpcErr);
    await sendText(waNumber, 'No pude consultar tus datos ahora, probá más tarde.');
    return;
  }

  // ── Build payload ──────────────────────────────────────────────────────────
  const payload = buildInsightsPayload(
    totalsRows,
    categoryRows,
    expensePeriodRows,
    incomePeriodRows,
    prevTotalsRows,
    currency,
    period,
  );

  // ── Insufficient data guard ────────────────────────────────────────────────
  if (isInsufficientData(payload)) {
    await sendText(
      waNumber,
      'Todavía no tengo suficientes datos de este período para darte recomendaciones. Registrá algunos gastos y volvé a preguntarme.',
    );
    return;
  }

  // ── Call generate-insights ─────────────────────────────────────────────────
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const internalSecret = Deno.env.get('WHATSAPP_INTERNAL_SECRET') ?? '';

  let insightsRes: Response;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20_000);
    try {
      insightsRes = await fetch(`${supabaseUrl}/functions/v1/generate-insights`, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${serviceRoleKey}`,
          'x-whatsapp-internal-secret': internalSecret,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (fetchErr) {
    console.error('[recommendations] generate-insights fetch error:', fetchErr);
    await sendText(waNumber, 'No pude generar recomendaciones ahora, probá más tarde.');
    return;
  }

  if (!insightsRes.ok) {
    const errBody = await insightsRes.text().catch(() => '(unreadable)');
    console.error(
      `[recommendations] generate-insights non-2xx: ${insightsRes.status} — ${errBody}`,
    );
    await sendText(waNumber, 'No pude generar recomendaciones ahora, probá más tarde.');
    return;
  }

  let parsed: InsightsResponse;
  try {
    parsed = (await insightsRes.json()) as InsightsResponse;
  } catch (parseErr) {
    console.error('[recommendations] Failed to parse generate-insights response:', parseErr);
    await sendText(waNumber, 'No pude generar recomendaciones ahora, probá más tarde.');
    return;
  }

  const insights: Insight[] = parsed?.data?.insights ?? [];

  // Empty insights array → model found no data worth recommending
  if (insights.length === 0) {
    await sendText(
      waNumber,
      'Todavía no tengo suficientes datos de este período para darte recomendaciones. Registrá algunos gastos y volvé a preguntarme.',
    );
    return;
  }

  const reply = formatInsightsReply(insights);
  await sendText(waNumber, reply);
}
