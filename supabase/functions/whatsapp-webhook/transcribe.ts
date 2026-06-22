/**
 * transcribe.ts
 * Groq Whisper audio transcription for the WhatsApp bot.
 *
 * Exports:
 *   transcribeAudio  — POST multipart to Groq Whisper and return transcript text
 *
 * Env vars consumed:
 *   GROQ_API_KEY  — shared with classify.ts and extract-document
 */

const GROQ_TRANSCRIPTION_ENDPOINT = 'https://api.groq.com/openai/v1/audio/transcriptions';
const GROQ_WHISPER_MODEL = 'whisper-large-v3';
const GROQ_TRANSCRIPTION_TIMEOUT_MS = 30_000;

/**
 * Transcribes audio bytes using Groq Whisper.
 *
 * Posts a multipart/form-data request with:
 *   - `file`: the audio Blob (filename derived from mimeType, e.g. "audio.ogg")
 *   - `model`: "whisper-large-v3"
 *
 * @param bytes     Raw audio bytes downloaded from the Meta Graph API.
 * @param mimeType  MIME type reported by Meta (e.g. "audio/ogg; codecs=opus").
 * @returns         The transcript text string.
 *
 * @throws Error if GROQ_API_KEY is not set, the request times out, the HTTP
 *         response is not 2xx, or the response body is not parseable.
 * Callers are responsible for catching and sending a user-facing fallback.
 */
export async function transcribeAudio(bytes: Uint8Array, mimeType: string): Promise<string> {
  const groqApiKey = Deno.env.get('GROQ_API_KEY');
  if (!groqApiKey) {
    throw new Error('[transcribe] GROQ_API_KEY is not set');
  }

  // Derive a file extension from the MIME type so Groq can identify the codec.
  // Meta often sends "audio/ogg; codecs=opus" — strip params before the semicolon.
  const baseMime = mimeType.split(';')[0].trim().toLowerCase();
  const extMap: Record<string, string> = {
    'audio/ogg': 'ogg',
    'audio/mpeg': 'mp3',
    'audio/mp4': 'm4a',
    'audio/webm': 'webm',
    'audio/wav': 'wav',
    'audio/flac': 'flac',
    'audio/aac': 'aac',
    'audio/amr': 'amr',
  };
  const ext = extMap[baseMime] ?? 'ogg';
  const filename = `audio.${ext}`;

  const blob = new Blob([bytes], { type: mimeType });

  const formData = new FormData();
  formData.append('file', blob, filename);
  formData.append('model', GROQ_WHISPER_MODEL);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), GROQ_TRANSCRIPTION_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(GROQ_TRANSCRIPTION_ENDPOINT, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${groqApiKey}`,
        // Note: do NOT set Content-Type manually; the browser/Deno runtime sets
        // it with the correct boundary when body is FormData.
      },
      body: formData,
    });
  } catch (fetchErr: unknown) {
    clearTimeout(timeoutId);
    const isAbort = fetchErr instanceof Error && fetchErr.name === 'AbortError';
    if (isAbort) {
      throw new Error('[transcribe] Groq Whisper request timed out');
    }
    throw new Error(`[transcribe] Groq Whisper fetch error: ${String(fetchErr)}`);
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    const errBody = await response.text().catch(() => '(unreadable)');
    throw new Error(`[transcribe] Groq Whisper non-2xx: ${response.status} — ${errBody}`);
  }

  interface WhisperResponse {
    text?: string;
  }

  let data: WhisperResponse;
  try {
    data = (await response.json()) as WhisperResponse;
  } catch (parseErr) {
    throw new Error(`[transcribe] Failed to parse Whisper JSON response: ${String(parseErr)}`);
  }

  if (typeof data.text !== 'string') {
    throw new Error('[transcribe] Whisper response missing "text" field');
  }

  return data.text;
}
