/**
 * generate-insights/index.ts
 * Supabase Edge Function — AI-powered spending recommendations via Groq.
 *
 * Accepts client-computed spending aggregates for a given period+currency,
 * calls Groq's LLM, and returns 2–4 actionable insights in Spanish (rioplatense).
 *
 * Required secrets:
 *   GROQ_API_KEY        — Groq API key with chat-completions access (shared with extract-receipt)
 *
 * Injected by Supabase runtime:
 *   SUPABASE_URL
 *   SUPABASE_ANON_KEY
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Currency = 'ARS' | 'USD';
type InsightKind = 'warning' | 'tip' | 'positive' | 'neutral';

interface InsightCta {
  label: string;
  route: string | null;
}

interface Insight {
  kind: InsightKind;
  title: string;
  body: string;
  cta?: InsightCta;
}

interface RequestBody {
  currency: Currency;
  period: { label: string; from: string; to: string };
  totals: { expenses: number; incomes: number; net: number };
  byCategory: { name: string; total: number; pct: number }[];
  trend: { bucket: string; expenses: number; incomes: number }[];
  prevPeriodExpenses?: number;
}

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
// Constants
// ---------------------------------------------------------------------------

const GROQ_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'meta-llama/llama-4-scout-17b-16e-instruct';
const GROQ_TIMEOUT_MS = 15_000;

const VALID_KINDS = new Set<InsightKind>(['warning', 'tip', 'positive', 'neutral']);
const MAX_INSIGHTS = 4;
const MAX_TITLE_LEN = 48;
const MAX_BODY_LEN = 160;

// ---------------------------------------------------------------------------
// Helper: JSON response builder
// ---------------------------------------------------------------------------

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}

// ---------------------------------------------------------------------------
// Helper: minimal request body validator
// ---------------------------------------------------------------------------

function isValidBody(value: unknown): value is RequestBody {
  if (!value || typeof value !== 'object') return false;
  const obj = value as Record<string, unknown>;

  if (obj['currency'] !== 'ARS' && obj['currency'] !== 'USD') return false;

  const period = obj['period'];
  if (!period || typeof period !== 'object') return false;
  const p = period as Record<string, unknown>;
  if (typeof p['label'] !== 'string') return false;
  if (typeof p['from'] !== 'string') return false;
  if (typeof p['to'] !== 'string') return false;

  const totals = obj['totals'];
  if (!totals || typeof totals !== 'object') return false;
  const t = totals as Record<string, unknown>;
  if (typeof t['expenses'] !== 'number') return false;
  if (typeof t['incomes'] !== 'number') return false;
  if (typeof t['net'] !== 'number') return false;

  if (!Array.isArray(obj['byCategory'])) return false;
  if (!Array.isArray(obj['trend'])) return false;

  return true;
}

// ---------------------------------------------------------------------------
// Helper: insights normaliser
//
// Validates the raw "insights" array returned by the LLM and coerces each
// entry into a clean Insight shape.  Drops entries with invalid kind.
// Clamps title to 48 chars and body to 160 chars.  Keeps cta only when it
// has a non-empty string label.  Caps the output to 4 entries.
// ---------------------------------------------------------------------------

function normaliseInsights(raw: unknown): Insight[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  const result: Insight[] = [];

  for (const entry of raw) {
    if (result.length >= MAX_INSIGHTS) break;

    if (!entry || typeof entry !== 'object') continue;
    const obj = entry as Record<string, unknown>;

    // kind: must be one of the four valid values; otherwise drop the entry
    if (!VALID_KINDS.has(obj['kind'] as InsightKind)) continue;
    const kind = obj['kind'] as InsightKind;

    // title: coerce to string, trim, clamp to 48 chars; skip if empty
    const rawTitle = typeof obj['title'] === 'string' ? obj['title'].trim() : '';
    if (!rawTitle) continue;
    const title = rawTitle.length > MAX_TITLE_LEN ? rawTitle.slice(0, MAX_TITLE_LEN) : rawTitle;

    // body: coerce to string, trim, clamp to 160 chars; skip if empty
    const rawBody = typeof obj['body'] === 'string' ? obj['body'].trim() : '';
    if (!rawBody) continue;
    const body = rawBody.length > MAX_BODY_LEN ? rawBody.slice(0, MAX_BODY_LEN) : rawBody;

    // cta: keep only if it has a non-empty string label
    let cta: InsightCta | undefined;
    const rawCta = obj['cta'];
    if (rawCta && typeof rawCta === 'object') {
      const ctaObj = rawCta as Record<string, unknown>;
      if (typeof ctaObj['label'] === 'string' && ctaObj['label'].trim() !== '') {
        cta = {
          label: ctaObj['label'].trim(),
          route: typeof ctaObj['route'] === 'string' ? ctaObj['route'] : null,
        };
      }
    }

    const insight: Insight = { kind, title, body };
    if (cta !== undefined) {
      insight.cta = cta;
    }
    result.push(insight);
  }

  return result;
}

// ---------------------------------------------------------------------------
// System prompt builder
// ---------------------------------------------------------------------------

function buildSystemPrompt(): string {
  return `Sos un asistente financiero personal de la app RADAR (plataforma de seguimiento de gastos).
Tu tarea es analizar los agregados de gastos e ingresos del período y generar recomendaciones accionables.

Respondé ÚNICAMENTE con un objeto JSON válido con la siguiente estructura exacta:
{"insights":[{"kind":"warning|tip|positive|neutral","title":"...","body":"...","cta":{"label":"...","route":null}}]}

Reglas ESTRICTAS:
- Respondé ÚNICAMENTE con JSON válido, sin texto extra antes ni después.
- La clave raíz es "insights" y su valor es un array.
- Cada entrada tiene: "kind" (uno de: warning, tip, positive, neutral), "title" (string), "body" (string). El campo "cta" es opcional.
- Generá entre 2 y 4 insights. Nunca más de 4, nunca menos de 2 (salvo que no haya datos suficientes).
- "title" debe tener como máximo 48 caracteres.
- "body" debe tener como máximo 160 caracteres.
- Tono rioplatense, sentence case, sin emoji.
- NO inventés números: usá únicamente los montos y porcentajes provistos en el payload del usuario.
- Los montos deben expresarse en la moneda indicada por el campo "currency" del payload.
- Si todos los totales son 0 (sin movimientos), devolvé {"insights":[]}.
- Si incluís "cta", el campo "route" debe ser null (no tenés acceso a las rutas).`;
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

Deno.serve(async (req: Request): Promise<Response> => {
  // -- CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    // -- Auth: internal service-to-service bypass OR standard Bearer JWT
    const internalSecret = Deno.env.get('WHATSAPP_INTERNAL_SECRET');
    const internalHeader = req.headers.get('x-whatsapp-internal-secret');
    const isInternalRequest =
      typeof internalSecret === 'string' &&
      internalSecret.length > 0 &&
      internalHeader === internalSecret;

    if (!isInternalRequest) {
      const authHeader = req.headers.get('Authorization');
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return jsonResponse({ error: { code: 'UNAUTHENTICATED', message: 'No autorizado.' } }, 401);
      }

      const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
      const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

      const supabase = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader } },
      });

      const { data: userData, error: authError } = await supabase.auth.getUser();
      if (authError || !userData?.user) {
        return jsonResponse({ error: { code: 'UNAUTHENTICATED', message: 'No autorizado.' } }, 401);
      }
    }

    // -- Parse request body
    let body: RequestBody;
    try {
      body = (await req.json()) as RequestBody;
    } catch {
      return jsonResponse(
        { error: { code: 'BAD_REQUEST', message: 'Cuerpo de la petición inválido.' } },
        400,
      );
    }

    if (!isValidBody(body)) {
      return jsonResponse(
        {
          error: {
            code: 'BAD_REQUEST',
            message: 'Faltan campos requeridos o tienen formato incorrecto.',
          },
        },
        400,
      );
    }

    // -- Groq API key
    const groqApiKey = Deno.env.get('GROQ_API_KEY');
    if (!groqApiKey) {
      console.error('[generate-insights] GROQ_API_KEY is not set');
      return jsonResponse(
        { error: { code: 'AI_CONFIG_ERROR', message: 'IA no configurada.' } },
        500,
      );
    }

    // -- Build Groq request
    const userMessage = `Analizá los siguientes datos financieros del período y generá las recomendaciones:\n${JSON.stringify(body)}`;

    const groqPayload: GroqRequestPayload = {
      model: GROQ_MODEL,
      response_format: { type: 'json_object' },
      temperature: 0,
      messages: [
        {
          role: 'system',
          content: buildSystemPrompt(),
        },
        {
          role: 'user',
          content: userMessage,
        },
      ],
    };

    // -- Call Groq with AbortController timeout
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
        body: JSON.stringify(groqPayload),
      });
    } catch (fetchErr: unknown) {
      clearTimeout(timeoutId);
      const isAbort = fetchErr instanceof Error && fetchErr.name === 'AbortError';
      if (isAbort) {
        console.error('[generate-insights] Groq request timed out');
        return jsonResponse(
          {
            error: {
              code: 'AI_TIMEOUT',
              message: 'No se pudieron generar los insights. Intentá de nuevo más tarde.',
            },
          },
          504,
        );
      }
      console.error('[generate-insights] Groq fetch error:', fetchErr);
      return jsonResponse(
        {
          error: {
            code: 'UPSTREAM_ERROR',
            message: 'No se pudieron generar los insights. Intentá de nuevo más tarde.',
          },
        },
        502,
      );
    } finally {
      clearTimeout(timeoutId);
    }

    if (!groqResponse.ok) {
      const errBody = await groqResponse.text().catch(() => '(unreadable)');
      console.error(`[generate-insights] Groq non-2xx: ${groqResponse.status} — ${errBody}`);
      return jsonResponse(
        {
          error: {
            code: 'UPSTREAM_ERROR',
            message: 'No se pudieron generar los insights. Intentá de nuevo más tarde.',
          },
        },
        502,
      );
    }

    // -- Parse Groq response
    let groqData: GroqResponsePayload;
    try {
      groqData = (await groqResponse.json()) as GroqResponsePayload;
    } catch (parseErr) {
      console.error('[generate-insights] Failed to parse Groq JSON:', parseErr);
      return jsonResponse(
        {
          error: {
            code: 'AI_PARSE_ERROR',
            message: 'No se pudo leer la respuesta de la IA.',
          },
        },
        502,
      );
    }

    const rawContent = groqData?.choices?.[0]?.message?.content;
    if (typeof rawContent !== 'string') {
      console.error('[generate-insights] Unexpected Groq response shape:', groqData);
      return jsonResponse(
        {
          error: {
            code: 'AI_PARSE_ERROR',
            message: 'No se pudo leer la respuesta de la IA.',
          },
        },
        502,
      );
    }

    let rawObject: Record<string, unknown>;
    try {
      rawObject = JSON.parse(rawContent) as Record<string, unknown>;
    } catch (jsonErr) {
      console.error(
        '[generate-insights] Could not parse AI content JSON:',
        jsonErr,
        '— raw content:',
        rawContent,
      );
      return jsonResponse(
        {
          error: {
            code: 'AI_PARSE_ERROR',
            message: 'No se pudo leer la respuesta de la IA.',
          },
        },
        502,
      );
    }

    // -- Normalise + validate insights
    const insights: Insight[] = normaliseInsights(rawObject['insights']);

    // -- Success
    return jsonResponse({ data: { insights } }, 200);
  } catch (unexpectedErr: unknown) {
    console.error('[generate-insights] Unexpected error:', unexpectedErr);
    return jsonResponse({ error: { code: 'INTERNAL', message: 'Error inesperado.' } }, 500);
  }
});
