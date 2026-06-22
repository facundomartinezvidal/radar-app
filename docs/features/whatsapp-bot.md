# WhatsApp bot (HU-26..29)

RADAR's WhatsApp integration lets a linked user register expenses and incomes, query movements, and get spending recommendations — all in natural language from WhatsApp, without opening the app.

**Branch:** `feat/whatsapp-bot`
**Release:** Entrega 4
**HUs:** HU-26 (account linking, ALTO), HU-27 (capture, ALTO), HU-28 (queries, MEDIO), HU-29 (recommendations, MEDIO)
**Test baseline after this feature:** 1839 → 1871

**Provider:** Meta WhatsApp Cloud API (free tier; test number reaches ≤5 verified recipients until business verification)

---

## What ships

| Capability                 | HU    | Surface                                              | Notes                                                        |
| -------------------------- | ----- | ---------------------------------------------------- | ------------------------------------------------------------ |
| App link screen            | HU-26 | `app/(protected)/profile/whatsapp.tsx`               | Generate code, instructions, masked number, two-step unlink  |
| One-time code linking      | HU-26 | `create_link_code()` + `redeem_link_code()` RPCs     | 6-char base32, 10-min TTL                                    |
| Identity resolution        | HU-26 | `resolve_wa_user()` DEFINER RPC                      | E.164 normalize, per-message                                 |
| Webhook foundation         | all   | `supabase/functions/whatsapp-webhook/`               | GET verify handshake, POST HMAC auth, idempotency, async ack |
| Text capture               | HU-27 | `classify.ts` + `capture.ts`                         | Groq llama-4-scout-17b intent+entities                       |
| Audio capture              | HU-27 | `transcribe.ts` → text pipeline                      | Groq Whisper `whisper-large-v3`                              |
| Image / PDF capture        | HU-27 | `capture.ts` → `extract-document` (server-to-server) | Reuses existing edge fn via service-role bypass              |
| Confirmation state machine | HU-27 | `whatsapp_conversations` + `import_transactions_for` | `SELECT FOR UPDATE`, 30-min TTL, cleared on first consume    |
| Movement queries           | HU-28 | `queries.ts` + read `_for` RPCs                      | Totals or by-category; share-aware                           |
| Recommendations            | HU-29 | `recommendations.ts` → `generate-insights` (s2s)     | Reuses existing edge fn; top 1–3 insights                    |
| Rate limiting              | all   | `dispatch.ts`                                        | 8 messages / 60 s per number                                 |

---

## Architecture

### Security model

The webhook runs with `verify_jwt = false` (set in `supabase/config.toml`). Meta presents no Supabase JWT.

- **GET** — guarded by `WHATSAPP_VERIFY_TOKEN` (Meta subscription handshake)
- **POST** — guarded by `X-Hub-Signature-256` HMAC-SHA256 of the raw request body using `WHATSAPP_APP_SECRET`. The body is read as raw text **before** JSON parse so the bytes match what Meta signed. Invalid or missing signature → 403, no side effects.

All privilege escalation to act on a resolved user's behalf is confined to Pattern 1 SECURITY DEFINER RPCs revoked from `anon`, `public`, and `authenticated` — callable only by the service role. See `docs/decisions/2026-06-21-whatsapp-bot-schema.md`.

### Request flow

```
Meta Cloud API
    │ GET ?hub.verify_token=...&hub.challenge=...
    ├─ verify.ts → checkHandshake → 200 echo challenge / 403
    │
    │ POST (signed)
    ├─ index.ts reads raw body (for HMAC)
    ├─ verify.ts → verifySignature → 403 on mismatch
    ├─ parse JSON → extract messages[]
    ├─ return 200 immediately  ◀── Meta ack window met
    └─ EdgeRuntime.waitUntil(handleMessage(...))
          │
          ├─ db.ts recordInbound → UNIQUE on provider_message_id (idempotency)
          ├─ dispatch.ts countRecentInbound → rate limit (8/60s)
          ├─ guard: unsupported type (sticker, location…) → polite reply
          ├─ db.ts resolveUser → resolve_wa_user() RPC
          │
          ├─ UNLINKED → looksLikeLinkCode? → redeemLinkCode() RPC → reply per outcome
          │          └─ else → UNLINKED_PROMPT
          │
          └─ LINKED → media branch:
                ├─ image/document → handleMediaCapture → extract-document (s2s)
                ├─ audio → transcribeAudio (Groq Whisper) → text pipeline
                └─ text → classifyIntent (Groq) → intent router:
                      ├─ pending + confirm → handleConfirm → import_transactions_for RPC
                      ├─ pending + cancel → clearPending
                      ├─ capture_expense / capture_income → handleCapture → pending
                      ├─ query → handleQuery → get_personal_totals_for / get_expense_by_category_for
                      ├─ recommendation → handleRecommendation → generate-insights (s2s)
                      ├─ unlink → unlink_wa RPC
                      └─ help / unknown / low-confidence → HELP_MESSAGE
```

### Async reply model (Design D3)

The Meta Cloud API has no synchronous reply channel. All outbound messages are `POST /{phone_number_id}/messages` calls to the Graph API (`graph.ts → sendText`). The webhook acks Meta with an empty 200 immediately and does all message handling inside `EdgeRuntime.waitUntil`, avoiding timeout retries from Meta.

### Confirmation state machine (Design D4)

`whatsapp_conversations` holds at most one pending action per user (pk = `user_id`). Creating a new capture stores a `pending_action` jsonb with `expires_at` (30 minutes). A `confirm` intent consumes it via `import_transactions_for` and clears the row. A `cancel` intent or expiry discards it. `SELECT … FOR UPDATE` on the row serializes concurrent `sí` messages — a duplicate confirm after the first is a no-op.

### Server-to-server calls (Design D2)

`handleMediaCapture` and `handleRecommendation` call `extract-document` and `generate-insights` respectively via `fetch` with `Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>` and optionally `x-whatsapp-internal-secret`. Both edge functions received a small internal bypass that keeps the existing app-facing JWT gate intact.

---

## HU-26 — Account linking

### Link flow

1. User opens **Perfil → WhatsApp** in the app.
2. Taps **"Generar código"** → `create_link_code()` INVOKER RPC returns a 6-char code valid for 10 minutes.
3. App displays the code prominently with instructions and a `wa.me` deep link that pre-fills the code.
4. User sends the code to the bot's number.
5. Webhook (`dispatch.ts`) detects the code shape via `looksLikeLinkCode()` regex and calls `redeem_link_code()`.
6. On `linked`: bot confirms, `whatsapp_links` row inserted with `status='linked'`.
7. On `expired`/`reused`/`invalid`/`already_linked`: bot replies with a specific Spanish message.

### Unlink

- **From app:** RLS UPDATE policy — user sets `status='unlinked'` directly.
- **From bot:** send "desvinculame" → `unlink` intent → `unlink_wa(userId)` DEFINER RPC.

After unlinking, `resolve_wa_user` returns NULL and the number is free to bind to any account.

---

## HU-27 — Capture

### Text path

1. `classifyIntent(text)` → `{intent, entities, confidence}` via Groq (llama-4-scout-17b, temperature 0).
2. Validated intent (`capture_expense` / `capture_income`, confidence ≥ 0.4).
3. Missing amount → clarifying question ("¿De cuánto fue el gasto?"), no pending state created.
4. Zero/negative amount → rejected immediately.
5. `entitiesToRow()` maps entities to `ImportTransactionRow`. Currency defaults to ARS; USD only when explicit ("dólares", "usd", "verdes"). Argentine slang: "luca" = 1000 ARS, "palo" = 1M ARS.
6. Category resolved via case-insensitive `resolveCategoryId()` against user's `categories` table.
7. `setPendingAction()` stores the row in `whatsapp_conversations`.
8. Bot replies with a confirm prompt showing direction, amount, currency.

### Audio path

Same as text after transcription: `fetchMediaBytes(audio.id)` → `transcribeAudio(bytes, mimeType)` via Groq Whisper. On empty transcript or error → "No pude entender el audio, escribime el gasto o mandá una foto."

### Image / PDF path

`fetchMediaBytes(mediaId)` → base64-encode → POST to `extract-document` with `Authorization: Bearer <service_role_key>`. On single transaction: confirm prompt. On `card_statement` with N rows: summarize count + total, single import-all confirm. Low OCR confidence (`< 0.5`) flagged in confirm message.

### Confirm / cancel

- `confirm` intent → `handleConfirm` → `import_transactions_for(userId, rows)` RPC → clear pending → "Listo, registré N movimiento/s."
- `cancel` intent → `clearPending(userId)` → "Listo, lo cancelé."
- Expired pending → "Esa operación expiró, mandámela de nuevo."

---

## HU-28 — Queries

`handleQuery` branches on whether `entities.queryCategory` is set:

| Path             | RPC called                    | Example reply                                    |
| ---------------- | ----------------------------- | ------------------------------------------------ |
| Totals (default) | `get_personal_totals_for`     | "Gastos — Este mes:\nARS: $ 45.000,00 (12 mov.)" |
| By category      | `get_expense_by_category_for` | Top 5 categories + "Otros" rollup + total        |

Period resolution (`resolvePeriod`) is UTC-based. Supported periods: `today`, `week` (ISO Mon–now), `month`, `prev_month`, `year`, custom `{from, to}`. Default when unspecified: current month. Amounts formatted as Argentine locale: `$ 12.345,67` (ARS), `USD 1.234,56`.

All read RPCs are share-aware — group expenses count only the user's split amount, matching in-app values.

---

## HU-29 — Recommendations

`handleRecommendation` gathers 5 RPC calls in parallel (current period totals, by-category, expense trend, income trend, previous period totals), builds the `InsightsPayload`, then calls `generate-insights` server-to-server.

Insufficient data guard: if both `totals.expenses` and `totals.incomes` are 0, replies with a graceful "no data" message instead of calling Groq. Bot formats the top 1–3 insights as `*title*\nbody` blocks separated by blank lines.

Fallback on `generate-insights` error or timeout (20 s): "No pude generar recomendaciones ahora, probá más tarde."

---

## Intent classification

`classify.ts` uses a single Groq chat-completions call (llama-4-scout-17b, `response_format: json_object`, temperature 0, 10 s timeout). NEVER throws — on any error returns `{intent: 'unknown', entities: {}, confidence: 0, language: 'es'}`.

| Intent            | Signals                                                  |
| ----------------- | -------------------------------------------------------- |
| `capture_expense` | "gasté", "pagué", "compré", "salió", "cargué"            |
| `capture_income`  | "cobré", "me pagaron", "entró", "sueldo", "ingresó"      |
| `query`           | "¿cuánto gasté?", "mostrá", "balance", "ver movimientos" |
| `recommendation`  | "dame un consejo", "¿cómo vengo?", "análisis"            |
| `confirm`         | "sí", "dale", "ok", "confirmo", "va", "bueno"            |
| `cancel`          | "no", "cancelá", "olvidate", "no gracias"                |
| `unlink`          | "desvinculame", "unlink"                                 |
| `help`            | "ayuda", "help", "¿qué podés hacer?"                     |
| `unknown`         | fallback                                                 |

Low confidence threshold: `0.4`. Capture and query intents below this threshold fall back to the help message.

---

## Edge cases

| Situation                           | Behavior                                                                    |
| ----------------------------------- | --------------------------------------------------------------------------- |
| Invalid `X-Hub-Signature-256`       | 403, no side effects                                                        |
| GET verify token mismatch           | 403                                                                         |
| Status/delivery callback            | 200, no processing                                                          |
| Duplicate webhook delivery          | `provider_message_id` UNIQUE → 200 short-circuit, no double-write           |
| Unlinked sender (non-code message)  | Linking prompt only; no financial action                                    |
| Code expired / reused / invalid     | Specific Spanish reply per outcome                                          |
| Number already linked to other user | `already_linked` reply; instructs to unlink first                           |
| Rate limit exceeded (>8/60s)        | "Esperá un momento, estás enviando mensajes muy rápido."                    |
| Unsupported message type (sticker…) | "Por ahora puedo con texto, audios, fotos y PDFs."                          |
| Missing amount in capture           | Clarifying question; no pending action                                      |
| Zero / negative amount              | "El monto tiene que ser mayor a cero."                                      |
| Currency ambiguity                  | Default ARS; surfaced in confirm text                                       |
| Low OCR confidence                  | Confirm prompt with "No estoy seguro de estos datos, revisá" prefix         |
| Media fetch failure                 | "No pude descargar el archivo, reenvialo."                                  |
| Empty audio transcript              | "No pude entender el audio, escribime el gasto o mandá una foto."           |
| Pending confirmation expired        | "Esa operación expiró, mandámela de nuevo."                                 |
| Duplicate `sí` (double confirm)     | No-op; pending cleared on first consume                                     |
| Groq timeout (classify / insights)  | Fallback intent `unknown` / friendly "no disponible" reply                  |
| Insufficient data for insights      | Graceful "no tengo suficientes datos" message                               |
| Unhandled error                     | `markProcessed(failed)` + generic "probá de nuevo" reply if not yet replied |

---

## Key files

| File                                                           | Role                                                                          |
| -------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `supabase/functions/whatsapp-webhook/index.ts`                 | Router: GET verify, POST HMAC, extract messages, ack + async dispatch         |
| `supabase/functions/whatsapp-webhook/verify.ts`                | Pure: `checkHandshake`, `verifySignature` (unit-testable)                     |
| `supabase/functions/whatsapp-webhook/graph.ts`                 | Meta Graph API v21.0: `sendText`, `fetchMediaBytes`                           |
| `supabase/functions/whatsapp-webhook/db.ts`                    | Service-role helpers: record/resolve/getConversation/setPending/markProcessed |
| `supabase/functions/whatsapp-webhook/dispatch.ts`              | `handleMessage`: idempotency → rate-limit → identity → media/audio/text route |
| `supabase/functions/whatsapp-webhook/classify.ts`              | Groq intent classifier; never throws                                          |
| `supabase/functions/whatsapp-webhook/capture.ts`               | `handleCapture`, `handleConfirm`, `handleMediaCapture`                        |
| `supabase/functions/whatsapp-webhook/transcribe.ts`            | Groq Whisper; multipart form-data                                             |
| `supabase/functions/whatsapp-webhook/queries.ts`               | `handleQuery`, `resolvePeriod`, `formatAmount`                                |
| `supabase/functions/whatsapp-webhook/recommendations.ts`       | `handleRecommendation`, `buildInsightsPayload`                                |
| `app/(protected)/profile/whatsapp.tsx`                         | Link screen: generate/display code, linked status, two-step unlink            |
| `lib/repositories/whatsapp.ts`                                 | `createLinkCode`, `unlinkWhatsapp`, `getWhatsappLink`                         |
| `hooks/use-whatsapp-link.ts`                                   | TanStack Query: `useWhatsappLink`, `useCreateLinkCode`, `useUnlinkWhatsapp`   |
| `lib/schemas/whatsapp.ts`                                      | Zod: `linkCodeSchema`, `whatsappLinkSchema`                                   |
| `supabase/migrations/20260622005257_whatsapp_bot_schema.sql`   | 4 tables + indexes + RLS + triggers                                           |
| `supabase/migrations/20260622005922_whatsapp_link_rpcs.sql`    | `create_link_code`, `redeem_link_code`, `resolve_wa_user`, `unlink_wa`        |
| `supabase/migrations/20260622010559_whatsapp_service_rpcs.sql` | `import_transactions_for` + 4 read `_for` variants                            |

---

## Deployment / Meta setup

### Edge function secrets

Set in Supabase edge environment (never in `.env.local`):

```bash
supabase secrets set \
  WHATSAPP_ACCESS_TOKEN=<Meta system-user long-lived token> \
  WHATSAPP_PHONE_NUMBER_ID=<phone number id from Meta dashboard> \
  WHATSAPP_APP_SECRET=<Meta app secret> \
  WHATSAPP_VERIFY_TOKEN=<random shared secret> \
  WHATSAPP_INTERNAL_SECRET=<optional internal bypass token> \
  --project-ref miiorhmqxdqsowqxnpii
```

`GROQ_API_KEY` already set from previous features.

### Deploy

```bash
supabase functions deploy whatsapp-webhook --project-ref miiorhmqxdqsowqxnpii
```

`verify_jwt = false` is declared in `supabase/config.toml` under `[functions.whatsapp-webhook]`.

### Meta dashboard steps

1. Go to **Meta for Developers → your app → WhatsApp → Configuration**.
2. Set **Callback URL**: `https://miiorhmqxdqsowqxnpii.supabase.co/functions/v1/whatsapp-webhook`
3. Set **Verify token**: must match `WHATSAPP_VERIFY_TOKEN`.
4. Click **Verify and save** — Meta sends the GET handshake; the function echoes `hub.challenge`.
5. Under **Webhook fields**, subscribe to the **`messages`** field.
6. Under **To** in the test panel, add demo recipient phone numbers to the allow-list (up to 5 until business verification).
7. Use a **long-lived system-user access token** (the dashboard token expires in 24 h).

### Rollback

Unsubscribe the `messages` webhook field in the Meta dashboard, or disable the edge function. The new tables and Pattern 1 RPCs are additive and inert without the webhook.

---

## Out of scope

- Multiple WhatsApp numbers per user
- Group / community chats
- Per-row exclusion in multi-tx import (import-all only)
- Push reminders / outbound-initiated campaigns
- Business verification (test number limit: 5 recipients)

---

## Related

- ADR: `docs/decisions/2026-06-21-whatsapp-bot-schema.md`
- OpenSpec change: `openspec/changes/whatsapp-bot/`
- User flows: `docs/user-flows/HU-26-bot-whatsapp.md`, `HU-27-bot-registro-gasto.md`, `HU-28-bot-consultas.md`, `HU-29-bot-recomendaciones.md`
- Reused: `docs/features/document-capture-classify.md`, `docs/features/insights.md`
