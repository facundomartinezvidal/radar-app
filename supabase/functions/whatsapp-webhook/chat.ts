/**
 * chat.ts
 * Handles the conversational AI (`chat`) intent for the WhatsApp bot.
 *
 * When a user asks an open-ended financial question ("¿en qué se me va la
 * plata?", "¿gasto mucho en comida?") that is not a simple total, list, or
 * explicit advice request, this handler assembles a compact data context from
 * the user's own movements and asks Groq's llama-4-scout model to answer.
 *
 * Exports:
 *   handleChat          — main intent handler; called from dispatch.ts
 *   buildChatContextBlock — pure helper; exported for unit testing
 *
 * Design notes:
 *   - Mirrors the Groq call pattern from classify.ts / recommendations.ts.
 *   - All data is fetched in parallel (same pattern as handleRecommendation).
 *   - NEVER throws — on any error it replies with a friendly fallback.
 *   - Read-only; no pending action / confirmation gate required.
 *
 * Env vars consumed:
 *   GROQ_API_KEY                — shared with classify.ts and extract-document
 *   SUPABASE_URL                — (via serviceClient() in db.ts)
 *   SUPABASE_SERVICE_ROLE_KEY   — (via serviceClient() in db.ts)
 */

import { sendText } from './twilio.ts';
import { serviceClient } from './db.ts';
import { resolvePeriod } from './queries.ts';
import type { Classification } from './classify.ts';

// ---------------------------------------------------------------------------
// Groq constants (mirror classify.ts)
// ---------------------------------------------------------------------------

const GROQ_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'meta-llama/llama-4-scout-17b-16e-instruct';
const GROQ_TIMEOUT_MS = 12_000;

// ---------------------------------------------------------------------------
// Internal RPC row types
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
// Groq internal types (mirror classify.ts)
// ---------------------------------------------------------------------------

interface GroqMessage {
  role: string;
  content: string;
}

interface GroqRequestPayload {
  model: string;
  messages: GroqMessage[];
  temperature: number;
  max_tokens: number;
}

interface GroqResponsePayload {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

// ---------------------------------------------------------------------------
// handleChat
// ---------------------------------------------------------------------------

/**
 * Handles an open-ended conversational question about the user's finances.
 *
 * Steps:
 *   1. Fetch current-month totals, top-5 ARS categories, and last-10 movements.
 *   2. Build a compact context block.
 *   3. POST to Groq with a rioplatense financial-assistant system prompt.
 *   4. Reply with the model's answer.
 *   5. On any error (no data, RPC failure, Groq error) → friendly fallback.
 *
 * @param userId         RADAR user UUID (caller already verified linked).
 * @param waNumber       Sender E.164 number (for replies).
 * @param text           The user's raw message text (used as the question).
 * @param _classification Pre-classified intent (unused entities; kept for dispatch symmetry).
 */
export async function handleChat(
  userId: string,
  waNumber: string,
  text: string,
  _classification: Classification,
): Promise<void> {
  const groqApiKey = Deno.env.get('GROQ_API_KEY');
  if (!groqApiKey) {
    console.error('[chat] GROQ_API_KEY not set — returning fallback');
    await sendText(waNumber, 'No pude analizar tus movimientos ahora, probá de nuevo.');
    return;
  }

  // Resolve current-month period
  const period = resolvePeriod(undefined, new Date());
  const db = serviceClient();

  // Fetch data in parallel
  let totals: TotalsRow[];
  let topCategories: CategoryRow[];
  let recentMovements: MovementRow[];

  try {
    const [totalsRes, catRes, movRes] = await Promise.all([
      db.rpc('get_personal_totals_for', {
        p_user_id: userId,
        p_from: period.from,
        p_to: period.to,
      }),
      db.rpc('get_expense_by_category_for', {
        p_user_id: userId,
        p_currency: 'ARS',
        p_from: period.from,
        p_to: period.to,
      }),
      db.rpc('get_recent_movements_for', {
        p_user_id: userId,
        p_limit: 10,
        p_direction: null,
      }),
    ]);

    if (totalsRes.error) throw new Error(`get_personal_totals_for: ${totalsRes.error.message}`);
    if (catRes.error) throw new Error(`get_expense_by_category_for: ${catRes.error.message}`);
    if (movRes.error) throw new Error(`get_recent_movements_for: ${movRes.error.message}`);

    totals = (totalsRes.data ?? []) as TotalsRow[];
    topCategories = (catRes.data ?? []) as CategoryRow[];
    recentMovements = (movRes.data ?? []) as MovementRow[];
  } catch (rpcErr) {
    console.error('[chat] RPC error:', rpcErr);
    await sendText(waNumber, 'No pude analizar tus movimientos ahora, probá de nuevo.');
    return;
  }

  // No data guard
  if (totals.length === 0 && recentMovements.length === 0) {
    await sendText(
      waNumber,
      'Todavía no tengo movimientos tuyos para analizar. Registrá algunos gastos y volvé a preguntarme.',
    );
    return;
  }

  const contextBlock = buildChatContextBlock({
    totals,
    topCategories,
    recentMovements,
    periodLabel: period.label,
  });

  const systemPrompt =
    'Sos el asistente financiero de RADAR. Respondé en español rioplatense (voseo), ' +
    'breve y claro para WhatsApp (máx ~4 líneas, sin markdown pesado). ' +
    'Usá SOLO los datos provistos del usuario; si faltan datos, decilo. No inventes montos.';

  const userContent = `Datos del usuario:\n${contextBlock}\n\nPregunta: ${text}`;

  const payload: GroqRequestPayload = {
    model: GROQ_MODEL,
    temperature: 0.4,
    max_tokens: 300,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userContent },
    ],
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), GROQ_TIMEOUT_MS);

  let groqResponse: Response;
  try {
    groqResponse = await fetch(GROQ_ENDPOINT, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${groqApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
  } catch (fetchErr: unknown) {
    clearTimeout(timeoutId);
    const isAbort = fetchErr instanceof Error && fetchErr.name === 'AbortError';
    if (isAbort) {
      console.error('[chat] Groq request timed out');
    } else {
      console.error('[chat] Groq fetch error:', fetchErr);
    }
    await sendText(waNumber, 'No pude analizar tus movimientos ahora, probá de nuevo.');
    return;
  } finally {
    clearTimeout(timeoutId);
  }

  if (!groqResponse.ok) {
    const errBody = await groqResponse.text().catch(() => '(unreadable)');
    console.error(`[chat] Groq non-2xx: ${groqResponse.status} — ${errBody}`);
    await sendText(waNumber, 'No pude analizar tus movimientos ahora, probá de nuevo.');
    return;
  }

  let groqData: GroqResponsePayload;
  try {
    groqData = (await groqResponse.json()) as GroqResponsePayload;
  } catch (parseErr) {
    console.error('[chat] Failed to parse Groq JSON:', parseErr);
    await sendText(waNumber, 'No pude analizar tus movimientos ahora, probá de nuevo.');
    return;
  }

  const answer = groqData?.choices?.[0]?.message?.content?.trim();
  if (!answer) {
    console.error('[chat] Unexpected Groq response shape:', groqData);
    await sendText(waNumber, 'No pude analizar tus movimientos ahora, probá de nuevo.');
    return;
  }

  await sendText(waNumber, answer);
}
