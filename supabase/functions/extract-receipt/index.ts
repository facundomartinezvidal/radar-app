/**
 * extract-receipt/index.ts
 * Supabase Edge Function — Receipt OCR via Groq vision.
 *
 * Accepts a base64-encoded receipt image, calls Groq's vision-capable LLM,
 * and returns structured expense data (amount, currency, date, merchant,
 * category hint, confidence score).
 *
 * Required secrets:
 *   GROQ_API_KEY        — Groq API key with chat-completions access
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

interface RequestBody {
  imageBase64: string;
  mimeType?: string;
}

interface OcrResult {
  amount: number | null;
  currency: 'ARS' | 'USD' | null;
  occurredAt: string | null;
  merchant: string | null;
  categoryHint: string | null;
  confidence: number;
}

interface GroqMessage {
  role: string;
  content:
    | string
    | Array<
        | { type: 'text'; text: string }
        | { type: 'image_url'; image_url: { url: string } }
      >;
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
const GROQ_TIMEOUT_MS = 20_000;

// ---------------------------------------------------------------------------
// Helper: JSON response builder
// ---------------------------------------------------------------------------

function jsonResponse(
  body: unknown,
  status: number,
  extraHeaders: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
      ...extraHeaders,
    },
  });
}

// ---------------------------------------------------------------------------
// Helper: OCR result validator/normaliser
//
// Validates the raw object returned by the LLM and coerces fields into the
// expected shapes.  No external schema library — manual checks only.
// ---------------------------------------------------------------------------

function normaliseOcrResult(raw: Record<string, unknown>): OcrResult {
  // amount: coerce to number or null
  let amount: number | null = null;
  if (raw.amount !== null && raw.amount !== undefined) {
    const coerced = Number(raw.amount);
    if (!Number.isNaN(coerced) && coerced >= 0) {
      amount = coerced;
    }
  }

  // currency: only 'ARS' | 'USD' | null
  let currency: 'ARS' | 'USD' | null = null;
  if (raw.currency === 'ARS' || raw.currency === 'USD') {
    currency = raw.currency;
  }

  // occurredAt: valid ISO date, not in the future
  let occurredAt: string | null = null;
  if (typeof raw.occurredAt === 'string' && raw.occurredAt.trim() !== '') {
    const parsed = new Date(raw.occurredAt);
    if (!Number.isNaN(parsed.getTime()) && parsed <= new Date()) {
      // Store as ISO 8601 date-only string (YYYY-MM-DD) to avoid TZ issues
      occurredAt = parsed.toISOString().split('T')[0];
    }
  }

  // merchant: string or null
  const merchant =
    typeof raw.merchant === 'string' && raw.merchant.trim() !== ''
      ? raw.merchant.trim()
      : null;

  // categoryHint: string or null
  const categoryHint =
    typeof raw.categoryHint === 'string' && raw.categoryHint.trim() !== ''
      ? raw.categoryHint.trim()
      : null;

  // confidence: clamp to [0, 1]
  let confidence = 0;
  if (typeof raw.confidence === 'number' && !Number.isNaN(raw.confidence)) {
    confidence = Math.min(1, Math.max(0, raw.confidence));
  }

  return { amount, currency, occurredAt, merchant, categoryHint, confidence };
}

// ---------------------------------------------------------------------------
// System prompt for the OCR LLM
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `Sos un asistente especializado en leer tickets y facturas comerciales argentinas.
Tu tarea es extraer datos estructurados del ticket o comprobante que se te muestra.

Respondé ÚNICAMENTE con un objeto JSON válido con las siguientes claves:
- "amount": número (el total del ticket como número entero o decimal, sin separadores de miles, punto como separador decimal). Ejemplo: si el ticket dice "$12.500,50" devolvé 12500.5. Si no podés leerlo, devolvé null.
- "currency": "ARS" o "USD" según la moneda del ticket. Si no podés determinarlo, devolvé null.
- "occurredAt": fecha del ticket en formato ISO 8601 (YYYY-MM-DD). Si no podés leerla, devolvé null.
- "merchant": nombre del comercio o empresa emisora del ticket (string). Si no se ve, devolvé null.
- "categoryHint": categoría del gasto en español, una de: "Comida", "Supermercado", "Transporte", "Salud", "Entretenimiento", "Servicios", "Ropa", "Tecnología", "Educación", "Otro". Si no podés determinarlo, devolvé null.
- "confidence": número entre 0 y 1 indicando tu confianza en la extracción (1 = muy seguro, 0 = no pudiste leer nada).

Si la imagen NO es un ticket o comprobante, establecé todos los campos en null y "confidence" en 0.
No incluyas explicaciones ni texto fuera del JSON.`;

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

Deno.serve(async (req: Request): Promise<Response> => {
  // -- CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    // -- Auth: require Bearer JWT
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return jsonResponse(
        { error: { code: 'UNAUTHENTICATED', message: 'No autorizado.' } },
        401,
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData, error: authError } =
      await supabase.auth.getUser();
    if (authError || !userData?.user) {
      return jsonResponse(
        { error: { code: 'UNAUTHENTICATED', message: 'No autorizado.' } },
        401,
      );
    }

    // -- Parse request body
    let body: RequestBody;
    try {
      body = (await req.json()) as RequestBody;
    } catch {
      return jsonResponse(
        { error: { code: 'BAD_REQUEST', message: 'Falta la imagen.' } },
        400,
      );
    }

    if (
      !body.imageBase64 ||
      typeof body.imageBase64 !== 'string' ||
      body.imageBase64.trim() === ''
    ) {
      return jsonResponse(
        { error: { code: 'BAD_REQUEST', message: 'Falta la imagen.' } },
        400,
      );
    }

    const mimeType = body.mimeType ?? 'image/jpeg';
    const imageDataUrl = `data:${mimeType};base64,${body.imageBase64}`;

    // -- Groq API key
    const groqApiKey = Deno.env.get('GROQ_API_KEY');
    if (!groqApiKey) {
      console.error('[extract-receipt] GROQ_API_KEY is not set');
      return jsonResponse(
        {
          error: {
            code: 'OCR_CONFIG_ERROR',
            message: 'OCR no configurado.',
          },
        },
        500,
      );
    }

    // -- Build Groq request
    const groqPayload: GroqRequestPayload = {
      model: GROQ_MODEL,
      response_format: { type: 'json_object' },
      temperature: 0,
      messages: [
        {
          role: 'system',
          content: SYSTEM_PROMPT,
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Extraé los datos del siguiente ticket o comprobante.',
            },
            {
              type: 'image_url',
              image_url: { url: imageDataUrl },
            },
          ],
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
      const isAbort =
        fetchErr instanceof Error && fetchErr.name === 'AbortError';
      if (isAbort) {
        console.error('[extract-receipt] Groq request timed out');
        return jsonResponse(
          {
            error: {
              code: 'OCR_TIMEOUT',
              message:
                'No se pudo analizar el ticket. Ingresá los datos manualmente.',
            },
          },
          504,
        );
      }
      console.error('[extract-receipt] Groq fetch error:', fetchErr);
      return jsonResponse(
        {
          error: {
            code: 'UPSTREAM_ERROR',
            message:
              'No se pudo analizar el ticket. Ingresá los datos manualmente.',
          },
        },
        502,
      );
    } finally {
      clearTimeout(timeoutId);
    }

    if (!groqResponse.ok) {
      const errBody = await groqResponse.text().catch(() => '(unreadable)');
      console.error(
        `[extract-receipt] Groq non-2xx: ${groqResponse.status} — ${errBody}`,
      );
      return jsonResponse(
        {
          error: {
            code: 'UPSTREAM_ERROR',
            message:
              'No se pudo analizar el ticket. Ingresá los datos manualmente.',
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
      console.error('[extract-receipt] Failed to parse Groq JSON:', parseErr);
      return jsonResponse(
        {
          error: {
            code: 'OCR_PARSE_ERROR',
            message: 'No se pudieron leer los datos del ticket.',
          },
        },
        502,
      );
    }

    const rawContent = groqData?.choices?.[0]?.message?.content;
    if (typeof rawContent !== 'string') {
      console.error('[extract-receipt] Unexpected Groq response shape:', groqData);
      return jsonResponse(
        {
          error: {
            code: 'OCR_PARSE_ERROR',
            message: 'No se pudieron leer los datos del ticket.',
          },
        },
        502,
      );
    }

    let rawOcrObject: Record<string, unknown>;
    try {
      rawOcrObject = JSON.parse(rawContent) as Record<string, unknown>;
    } catch (jsonErr) {
      console.error(
        '[extract-receipt] Could not parse OCR content JSON:',
        jsonErr,
        '— raw content:',
        rawContent,
      );
      return jsonResponse(
        {
          error: {
            code: 'OCR_PARSE_ERROR',
            message: 'No se pudieron leer los datos del ticket.',
          },
        },
        502,
      );
    }

    // -- Normalise + validate extracted fields
    const ocrResult: OcrResult = normaliseOcrResult(rawOcrObject);

    // -- Success
    return jsonResponse({ data: ocrResult }, 200);
  } catch (unexpectedErr: unknown) {
    console.error('[extract-receipt] Unexpected error:', unexpectedErr);
    return jsonResponse(
      { error: { code: 'INTERNAL', message: 'Error inesperado.' } },
      500,
    );
  }
});
