/**
 * chat.ts
 * Handles the conversational AI (`chat`) intent for the WhatsApp bot.
 *
 * When a user asks an open-ended financial question ("¿en qué se me va la
 * plata?", "¿gasto mucho en comida?") that is not a simple total, list, or
 * explicit advice request, this handler assembles a FinancialContext via
 * finance_context.ts and routes it through render.ts for LLM rendering with
 * a deterministic fallback.
 *
 * Exports:
 *   handleChat            — main intent handler; called from dispatch.ts
 *   buildChatContextBlock — pure helper; exported for unit testing (legacy)
 *
 * Design notes:
 *   - Period-aware: resolves period from classification.entities.queryPeriod.
 *   - assembleFinancialContext fetches all data in parallel.
 *   - renderFinancialAnswer handles all LLM failures transparently.
 *   - NEVER throws — on RPC error it replies with a friendly fallback.
 *   - Read-only; no pending action / confirmation gate required.
 *
 * Env vars consumed:
 *   GROQ_API_KEY                — via render.ts
 *   SUPABASE_URL                — (via serviceClient() in db.ts / finance_context.ts)
 *   SUPABASE_SERVICE_ROLE_KEY   — (via serviceClient() in db.ts / finance_context.ts)
 */

import { sendText } from './twilio.ts';
import { resolvePeriod, buildTotalsReply } from './queries.ts';
import { assembleFinancialContext, buildFinancialContextBlock } from './finance_context.ts';
import { renderFinancialAnswer } from './render.ts';
import type { Classification } from './classify.ts';

// ---------------------------------------------------------------------------
// Internal RPC row types (kept for buildChatContextBlock — exported for tests)
// ---------------------------------------------------------------------------

interface TotalsRow {
  currency: string;
  total: number;
  count: number;
}

interface CategoryRow {
  category_name: string;
  total: number;
  count: number;
}

interface MovementRow {
  direction: 'expense' | 'income';
  amount: number;
  currency: string;
  description: string | null;
  category_name: string | null;
  occurred_at: string;
}

// ---------------------------------------------------------------------------
// Context block builder — exported for unit testing
// ---------------------------------------------------------------------------

export interface ChatContextData {
  totals: TotalsRow[];
  topCategories: CategoryRow[];
  recentMovements: MovementRow[];
  periodLabel: string;
}

/**
 * Builds a compact, WhatsApp-safe context string from the user's financial
 * data aggregates for the current month.
 *
 * Deliberately compact: Groq replies are short (≤ 4 lines), so we feed it
 * only the most relevant figures rather than a full dump.
 *
 * Exported as a pure function so it can be unit-tested without network access.
 */
export function buildChatContextBlock(data: ChatContextData): string {
  const lines: string[] = [`Período: ${data.periodLabel.replace(/:$/, '')}`];

  // Totals
  if (data.totals.length > 0) {
    const totalsStr = data.totals
      .map((r) => `${r.currency}: gastos=${Number(r.total).toFixed(2)} (${r.count} mov.)`)
      .join(', ');
    lines.push(`Totales — ${totalsStr}`);
  } else {
    lines.push('Totales — sin datos');
  }

  // Top categories (max 5)
  if (data.topCategories.length > 0) {
    const catStr = data.topCategories
      .slice(0, 5)
      .map((c) => `${c.category_name}: ${Number(c.total).toFixed(2)}`)
      .join('; ');
    lines.push(`Top categorías (ARS): ${catStr}`);
  }

  // Recent movements (max 10)
  if (data.recentMovements.length > 0) {
    const movStr = data.recentMovements
      .map((m) => {
        const datePart = m.occurred_at.slice(0, 10);
        const [, mm, dd] = datePart.split('-');
        const dirLabel = m.direction === 'expense' ? 'gasto' : 'ingreso';
        const desc = m.description ? ` "${m.description}"` : '';
        const cat = m.category_name ? ` [${m.category_name}]` : '';
        return `${dd}/${mm} ${dirLabel} ${m.currency} ${Number(m.amount).toFixed(2)}${desc}${cat}`;
      })
      .join('; ');
    lines.push(`Últimos movimientos: ${movStr}`);
  } else {
    lines.push('Últimos movimientos: sin datos');
  }

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// handleChat
// ---------------------------------------------------------------------------

/**
 * Handles an open-ended conversational question about the user's finances.
 *
 * Steps:
 *   1. Resolve period from classification entities (period-aware).
 *   2. Assemble FinancialContext (totals + categories + last-10 movements).
 *   3. Build an exact-figures context block via buildFinancialContextBlock.
 *   4. Render a natural WhatsApp reply via renderFinancialAnswer (LLM with
 *      deterministic fallback via buildTotalsReply).
 *   5. On RPC error → friendly fallback; render.ts handles all LLM failures.
 *
 * @param userId         RADAR user UUID (caller already verified linked).
 * @param waNumber       Sender E.164 number (for replies).
 * @param text           The user's raw message text (used as the question).
 * @param classification Pre-classified intent + entities (queryPeriod, currency).
 */
export async function handleChat(
  userId: string,
  waNumber: string,
  text: string,
  classification: Classification,
): Promise<void> {
  const period = resolvePeriod(classification.entities.queryPeriod, new Date());

  let ctx;
  try {
    ctx = await assembleFinancialContext(userId, period, {
      currency: classification.entities.currency,
      includeMovements: true,
      movementLimit: 10,
      includeIncomeCategories: false,
    });
  } catch (rpcErr) {
    console.error('[chat] RPC error:', rpcErr);
    await sendText(waNumber, 'No pude analizar tus movimientos ahora, probá de nuevo.');
    return;
  }

  // No-data guard: both totals empty AND no movements
  const noData = ctx.byCurrency.length === 0 && ctx.recentMovements.length === 0;
  if (noData) {
    await sendText(
      waNumber,
      'Todavía no tengo movimientos tuyos para analizar. Registrá algunos gastos y volvé a preguntarme.',
    );
    return;
  }

  const contextBlock = buildFinancialContextBlock(ctx);
  const fallback = buildTotalsReply(ctx);
  const reply = await renderFinancialAnswer({
    contextBlock,
    userQuestion: text,
    deterministicFallback: fallback,
  });
  await sendText(waNumber, reply);
}
