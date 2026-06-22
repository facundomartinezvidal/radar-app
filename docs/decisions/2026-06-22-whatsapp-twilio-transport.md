# Decision: WhatsApp bot transport — Twilio variant

Date: 2026-06-22
Status: Accepted (branch `feat/whatsapp-bot-twilio`)
Related: [`2026-06-21-whatsapp-bot-schema.md`](2026-06-21-whatsapp-bot-schema.md), [`docs/features/whatsapp-bot.md`](../features/whatsapp-bot.md)

## Context

The WhatsApp bot (HU-26..29) shipped on `feat/whatsapp-bot` against the **Meta
WhatsApp Cloud API**. In Meta test mode, outbound messages to the developer's
Argentine number are never delivered (the Graph API accepts the send and returns
a message id, but nothing arrives) — lifting this requires Meta business
verification, impractical for the academic Entrega. **Twilio's WhatsApp Sandbox**
has no such block: a recipient opts in with `join <keyword>` and gets a working
two-way channel to a real AR number, no verification.

The bot was designed with the messaging provider as an isolated adapter, so this
is a **transport swap**, not a re-implementation.

## Decision

Re-target the existing `whatsapp-webhook` edge function from Meta Cloud API to
Twilio WhatsApp, changing only the transport seam. Everything else is reused
verbatim.

### Reused unchanged (no migration, no RPC changes, no `types/supabase.ts` regen)

- 4 tables (`whatsapp_links`, `whatsapp_link_codes`, `whatsapp_messages`,
  `whatsapp_conversations`) and 9 RPCs. `whatsapp_messages.provider_message_id`
  is provider-neutral and now stores Twilio's `MessageSid`.
- `classify.ts`, `transcribe.ts`, `queries.ts`, `recommendations.ts`, `db.ts`,
  the capture/confirm state machine (`capture.ts` logic), the rate limiter and
  link-code flow in `dispatch.ts`.
- The `extract-document` / `generate-insights` internal service-role bypass.
- The in-app link screen (copy tweak only: Twilio Sandbox `join` step).

### Transport seam changes

| Concern            | Meta (Cloud API)                                                                                         | Twilio (this branch)                                                                                                 |
| ------------------ | -------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Caller auth        | GET `hub.challenge` handshake + `X-Hub-Signature-256` (HMAC-SHA256 over raw body, `WHATSAPP_APP_SECRET`) | `X-Twilio-Signature` = `base64(HMAC-SHA1(TWILIO_AUTH_TOKEN, url + concat(sortedParamName+value)))`; no GET handshake |
| Inbound            | JSON `entry[].changes[].value.messages[]`                                                                | form-encoded `From`/`Body`/`NumMedia`/`MediaUrl{i}`/`MediaContentType{i}`/`MessageSid`                               |
| Idempotency key    | Meta message `id`                                                                                        | Twilio `MessageSid`                                                                                                  |
| Outbound reply     | Graph `POST /{phone_number_id}/messages` (bearer)                                                        | Twilio Messages API `POST /2010-04-01/Accounts/{sid}/Messages.json` (HTTP Basic auth)                                |
| Media fetch        | media-`id` → URL → bytes (2 calls, bearer)                                                               | single Basic-auth GET of `MediaUrl{i}`                                                                               |
| Number form        | strip `+`; AR `549`→`15` recipient transform                                                             | strip `whatsapp:` prefix; no transform (Twilio normalizes AR `+549…` both ways)                                      |
| Ack                | empty 200                                                                                                | empty TwiML `<Response></Response>` (`text/xml`, 200)                                                                |
| Secrets (edge env) | `WHATSAPP_ACCESS_TOKEN`/`_PHONE_NUMBER_ID`/`_APP_SECRET`/`_VERIFY_TOKEN`                                 | `TWILIO_ACCOUNT_SID`/`TWILIO_AUTH_TOKEN`/`TWILIO_WHATSAPP_FROM`                                                      |

### File-level impact (all under `supabase/functions/whatsapp-webhook/`)

- `verify.ts` — Twilio HMAC-SHA1 signature (`buildTwilioSignatureBase`,
  `validateTwilioSignature`); `checkHandshake` + Meta HMAC removed.
- `parse.ts` (new) — `parseTwilioForm` maps the form to the internal
  `WaMessage`/`WaContact` shape; for media, the `.id` field carries the Twilio
  `MediaUrl` so downstream `fetchMediaBytes(.id)` works transparently.
- `twilio.ts` (replaces `graph.ts`) — `sendText` (Messages API), `fetchMediaBytes`
  (Basic-auth GET).
- `index.ts` — form parse, signature validate, empty-TwiML ack; GET handshake
  removed.
- `dispatch.ts` / `capture.ts` — import path `./graph.ts` → `./twilio.ts`; no
  logic change.
- Tests: `verify.test.ts` rewritten for Twilio; `parse.test.ts` added.
  `dispatch.test.ts` / `capture.test.ts` unchanged (pure helpers only).

## Consequences

- A live demo to an Argentine number works: opt in with `join <keyword>`, then
  link and chat. Replies arrive (unlike Meta test mode).
- Twilio only delivers within an active session window (24h after the user's last
  inbound) until a production WhatsApp sender is approved — fine for the demo;
  the link screen tells the user to `join` first.
- Same function name `whatsapp-webhook`; deploying this branch overwrites the Meta
  build. Branches are mutually exclusive — one provider deployed at a time. A
  future merge could pick the provider by env or detect `X-Twilio-Signature`
  vs `X-Hub-Signature-256` at runtime.
- The webhook stays JWT-less (`verify_jwt = false`); `X-Twilio-Signature` is the
  sole caller auth, validated before any side effect.

## Notes

- Signature base-string must use the exact public URL Twilio is configured with
  (`req.url`); any host/scheme/trailing-slash drift breaks the HMAC match.
- `deno` is not run in CI and was not installed during this build; the Deno test
  files use node-verified HMAC-SHA1 vectors (HMAC-SHA1 is standard, so Web Crypto
  and node `crypto` agree byte-for-byte).
