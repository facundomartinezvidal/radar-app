# ADR: OCR via Groq vision + Supabase Edge Function

**Date:** 2026-05-31
**Status:** Accepted
**Scope:** `radar-app` — receipt scan feature (HU-02/03/05/06)

---

## Context

RADAR's "captura rápida + IA" value pillar requires photographing a paper
or digital receipt and automatically pre-filling the new-expense form.
Three implementation axes had open choices at the start of this feature:

1. **Where does OCR run?** On-device ML, a dedicated cloud OCR API, or a
   vision LLM via an existing backend primitive.
2. **How does the image travel?** Upload to Storage first, or inline in the
   request body as base64.
3. **Which vision model?**

Constraints in play:

- The app targets Expo Go for the prototype phase — no custom dev build,
  no native ML modules.
- The `media` Storage bucket does not exist yet; adding a Storage upload
  dependency would block the feature.
- Groq was already considered for the AI/insights pillar, so a key and
  account already exist.

---

## Decision

### 1. Groq vision via Supabase Edge Function

A new Deno edge function (`extract-receipt`) receives the image, calls
Groq's OpenAI-compatible endpoint
(`https://api.groq.com/openai/v1/chat/completions`), and returns
structured JSON. The function verifies the caller's Supabase JWT before
touching Groq.

**Why not on-device ML Kit (Firebase)?**
ML Kit requires a custom dev build and a native module — incompatible with
Expo Go. It would also block progress until the build pipeline is set up.

**Why not a dedicated cloud OCR API (Google Vision, AWS Textract)?**
Both introduce new vendor accounts, billing, and integration surface.
Groq already has an account and fits the "AI pillar" narrative; a
vision-capable LLM also gives us `categoryHint` and `confidence` for free,
which a pure OCR API does not.

### 2. Base64 transport in the request body

The client compresses the image to JPEG at 1024 px / q0.6 via
`expo-image-manipulator` (always < 4 MB after compression) and sends
the bytes as a base64 string in the POST body. The edge function
reconstructs the data URL (`data:<mimeType>;base64,<bytes>`) for the
Groq vision message.

**Why not upload to Storage first?**
The `media` bucket does not exist. Requiring it would block this feature
on a separate infrastructure task. Base64-in-body avoids that dependency
entirely; when the bucket is eventually created, persisting the receipt
image becomes an additive step, not a prerequisite.

### 3. Model: `meta-llama/llama-4-scout-17b-16e-instruct`

Chosen for: vision support on Groq's API, `json_object` response format
(deterministic JSON output), temperature 0, and fast inference (P95 target
< 6 s). The model is prompted in Spanish to extract `amount`, `currency`,
`occurredAt`, `merchant`, `categoryHint`, and `confidence`.

---

## Consequences

**Benefits:**

- Works in Expo Go — no native module or dev build required.
- No new vendor accounts — reuses Groq, Supabase infra.
- `categoryHint` + `confidence` fields come for free from the LLM, enabling
  the low-confidence UX warning and category auto-matching.
- The edge function is independently deployable and testable via curl.

**Tradeoffs:**

- Receipt images are not persisted. If the user wants to reference the
  original ticket later, it is gone after the session. Deferred until the
  `media` bucket is created.
- The 20-second timeout on Groq is generous; on slow networks the user
  waits on the loading screen. The retry UX mitigates this.
- Base64 adds ~33% overhead vs binary upload. After compression the payload
  is comfortably within Groq's limits, but very high-resolution originals
  could hit the edge; the compressor caps width at 1024 px to prevent this.
- `meta-llama/llama-4-scout-17b-16e-instruct` is a third-party model;
  extraction quality on Argentine receipt formats was validated manually
  but not benchmarked at scale.

---

## Implementation

1. `lib/image.ts` — `compressForOcr(uri)` → `{ base64, mimeType }`.
2. `supabase/functions/extract-receipt/index.ts` — Deno function: JWT
   verification → body parse → Groq call with AbortController timeout →
   `normaliseOcrResult` → `{ data: OcrResult }`.
3. `lib/schemas/ocr.ts` — `ocrResultSchema` (zod) for client-side
   defensive parse of the edge function response.
4. `lib/ocr.ts` — `extractReceipt`, `mapOcrToPrefill`, `matchCategory`,
   `OcrError` (typed error with `code` field).
5. `hooks/use-extract-receipt.ts` — TanStack Query `useMutation` wrapper.
6. `app/(protected)/expense/review.tsx` — orchestrates compress → OCR →
   prefill → `ExpenseForm` → `useCreateExpense`.
