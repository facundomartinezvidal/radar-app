/**
 * queries.ts
 * Handles movement query intents for the WhatsApp bot.
 *
 * Exports:
 *   handleQuery     — called by dispatch when intent is 'query'
 *   resolvePeriod   — pure function; exported for testing
 *   formatAmount    — pure function; exported for testing
 *
 * Period resolution choice (current calendar week = Mon–now):
 *   'week' resolves to Monday 00:00:00 of the current ISO week through the
 *   last instant of today.  This matches the "esta semana" mental model for
 *   Argentine users ("lo que llevo de la semana") rather than a rolling 7-day
 *   window, and is consistent with the in-app weekly filter.
 *
 * Amount formatting:
 *   ARS: "$ 12.345,67"  (dot thousands, comma decimal, "$ " prefix)
 *   USD: "USD 1.234,56" (same separators, "USD " prefix)
 *   This mirrors the Argentine locale convention for financial figures.
 */

import { sendText } from './twilio.ts';
import { serviceClient } from './db.ts';
import type { Classification, QueryPeriod } from './classify.ts';

// ---------------------------------------------------------------------------
// Period resolver
// ---------------------------------------------------------------------------

export interface ResolvedPeriod {
  from: string; // ISO 8601 timestamptz — start (inclusive)
  to: string; // ISO 8601 timestamptz — end (inclusive)
  label: string; // human-readable prefix for the reply, e.g. "Este mes:"
}

/**
 * Resolves a QueryPeriod discriminated union to concrete ISO timestamps and a
 * rioplatense label.  All arithmetic is relative to `now` so the function is
 * deterministic in tests (just pass a fixed Date).
 *
 * Default when `period` is undefined → current calendar month.
 *
 * Week choice: Monday 00:00:00 of the current ISO week → end of `now` day.
 */
export function resolvePeriod(period: QueryPeriod | undefined, now: Date): ResolvedPeriod {
  // Helpers — work with UTC to avoid TZ drift in the Deno edge runtime.
  // Argentina uses UTC-3 but the edge fn runs at UTC; for "este mes" the
  // difference is acceptable (at most 3 hours off on the first/last day).
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth(); // 0-indexed
  const d = now.getUTCDate();

  /** Returns the start of a given UTC date as ISO string (00:00:00.000Z). */
  function startOfDay(year: number, month: number, day: number): string {
    return new Date(Date.UTC(year, month, day, 0, 0, 0, 0)).toISOString();
  }

  /** Returns the last instant of a given UTC date as ISO string (23:59:59.999Z). */
  function endOfDay(year: number, month: number, day: number): string {
    return new Date(Date.UTC(year, month, day, 23, 59, 59, 999)).toISOString();
  }

  const effectivePeriod: QueryPeriod = period ?? 'month';

  if (effectivePeriod === 'today') {
    return {
      from: startOfDay(y, m, d),
      to: endOfDay(y, m, d),
      label: 'Hoy:',
    };
  }

  if (effectivePeriod === 'week') {
    // ISO week starts on Monday (getUTCDay() = 0 for Sunday, 1 for Monday).
    const dayOfWeek = now.getUTCDay(); // 0=Sun, 1=Mon, …, 6=Sat
    // Days to subtract to reach Monday; Sunday (0) → go back 6 days.
    const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const monday = new Date(Date.UTC(y, m, d - daysToMonday, 0, 0, 0, 0));
    return {
      from: monday.toISOString(),
      to: endOfDay(y, m, d),
      label: 'Esta semana:',
    };
  }

  if (effectivePeriod === 'month') {
    return {
      from: startOfDay(y, m, 1),
      to: endOfDay(y, m, new Date(Date.UTC(y, m + 1, 0)).getUTCDate()),
      label: 'Este mes:',
    };
  }

  if (effectivePeriod === 'prev_month') {
    const prevM = m === 0 ? 11 : m - 1;
    const prevY = m === 0 ? y - 1 : y;
    const lastDay = new Date(Date.UTC(prevY, prevM + 1, 0)).getUTCDate();
    return {
      from: startOfDay(prevY, prevM, 1),
      to: endOfDay(prevY, prevM, lastDay),
      label: 'Mes pasado:',
    };
  }

  if (effectivePeriod === 'year') {
    return {
      from: startOfDay(y, 0, 1),
      to: endOfDay(y, 11, 31),
      label: 'Este año:',
    };
  }

  // Custom range { from, to } — treat the date strings as start/end-of-day UTC.
  const { from: rawFrom, to: rawTo } = effectivePeriod;
  const fromDate = new Date(rawFrom + 'T00:00:00.000Z');
  const toDate = new Date(rawTo + 'T23:59:59.999Z');
  const fromParts = [fromDate.getUTCFullYear(), fromDate.getUTCMonth(), fromDate.getUTCDate()] as [
    number,
    number,
    number,
  ];
  const toParts = [toDate.getUTCFullYear(), toDate.getUTCMonth(), toDate.getUTCDate()] as [
    number,
    number,
    number,
  ];
  const fromLabel = rawFrom.slice(5).replace('-', '/'); // "MM/DD"
  const toLabel = rawTo.slice(5).replace('-', '/');
  return {
    from: startOfDay(...fromParts),
    to: endOfDay(...toParts),
    label: `Del ${fromLabel} al ${toLabel}:`,
  };
}

// ---------------------------------------------------------------------------
// Amount formatter
// ---------------------------------------------------------------------------

/**
 * Formats a numeric amount in Argentine locale style.
 *   ARS → "$ 12.345,67"
 *   USD → "USD 1.234,56"
 *
 * Exported for unit testing.
 */
export function formatAmount(amount: number, currency: string): string {
  // Round to 2 decimal places
  const fixed = amount.toFixed(2);
  const [intPart, decPart] = fixed.split('.');
  // Add dot thousands separator
  const withThousands = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const formatted = `${withThousands},${decPart}`;
  return currency === 'USD' ? `USD ${formatted}` : `$ ${formatted}`;
}

// ---------------------------------------------------------------------------
// RPC row types
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

// ---------------------------------------------------------------------------
// handleQuery
// ---------------------------------------------------------------------------

/**
 * Answers a natural-language query about the user's movements.
 *
 * Decision logic:
 *   - If `queryCategory` is present in entities → call get_expense_by_category_for
 *     (the user asked "¿en qué gasté…?" or filtered by category).
 *   - Otherwise → call get_personal_totals_for for a concise total-per-currency reply.
 *
 * Both paths are read-only; no confirmation is required.
 *
 * @param userId         RADAR user UUID (caller already verified linked).
 * @param waNumber       Sender E.164 number (for replies).
 * @param classification Pre-classified intent + entities (queryPeriod, queryCategory, currency).
 */
export async function handleQuery(
  userId: string,
  waNumber: string,
  classification: Classification,
): Promise<void> {
  const { queryPeriod, queryCategory, currency } = classification.entities;

  const { from, to, label } = resolvePeriod(queryPeriod, new Date());

  try {
    if (queryCategory !== undefined) {
      // Category breakdown path
      await handleCategoryQuery(userId, waNumber, from, to, label, currency);
    } else {
      // Total-per-currency path
      await handleTotalsQuery(userId, waNumber, from, to, label);
    }
  } catch (err) {
    console.error('[queries] handleQuery RPC error:', err);
    await sendText(waNumber, 'No pude consultar tus movimientos ahora, probá de nuevo.');
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Calls get_personal_totals_for and builds a per-currency totals reply.
 * Shows ARS and USD rows when both exist; shows a single line otherwise.
 */
async function handleTotalsQuery(
  userId: string,
  waNumber: string,
  from: string,
  to: string,
  label: string,
): Promise<void> {
  const db = serviceClient();

  const { data, error } = await db.rpc('get_personal_totals_for', {
    p_user_id: userId,
    p_from: from,
    p_to: to,
  });

  if (error) {
    throw new Error(`get_personal_totals_for failed: ${error.message}`);
  }

  const rows = (data ?? []) as TotalsRow[];

  if (rows.length === 0) {
    await sendText(waNumber, 'No tenés movimientos en ese período.');
    return;
  }

  const lines: string[] = [`*Gastos — ${label}*`];
  for (const row of rows) {
    lines.push(
      `${row.currency}: ${formatAmount(Number(row.total), row.currency)} (${row.count} mov.)`,
    );
  }

  await sendText(waNumber, lines.join('\n'));
}

/**
 * Calls get_expense_by_category_for and builds a top-categories reply.
 * Currency defaults to ARS when not specified.
 */
async function handleCategoryQuery(
  userId: string,
  waNumber: string,
  from: string,
  to: string,
  label: string,
  currency: string | undefined,
): Promise<void> {
  const effectiveCurrency = currency ?? 'ARS';
  const db = serviceClient();

  const { data, error } = await db.rpc('get_expense_by_category_for', {
    p_user_id: userId,
    p_currency: effectiveCurrency,
    p_from: from,
    p_to: to,
  });

  if (error) {
    throw new Error(`get_expense_by_category_for failed: ${error.message}`);
  }

  const rows = (data ?? []) as CategoryRow[];

  if (rows.length === 0) {
    await sendText(waNumber, 'No tenés movimientos en ese período.');
    return;
  }

  const TOP = 5;
  const top = rows.slice(0, TOP);
  const grandTotal = rows.reduce((acc, r) => acc + Number(r.total), 0);
  const shownTotal = top.reduce((acc, r) => acc + Number(r.total), 0);

  const lines: string[] = [`*Gastos por categoría (${effectiveCurrency}) — ${label}*`];
  for (const row of top) {
    lines.push(`• ${row.category_name}: ${formatAmount(Number(row.total), effectiveCurrency)}`);
  }

  if (rows.length > TOP) {
    const otherTotal = grandTotal - shownTotal;
    lines.push(`• Otros: ${formatAmount(otherTotal, effectiveCurrency)}`);
  }

  lines.push(`*Total: ${formatAmount(grandTotal, effectiveCurrency)}*`);

  await sendText(waNumber, lines.join('\n'));
}
