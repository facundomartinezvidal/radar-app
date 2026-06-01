# Receipt scan — OCR → validate

Camera or gallery capture of a paper/digital receipt, automatic extraction
of expense data via Groq vision, and pre-filled form validation before
saving. Covers HU-02, HU-03, HU-05, HU-06.

---

## What ships

| Capability              | Surface                               | Notes                                  |
| ----------------------- | ------------------------------------- | -------------------------------------- |
| Camera capture (HU-02)  | `app/(protected)/(tabs)/camera.tsx`   | CameraView SDK 54, flip, retake        |
| Gallery pick (HU-03)    | `app/(protected)/(tabs)/camera.tsx`   | ImagePicker array-syntax SDK 54        |
| OCR extraction (HU-05)  | `supabase/functions/extract-receipt/` | Groq vision, JSON mode, 20 s timeout   |
| Validate + save (HU-06) | `app/(protected)/expense/review.tsx`  | Pre-filled ExpenseForm, editable       |
| Date field              | `components/expenses/date-field.tsx`  | @react-native-community/datetimepicker |

---

## Architecture / data flow

```mermaid
flowchart TD
    A[camera.tsx\ncapture / gallery] -->|imageUri query param| B[review.tsx]
    B --> C[compressForOcr\nlib/image.ts]
    C -->|base64 + mimeType| D[useExtractReceipt\nhooks/use-extract-receipt.ts]
    D --> E[extractReceipt\nlib/ocr.ts]
    E -->|supabase.functions.invoke| F[extract-receipt\nEdge Function]
    F -->|chat/completions + vision| G[Groq\nllama-4-scout-17b]
    G -->|OcrResult JSON| F
    F -->|{ data: OcrResult }| E
    E -->|ocrResultSchema.parse| D
    D -->|OcrResult| B
    B --> H[mapOcrToPrefill\nlib/ocr.ts]
    H -->|ReceiptPrefill| I[ExpenseForm\ncomponents/expenses/expense-form.tsx]
    I -->|CreateExpenseInput| J[useCreateExpense\nhooks/use-expenses.ts]
    J --> K[expenses table\nSupabase Postgres + RLS]
```

---

## Key files

| File                                           | Role                                                             |
| ---------------------------------------------- | ---------------------------------------------------------------- |
| `app/(protected)/(tabs)/camera.tsx`            | Capture / gallery picker; navigates to review screen             |
| `app/(protected)/expense/review.tsx`           | Orchestrates compress → OCR → prefill → save                     |
| `lib/image.ts`                                 | `compressForOcr` — 1024 px JPEG at q0.6 via ImageManipulator     |
| `lib/ocr.ts`                                   | `extractReceipt`, `mapOcrToPrefill`, `matchCategory`, `OcrError` |
| `lib/schemas/ocr.ts`                           | `ocrResultSchema` (zod) + `OcrResult` type                       |
| `hooks/use-extract-receipt.ts`                 | TanStack Query `useMutation` wrapper around `extractReceipt`     |
| `components/expenses/date-field.tsx`           | DS-styled date picker; Android modal / iOS inline spinner        |
| `supabase/functions/extract-receipt/index.ts`  | Deno edge function — JWT check, Groq call, normalisation         |
| `supabase/functions/extract-receipt/README.md` | Deploy + curl reference for the edge function                    |

---

## OCR contract

**Request** (POST `/functions/v1/extract-receipt`):

```json
{
  "imageBase64": "<base64-encoded JPEG bytes>",
  "mimeType": "image/jpeg"
}
```

`mimeType` is optional; defaults to `image/jpeg`. Supported:
`image/jpeg`, `image/png`, `image/webp`.

**Response — success (200)**:

```json
{
  "data": {
    "amount": 12500.5,
    "currency": "ARS",
    "occurredAt": "2026-05-28",
    "merchant": "Supermercado Día",
    "categoryHint": "Supermercado",
    "confidence": 0.92
  }
}
```

Any field the model could not read is `null`. `confidence < 0.5` triggers
a low-confidence banner on the review screen prompting the user to verify
all fields.

---

## Error taxonomy

| HTTP | `error.code`       | Cause                                | Client behavior        |
| ---- | ------------------ | ------------------------------------ | ---------------------- |
| 401  | `UNAUTHENTICATED`  | Missing / invalid JWT                | Manual-entry fallback  |
| 400  | `BAD_REQUEST`      | `imageBase64` missing or empty       | Manual-entry fallback  |
| 500  | `OCR_CONFIG_ERROR` | `GROQ_API_KEY` not set on project    | Manual-entry fallback  |
| 502  | `UPSTREAM_ERROR`   | Groq returned non-2xx                | Manual-entry fallback  |
| 502  | `OCR_PARSE_ERROR`  | Groq response unparseable            | Manual-entry fallback  |
| 504  | `OCR_TIMEOUT`      | Groq did not respond within 20 s     | **Retryable** + button |
| —    | `NETWORK_ERROR`    | Device offline / FunctionsFetchError | **Retryable** + button |
| 500  | `INTERNAL`         | Unhandled edge function error        | Manual-entry fallback  |

Retryable errors (`OCR_TIMEOUT`, `NETWORK_ERROR`) and compression failures
show a "Reintentar" button alongside the empty form. All other errors show
a static notice and the empty form — no crash, no dead end.

---

## Configuration

### Secret

```bash
supabase secrets set GROQ_API_KEY=gsk_... --project-ref miiorhmqxdqsowqxnpii
```

### Deploy

```bash
supabase functions deploy extract-receipt --project-ref miiorhmqxdqsowqxnpii
```

The function uses `verify_jwt: true` (default). No `supabase/config.toml`
override is needed.

---

## Out of scope

- **Receipt image not persisted** — `compressForOcr` produces a transient
  base64 payload; no upload to the `media` Storage bucket occurs until
  that bucket is created (see AGENTS.md §10 pending item 2).
- Line-item splitting, batch scanning.
- On-device offline OCR.
- WhatsApp receipt capture.
- Auto-creating new categories from `categoryHint`.

---

## Related

- HU specs: `docs/user-flows/HU-02.md`, `HU-03.md`, `HU-05.md`, `HU-06.md`
- Decision record: `docs/decisions/2026-05-31-ocr-groq-edge-function.md`
- Expenses form (foundation): `docs/features/expenses-crud.md`
