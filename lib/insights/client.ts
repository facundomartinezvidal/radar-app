/**
 * Edge-function client for the `generate-insights` Supabase edge function.
 *
 * - `InsightsError`     — typed error class, mirrors `OcrError` in `lib/ocr.ts`.
 * - `generateInsights`  — calls the edge function, unwraps `{ data: { insights } }`,
 *                         validates/filters entries, caps to 4. Throws `InsightsError`
 *                         on any failure. Does NOT implement the local fallback —
 *                         that lives in `hooks/use-insights.ts` (AC6).
 */
import type { GenerateInsightsInput, Insight, InsightKind } from '@/lib/insights/types';
import { supabase } from '@/lib/supabase';

// ---------------------------------------------------------------------------
// Error type
// ---------------------------------------------------------------------------

/** Error thrown by `generateInsights` when the edge function returns non-2xx,
 *  when the supabase-js invocation itself fails, or when the response shape is
 *  unexpected.
 */
export class InsightsError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'InsightsError';
    this.code = code;
  }
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_INSIGHTS = 4;

const VALID_KINDS = new Set<InsightKind>(['warning', 'tip', 'positive', 'neutral']);

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Return true when the value looks like a valid Insight entry. */
function isValidInsight(entry: unknown): entry is Insight {
  if (!entry || typeof entry !== 'object') return false;
  const obj = entry as Record<string, unknown>;
  return (
    typeof obj['title'] === 'string' &&
    typeof obj['body'] === 'string' &&
    VALID_KINDS.has(obj['kind'] as InsightKind)
  );
}

// ---------------------------------------------------------------------------
// Edge function invocation
// ---------------------------------------------------------------------------

/**
 * Call the `generate-insights` Supabase edge function and return a validated
 * `Insight[]` (2–4 entries).
 *
 * The edge function wraps its success payload as `{ data: { insights: [...] } }`,
 * so the invoke `data` field is `{ data: { insights: Insight[] } }` — we
 * unwrap two levels before consuming.
 *
 * Defensive post-processing (belt-and-suspenders, mirrors what the edge fn
 * already does):
 * - Drops entries whose `kind` is not in the allowed set or whose `title`/`body`
 *   are not strings.
 * - Caps the result to 4 insights.
 *
 * @throws {InsightsError} on network / HTTP / parse failures.
 */
export async function generateInsights(input: GenerateInsightsInput): Promise<Insight[]> {
  const { data: invokeData, error: invokeError } = await supabase.functions.invoke(
    'generate-insights',
    { body: input },
  );

  if (invokeError) {
    // supabase-js FunctionsFetchError indicates an offline / network-level
    // failure (device offline, function unreachable). Treat as retryable.
    const errorName = (invokeError as unknown as { name?: string }).name;
    if (
      errorName === 'FunctionsFetchError' ||
      (invokeError.constructor && invokeError.constructor.name === 'FunctionsFetchError')
    ) {
      throw new InsightsError(
        'NETWORK_ERROR',
        'No se pudieron cargar los insights. Verificá tu conexión.',
      );
    }

    // supabase-js FunctionsHttpError exposes the raw response body via
    // `.context` (when available). Try to read the edge function's structured
    // error from there.
    const context = (invokeError as unknown as { context?: unknown }).context;
    if (context && typeof context === 'object') {
      const edgeError = (context as { error?: { code?: string; message?: string } }).error;
      if (edgeError?.code && edgeError?.message) {
        throw new InsightsError(edgeError.code, edgeError.message);
      }
    }

    // Generic fallback
    throw new InsightsError(
      'UPSTREAM_ERROR',
      invokeError.message ?? 'No se pudieron cargar los insights.',
    );
  }

  // The edge fn wraps its response as { data: { insights: Insight[] } }
  const inner = (invokeData as { data?: unknown } | null)?.data;
  const rawInsights = (inner as { insights?: unknown } | null)?.insights;

  if (!Array.isArray(rawInsights)) {
    throw new InsightsError(
      'PARSE_ERROR',
      'La respuesta del servidor no tiene el formato esperado.',
    );
  }

  // Defensive filtering: drop invalid entries, cap to MAX_INSIGHTS.
  return (rawInsights as unknown[]).filter(isValidInsight).slice(0, MAX_INSIGHTS);
}
