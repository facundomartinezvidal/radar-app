## 1. Schema & data model

- [ ] 1.1 Migration: `whatsapp_links` (user_id ↔ E.164, status, unique active number, unique active user) with RLS (own row select/update)
- [ ] 1.2 Migration: `whatsapp_link_codes` (code unique, expires_at, consumed_at) with RLS (own rows) + partial index where consumed_at is null
- [ ] 1.3 Migration: `whatsapp_messages` (provider message id UNIQUE — stores Meta `id`, audit fields) — RLS enabled, no policies (service-role only)
- [ ] 1.4 Migration: `whatsapp_conversations` (pk user_id, pending_action jsonb, pending_kind, expires_at) — service-role only
- [ ] 1.5 Dual-ship migrations per `docs/conventions/database.md`; run `get_advisors`; regenerate `types/supabase.ts`
- [ ] 1.6 Tests: RLS denies cross-user access; unique constraints (active number/user, message_sid) hold

## 2. Linking & identity RPCs (HU-26)

- [ ] 2.1 `create_link_code()` (SECURITY INVOKER, auth.uid) — 10-min expiry, invalidate prior unconsumed codes; returns {code, expires_at}
- [ ] 2.2 `redeem_link_code(p_code, p_wa)` (DEFINER, Pattern 1, revoke anon/public/authenticated) — atomic bind; returns linked/expired/reused/invalid/already_linked
- [ ] 2.3 `resolve_wa_user(p_wa)` → uuid (DEFINER, Pattern 1) — E.164 normalization, linked-row lookup
- [ ] 2.4 `unlink_wa(p_user_id)` (DEFINER, Pattern 1) + app-side RLS unlink path
- [ ] 2.5 Tests: redeem outcomes (happy/expired/reused/invalid/already_linked-other-user); resolve linked→uuid / unlinked→null; revocation from authenticated

## 3. Service-side transaction & read RPCs (HU-27/28/29)

- [ ] 3.1 `import_transactions_for(p_user_id, p_rows)` → int (DEFINER, Pattern 1; body = `import_transactions` with explicit uid)
- [ ] 3.2 `get_personal_totals_for(p_user_id, p_from, p_to)` (DEFINER, Pattern 1, share-aware)
- [ ] 3.3 `get_expense_by_category_for` / `get_expense_by_period_for` / `get_income_by_period_for` (DEFINER, Pattern 1, share-aware)
- [ ] 3.4 Tests: `import_transactions_for` validation/atomicity/revocation; read-RPC parity with INVOKER versions for a given user

## 4. Reuse existing edge functions server-to-server

- [ ] 4.1 Add internal bypass (service-role Bearer or `WHATSAPP_INTERNAL_SECRET`) to `extract-document`; keep app JWT path unchanged
- [ ] 4.2 Add the same bypass to `generate-insights`
- [ ] 4.3 Tests: service-role call succeeds; app JWT path still gated

## 5. Webhook foundation

- [ ] 5.1 `supabase/config.toml`: `[functions.whatsapp-webhook] verify_jwt = false`
- [ ] 5.2 GET verification handshake: echo `hub.challenge` when `hub.verify_token` matches `WHATSAPP_VERIFY_TOKEN`, else 403
- [ ] 5.3 POST signature verification (`X-Hub-Signature-256` = HMAC-SHA256 of raw body w/ `WHATSAPP_APP_SECRET`, 403 on fail); JSON payload parse (`entry[].changes[].value.messages[]`); ignore status events
- [ ] 5.4 Idempotency: insert on Meta message `id`, short-circuit 200 on duplicate
- [ ] 5.5 Identity resolution via `resolve_wa_user`; unlinked → link/help prompt only
- [ ] 5.6 Async harness: ack 200 immediately, handle + reply via Graph API `POST /{phone_number_id}/messages` inside `EdgeRuntime.waitUntil`; Graph media-id→URL→bytes fetch helper (bearer `WHATSAPP_ACCESS_TOKEN`)
- [ ] 5.7 Tests: GET handshake (echo/403), POST signature reject (403), dedup (200 on repeat id), status-event ignore, unlinked→prompt

## 6. HU-26 link flow wiring

- [ ] 6.1 Dispatch code-bodied messages from unlinked numbers to `redeem_link_code`; reply per outcome
- [ ] 6.2 Tests: each redeem outcome maps to the correct reply

## 7. Intent classifier (HU-27/28/29)

- [ ] 7.1 Groq text classifier module → {intent, entities, confidence, language}
- [ ] 7.2 Resolve confirm/cancel/unlink/help/unknown intents against pending state
- [ ] 7.3 Tests: fixture messages → intents/entities; low-confidence/unknown handling

## 8. HU-27 capture

- [ ] 8.1 Text capture: entities → `ImportTransactionRow`, category match (port `matchCategory`), store pending_action
- [ ] 8.2 Confirm/cancel state machine: consume pending → `import_transactions_for`; clear on consume; FOR UPDATE lock
- [ ] 8.3 Image/PDF: Graph media-id→URL→bytes fetch → base64 → `extract-document` → map (port `mapDocumentToPrefill`/`partitionByDirection`); single vs card_statement multi confirm
- [ ] 8.4 Audio: Graph media fetch → Groq Whisper `whisper-large-v3` → text pipeline
- [ ] 8.5 Edge handling: ambiguous→clarify, low OCR confidence→flag, currency default ARS surfaced, zero/negative reject, media/transcription failure
- [ ] 8.6 Tests: capture→confirm→insert; cancel; expired pending; duplicate confirm no double-write; multi-tx; failures

## 9. HU-28 queries

- [ ] 9.1 Period parsing (este mes / semana / rango) → from/to; optional category/currency
- [ ] 9.2 Call read `_for` RPCs; format concise WhatsApp reply (tabular amounts, ARS/USD)
- [ ] 9.3 Tests: total this month, by-category, share-aware, no-data fallback

## 10. HU-29 recommendations

- [ ] 10.1 Build `generate-insights` payload from read `_for` RPCs (current + previous period)
- [ ] 10.2 Call `generate-insights`; reply top 1–3 insights; insufficient-data + failure fallbacks
- [ ] 10.3 Tests: payload shape, top-N reply, empty-data + error paths

## 11. Hardening

- [ ] 11.1 Per-`wa_number` rate limiting; pending-confirmation expiry; multi-media (NumMedia>1) note; group-jid ignore; Groq timeout reply
- [ ] 11.2 Tests for the above

## 12. App: link screen (HU-26 client)

- [ ] 12.1 `lib/schemas/whatsapp.ts` + `lib/repositories/whatsapp.ts` + hook (TanStack Query mutation for create_link_code)
- [ ] 12.2 `app/(protected)/profile/whatsapp.tsx` (generate/show code, join instructions, linked status, unlink) following `edit-name.tsx` + DS tokens
- [ ] 12.3 Add "Vincular WhatsApp" row in `profile/index.tsx`
- [ ] 12.4 Tests (RNTL): generate/copy code, linked status, unlink

## 13. Deploy & docs

- [ ] 13.1 Set edge secrets (`WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_APP_SECRET`, `WHATSAPP_VERIFY_TOKEN`, optional `WHATSAPP_INTERNAL_SECRET`); deploy webhook; in Meta dashboard set callback URL + verify token, subscribe `messages` field, add demo recipient numbers
- [ ] 13.2 Manual end-to-end: join → send code → capture text/audio/image/pdf → confirm → row in app; query + recommendation replies
- [ ] 13.3 Docs: `docs/decisions/2026-06-21-whatsapp-bot-schema.md`, `docs/features/whatsapp-bot.md`, `docs/user-flows/HU-26..29-*.md`; update `docs/conventions/database.md` (new Pattern-1 RPCs) + AGENTS.md §6/§7/§10 + test baseline
- [ ] 13.4 Quality gates: `pnpm format:check && pnpm lint && pnpm typecheck && pnpm test`; `get_advisors` shows no new Pattern-1 lints
