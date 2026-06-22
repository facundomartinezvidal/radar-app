## Why

The WhatsApp bot (HU-26/27/28/29) is already built and deployed against the **Meta WhatsApp Cloud API** (`feat/whatsapp-bot`). In test mode Meta does not deliver outbound messages to Argentine test recipients (Graph accepts the send and returns a message id, but the message never arrives) until business verification — impractical for the academic Entrega. **Twilio's WhatsApp Sandbox** has no such delivery block: a user opts in with `join <keyword>` and gets a working two-way channel to a real AR number in minutes, with no business verification. This change re-targets the same bot at Twilio so the live demo actually delivers replies.

This is a **transport swap**, not a re-implementation. The DB schema, RPCs, capture/query/recommendation logic, confirmation state machine, and the in-app link screen are provider-agnostic and are **reused as-is** from `feat/whatsapp-bot`. Only the messaging adapter (caller authentication, inbound parsing, outbound reply, media fetch, number form) changes.

## What Changes

- Re-target the `whatsapp-webhook` Supabase edge function from Meta Cloud API to **Twilio WhatsApp**:
  - **Caller auth**: replace Meta's GET `hub.challenge` handshake + `X-Hub-Signature-256` (HMAC-SHA256 over raw body) with **`X-Twilio-Signature`** validation (HMAC-SHA1 over the full request URL + alphabetically-sorted POST params, base64, keyed on `TWILIO_AUTH_TOKEN`). No GET handshake — Twilio's callback URL is set in the console.
  - **Inbound parse**: replace the Cloud API JSON payload (`entry[].changes[].value.messages[]`) with Twilio's **form-encoded** body (`From`, `Body`, `NumMedia`, `MediaUrl0..N`, `MediaContentType0..N`, `MessageSid`, `WaId`).
  - **Idempotency**: key `whatsapp_messages.provider_message_id` on Twilio's `MessageSid` (the column is already provider-neutral).
  - **Outbound reply**: replace Graph API `POST /{phone_number_id}/messages` with the **Twilio Messages API** (`POST /2010-04-01/Accounts/{sid}/Messages.json`, HTTP Basic auth, `From=TWILIO_WHATSAPP_FROM`). Keep the ack-fast / reply-async shape (empty TwiML 200, then send).
  - **Media fetch**: replace the Graph media-`id`→URL→bytes two-step with a single authenticated GET of Twilio's `MediaUrl0` (HTTP Basic auth), MIME from `MediaContentType0`.
  - **Number form**: strip the `whatsapp:` prefix from `From` to get E.164 for resolve/store; prepend it for sending. Twilio normalizes AR numbers to canonical `+549…` E.164 both ways, so the Meta-specific `549`→`15` recipient transform is **removed**.
- **Reused unchanged** (no new migration): all 4 tables (`whatsapp_links`, `whatsapp_link_codes`, `whatsapp_messages`, `whatsapp_conversations`) and all 9 RPCs; the intent classifier, Whisper transcription, capture/confirm state machine, queries, and recommendations modules; the `extract-document` / `generate-insights` internal bypass; the in-app `profile/whatsapp.tsx` link screen (copy tweak only: sandbox `join` step).

## Capabilities

### New Capabilities
- `whatsapp-linking`: One-time-code linking/unlinking and identity resolution for inbound Twilio messages, authenticated by `X-Twilio-Signature` (HU-26).
- `whatsapp-capture`: Conversational expense/income capture over Twilio WhatsApp from text/audio/image/pdf with a mandatory confirmation step (HU-27).
- `whatsapp-queries`: Natural-language movement queries from share-aware aggregation RPCs (HU-28).
- `whatsapp-recommendations`: Natural-language recommendations via `generate-insights` (HU-29).

### Modified Capabilities
<!-- None at the spec level. Same business behaviour; only the transport adapter differs. The schema/RPCs are reused from feat/whatsapp-bot. -->

## Impact

- **New code**: none structurally — a new `feat/whatsapp-bot-twilio` branch off `feat/whatsapp-bot`.
- **Modified code**: `supabase/functions/whatsapp-webhook/` — `verify.ts` (Twilio HMAC-SHA1 signature), `index.ts` (form parse, drop GET handshake, empty-TwiML ack), `graph.ts`→`twilio.ts` (`sendText` via Messages API, `fetchMediaBytes` via `MediaUrl` basic-auth), `dispatch.ts`/`capture.ts` (inbound-shape adapter: `From`/`MediaUrl` instead of `from`/media-id); affected tests; link-screen copy. `config.toml` keeps `verify_jwt = false`.
- **Unchanged**: migration, all RPCs, `types/supabase.ts`, classifier, transcribe, queries, recommendations, confirmation state machine, `extract-document`/`generate-insights` bypass.
- **External deps**: Twilio account + WhatsApp Sandbox (free; `join <keyword>` opt-in, 72h session window, replies only to opted-in numbers until a production WhatsApp sender is approved); Groq (existing `GROQ_API_KEY`).
- **Secrets (edge env only)**: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_FROM` (e.g. `whatsapp:+14155238886`), optional `WHATSAPP_INTERNAL_SECRET`. The Meta secrets (`WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_APP_SECRET`, `WHATSAPP_VERIFY_TOKEN`) are no longer used on this branch.
- **Security**: webhook stays JWT-less but is now signature-verified via `X-Twilio-Signature`; all privilege escalation stays confined to the existing Pattern-1 DEFINER RPCs.
- **Docs**: new `docs/decisions/2026-06-22-whatsapp-twilio-transport.md`; update `docs/features/whatsapp-bot.md` (provider note) and AGENTS.md if this branch is merged.
