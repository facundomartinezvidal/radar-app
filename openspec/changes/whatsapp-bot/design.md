## Context

RADAR is an Expo mobile app with a Supabase backend (Postgres + RLS, edge functions, Groq for vision/OCR). All current write/read RPCs (`import_transactions`, `get_personal_totals`, `get_expense_by_*`) are `SECURITY INVOKER` and key on `auth.uid()`. The WhatsApp bot is invoked **by Meta's WhatsApp Cloud API**, which presents **no Supabase user JWT** — so those RPCs are unusable as-is from the webhook. This change adds the messaging integration without weakening the app's existing auth model. Provider is the **Meta WhatsApp Cloud API** (free tier; test number reaches up to 5 verified recipients until business verification); interaction is **natural language** via Groq; build target is **end-to-end deployed** against the Cloud API test number.

Reused assets (confirmed): `supabase/functions/extract-document/index.ts` (image/PDF → Groq vision → `DocumentTransaction[]`), `supabase/functions/generate-insights/index.ts` (text Groq → `insights[]`), `import_transactions(p_rows jsonb)`, the share-aware aggregation RPCs, `lib/ocr.ts` (`matchCategory`, `mapDocumentToPrefill`, `partitionByDirection`), `lib/repositories/transactions.ts` (`ImportTransactionRow`), and `app/(protected)/profile/edit-name.tsx` as the link-screen template.

## Goals / Non-Goals

**Goals:**
- A single, signature-authenticated `whatsapp-webhook` edge function that links accounts, captures money from text/audio/image/pdf, answers queries, and gives recommendations — all in natural language.
- Reuse the existing OCR/insights/import logic rather than re-implementing it.
- Confine all JWT-less privilege escalation to a small, auditable set of `SECURITY DEFINER` Pattern-1 RPCs revoked from `authenticated`.
- Never persist a transaction without explicit user confirmation.

**Non-Goals:**
- Migration to Meta WhatsApp Cloud API (sandbox-only for now).
- Multiple WhatsApp numbers per user; group/community chats.
- Per-row exclusion in a multi-transaction import (stretch — import-all only).
- Push reminders / outbound-initiated campaigns.

## Decisions

### D1 — Identity bridge: explicit-`p_user_id` DEFINER RPCs (not raw service-role inserts)
The webhook resolves the verified sender number to a `user_id` and then calls new `*_for(p_user_id, …)` DEFINER variants whose bodies mirror the existing INVOKER RPCs with `auth.uid()` replaced by `p_user_id`. **Why over raw `service-role .from().insert()`:** reuses validated business rules (amount>0, currency/direction checks, atomicity, `source='manual'`, share-aware CASE), and keeps every escalation in one reviewable place. These are **Pattern 1** (per `docs/conventions/database.md`): `REVOKE EXECUTE FROM anon, public, authenticated` so only the service role can call them — critical because they accept a caller-supplied `p_user_id`. This matches existing precedent (`materialize_due_*`) and will not add advisor `authenticated_security_definer_function_executable` lints.

### D2 — Single webhook router, reuse heavy functions server-to-server
Meta targets one callback URL, so one `whatsapp-webhook` entrypoint owns the cross-cutting concerns (GET verify handshake, POST signature verify, idempotency, identity, dispatch). It calls the already-built `extract-document` and `generate-insights` server-to-server using the service role. Those two functions get a small **internal bypass** (service-role Bearer or `WHATSAPP_INTERNAL_SECRET` header) so the existing app-facing JWT gate is preserved while the webhook can reach them. Audio transcription (Groq Whisper) is an in-function module, not a separate deployment, to avoid a second cold start.

### D3 — Acknowledge fast, reply asynchronously via Graph API
Meta retries the webhook on any non-200 and expects a prompt ack; Groq vision (up to 30s) and Whisper exceed a safe ack window. The Cloud API has **no synchronous reply channel** (unlike Twilio's TwiML) — all outbound messages are Graph API `POST /{phone_number_id}/messages` calls with the `WHATSAPP_ACCESS_TOKEN` bearer. So the webhook does fast work first (signature, dedup-insert as `processing`, identity), returns an immediate empty 200, and continues all message handling — including text replies — via `EdgeRuntime.waitUntil(...)` + Graph API. One reply mechanism, uniformly async.

### D4 — Confirmation state machine in `whatsapp_conversations`
One pending action per user (pk = `user_id`) holds `pending_action jsonb` with an expiry. Capture builds a pending action; `confirm` consumes it and writes; `cancel`/expiry discards it. Clearing on first consume makes a duplicate "sí" a no-op (no double insert). A `SELECT … FOR UPDATE` on the row serializes concurrent confirmations.

### D5 — Idempotency via `whatsapp_messages.message_sid UNIQUE`
Insert-first on the Meta message `id`; on unique violation, short-circuit 200. The same image sent twice still creates two pending confirmations (no natural dedup key for media content) — acceptable because each requires explicit confirm.

## Risks / Trade-offs

- **JWT-less endpoint** → `X-Hub-Signature-256` verification is the *only* caller auth. Mitigation: mandatory HMAC-SHA256 over the **raw** request body using `WHATSAPP_APP_SECRET` (read the body before any JSON parse so the bytes match); reject 403 on mismatch; keep `WHATSAPP_VERIFY_TOKEN` secret for the GET handshake.
- **Caller-supplied `p_user_id` in DEFINER RPCs** → a leaked client token must never reach them. Mitigation: Pattern-1 revocation from `authenticated`; run `get_advisors` after migration to confirm no new lints.
- **Cloud API test-mode constraints** → test number reaches only recipients added to the app's allow-list (≤5) until business verification; access token may be short-lived. Mitigation: add demo numbers in the Meta dashboard; use a long-lived/system-user token; one-number-per-user unique index (relax later).
- **LLM mis-parse / wrong amount or currency** → financial error. Mitigation: never auto-write; confirmation always shows parsed amount + currency; clarify on low confidence/missing entities; reject non-positive amounts.
- **Async reply path failure** (Graph API error / expired token) → user gets no reply. Mitigation: mark message `failed`, log; idempotency lets the user safely resend; monitor token expiry.

## Migration Plan

1. Ship the migration (4 tables + 9 RPCs, dual-shipped per `database.md`); run `get_advisors`; regenerate `types/supabase.ts`.
2. Add internal bypass to `extract-document` / `generate-insights`.
3. Deploy `whatsapp-webhook` with `verify_jwt=false`; set Meta + internal secrets in edge env (`WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_APP_SECRET`, `WHATSAPP_VERIFY_TOKEN`).
4. In the Meta app dashboard: set the callback URL + verify token (GET handshake), subscribe to the `messages` webhook field, and add demo recipient numbers to the allow-list.
5. Ship the app link screen; verify generate-code → send-to-bot → linked end-to-end with a real phone.
6. **Rollback**: unsubscribe the Meta webhook field / disable the function; the new tables and Pattern-1 RPCs are additive and inert without the webhook.

## Open Questions

- Exact link-code format (length/alphabet) — recommend 6 chars base32 without ambiguous glyphs.
- Per-`wa_number` rate-limit thresholds (Groq/Graph cost control) — start conservative.
- Access-token longevity: use a system-user long-lived token vs refreshing the temporary dashboard token.
- Whether to support per-row exclusion in multi-tx imports later (currently import-all only).
