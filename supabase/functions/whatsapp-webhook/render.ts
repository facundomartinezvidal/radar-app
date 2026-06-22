/**
 * render.ts
 * LLM-powered reply renderer for WhatsApp financial query answers.
 *
 * Takes a pre-computed "context block" of EXACT figures (assembled by
 * finance_context.ts) and asks Groq's llama-4-scout model to reframe
 * those figures into a natural, rioplatense WhatsApp reply. The LLM is
 * NEVER allowed to compute or invent numbers — it only copies and
 * rewords the values already present in the DATOS block.
 *
 * Since this module sits in the critical path of every query reply,
 * ANY failure (missing key, timeout, non-2xx, parse error, empty
 * content, verbatim-guard rejection, length-cap breach) transparently
 * returns the supplied deterministic fallback without throwing.
 *
 * Exports:
 *   renderFinancialAnswer        — main entry; NEVER throws
 *   extractMoneyTokens           — pure helper; exported for unit testing
 *   outputUsesOnlyKnownFigures   — pure helper; exported for unit testing
 *   withinLengthLimit            — pure helper; exported for unit testing
 *
 * Env vars consumed:
 *   GROQ_API_KEY  — shared with classify.ts, recommendations.ts, chat.ts
 */

// ---------------------------------------------------------------------------
// Groq constants (mirror chat.ts)
// ---------------------------------------------------------------------------

const GROQ_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'meta-llama/llama-4-scout-17b-16e-instruct';
const GROQ_TIMEOUT_MS = 8_000;

// ---------------------------------------------------------------------------
// Groq internal types (mirror chat.ts)
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
  choices: {
    message: {
      content: string;
    };
  }[];
}

// ---------------------------------------------------------------------------
// Public interface
// ---------------------------------------------------------------------------

export interface RenderArgs {
  /** Exact-figures block assembled by finance_context.ts */
  contextBlock: string;
  /** User's question or a synthesized one for structured queries */
  userQuestion: string;
  /** Template reply to return if the LLM can't be trusted or fails */
  deterministicFallback: string;
}

// ---------------------------------------------------------------------------
// System prompt (Spanish, rioplatense)
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT =
  'Sos el asistente financiero de RADAR para WhatsApp. Hablás español rioplatense (voseo), cercano y claro.\n\n' +
  'REGLA INVIOLABLE: NUNCA calcules, estimes ni inventes montos, cantidades, fechas ni porcentajes. ' +
  'Usá EXCLUSIVAMENTE las cifras que aparecen en el bloque DATOS, copiadas EXACTAMENTE carácter por carácter ' +
  '(incluidos "$", "USD", los puntos de miles y la coma decimal). ' +
  'Si una cifra no está en DATOS, no la menciones.\n\n' +
  'Tu tarea es redactar una respuesta linda y natural a la pregunta usando esas cifras. ' +
  'Podés ordenar, estructurar y agregar contexto breve en prosa. ' +
  'Usá emojis con moderación (1 a 3 como máximo). ' +
  'No uses tablas ni markdown pesado. ' +
  'Máximo ~6 líneas, apto para WhatsApp. ' +
  'Si DATOS dice "sin datos" para lo que se pregunta, decilo con naturalidad sin inventar.';

// ---------------------------------------------------------------------------
// Pure helpers — exported for unit testing
// ---------------------------------------------------------------------------

/**
 * Extracts all monetary and percentage tokens from `text`.
 *
 * Matches:
 *   - ARS amounts:   $1.234,56  or  $ 1.234,56
 *   - USD amounts:   USD1.234,56  or  USD 1.234,56
 *   - Percentages:   -12,5%  +3%  7%
 *
 * Returns the raw matched strings (may contain duplicates).
 */
export function extractMoneyTokens(text: string): string[] {
  const arsPattern = /\$\s?\d{1,3}(?:\.\d{3})*,\d{2}/gi;
  const usdPattern = /USD\s?\d{1,3}(?:\.\d{3})*,\d{2}/gi;
  const pctPattern = /[-+]?\d+(?:,\d+)?%/g;

  const ars = text.match(arsPattern) ?? [];
  const usd = text.match(usdPattern) ?? [];
  const pct = text.match(pctPattern) ?? [];

  return [...ars, ...usd, ...pct];
}

/**
 * Returns `true` if every monetary/percentage token found in `output`
 * also appears in `contextBlock` (after whitespace-normalisation on both
 * sides so "$45.000,00" matches "$ 45.000,00").
 *
 * If `output` contains no money tokens, returns `true` unconditionally —
 * there is nothing to verify.
 */
export function outputUsesOnlyKnownFigures(output: string, contextBlock: string): boolean {
  const tokens = extractMoneyTokens(output);
  if (tokens.length === 0) return true;

  // Normalise by stripping all whitespace for substring matching.
  const normCtx = contextBlock.replace(/\s/g, '');

  for (const token of tokens) {
    const normToken = token.replace(/\s/g, '');
    if (!normCtx.includes(normToken)) {
      return false;
    }
  }

  return true;
}

/**
 * Returns `true` if `output.length <= max`.
 * Default `max` is 1400 characters.
 */
export function withinLengthLimit(output: string, max = 1400): boolean {
  return output.length <= max;
}

// ---------------------------------------------------------------------------
// Main entry
// ---------------------------------------------------------------------------

/**
 * Renders a natural-language WhatsApp reply using Groq, given a pre-built
 * context block of exact financial figures.
 *
 * Returns the LLM's answer on success; `args.deterministicFallback` on ANY
 * failure (no GROQ_API_KEY, timeout, non-2xx, parse error, empty content,
 * verbatim-guard rejection, length-guard breach).
 *
 * NEVER throws.
 */
export async function renderFinancialAnswer(args: RenderArgs): Promise<string> {
  const { contextBlock, userQuestion, deterministicFallback } = args;

  // Step 1 — env guard
  const groqApiKey = Deno.env.get('GROQ_API_KEY');
  if (!groqApiKey) {
    console.log('[render] GROQ_API_KEY not set — using fallback');
    return deterministicFallback;
  }

  const payload: GroqRequestPayload = {
    model: GROQ_MODEL,
    temperature: 0.4,
    max_tokens: 300,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: `DATOS:\n${contextBlock}\n\nPregunta del usuario: ${userQuestion}`,
      },
    ],
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), GROQ_TIMEOUT_MS);

  // Step 2 — fetch
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
      console.error('[render] Groq request timed out — using fallback');
    } else {
      console.error('[render] Groq fetch error — using fallback:', fetchErr);
    }
    return deterministicFallback;
  } finally {
    clearTimeout(timeoutId);
  }

  // Step 3 — non-2xx
  if (!groqResponse.ok) {
    const errBody = await groqResponse.text().catch(() => '(unreadable)');
    console.error(`[render] Groq non-2xx: ${groqResponse.status} — ${errBody} — using fallback`);
    return deterministicFallback;
  }

  // Step 4 — JSON parse
  let groqData: GroqResponsePayload;
  try {
    groqData = (await groqResponse.json()) as GroqResponsePayload;
  } catch (parseErr) {
    console.error('[render] Failed to parse Groq JSON — using fallback:', parseErr);
    return deterministicFallback;
  }

  // Step 5 — empty / missing content
  const answer = groqData?.choices?.[0]?.message?.content?.trim();
  if (!answer) {
    console.error('[render] Empty or missing Groq content — using fallback');
    return deterministicFallback;
  }

  // Step 6 — length guard
  if (!withinLengthLimit(answer)) {
    console.log('[render] output too long — using fallback');
    return deterministicFallback;
  }

  // Step 7 — verbatim number guard
  if (!outputUsesOnlyKnownFigures(answer, contextBlock)) {
    console.log('[render] output contained an unknown figure — using fallback');
    return deterministicFallback;
  }

  // Step 8 — success
  return answer;
}
