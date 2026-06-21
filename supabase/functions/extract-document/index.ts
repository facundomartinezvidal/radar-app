/**
 * extract-document/index.ts
 * Supabase Edge Function — Document classification + data extraction via Groq vision.
 *
 * Accepts a base64-encoded image OR PDF, classifies the document type, and returns
 * structured financial transaction data (amount, currency, date, merchant, direction,
 * category hint, items, etc.) across up to 3 pages.
 *
 * PDFs are rasterised page-by-page to PNG using mupdf (WASM) before being sent to
 * the vision model. Images are passed through directly.
 *
 * Required secrets:
 *   GROQ_API_KEY        — Groq API key with chat-completions access
 *
 * Injected by Supabase runtime:
 *   SUPABASE_URL
 *   SUPABASE_ANON_KEY
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { encodeBase64 } from 'https://deno.land/std@0.224.0/encoding/base64.ts';
import { corsHeaders } from '../_shared/cors.ts';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RequestBody {
  imageBase64?: string;
  pdfBase64?: string;
  mimeType?: string;
  categories?: string[];
}

interface DocumentItem {
  name: string;
  quantity: number | null;
  unitPrice: number | null;
  lineTotal: number | null;
}

interface DocumentTransaction {
  amount: number | null;
  currency: 'ARS' | 'USD' | null;
  occurredAt: string | null;
  merchant: string | null;
  direction: 'expense' | 'income';
  categoryHint: string | null;
  suggestedNewCategory: string | null;
  suggestedNewCategoryReason: string | null;
  items: DocumentItem[];
}

type DocumentType = 'receipt' | 'transfer' | 'card_statement' | 'screenshot' | 'unknown';

interface DocumentResult {
  documentType: DocumentType;
  confidence: number;
  truncated: boolean;
  transactions: DocumentTransaction[];
}

interface GroqMessage {
  role: string;
  content:
    | string
    | Array<{ type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } }>;
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
const GROQ_TIMEOUT_MS = 30_000;

const MAX_PDF_PAGES = 3;
const MAX_ITEMS = 50;
const MAX_TRANSACTIONS = 100;

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
// Helper: base64-decode a string to Uint8Array
// ---------------------------------------------------------------------------

function base64ToUint8Array(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

// ---------------------------------------------------------------------------
// Helper: rasterise PDF pages to base64 PNG data URLs (mupdf WASM)
//
// Returns up to MAX_PDF_PAGES data URLs and a `truncated` flag indicating
// whether the PDF contained more pages than were processed.
// Throws on mupdf errors — callers must wrap in try/catch.
// ---------------------------------------------------------------------------

interface PdfRasterResult {
  pageDataUrls: string[];
  truncated: boolean;
}

async function rasterisePdf(pdfBytes: Uint8Array): Promise<PdfRasterResult> {
  const mupdf = await import('npm:mupdf@1.26.4');
  const doc = mupdf.Document.openDocument(pdfBytes, 'application/pdf');
  const total = doc.countPages();
  const pagesToProcess = Math.min(total, MAX_PDF_PAGES);
  const truncated = total > MAX_PDF_PAGES;

  const pageDataUrls: string[] = [];

  for (let i = 0; i < pagesToProcess; i++) {
    const page = doc.loadPage(i);
    const pix = page.toPixmap(
      mupdf.Matrix.scale(2, 2),
      mupdf.ColorSpace.DeviceRGB,
      false,
      true,
    );
    const pngBytes: Uint8Array = pix.asPNG();
    const b64 = encodeBase64(pngBytes);
    pageDataUrls.push(`data:image/png;base64,${b64}`);
  }

  return { pageDataUrls, truncated };
}

// ---------------------------------------------------------------------------
// Helper: line-item normaliser
//
// Validates the raw "items" array returned by the LLM and coerces each entry
// into the expected DocumentItem shape.  Non-array input is silently treated
// as an empty list so existing callers that omit the field are not broken.
// ---------------------------------------------------------------------------

function normaliseItems(raw: unknown): DocumentItem[] {
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw.slice(0, MAX_ITEMS).reduce<DocumentItem[]>((acc, entry: unknown) => {
    if (entry === null || typeof entry !== 'object') {
      return acc;
    }

    const item = entry as Record<string, unknown>;

    // name: must be a non-empty string after trim; truncate to 120 chars
    if (typeof item.name !== 'string') {
      return acc;
    }
    const trimmedName = item.name.trim();
    if (trimmedName === '') {
      return acc;
    }
    const name = trimmedName.length > 120 ? trimmedName.slice(0, 120) : trimmedName;

    // quantity: coerce to finite positive number; 0 → null
    let quantity: number | null = null;
    if (item.quantity !== null && item.quantity !== undefined) {
      const coerced = Number(item.quantity);
      if (Number.isFinite(coerced) && coerced > 0) {
        quantity = coerced;
      }
    }

    // unitPrice: coerce to finite non-negative number; negative → null
    let unitPrice: number | null = null;
    if (item.unitPrice !== null && item.unitPrice !== undefined) {
      const coerced = Number(item.unitPrice);
      if (Number.isFinite(coerced) && coerced >= 0) {
        unitPrice = coerced;
      }
    }

    // lineTotal: coerce to finite non-negative number; negative → null
    let lineTotal: number | null = null;
    if (item.lineTotal !== null && item.lineTotal !== undefined) {
      const coerced = Number(item.lineTotal);
      if (Number.isFinite(coerced) && coerced >= 0) {
        lineTotal = coerced;
      }
    }

    // Derive lineTotal from quantity × unitPrice when missing
    if (lineTotal === null && quantity !== null && unitPrice !== null) {
      lineTotal = Math.round(quantity * unitPrice * 100) / 100;
    }

    acc.push({ name, quantity, unitPrice, lineTotal });
    return acc;
  }, []);
}

// ---------------------------------------------------------------------------
// Helper: single-transaction normaliser
//
// Validates one raw transaction object from the LLM and coerces all fields
// into the expected DocumentTransaction shape.
// ---------------------------------------------------------------------------

function normaliseTransaction(raw: Record<string, unknown>): DocumentTransaction {
  // amount: coerce to number ≥ 0 or null
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

  // occurredAt: valid ISO date, not in the future → YYYY-MM-DD
  let occurredAt: string | null = null;
  if (typeof raw.occurredAt === 'string' && raw.occurredAt.trim() !== '') {
    const parsed = new Date(raw.occurredAt);
    if (!Number.isNaN(parsed.getTime()) && parsed <= new Date()) {
      occurredAt = parsed.toISOString().split('T')[0];
    }
  }

  // merchant: string or null
  const merchant =
    typeof raw.merchant === 'string' && raw.merchant.trim() !== '' ? raw.merchant.trim() : null;

  // direction: 'expense' | 'income', default 'expense'
  const direction: 'expense' | 'income' =
    raw.direction === 'income' ? 'income' : 'expense';

  // categoryHint: string or null
  const categoryHint =
    typeof raw.categoryHint === 'string' && raw.categoryHint.trim() !== ''
      ? raw.categoryHint.trim()
      : null;

  // suggestedNewCategory: trimmed, non-empty, truncated to 40 chars, else null
  let suggestedNewCategory: string | null = null;
  if (typeof raw.suggestedNewCategory === 'string') {
    const trimmed = raw.suggestedNewCategory.trim();
    if (trimmed !== '') {
      suggestedNewCategory = trimmed.length > 40 ? trimmed.slice(0, 40) : trimmed;
    }
  }

  // suggestedNewCategoryReason: trimmed, non-empty, truncated to 160 chars, else null
  let suggestedNewCategoryReason: string | null = null;
  if (typeof raw.suggestedNewCategoryReason === 'string') {
    const trimmed = raw.suggestedNewCategoryReason.trim();
    if (trimmed !== '') {
      suggestedNewCategoryReason = trimmed.length > 160 ? trimmed.slice(0, 160) : trimmed;
    }
  }

  // items: delegate to normaliseItems; falls back to [] if absent or invalid
  const items = normaliseItems(raw.items);

  return {
    amount,
    currency,
    occurredAt,
    merchant,
    direction,
    categoryHint,
    suggestedNewCategory,
    suggestedNewCategoryReason,
    items,
  };
}

// ---------------------------------------------------------------------------
// Helper: full document result normaliser
//
// Validates the raw object returned by the LLM and coerces all top-level
// fields and the transactions array. No external schema library — manual only.
// ---------------------------------------------------------------------------

function normaliseDocumentResult(
  raw: Record<string, unknown>,
  truncated: boolean,
  isSingleTransactionDoc: boolean,
): DocumentResult {
  // documentType: coerce to one of the 5 literals, else 'unknown'
  const validTypes: DocumentType[] = [
    'receipt',
    'transfer',
    'card_statement',
    'screenshot',
    'unknown',
  ];
  const documentType: DocumentType = validTypes.includes(raw.documentType as DocumentType)
    ? (raw.documentType as DocumentType)
    : 'unknown';

  // confidence: clamp [0,1]
  let confidence = 0;
  if (typeof raw.confidence === 'number' && !Number.isNaN(raw.confidence)) {
    confidence = Math.min(1, Math.max(0, raw.confidence));
  }

  // transactions: array; cap at MAX_TRANSACTIONS
  let transactions: DocumentTransaction[] = [];
  if (Array.isArray(raw.transactions)) {
    const limited = (raw.transactions as unknown[]).slice(0, MAX_TRANSACTIONS);
    for (const entry of limited) {
      if (entry !== null && typeof entry === 'object') {
        transactions.push(normaliseTransaction(entry as Record<string, unknown>));
      }
    }
  }

  // For non-card_statement types, keep at most 1 transaction
  if (isSingleTransactionDoc && transactions.length > 1) {
    transactions = transactions.slice(0, 1);
  }

  return { documentType, confidence, truncated, transactions };
}

// ---------------------------------------------------------------------------
// System prompt builder for the document classifier LLM
// ---------------------------------------------------------------------------

/**
 * Builds the classification + extraction system prompt dynamically using the
 * caller's category list.
 *
 * When `categoryNames` is empty the fallback is the 9 system categories seeded
 * in the DB (Comida, Supermercado, Transporte, Ocio, Salud, Hogar, Servicios,
 * Viajes, Otro). This keeps the prompt coherent even if the client omits the
 * list for any reason.
 */
function buildSystemPrompt(categoryNames: string[]): string {
  const list =
    categoryNames.length > 0
      ? categoryNames
      : [
          'Comida',
          'Supermercado',
          'Transporte',
          'Ocio',
          'Salud',
          'Hogar',
          'Servicios',
          'Viajes',
          'Otro',
        ];

  const categoryList = list.map((n) => `"${n}"`).join(', ');

  return `Sos un asistente especializado en analizar documentos financieros argentinos.
Tu tarea es clasificar el documento y extraer todas las transacciones financieras que contenga.

Respondé ÚNICAMENTE con un objeto JSON válido con las siguientes claves:

- "documentType": clasificá el documento con uno de estos valores exactos:
  * "receipt" — ticket o factura de compra (comercio, restaurant, supermercado, etc.)
  * "transfer" — comprobante de transferencia bancaria o de billetera digital (Mercado Pago, Ualá, Naranja X, banco, etc.)
  * "card_statement" — resumen o estado de cuenta de tarjeta de crédito/débito con múltiples consumos
  * "screenshot" — captura de pantalla de una app financiera o monto suelto sin contexto suficiente
  * "unknown" — no es un documento financiero legible o no se puede determinar

- "confidence": número entre 0 y 1 indicando tu confianza en la clasificación y extracción (1 = muy seguro, 0 = no pudiste leer nada útil).

- "transactions": array de objetos con las transacciones financieras del documento. Reglas según tipo:
  * "receipt", "transfer", "screenshot": devolvé UNA sola transacción en el array (la principal).
  * "card_statement": devolvé una transacción por cada consumo o movimiento legible.
  * "unknown": devolvé un array vacío [].

  Cada transacción tiene estas claves:
  - "amount": total como número (sin separadores de miles, punto como decimal). Ejemplo: "$12.500,50" → 12500.5. Si no podés leerlo, devolvé null.
  - "currency": "ARS" o "USD" según la moneda. Si no podés determinarlo, devolvé null.
  - "occurredAt": fecha en formato ISO 8601 (YYYY-MM-DD). Si no podés leerla, devolvé null.
  - "merchant": nombre del comercio o contraparte (string). Si no se ve, devolvé null.
  - "direction": sentido de la transacción:
    * Para TRANSFERENCIAS: si el usuario es el destinatario/beneficiario (te transfirieron, recibiste, ingreso) → "income". Si el usuario es el emisor (enviaste, transferiste, debitaron) → "expense". Si no se puede determinar → "expense".
    * Para tickets, facturas, consumos de tarjeta → siempre "expense".
    * Para capturas de app financiera: interpretá según el contexto visible.
  - "categoryHint": una de la siguiente lista del usuario: ${categoryList}. Devolvé EXACTAMENTE uno de esos nombres SOLO si el rubro encaja de forma clara y directa. Si la relación es forzada o indirecta, devolvé null. Reglas estrictas: "Ocio" es EXCLUSIVAMENTE entretenimiento (cine, bar, teatro, salidas, videojuegos); NO aplica a ropa ni tecnología. Indumentaria/calzado → null a menos que la lista tenga una categoría de ropa. Farmacia → "Salud" solo si la lista lo incluye con ese nombre exacto. Preferí null antes que forzar.
  - "suggestedNewCategory": CRÍTICO — si "categoryHint" es null, NUNCA debe ser null: proponé un nombre corto para una categoría nueva (1 o 2 palabras, en español, Tipo Título). Ejemplos: indumentaria → "Ropa"; farmacia sin "Salud" → "Farmacia"; electrónica → "Tecnología"; mascotas → "Mascotas"; librería → "Librería"; belleza → "Belleza"; deportes → "Deportes". Si "categoryHint" no es null, devolvé null aquí.
  - "suggestedNewCategoryReason": cuando "suggestedNewCategory" no es null, explicá en UNA frase breve (máx ~140 caracteres), en español rioplatense formal, por qué ese gasto merece una categoría propia. Ejemplo: "El comercio es Zara, una tienda de indumentaria; conviene una categoría de ropa separada de tus otros gastos." Si "suggestedNewCategory" es null, devolvé null aquí.
  - "items": array de renglones del detalle. Sólo para tickets con líneas de detalle; para transferencias y consumos normales devolvé []. Cada objeto: {"name": descripción (string), "quantity": cantidad numérica o null, "unitPrice": precio unitario numérico o null, "lineTotal": total del renglón numérico o null}. Máximo 50 ítems.

Si el documento NO es financiero o no contiene datos útiles: documentType "unknown", transactions [] y confidence 0.
No incluyas explicaciones ni texto fuera del JSON.`;
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
    // -- Auth: require Bearer JWT
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

    // -- Parse request body
    let body: RequestBody;
    try {
      body = (await req.json()) as RequestBody;
    } catch {
      return jsonResponse(
        { error: { code: 'BAD_REQUEST', message: 'Falta el documento.' } },
        400,
      );
    }

    // -- Validate: exactly one of imageBase64 / pdfBase64 must be present
    const hasImage =
      typeof body.imageBase64 === 'string' && body.imageBase64.trim() !== '';
    const hasPdf = typeof body.pdfBase64 === 'string' && body.pdfBase64.trim() !== '';

    if (!hasImage && !hasPdf) {
      return jsonResponse(
        { error: { code: 'BAD_REQUEST', message: 'Falta el documento.' } },
        400,
      );
    }
    if (hasImage && hasPdf) {
      return jsonResponse(
        {
          error: {
            code: 'BAD_REQUEST',
            message: 'Enviá solo una imagen o un PDF, no ambos.',
          },
        },
        400,
      );
    }

    // -- Parse categories list (validate it is an array of strings; otherwise [])
    const categories: string[] = Array.isArray(body.categories)
      ? body.categories.filter((c): c is string => typeof c === 'string')
      : [];

    // -- Groq API key
    const groqApiKey = Deno.env.get('GROQ_API_KEY');
    if (!groqApiKey) {
      console.error('[extract-document] GROQ_API_KEY is not set');
      return jsonResponse(
        { error: { code: 'OCR_CONFIG_ERROR', message: 'OCR no configurado.' } },
        500,
      );
    }

    // -- Build page image data URLs (1 for images, 1-3 for PDFs)
    let pageDataUrls: string[];
    let truncated = false;

    if (hasImage) {
      const mimeType = body.mimeType ?? 'image/jpeg';
      pageDataUrls = [`data:${mimeType};base64,${body.imageBase64!}`];
      truncated = false;
    } else {
      // PDF path: rasterise to PNG via mupdf
      const pdfBytes = base64ToUint8Array(body.pdfBase64!);
      let rasterResult: PdfRasterResult;
      try {
        rasterResult = await rasterisePdf(pdfBytes);
      } catch (pdfErr) {
        console.error('[extract-document] PDF rasterisation failed:', pdfErr);
        return jsonResponse(
          {
            error: {
              code: 'PDF_CONVERT_ERROR',
              message: 'No pudimos leer el PDF. Probá con una captura.',
            },
          },
          422,
        );
      }
      pageDataUrls = rasterResult.pageDataUrls;
      truncated = rasterResult.truncated;

      if (pageDataUrls.length === 0) {
        console.error('[extract-document] PDF produced 0 rasterised pages');
        return jsonResponse(
          {
            error: {
              code: 'PDF_CONVERT_ERROR',
              message: 'No pudimos leer el PDF. Probá con una captura.',
            },
          },
          422,
        );
      }
    }

    // -- Build Groq request: one user message with text + one image_url per page
    const imageContentParts: Array<{
      type: 'image_url';
      image_url: { url: string };
    }> = pageDataUrls.map((url) => ({
      type: 'image_url' as const,
      image_url: { url },
    }));

    const groqPayload: GroqRequestPayload = {
      model: GROQ_MODEL,
      response_format: { type: 'json_object' },
      temperature: 0,
      messages: [
        {
          role: 'system',
          content: buildSystemPrompt(categories),
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Clasificá y extraé los datos del siguiente documento financiero.',
            },
            ...imageContentParts,
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
      const isAbort = fetchErr instanceof Error && fetchErr.name === 'AbortError';
      if (isAbort) {
        console.error('[extract-document] Groq request timed out');
        return jsonResponse(
          {
            error: {
              code: 'OCR_TIMEOUT',
              message: 'No se pudo analizar el documento. Ingresá los datos manualmente.',
            },
          },
          504,
        );
      }
      console.error('[extract-document] Groq fetch error:', fetchErr);
      return jsonResponse(
        {
          error: {
            code: 'UPSTREAM_ERROR',
            message: 'No se pudo analizar el documento. Ingresá los datos manualmente.',
          },
        },
        502,
      );
    } finally {
      clearTimeout(timeoutId);
    }

    if (!groqResponse.ok) {
      const errBody = await groqResponse.text().catch(() => '(unreadable)');
      console.error(`[extract-document] Groq non-2xx: ${groqResponse.status} — ${errBody}`);
      return jsonResponse(
        {
          error: {
            code: 'UPSTREAM_ERROR',
            message: 'No se pudo analizar el documento. Ingresá los datos manualmente.',
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
      console.error('[extract-document] Failed to parse Groq JSON:', parseErr);
      return jsonResponse(
        {
          error: {
            code: 'OCR_PARSE_ERROR',
            message: 'No se pudieron leer los datos del documento.',
          },
        },
        502,
      );
    }

    const rawContent = groqData?.choices?.[0]?.message?.content;
    if (typeof rawContent !== 'string') {
      console.error('[extract-document] Unexpected Groq response shape:', groqData);
      return jsonResponse(
        {
          error: {
            code: 'OCR_PARSE_ERROR',
            message: 'No se pudieron leer los datos del documento.',
          },
        },
        502,
      );
    }

    let rawDocObject: Record<string, unknown>;
    try {
      rawDocObject = JSON.parse(rawContent) as Record<string, unknown>;
    } catch (jsonErr) {
      console.error(
        '[extract-document] Could not parse OCR content JSON:',
        jsonErr,
        '— raw content:',
        rawContent,
      );
      return jsonResponse(
        {
          error: {
            code: 'OCR_PARSE_ERROR',
            message: 'No se pudieron leer los datos del documento.',
          },
        },
        502,
      );
    }

    // -- Normalise + validate extracted fields
    // card_statement may have multiple transactions; all others cap at 1
    const rawDocType = rawDocObject.documentType;
    const isSingleTransactionDoc = rawDocType !== 'card_statement';

    const result: DocumentResult = normaliseDocumentResult(
      rawDocObject,
      truncated,
      isSingleTransactionDoc,
    );

    // -- Success
    return jsonResponse({ data: result }, 200);
  } catch (unexpectedErr: unknown) {
    console.error('[extract-document] Unexpected error:', unexpectedErr);
    return jsonResponse({ error: { code: 'INTERNAL', message: 'Error inesperado.' } }, 500);
  }
});
