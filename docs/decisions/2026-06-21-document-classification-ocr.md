# ADR: Document classification OCR — extract-document edge function

**Date:** 2026-06-21
**Status:** Accepted
**Scope:** `radar-app` — document capture & classification feature (HU-25)

---

## Context

The existing OCR pipeline (`extract-receipt`, HU-05/06) covers one narrow case: a photo of a
paper or digital receipt is captured and assumed to be a single expense. Three structural
limitations blocked extending that assumption to the broader document types users actually
encounter in Argentina:

1. **Receipt-only assumption** — `extract-receipt` returns a single flat `OcrResult` with no
   `documentType` field. Routing an incoming transfer or a card statement through it produces
   wrong results (always an expense, no type awareness).

2. **No transfer direction model** — the `expenses` and `incomes` tables are separate; there is
   no `direction` column anywhere. A received transfer must create an `incomes` row, not an
   `expenses` row. The existing function has no concept of direction.

3. **PDF not handled** — the Groq vision model (`llama-4-scout-17b`) is vision-only. The Expo
   client runs in Expo Go and cannot render PDF natively. There was no server-side rasterization
   in the stack. Users who receive comprobantes as PDFs (Mercado Pago, Ualá statements) had no
   path to upload them.

Additionally, Argentine users frequently receive card account summaries containing many
transactions. Forcing 1-by-1 manual entry is the status-quo friction RADAR exists to eliminate.

---

## Decision

### 1. New edge function `extract-document` — do not extend `extract-receipt`

A separate Deno edge function handles the new classification contract. `extract-receipt` is left
intact and its test baseline is not disturbed.

**Rationale:** The output contracts are incompatible. `extract-receipt` returns a single `OcrResult`
(`amount`, `merchant`, `currency`, `occurredAt`, `confidence`). The new contract requires
`documentType`, `direction`, and a `transactions[]` array that may have length > 1. Merging the two
contracts into one function would require branching logic on input and produce a union type that
obscures intent. Separate functions keep each contract clean and independently deployable.

The review screen (`expense/review.tsx`) now uses `extract-document` for the unified document flow.
The `extract-receipt` function remains deployed for backward compatibility and targeted receipt
scanning if needed.

### 2. Server-side PDF rasterization via mupdf (WASM) — `npm:` specifier, lazy-loaded

PDF pages are converted to PNG images in the Deno edge runtime using the mupdf library. The
function processes up to 3 pages. Pages beyond that limit are truncated (flagged as `truncated: true`
in the response). Images pass through without conversion.

All page images are collected and sent to Groq in a single vision call with a multi-image message
payload. Transactions from all pages are concatenated into a single `transactions[]` array.

**Rationale for server-side rasterization:** Groq is vision-only — it cannot parse a PDF binary.
The Expo client runs in Expo Go, which does not support native PDF rendering modules. A custom dev
build could add client-side PDF support (e.g. via `react-native-pdf`) but that is a significant
infrastructure cost for the prototype phase. The edge function is already the right place to
handle vendor-specific transformations.

**Rationale for the 3-page cap:** Each page is a separate vision call input. More pages increase
latency and Groq token cost linearly. For MVP use cases (bank transfer confirmations, single-month
card summaries), 3 pages covers the vast majority of real documents.

#### mupdf import strategy: esm.sh → npm: deviation

**Original plan:** import mupdf at module top via `https://esm.sh/mupdf@1.26.4`.

**Issue:** Deploying v1 of `extract-document` with the top-level esm.sh import produced an HTTP 500
at the OPTIONS preflight — before any request logic executed. This is a module-load crash. The esm.sh
WASM bundle for mupdf fails to instantiate in the Supabase Edge (Deno) runtime. A Node.js spike had
confirmed the mupdf API and rasterization logic worked correctly, but Node ≠ the edge WASM bundle.

**Applied deviation:** The top-level import was removed. mupdf is now lazy-loaded inside the
`rasterisePdf` function via the `npm:` specifier:

```typescript
// rasterisePdf — called only when mimeType === 'application/pdf'
const mupdf = await import('npm:mupdf@1.26.4');
```

The `npm:` specifier uses Supabase Edge's Node-compat layer, which resolves the same build that
worked in the Node spike. Redeploying as v2 returned OPTIONS 204 — the function boots cleanly.

**Residual risk:** The `npm:mupdf` WASM instantiation at _invocation_ time (i.e. when an actual
PDF request arrives) has not been confirmed end-to-end in the edge runtime. A Node spike validated
the rasterization API; a full authenticated E2E test with a PDF payload is the remaining open step.
Any failure (import error or rasterization error) is caught and returned as `PDF_CONVERT_ERROR`
(HTTP 422) with the Spanish message `"No pudimos leer el PDF, probá con una captura"`. Image
documents are entirely unaffected. If `npm:mupdf` also fails at invocation, fallback paths are:
a hosted PDF-to-image conversion service (e.g. Gotenberg), or deferring PDF support to phase 2
(image-capture-only, as today).

**Magnitude:** Minor — same library, changed import specifier and made the function async. No
architectural change, no consensus required. Graceful degradation preserved.

### 3. Unified `transactions[]` output contract

Every document type — receipt, transfer, screenshot, card_statement — produces the same
`{ documentType, confidence, truncated, transactions[] }` shape. Single-document types always
produce an array of length 1.

Each transaction carries:

```typescript
{
  amount: number | null
  currency: 'ARS' | 'USD' | null
  occurredAt: string | null       // ISO date
  merchant: string | null
  direction: 'expense' | 'income' // defaults to 'expense' when undetermined
  categoryHint: string | null
  suggestedNewCategory: string | null
  items: OcrLineItem[]
}
```

**Rationale:** A single contract eliminates client-side branching based on document type. The
review screen simply checks `transactions.length` and `transactions[0].direction`. Zod validation
(`documentOcrResultSchema` in `lib/schemas/document.ts`) applies uniformly regardless of type.

### 4. Direction routing in the review screen

`expense/review.tsx` branches on the first transaction's `direction`:

- `direction === 'expense'` → `<ExpenseForm prefill={...}>`
- `direction === 'income'` → `<IncomeForm prefill={...}>` (new `IncomePrefill` prop added)

A toggle lets the user override the inferred direction; the form swaps while preserving extracted
field values. The document type is shown as a badge (e.g. "Transferencia", "Comprobante").

`income-form.tsx` gained `IncomePrefill` support by mirroring the existing `prefill` prop pattern
from `ExpenseForm`. Prefill processing reuses `matchCategory`, `mapOcrItems`, and `normalizeName`
from `lib/ocr.ts`.

**Rationale:** Keeping routing logic in the review screen (presentation layer) avoids coupling
the data-extraction layer to UI routing decisions. The edge function only infers; the client decides
how to present it.

### 5. Atomic batch import via `import_transactions` RPC (SECURITY INVOKER)

Multi-transaction results (card statements) render as a selectable list. Confirmed rows are imported
via a single RPC call:

```sql
create or replace function public.import_transactions(p_rows jsonb)
returns void
language plpgsql
security invoker
```

`SECURITY INVOKER` means the function executes with the caller's RLS context — rows are inserted with
`user_id = auth.uid()`. The function is transactional: any row-level failure rolls back the entire
batch. This follows the pattern established by the shared-expenses RPCs.

**Rationale:** A single RPC call avoids N round-trips from the client. The transactional guarantee
prevents partial-import states (some rows created, some not) that would be confusing and hard to
recover from. SECURITY INVOKER is correct for client-callable RPCs that must respect row-level
ownership; the existing SECURITY DEFINER RPCs are used only for cron-triggered materializers
(Pattern 1 per `docs/conventions/database.md`).

---

## Alternatives considered

### esm.sh mupdf (top-level import)

Attempted first. Crashes the Supabase Edge runtime at module load time — the WASM binary fails
to instantiate outside Node. Not viable without a fix upstream in esm.sh or a Supabase runtime
update. Rejected.

### unpdf (text extraction only)

`unpdf` extracts text content from PDFs without rasterization. Would not work because Groq is
vision-only — it needs image data. Text-only extraction also loses layout information critical
for reading tabular card statement data. Rejected.

### Client-side PDF rendering (react-native-pdf)

Requires a custom dev build. Expo Go does not support it. Blocks progress during the prototype
phase. Deferred to a possible phase 2 when the build pipeline is established.

### External PDF-to-image API (Gotenberg, PDFShift, pdf.co)

Would require a new vendor account, billing, and outbound HTTP from the edge function. Adds a
third-party dependency and increases cost per request. Not justified for MVP given the mupdf
npm: approach is cleaner. Retained as the fallback if `npm:mupdf` proves unviable at runtime.

### Extend `extract-receipt` with a `documentType` parameter

Would require changing the response schema in a breaking way, complicating the existing test
suite and any future consumers of `extract-receipt`. The separation principle is cleaner.
Rejected.

---

## Consequences

**Benefits:**

- PDF files and images can both be submitted through a single capture entry point.
- Transfer direction is inferred automatically; users no longer have to choose between
  expense and income screens before even seeing the data.
- Card statements with N transactions can be imported in one session instead of N manual entries.
- `extract-receipt` is unchanged — no regression risk to the existing OCR baseline.
- PDF failures degrade gracefully; the image capture path is completely unaffected.
- Atomic import prevents partial-state inconsistencies.

**Tradeoffs:**

- **mupdf runtime validation gap** — the PDF rasterization path is validated up to deploy-time
  boot (OPTIONS 204) and a Node API spike. A full authenticated E2E test with a PDF payload
  is still needed to confirm `npm:mupdf` works at invocation time in the edge runtime.
- **3-page truncation** — multi-page PDFs beyond 3 pages lose data silently (with a `truncated`
  flag). Users with longer statements must fall back to screenshot-by-screenshot.
- **Latency for multi-page PDFs** — rasterization + a Groq vision call with multiple images
  adds latency. P95 target for a 3-page PDF is ~25 s (vs ~8 s for a single image); a spinner
  with progress context is shown.
- **Direction inference accuracy** — LLM direction inference can err (e.g. ambiguous transfer
  screenshots). The user-facing toggle mitigates this; default is `expense` on uncertainty.
- **Import is all-or-nothing** — a single invalid row aborts the entire batch. Users must fix
  and retry. Acceptable for MVP.
- **Original file not stored** — as with `extract-receipt`, the document bytes are transient.
  Deferred to the `media` bucket phase.

---

## Implementation

1. `expo-document-picker` added to `package.json`; "Documento" entry point in `camera.tsx` with
   type + size validation.
2. `supabase/functions/extract-document/index.ts` — JWT verification → branch on `mimeType` →
   `rasterisePdf` (lazy `npm:mupdf`) or pass-through → single Groq vision call → validate →
   `{ data: DocumentOcrResult }`.
3. `lib/schemas/document.ts` — `documentOcrResultSchema` (Zod), `DocumentOcrResult`,
   `DocumentTransaction` types.
4. `lib/ocr.ts` — `extractDocument()`, `mapDocumentToPrefill()`, direction helpers. Reuses
   `matchCategory`, `mapOcrItems`, `normalizeName`.
5. `hooks/use-extract-document.ts` — TanStack Query `useMutation` wrapper.
6. `components/incomes/income-form.tsx` — `IncomePrefill` prop added; prefill wiring mirrors
   `ExpenseForm`.
7. `expense/review.tsx` — branches on `transactions.length` and `direction`; doc-type badge;
   direction toggle.
8. `supabase/migrations/20260621215215_import_transactions.sql` — `import_transactions` RPC,
   SECURITY INVOKER, dual-ship.
9. `types/supabase.ts` regenerated; `lib/repositories/transactions.ts` +
   `hooks/use-import-transactions.ts` + `components/expenses/transaction-import-list.tsx`.
