## Why

Argentine young adults already coordinate money inside WhatsApp; making them open a separate app to register a quick expense is friction that loses captures. RADAR's BMC names "WhatsApp conversational capture" as a value pillar — this change delivers it: register and review money over WhatsApp, in natural language, without opening the app. Scoped for Entrega 4 (HU-26/27 ALTO, HU-28/29 MEDIO).

## What Changes

- Add a `whatsapp-webhook` Supabase edge function (Meta WhatsApp Cloud API inbound) that answers Meta's GET verification handshake, authenticates inbound webhooks by **payload signature** (`verify_jwt=false`), resolves the sender number to a RADAR user, classifies intent with Groq, and replies via the Graph API.
- **HU-26** — Account linking: app generates a one-time code; user sends it to the bot; bot binds the E.164 number to the Supabase user. Unlink supported from both app and bot.
- **HU-27** — Expense/income capture from **text, audio (Groq Whisper), image and PDF (reuse `extract-document`)**, always gated by a WhatsApp confirmation step before any write.
- **HU-28** — Natural-language movement queries ("¿cuánto gasté este mes?", "¿en qué gasté?") answered from aggregation RPCs.
- **HU-29** — Natural-language recommendations ("¿cómo vengo?") via the existing `generate-insights` function.
- New tables `whatsapp_links`, `whatsapp_link_codes`, `whatsapp_messages`, `whatsapp_conversations`.
- New `SECURITY DEFINER` RPC variants taking explicit `p_user_id` (Pattern 1, `REVOKE EXECUTE FROM anon, public, authenticated`) so the JWT-less webhook can act on a user's behalf safely.
- New in-app screen `app/(protected)/profile/whatsapp.tsx` to generate the link code and manage the binding.
- Internal service-to-service bypass added to `extract-document` and `generate-insights` so the webhook can call them with the service role.

## Capabilities

### New Capabilities
- `whatsapp-linking`: One-time-code linking and unlinking of a WhatsApp number to a RADAR account; identity resolution for inbound messages (HU-26).
- `whatsapp-capture`: Conversational expense/income capture over WhatsApp from text/audio/image/pdf, with a mandatory confirmation step before persisting (HU-27).
- `whatsapp-queries`: Natural-language queries about the user's movements, answered from share-aware aggregation RPCs (HU-28).
- `whatsapp-recommendations`: Natural-language spending recommendations generated from the user's aggregated data (HU-29).

### Modified Capabilities
<!-- None. The webhook reuses extract-document / generate-insights / import logic via new server-side RPC variants and an internal bypass; no existing spec-level requirement changes. -->

## Impact

- **New code**: `supabase/functions/whatsapp-webhook/` (router + signature verify + intent classifier + Whisper transcribe modules); one migration adding 4 tables + 9 RPCs; `app/(protected)/profile/whatsapp.tsx` + `lib/repositories/whatsapp.ts` + hook + `lib/schemas/whatsapp.ts`.
- **Modified code**: `extract-document` and `generate-insights` (internal service-role bypass); `supabase/config.toml` (`[functions.whatsapp-webhook] verify_jwt = false`); `types/supabase.ts` regenerated.
- **External deps**: Meta WhatsApp Cloud API (Meta app, WhatsApp Business test number + phone-number-id, access token, app secret; free tier ≈1000 conv/mo, test number reaches up to 5 verified recipients until business verification); Groq Whisper `whisper-large-v3` (new model usage on existing `GROQ_API_KEY`).
- **Secrets (edge env only)**: `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_APP_SECRET`, `WHATSAPP_VERIFY_TOKEN`, optional `WHATSAPP_INTERNAL_SECRET`.
- **Security**: webhook is JWT-less but signature-verified; all privilege escalation confined to Pattern-1 DEFINER RPCs revoked from `authenticated`.
- **Docs**: new `docs/decisions/2026-06-21-whatsapp-bot-schema.md`, `docs/features/whatsapp-bot.md`, `docs/user-flows/HU-26..29-*.md`; update `docs/conventions/database.md` + AGENTS.md §6/§7/§10.
