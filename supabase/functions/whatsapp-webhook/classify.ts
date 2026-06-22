/**
 * classify.ts
 * Natural-language intent classifier for the WhatsApp bot.
 *
 * Exports a single `classifyIntent(text)` function that sends a single Groq
 * chat-completions call and returns a structured `Classification` object.
 *
 * Design notes:
 *   - One call per message; the prompt is entirely in the system message so
 *     Groq's prompt caching can reuse it across requests.
 *   - response_format: { type: 'json_object' } guarantees parseable output.
 *   - temperature: 0 keeps classification deterministic.
 *   - An AbortController timeout mirrors the pattern used by generate-insights.
 *   - On ANY Groq error (timeout, HTTP error, parse failure) the function
 *     returns the safe fallback { intent: 'unknown', entities: {}, confidence: 0,
 *     language: 'es' }. The caller decides how to handle 'unknown'.
 *
 * Env vars consumed:
 *   GROQ_API_KEY — shared with extract-document and generate-insights
 */

// ---------------------------------------------------------------------------
// Constants — mirrored from generate-insights for consistency
// ---------------------------------------------------------------------------

const GROQ_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'meta-llama/llama-4-scout-17b-16e-instruct';
const GROQ_TIMEOUT_MS = 10_000;

// Low-confidence threshold exported so tests and the router can use the same value
export const LOW_CONFIDENCE_THRESHOLD = 0.4;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type IntentKind =
  | 'capture_expense'
  | 'capture_income'
  | 'query'
  | 'recommendation'
  | 'chat'
  | 'confirm'
  | 'cancel'
  | 'unlink'
  | 'help'
  | 'unknown';

export type QueryPeriod =
  | 'today'
  | 'week'
  | 'month'
  | 'prev_month'
  | 'year'
  | { from: string; to: string };

export interface ClassificationEntities {
  /** Numeric amount (positive). Present only when parseable from the message. */
  amount?: number;
  /** Only 'USD' when explicitly stated ("dólares", "usd", "dolares"). */
  currency?: 'ARS' | 'USD';
  /** Human-readable description extracted from the message. */
  description?: string;
  /** Merchant or payee name when identifiable. */
  merchant?: string;
  /**
   * Date of occurrence as ISO yyyy-mm-dd.
   * Must not be a future date; if the extracted date is in the future, omit.
   */
  occurredAt?: string;
  /** Suggested category label inferred from context (e.g. "Supermercado"). */
  categoryHint?: string;
  /** Explicit direction override — only set when the message is unambiguous. */
  direction?: 'expense' | 'income';
  /** Resolved query period for 'query' intents. */
  queryPeriod?: QueryPeriod;
  /** Category filter for 'query' intents. */
  queryCategory?: string;
  /**
   * When true, the user is asking for individual movement rows (a list),
   * not aggregated totals.  Signals: "últimos", "último", "última",
   * "detalle", "movimientos", "listá/listame", "mostrame los",
   * "cuáles fueron", "cuál fue mi último".
   */
  listMode?: boolean;
  /**
   * How many rows to return when listMode is true.
   * Extracted from "último/última/el último" → 1; "últimos N" → N.
   * Defaults to 5 in the handler when listMode is true but limit is absent.
   * Clamped to [1, 20] by normaliseClassification.
   */
  limit?: number;
}

export interface Classification {
  intent: IntentKind;
  entities: ClassificationEntities;
  /** 0..1 confidence score returned by the model. */
  confidence: number;
  /** ISO 639-1 language code, e.g. 'es', 'en'. */
  language: string;
}

// ---------------------------------------------------------------------------
// Safe fallback returned on any error
// ---------------------------------------------------------------------------

const FALLBACK: Classification = {
  intent: 'unknown',
  entities: {},
  confidence: 0,
  language: 'es',
};

// ---------------------------------------------------------------------------
// Groq internal types
// ---------------------------------------------------------------------------

interface GroqMessage {
  role: string;
  content: string;
}

interface GroqRequestPayload {
  model: string;
  messages: GroqMessage[];
  response_format: { type: 'json_object' };
  temperature: number;
}

interface GroqResponsePayload {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

// ---------------------------------------------------------------------------
// System prompt
// ---------------------------------------------------------------------------

/**
 * Builds the classifier system prompt.
 *
 * Intent mapping (exhaustive):
 *   capture_expense  — registrar un gasto ("gasté", "pagué", "compré", "salió")
 *   capture_income   — registrar un ingreso ("cobré", "me pagaron", "entró", "sueldo", "ingresó")
 *   query            — consultar movimientos ("¿cuánto?", "¿qué gasté?", "mostrá mis gastos")
 *                      For the `query` intent: when the user asks for INDIVIDUAL movement rows /
 *                      a list / the latest one (signals: "últimos", "último", "última", "detalle",
 *                      "movimientos", "listá/listame", "mostrame los", "cuáles fueron",
 *                      "cuál fue mi último"), set listMode: true.
 *                      Extract limit: "último/última/el último" → 1; "últimos tres/3" → 3;
 *                      default 5 if listMode is true but no count given.
 *                      Keep listMode false/omitted for "¿cuánto gasté?" totals queries.
 *                      Use direction entity to scope: "gastos" → "expense", "ingresos" → "income".
 *   recommendation   — pedir consejo/recomendación ("dame un consejo", "¿cómo vengo?", "recomendación")
 *   chat             — preguntas abiertas/conversación sobre las finanzas del usuario que NO son
 *                      un total simple, una lista de movimientos ni un pedido de consejo explícito.
 *                      Señales: "¿en qué se me va la plata?", "¿gasto mucho en comida?",
 *                      "explicame mis gastos del mes", "¿me conviene…?", preguntas financieras
 *                      generales sobre sus datos.
 *   confirm          — confirmar una acción pendiente (sí/dale/ok/claro/confirmo/va/bueno)
 *   cancel           — cancelar una acción pendiente (no/cancelá/cancelar/olvidate/no gracias)
 *   unlink           — desvincular el número ("desvinculá", "unlink", "quiero desvincularme")
 *   help             — pedir ayuda ("¿qué podés hacer?", "ayuda", "help", "comandos")
 *   unknown          — nada de lo anterior o ambiguo
 *
 * Argentine money phrasing (always aware of):
 *   "luca" = 1 000 ARS, "palo" = 1 000 000 ARS
 *   "verde/dólares/usd/USD/u$s" → currency: "USD"; anything else → omit currency field
 *   "hoy" → today, "ayer" → yesterday, "esta semana" → week, "este mes" → month
 *
 * The model MUST return ONLY valid JSON matching this shape:
 * {
 *   "intent": "<one of the intents above>",
 *   "entities": {
 *     "amount": <number|omit>,
 *     "currency": <"ARS"|"USD"|omit — only USD when explicit>,
 *     "description": <string|omit>,
 *     "merchant": <string|omit>,
 *     "occurredAt": <"yyyy-mm-dd"|omit — never future>,
 *     "categoryHint": <string|omit>,
 *     "direction": <"expense"|"income"|omit>,
 *     "queryPeriod": <"today"|"week"|"month"|"prev_month"|"year"|{"from":"yyyy-mm-dd","to":"yyyy-mm-dd"}|omit>,
 *     "queryCategory": <string|omit>,
 *     "listMode": <true|omit — only set to true, never false>,
 *     "limit": <positive integer 1..20|omit — only when listMode is true>
 *   },
 *   "confidence": <0.0..1.0>,
 *   "language": <ISO 639-1 code e.g. "es">
 * }
 */
function buildSystemPrompt(): string {
  const today = new Date().toISOString().slice(0, 10);
  return `Sos el clasificador de intenciones del bot de RADAR, una app de finanzas personales para usuarios argentinos.

Tu tarea es analizar el mensaje del usuario y devolver ÚNICAMENTE un objeto JSON (sin texto antes ni después) con esta estructura exacta:
{
  "intent": "<intent>",
  "entities": { ... },
  "confidence": <0.0 a 1.0>,
  "language": "<código ISO 639-1>"
}

## Intents válidos (elegí UNO):
- "capture_expense": el usuario quiere registrar un gasto. Señales: "gasté", "pagué", "compré", "salió", "cargué", "me cobró", "fui al", "almorcé", "cené".
- "capture_income": el usuario quiere registrar un ingreso. Señales: "cobré", "me pagaron", "entró", "sueldo", "ingresó", "facturé", "me depositaron", "transferí", "recibí".
- "query": el usuario quiere consultar sus movimientos. Señales: "¿cuánto gasté?", "mostrá", "¿qué gasté?", "mis gastos", "¿cómo estoy?", "balance", "resumen", "ver movimientos".
  - IMPORTANTE: cuando el usuario pide movimientos INDIVIDUALES o una lista ("últimos", "último", "última", "detalle", "movimientos", "listá/listame", "mostrame los", "cuáles fueron", "cuál fue mi último"), usá intent "query" Y setea listMode: true.
  - "listMode": true cuando pide lista/detalle; omitilo (o false) para totales/resumen agregado.
  - "limit": "último/última/el último" → 1; "últimos 3"/"últimos tres" → 3; si listMode true pero no hay número → 5. Omití si listMode no es true.
- "recommendation": el usuario pide un consejo o análisis. Señales: "dame un consejo", "¿cómo vengo?", "recomendación", "análisis", "¿estoy gastando mucho?", "sugerencia".
- "chat": el usuario hace preguntas abiertas sobre sus finanzas que NO son un total simple, una lista ni un consejo explícito. Señales: "¿en qué se me va la plata?", "¿gasto mucho en comida?", "explicame mis gastos del mes", "¿me conviene…?", preguntas generales sobre sus datos financieros. Usá "chat" cuando el usuario quiere conversar/explorar sus finanzas libremente.
- "confirm": el usuario confirma una acción pendiente. Señales: "sí", "si", "dale", "ok", "confirmo", "va", "bueno", "claro", "perfecto", "listo", "de acuerdo".
- "cancel": el usuario cancela una acción pendiente. Señales: "no", "cancelá", "cancelar", "olvidate", "no gracias", "dejalo", "para".
- "unlink": el usuario quiere desvincular su número. Señales: "desvinculá", "desvinculame", "unlink", "quiero desvincularte", "sacame".
- "help": el usuario pide ayuda o quiere saber qué puede hacer el bot. Señales: "ayuda", "help", "¿qué podés hacer?", "comandos", "opciones".
- "unknown": no encaja en ningún intent anterior o el mensaje es demasiado ambiguo.

## Extracción de entidades:
- amount: número positivo. "una luca" = 1000, "dos lucas" = 2000, "un palo" = 1000000, "medio palo" = 500000. Omití si no hay monto.
- currency: "USD" ÚNICAMENTE cuando el usuario dice explícitamente "dólares", "dolares", "USD", "usd", "u$s", "verdes", "dólar". En todos los demás casos OMITÍ este campo (no pongas "ARS").
- description: descripción textual de la transacción. Omití si no aplica.
- merchant: nombre del comercio o persona si está identificable. Omití si no aplica.
- occurredAt: fecha en formato "yyyy-mm-dd". "hoy" = ${today}. Nunca pongas una fecha futura. Omití si no hay fecha.
- categoryHint: categoría sugerida en español (e.g. "Supermercado", "Transporte", "Restaurante"). Omití si no podés inferir.
- direction: "expense" o "income". Sólo cuando es inequívoco. Omití si el intent ya lo define. Para "query" con listMode: "gastos" → "expense", "ingresos" → "income"; omití para ambos.
- queryPeriod: para intents "query". Valores: "today", "week", "month", "prev_month", "year", o {"from":"yyyy-mm-dd","to":"yyyy-mm-dd"} para rangos específicos.
- queryCategory: categoría específica para filtrar en queries. Omití si no se menciona.
- listMode: true SOLO cuando el usuario pide movimientos individuales/lista (ver "query" arriba). Nunca pongas false; simplemente omití si no aplica.
- limit: número entero positivo (1–20) SOLO cuando listMode es true. Omití en cualquier otro caso.

## Reglas estrictas:
- Devolvé ÚNICAMENTE JSON válido. Sin texto extra.
- confidence: 0.9–1.0 si el intent es claro; 0.6–0.89 si es probable; 0.4–0.59 si es incierto; <0.4 si es muy ambiguo.
- Para capture_expense/capture_income: si falta el monto, igual clasificá el intent correcto (omití "amount"). El handler preguntará.
- language: código ISO 639-1 del idioma del mensaje (probablemente "es").`;
}

// ---------------------------------------------------------------------------
// Raw classification normaliser
// ---------------------------------------------------------------------------

/**
 * Validates and coerces the raw JSON returned by Groq into a safe
 * Classification object.  Any field that fails validation is dropped.
 * On total parse failure, returns null so the caller can use FALLBACK.
 */
function normaliseClassification(raw: unknown): Classification | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;

  // intent
  const VALID_INTENTS = new Set<IntentKind>([
    'capture_expense',
    'capture_income',
    'query',
    'recommendation',
    'chat',
    'confirm',
    'cancel',
    'unlink',
    'help',
    'unknown',
  ]);
  const intent = VALID_INTENTS.has(obj['intent'] as IntentKind)
    ? (obj['intent'] as IntentKind)
    : 'unknown';

  // confidence
  const rawConf = obj['confidence'];
  const confidence = typeof rawConf === 'number' && rawConf >= 0 && rawConf <= 1 ? rawConf : 0;

  // language
  const rawLang = obj['language'];
  const language = typeof rawLang === 'string' && rawLang.length > 0 ? rawLang : 'es';

  // entities
  const rawEntities = obj['entities'];
  const entities: ClassificationEntities = {};

  if (rawEntities && typeof rawEntities === 'object') {
    const e = rawEntities as Record<string, unknown>;

    // amount — must be a positive finite number
    if (typeof e['amount'] === 'number' && e['amount'] > 0 && isFinite(e['amount'])) {
      entities.amount = e['amount'];
    }

    // currency — only 'ARS' | 'USD'
    if (e['currency'] === 'ARS' || e['currency'] === 'USD') {
      entities.currency = e['currency'];
    }

    // description
    if (typeof e['description'] === 'string' && e['description'].trim().length > 0) {
      entities.description = e['description'].trim();
    }

    // merchant
    if (typeof e['merchant'] === 'string' && e['merchant'].trim().length > 0) {
      entities.merchant = e['merchant'].trim();
    }

    // occurredAt — must match yyyy-mm-dd and not be in the future
    if (typeof e['occurredAt'] === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(e['occurredAt'])) {
      const today = new Date().toISOString().slice(0, 10);
      if (e['occurredAt'] <= today) {
        entities.occurredAt = e['occurredAt'];
      }
    }

    // categoryHint
    if (typeof e['categoryHint'] === 'string' && e['categoryHint'].trim().length > 0) {
      entities.categoryHint = e['categoryHint'].trim();
    }

    // direction
    if (e['direction'] === 'expense' || e['direction'] === 'income') {
      entities.direction = e['direction'];
    }

    // queryPeriod
    const VALID_PERIOD_STRINGS = new Set(['today', 'week', 'month', 'prev_month', 'year']);
    const rawPeriod = e['queryPeriod'];
    if (typeof rawPeriod === 'string' && VALID_PERIOD_STRINGS.has(rawPeriod)) {
      entities.queryPeriod = rawPeriod as QueryPeriod;
    } else if (rawPeriod && typeof rawPeriod === 'object') {
      const p = rawPeriod as Record<string, unknown>;
      if (
        typeof p['from'] === 'string' &&
        /^\d{4}-\d{2}-\d{2}$/.test(p['from']) &&
        typeof p['to'] === 'string' &&
        /^\d{4}-\d{2}-\d{2}$/.test(p['to'])
      ) {
        entities.queryPeriod = { from: p['from'], to: p['to'] };
      }
    }

    // queryCategory
    if (typeof e['queryCategory'] === 'string' && e['queryCategory'].trim().length > 0) {
      entities.queryCategory = e['queryCategory'].trim();
    }

    // listMode — accept only boolean true; drop anything else
    if (e['listMode'] === true) {
      entities.listMode = true;
    }

    // limit — positive integer, clamped to [1, 20]; only kept when listMode is set
    if (entities.listMode === true) {
      const rawLimit = e['limit'];
      if (typeof rawLimit === 'number' && isFinite(rawLimit)) {
        const clamped = Math.max(1, Math.min(20, Math.floor(rawLimit)));
        if (clamped >= 1) {
          entities.limit = clamped;
        }
      }
    }
  }

  return { intent, entities, confidence, language };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Classifies the intent of a WhatsApp message via a single Groq call.
 *
 * @param text  The trimmed text body of the incoming message.
 * @returns     A Classification describing the intent, extracted entities,
 *              confidence score, and detected language.
 *
 * NEVER throws — on any error (network, timeout, parse, missing key) it
 * returns the safe fallback { intent: 'unknown', entities: {}, confidence: 0,
 * language: 'es' }.
 */
export async function classifyIntent(text: string): Promise<Classification> {
  const groqApiKey = Deno.env.get('GROQ_API_KEY');
  if (!groqApiKey) {
    console.error('[classify] GROQ_API_KEY is not set — returning fallback');
    return { ...FALLBACK };
  }

  const payload: GroqRequestPayload = {
    model: GROQ_MODEL,
    response_format: { type: 'json_object' },
    temperature: 0,
    messages: [
      { role: 'system', content: buildSystemPrompt() },
      { role: 'user', content: text },
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
      console.error('[classify] Groq request timed out');
    } else {
      console.error('[classify] Groq fetch error:', fetchErr);
    }
    return { ...FALLBACK };
  } finally {
    clearTimeout(timeoutId);
  }

  if (!groqResponse.ok) {
    const errBody = await groqResponse.text().catch(() => '(unreadable)');
    console.error(`[classify] Groq non-2xx: ${groqResponse.status} — ${errBody}`);
    return { ...FALLBACK };
  }

  let groqData: GroqResponsePayload;
  try {
    groqData = (await groqResponse.json()) as GroqResponsePayload;
  } catch (parseErr) {
    console.error('[classify] Failed to parse Groq JSON:', parseErr);
    return { ...FALLBACK };
  }

  const rawContent = groqData?.choices?.[0]?.message?.content;
  if (typeof rawContent !== 'string') {
    console.error('[classify] Unexpected Groq response shape:', groqData);
    return { ...FALLBACK };
  }

  let rawObject: unknown;
  try {
    rawObject = JSON.parse(rawContent);
  } catch (jsonErr) {
    console.error('[classify] Could not parse AI content JSON:', jsonErr, '— raw:', rawContent);
    return { ...FALLBACK };
  }

  const result = normaliseClassification(rawObject);
  if (!result) {
    console.error('[classify] normaliseClassification returned null for:', rawObject);
    return { ...FALLBACK };
  }

  return result;
}
