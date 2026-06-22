## 1. Branch & reuse baseline

- [x] 1.1 Branch `feat/whatsapp-bot-twilio` off `feat/whatsapp-bot` (inherits schema, RPCs, all webhook modules, app screen, tests)
- [x] 1.2 Confirm reused-unchanged surface: migration (4 tables + 9 RPCs), `types/supabase.ts`, `classify.ts`, `transcribe.ts`, `queries.ts`, `recommendations.ts`, confirm/cancel state machine, `extract-document`/`generate-insights` internal bypass, `profile/whatsapp.tsx`
- [x] 1.3 `config.toml`: keep `[functions.whatsapp-webhook] verify_jwt = false`

## 2. Caller authentication (replace Meta auth)

- [x] 2.1 Rewrite `verify.ts`: remove Meta GET `hub.challenge` handshake + `X-Hub-Signature-256` (HMAC-SHA256); implement `X-Twilio-Signature` validation = `base64(HMAC-SHA1(TWILIO_AUTH_TOKEN, fullUrl + concat(sortedParamName+value)))`; 403 on mismatch
- [x] 2.2 Tests: rewrite `verify.test.ts` against node-verified vectors (RADAR-shaped + canonical Twilio example); valid→true, tampered/wrong-token/null-header→false; drop handshake tests

## 3. Inbound parsing & idempotency

- [x] 3.1 `index.ts`: parse `application/x-www-form-urlencoded`; drop GET branch; new `parse.ts` `parseTwilioForm` maps `From`(strip `whatsapp:`)→E.164, `Body`, `NumMedia`, `MediaUrl{i}`/`MediaContentType{i}`, `MessageSid`
- [x] 3.2 Idempotency on `MessageSid` → `whatsapp_messages.provider_message_id` (reuse `recordInbound`); duplicate → no-op
- [x] 3.3 Remove the AR `549`→`15` recipient transform (Twilio normalizes both ways)
- [x] 3.4 Tests: `parse.test.ts` covers text/image/audio/pdf, prefix-stripping, missing MessageSid/From→null. `dispatch.test.ts` unchanged (pure helpers only — parsing moved to `parse.ts`)

## 4. Outbound reply (replace Graph API)

- [x] 4.1 Replace `graph.ts` → `twilio.ts`: `sendText` via Twilio Messages API (`POST /2010-04-01/Accounts/{sid}/Messages.json`, HTTP Basic auth, `From=TWILIO_WHATSAPP_FROM`, `To=whatsapp:+…`); keep 15s timeout; errors swallowed
- [x] 4.2 `index.ts` ack: `await handleMessage` then return empty TwiML `<Response></Response>` (text/xml, 200). Await-before-ack kept (Supabase isolate teardown kills un-awaited work; Twilio tolerates latency and `MessageSid` dedup makes a timeout-retry a no-op)
- [x] 4.3 Update imports in `dispatch.ts`/`capture.ts`/`queries.ts`/`recommendations.ts` (`sendText` source `./graph.ts`→`./twilio.ts`)

## 5. Media fetch (replace Graph media-id flow)

- [x] 5.1 `twilio.ts` `fetchMediaBytes`: single authenticated GET of `MediaUrl` with Basic auth; MIME from response `content-type` (fallback `application/octet-stream`)
- [x] 5.2 `capture.ts`: media identified by URL — `parseTwilioForm` puts `MediaUrl` in `message.{image,audio,document}.id`, so `fetchMediaBytes(.id)` and the Whisper / `extract-document` pipeline are unchanged
- [x] 5.3 Tests: `parse.test.ts` asserts `MediaUrl`→`.id` mapping per type; capture fetch-failure path unchanged (resend prompt, no write)

## 6. Link-screen copy (HU-26 client)

- [x] 6.1 `profile/whatsapp.tsx`: 4-step instructions incl. Twilio Sandbox `join` phrase; `WHATSAPP_BOT_NUMBER`→sandbox `+14155238886`, new `WHATSAPP_SANDBOX_JOIN` constant
- [x] 6.2 Tests (RNTL): asserts `join` step renders; generate/copy code, linked status, unlink still pass (11 tests green)

## 7. Deploy & docs

- [ ] 7.1 Set edge secrets (`TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_FROM`, optional `WHATSAPP_INTERNAL_SECRET`); deploy `whatsapp-webhook` (`verify_jwt=false`) — needs Twilio creds (user action)
- [ ] 7.2 Twilio console: set Sandbox "when a message comes in" webhook → function URL (HTTP POST); record `join <keyword>` — user action
- [ ] 7.3 Manual end-to-end: `join` → send code → capture text/audio/image/pdf → confirm → row in app; query + recommendation replies arrive — user action
- [x] 7.4 Docs: `docs/decisions/2026-06-22-whatsapp-twilio-transport.md` written. Provider note in `docs/features/whatsapp-bot.md` + AGENTS.md deferred to branch merge
- [x] 7.5 Quality gates: `pnpm format:check` (clean on changed files), `pnpm lint` (0), `pnpm typecheck` (0), `pnpm test` (1871/1871, 109 suites)
