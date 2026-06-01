# extract-receipt — Edge Function

Receipt OCR via Groq vision. Accepts a base64-encoded image of a ticket or
commercial receipt and returns structured expense data extracted by a
vision-capable LLM.

---

## Purpose

Allows the mobile app to photograph a paper receipt and automatically
pre-fill the new-expense form with amount, date, merchant, currency, and a
category hint — eliminating manual data entry.

---

## Required secret

| Secret          | Description                                        |
| --------------- | -------------------------------------------------- |
| `GROQ_API_KEY`  | Groq API key with access to chat-completions (vision) |

The Supabase runtime automatically injects `SUPABASE_URL` and
`SUPABASE_ANON_KEY` — no manual configuration needed for those.

---

## Deploy

```bash
supabase functions deploy extract-receipt --project-ref miiorhmqxdqsowqxnpii
```

## Set the secret

```bash
supabase secrets set GROQ_API_KEY=gsk_... --project-ref miiorhmqxdqsowqxnpii
```

Verify secrets are set:

```bash
supabase secrets list --project-ref miiorhmqxdqsowqxnpii
```

---

## Request

```
POST /functions/v1/extract-receipt
Authorization: Bearer <supabase-user-jwt>
Content-Type: application/json

{
  "imageBase64": "<base64-encoded image bytes>",
  "mimeType": "image/jpeg"   // optional, defaults to "image/jpeg"
}
```

Supported MIME types: `image/jpeg`, `image/png`, `image/webp`.

---

## Response — success (200)

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

Any field the model could not read is returned as `null`.  
`confidence` is a number between 0 and 1 — values below ~0.5 should prompt
the user to review all fields manually.

---

## Response — errors

| HTTP | `error.code`       | Cause                                                     |
| ---- | ------------------ | --------------------------------------------------------- |
| 400  | `BAD_REQUEST`      | `imageBase64` missing or empty                            |
| 401  | `UNAUTHENTICATED`  | Missing or invalid `Authorization` header                 |
| 500  | `OCR_CONFIG_ERROR` | `GROQ_API_KEY` secret not set on the project              |
| 502  | `UPSTREAM_ERROR`   | Groq returned a non-2xx status                            |
| 502  | `OCR_PARSE_ERROR`  | Groq returned an unexpected or unparseable response       |
| 504  | `OCR_TIMEOUT`      | Groq did not respond within 20 seconds                    |
| 500  | `INTERNAL`         | Unhandled error — check Edge Function logs                |

---

## Sample curl invocation

Replace `<JWT>` with a valid Supabase user JWT and `<BASE64>` with the
base64-encoded image bytes.

```bash
curl -X POST \
  'https://miiorhmqxdqsowqxnpii.supabase.co/functions/v1/extract-receipt' \
  -H 'Authorization: Bearer <JWT>' \
  -H 'Content-Type: application/json' \
  -d '{
    "imageBase64": "<BASE64>",
    "mimeType": "image/jpeg"
  }'
```

To generate `<BASE64>` from a local file:

```bash
base64 -i receipt.jpg | tr -d '\n'
```

---

## Model details

| Parameter    | Value                                      |
| ------------ | ------------------------------------------ |
| Endpoint     | `https://api.groq.com/openai/v1/chat/completions` |
| Model        | `meta-llama/llama-4-scout-17b-16e-instruct` |
| Temperature  | `0` (deterministic)                        |
| Response format | `json_object`                           |
| Timeout      | 20 seconds                                 |

---

## Local development

```bash
supabase functions serve extract-receipt --env-file .env.local
```

Your `.env.local` must include:

```
GROQ_API_KEY=gsk_...
```
