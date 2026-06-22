## Context

The WhatsApp bot exists end-to-end on `feat/whatsapp-bot` against the Meta WhatsApp Cloud API. Meta's test mode never delivers outbound messages to the developer's Argentine number (Graph returns a message id; nothing arrives), and lifting that requires business verification — out of reach for the Entrega. Twilio's WhatsApp Sandbox sidesteps this: opt in with `join <keyword>`, get a working bidirectional channel to a real number, no verification.

The bot was deliberately designed so the messaging provider is an isolated adapter. The DB schema (`whatsapp_messages.provider_message_id` is provider-neutral), the Pattern-1 `*_for(p_user_id, …)` DEFINER RPCs, the Groq intent classifier, Whisper transcription, the capture→confirm state machine, queries, and recommendations are all transport-independent. This change therefore swaps only the adapter and **adds no schema and no new RPCs**.

## Goals / Non-Goals

**Goals:**
- Same four HUs, same behaviour, delivered over Twilio WhatsApp with replies that actually arrive on an AR number.
- Touch only the transport seam: caller auth, inbound parse, outbound reply, media fetch, number form.
- Reuse the shipped schema, RPCs, and business logic verbatim — no migration, no `types/supabase.ts` regen.
- Keep the JWT-less webhook signature-verified and keep all privilege escalation in the existing Pattern-1 RPCs.

**Non-Goals:**
- New tables or RPCs (the existing ones are reused unchanged).
- Twilio production WhatsApp sender approval (Sandbox is enough for the demo).
- Running Meta and Twilio simultaneously — this is a separate branch; one provider is deployed at a time.
- Multiple numbers per user; group chats; per-row exclusion in multi-tx imports; push reminders.

## Decisions

### D1 — Twilio request signing replaces Meta's handshake + body HMAC
Twilio has no GET verification handshake; the callback URL is set in the Twilio console. Inbound POSTs carry `X-Twilio-Signature`, computed as **base64(HMAC-SHA1(`TWILIO_AUTH_TOKEN`, fullURL + concat(sortedParamName + paramValue)))**. `verify.ts` recomputes it from the exact public function URL and the form fields and rejects 403 on mismatch. **Why this exact recipe:** Twilio sorts POST params alphabetically and appends each `name+value` to the URL with no separators; any deviation (wrong URL scheme/host, missing param) breaks the match. The function URL must be the externally-visible Supabase URL Twilio actually called (no trailing-slash drift).

### D2 — Form-encoded inbound, `MessageSid` idempotency
Parse `application/x-www-form-urlencoded`, not JSON. Map `From` (e.g. `whatsapp:+5491166660428`) → strip prefix → E.164 `+5491166660428`; `Body` → text; `NumMedia`/`MediaUrl{i}`/`MediaContentType{i}` → attachments; `MessageSid` → idempotency key written to `whatsapp_messages.provider_message_id` (UNIQUE). Duplicate `MessageSid` (Twilio retry on non-200) short-circuits 200 — same insert-first guard as today, just a different id source.

### D3 — Reply async via Twilio Messages API (keep the ack-fast shape)
Twilio supports a synchronous TwiML reply (`<Response><Message>…</Message></Response>`), but Groq vision/Whisper exceed Twilio's webhook timeout, so the bot keeps its uniform **ack-fast/reply-async** shape: validate signature → insert `processing` → resolve identity → return an **empty `<Response/>` (text/xml, 200)** immediately → continue handling and reply via the **Twilio Messages API** (`POST /2010-04-01/Accounts/{AccountSid}/Messages.json`, HTTP Basic auth `AccountSid:AuthToken`, body `From=TWILIO_WHATSAPP_FROM&To=whatsapp:+…&Body=…`) inside `EdgeRuntime.waitUntil`. One reply path for text and media alike; `dispatch.ts` logic is unchanged — only `sendText` swaps Graph for Messages API.

### D4 — Single-GET basic-auth media fetch
Twilio media is a ready-to-fetch URL (`MediaUrl0`) protected by HTTP Basic auth (`AccountSid:AuthToken`); there is no media-`id`→URL metadata step like Meta's. `fetchMediaBytes` becomes a single authenticated GET; MIME comes from `MediaContentType0` (fallback `application/octet-stream`). The capture pipeline downstream (base64 → `extract-document` / Whisper) is unchanged.

### D5 — AR number transform removed
The Meta branch needed `…549<area><8digits>` → `…<area>15<8digits>` because Cloud API test mode rejected the 9-form. Twilio normalizes AR mobiles to canonical `+549…` E.164 on the way in and accepts the same form on the way out, so that regex is deleted. The number stored/resolved is the clean E.164 from stripping the `whatsapp:` prefix.

### D6 — Reuse, don't re-create, schema and RPCs
No migration ships on this branch. The 4 tables and 9 RPCs from `feat/whatsapp-bot` already exist in the project and are provider-neutral. `resolve_wa_user`, `redeem_link_code`, `import_transactions_for`, and the read `_for` RPCs are called exactly as today. `types/supabase.ts` is not regenerated.

## Risks / Trade-offs

- **Signature recipe drift** → 403 on every inbound. Mitigation: build the signed string from the precise public URL Twilio is configured with; unit-test against Twilio's documented worked example; log the computed-vs-received signature on mismatch during bring-up.
- **Sandbox session window** → Twilio only delivers to numbers that sent `join <keyword>` within the last 24h of activity (free-form messages need an active session). Mitigation: the link screen instructs the user to `join` first; the demo stays inside the session window; document the constraint for the Entrega.
- **Two providers, one function name** → deploying this branch overwrites the Meta `whatsapp-webhook`. Mitigation: branches are mutually exclusive; only deploy the one being demoed. (A future merge would pick a provider via env or split function names.)
- **JWT-less endpoint** → `X-Twilio-Signature` is the only caller auth. Mitigation: mandatory validation before any side effect; 403 on mismatch; `TWILIO_AUTH_TOKEN` kept in edge env only.
- **LLM mis-parse** → same financial-error risk as the Meta branch; same mitigation (never auto-write; confirmation always shows amount + currency; reject non-positive).

## Migration Plan

1. Branch `feat/whatsapp-bot-twilio` off `feat/whatsapp-bot` (done) — inherits the full implementation.
2. Rewrite the transport seam: `verify.ts` (Twilio HMAC-SHA1), `index.ts` (form parse, drop GET handshake, empty-TwiML ack), `graph.ts`→`twilio.ts` (`sendText` Messages API, `fetchMediaBytes` basic-auth GET), `dispatch.ts`/`capture.ts` inbound-shape adapter.
3. Update the affected tests (`verify.test.ts`, `dispatch.test.ts`, capture media test); leave classifier/transcribe/queries/recommendations tests unchanged.
4. Set edge secrets (`TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_FROM`, optional `WHATSAPP_INTERNAL_SECRET`); deploy `whatsapp-webhook` (`verify_jwt=false`).
5. In the Twilio console: set the Sandbox "when a message comes in" webhook to the function URL (HTTP POST); note the `join <keyword>`.
6. Manual end-to-end: `join` → send link code → capture text/audio/image/pdf → confirm → row appears in app; query + recommendation replies arrive.
7. **Rollback**: point the Twilio Sandbox webhook away / redeploy the Meta branch. No schema to revert (none shipped).

## Open Questions

- Keep `whatsapp-webhook` as the function name (overwrites Meta on deploy) vs `whatsapp-webhook-twilio` for side-by-side — recommend same name, one provider at a time for the demo.
- Whether to soft-detect provider at runtime (presence of `X-Twilio-Signature` vs `X-Hub-Signature-256`) so one function serves both — out of scope now, noted for a future merge.
- Per-`wa_number` rate-limit thresholds — reuse the existing limiter as-is.
