# ADR: WhatsApp bot schema — tables, identity bridge, and service RPCs

**Date:** 2026-06-21
**Status:** Accepted
**Scope:** `radar-app` — WhatsApp bot integration (HU-26/27/28/29)

---

## Context

The WhatsApp bot is invoked by the Meta WhatsApp Cloud API, which presents **no Supabase user JWT**. All existing write and read RPCs (`import_transactions`, `get_personal_totals`, `get_expense_by_*`) are `SECURITY INVOKER` and key on `auth.uid()` — they are entirely unusable from the webhook. This change adds four tables and nine RPCs to bridge that identity gap without weakening the app's existing auth model.

---

## Decision

### D1 — Identity bridge: explicit-`p_user_id` DEFINER RPCs (not raw service-role inserts)

The webhook resolves the verified sender number to a `user_id` and then calls new `*_for(p_user_id, …)` DEFINER variants whose bodies mirror the existing INVOKER RPCs with `auth.uid()` replaced by `p_user_id`. This is **Pattern 1** per `docs/conventions/database.md`: `REVOKE EXECUTE FROM anon, public, authenticated` so only the service role can call them. These functions are not executable by `authenticated` and will NOT trigger the `authenticated_security_definer_function_executable` advisor lint.

**Why over raw `service-role .from().insert()`:** reuses validated business rules (amount>0, currency/direction checks, atomicity, `source='manual'`, share-aware CASE), and keeps every privilege escalation in one reviewable place.

---

## Tables

### `whatsapp_links` — number ↔ user binding

Holds the permanent record of a WhatsApp number bound to a RADAR user.

| Column        | Type        | Notes                             |
| ------------- | ----------- | --------------------------------- |
| `id`          | uuid PK     | `gen_random_uuid()`               |
| `user_id`     | uuid FK     | → `auth.users`, ON DELETE CASCADE |
| `wa_number`   | text        | E.164 format (`+549...`)          |
| `status`      | text        | `'linked'` or `'unlinked'`; CHECK |
| `linked_at`   | timestamptz |                                   |
| `unlinked_at` | timestamptz | NULL until unlinked               |
| `created_at`  | timestamptz |                                   |
| `updated_at`  | timestamptz | via `set_updated_at` trigger      |

**Partial unique indexes:**

- `(wa_number) WHERE status = 'linked'` — one active binding per number
- `(user_id) WHERE status = 'linked'` — one active binding per user

**RLS:** enabled. Policies for `authenticated`:

- SELECT `USING (auth.uid() = user_id)` — owner reads own rows
- UPDATE `USING/WITH CHECK (auth.uid() = user_id)` — owner can set `status='unlinked'` (app-side unlink)

Webhook inserts via service role (bypasses RLS). Webhook unlinks via `unlink_wa` DEFINER RPC.

---

### `whatsapp_link_codes` — one-time link codes (10-minute TTL)

Holds temporary codes the app generates for the user to send to the bot.

| Column        | Type        | Notes                             |
| ------------- | ----------- | --------------------------------- |
| `id`          | uuid PK     |                                   |
| `user_id`     | uuid FK     | → `auth.users`, ON DELETE CASCADE |
| `code`        | text UNIQUE | 6-char base32 (no 0/O/1/I/L)      |
| `expires_at`  | timestamptz | now() + 10 minutes                |
| `consumed_at` | timestamptz | NULL until redeemed               |
| `created_at`  | timestamptz |                                   |

**Partial unique index:** `(code) WHERE consumed_at IS NULL` — fast redemption lookup for active codes only.

**RLS:** enabled. Policies for `authenticated`:

- SELECT `USING (auth.uid() = user_id)` — read own codes
- INSERT `WITH CHECK (auth.uid() = user_id)` — `create_link_code` INVOKER RPC writes under caller's RLS

---

### `whatsapp_messages` — inbound idempotency log (service-role only)

Audit trail of every inbound Cloud API message. The `provider_message_id` UNIQUE constraint implements idempotency (Design D5): a duplicate Meta retry inserts nothing and returns 200.

| Column                | Type        | Notes                                             |
| --------------------- | ----------- | ------------------------------------------------- |
| `id`                  | uuid PK     |                                                   |
| `provider_message_id` | text UNIQUE | Meta message `id` field                           |
| `wa_number`           | text        | E.164 sender                                      |
| `user_id`             | uuid FK     | NULL when sender is unlinked                      |
| `direction`           | text        | `'inbound'` or `'outbound'`                       |
| `body`                | text        | Text body (NULL for media)                        |
| `num_media`           | int         | 0 for text; 1 for image/audio/document            |
| `status`              | text        | `'received'` → `'processing'` → `'done'/'failed'` |
| `intent`              | text        | Resolved intent (populated by dispatch)           |
| `received_at`         | timestamptz |                                                   |
| `processed_at`        | timestamptz | NULL until processed                              |

**RLS:** enabled, zero policies. PostgREST denies all JWT-authenticated client access. The webhook edge function runs with the service role key and bypasses RLS unconditionally.

---

### `whatsapp_conversations` — pending confirmation state (service-role only)

One row per user, pk = `user_id`. Implements the capture confirmation state machine (Design D4).

| Column           | Type        | Notes                                             |
| ---------------- | ----------- | ------------------------------------------------- |
| `user_id`        | uuid PK FK  | → `auth.users`, ON DELETE CASCADE                 |
| `wa_number`      | text        | Current E.164 number                              |
| `pending_action` | jsonb       | `{kind, payload: {rows: ImportTransactionRow[]}}` |
| `pending_kind`   | text        | `'expense'` / `'income'` / `'multi_import'`       |
| `expires_at`     | timestamptz | Pending action TTL (30 minutes from creation)     |
| `updated_at`     | timestamptz | via `set_updated_at` trigger                      |

`SELECT … FOR UPDATE` on this row serializes concurrent confirmations. A duplicate `sí` after the first confirm is a no-op because the row is cleared on first consume.

**RLS:** enabled, zero policies. Service-role only. No client access.

---

## RPCs

### `create_link_code()` — SECURITY INVOKER

Callable by `authenticated`. Generates a 6-char link code for `auth.uid()`, invalidates the user's prior unconsumed codes, and returns `{code, expires_at}`. Retries up to 5 times on UNIQUE collision (astronomically rare with ~387M permutations).

```
REVOKE FROM: anon, public
GRANT TO:    authenticated
```

---

### Pattern 1 RPCs — SECURITY DEFINER, service-role only

All eight RPCs below follow Pattern 1 (per `docs/conventions/database.md`). They accept an explicit `p_user_id uuid` in place of `auth.uid()`. Callable only by the `whatsapp-webhook` edge function running with the service-role key.

```
REVOKE FROM: anon, public, authenticated
GRANT TO:    service_role (implicit — postgres superuser retains)
```

#### `redeem_link_code(p_code text, p_wa text)` → jsonb

Normalizes `p_wa` to E.164, looks up the code, and atomically binds the number. Returns `{status, user_id}` where `status` is one of:

| Status           | Meaning                                             |
| ---------------- | --------------------------------------------------- |
| `linked`         | Number successfully bound (or same-user idempotent) |
| `expired`        | Code found but past `expires_at`                    |
| `reused`         | Code already consumed                               |
| `invalid`        | No matching code row                                |
| `already_linked` | Number already active for a different user          |

#### `resolve_wa_user(p_wa text)` → uuid

Normalizes `p_wa` to E.164 and returns the `user_id` of the active linked row, or NULL if unlinked. Called on every inbound message to establish identity.

#### `unlink_wa(p_user_id uuid)` → void

Sets `status='unlinked'` and `unlinked_at=now()` for all active bindings of `p_user_id`. After this call `resolve_wa_user` returns NULL for the formerly-linked number. The app-side unlink uses the RLS UPDATE policy directly under the user's JWT.

#### `import_transactions_for(p_user_id uuid, p_rows jsonb)` → integer

Clone of `import_transactions` with `auth.uid()` replaced by `p_user_id`. Validates `direction`, `amount > 0`, `currency IN ('ARS','USD')`. Inserts expense rows into `expenses` with `source='manual'` and income rows into `incomes` with `occurred_date` set. Atomic — any failure rolls back the entire batch.

#### `get_personal_totals_for(p_user_id uuid, p_from timestamptz, p_to timestamptz)` → table

Clone of `get_personal_totals`; share-aware CASE for group expenses (only the user's split amount counted).

#### `get_expense_by_category_for(p_user_id uuid, p_currency text, p_from timestamptz, p_to timestamptz)` → table

Clone of `get_expense_by_category`; share-aware CASE; results ordered by `total DESC`.

#### `get_expense_by_period_for(p_user_id uuid, p_currency text, p_bucket text, p_from timestamptz, p_to timestamptz)` → table

Clone of `get_expense_by_period`; bucket accepts `'day'`, `'week'`, `'month'`; share-aware CASE.

#### `get_income_by_period_for(p_user_id uuid, p_currency text, p_bucket text, p_from timestamptz, p_to timestamptz)` → table

Clone of `get_income_by_period`; no share-aware adjustment needed for incomes (always personal).

---

## Migration files

| File                                       | Contents                                                               |
| ------------------------------------------ | ---------------------------------------------------------------------- |
| `20260622005257_whatsapp_bot_schema.sql`   | 4 tables + indexes + RLS policies + triggers                           |
| `20260622005922_whatsapp_link_rpcs.sql`    | `create_link_code`, `redeem_link_code`, `resolve_wa_user`, `unlink_wa` |
| `20260622010559_whatsapp_service_rpcs.sql` | `import_transactions_for`, 4 read `_for` variants                      |

All three migrations dual-shipped per `docs/conventions/database.md` (SQL file + Supabase MCP `apply_migration`). `get_advisors` confirms no new `authenticated_security_definer_function_executable` lints.

---

## Security notes

- **JWT-less endpoint:** `verify_jwt = false` in `supabase/config.toml`. The raw request body is read before JSON parse so the HMAC-SHA256 bytes match what Meta signed. Any request with a missing or invalid `X-Hub-Signature-256` is rejected 403 before any side effect.
- **Caller-supplied `p_user_id`:** these RPCs must never be callable by a client JWT. Pattern 1 revocation from `authenticated` enforces this. A client JWT cannot reach these functions even if the edge function URL were somehow obtained.
- **`whatsapp_messages` / `whatsapp_conversations`:** zero RLS policies means PostgREST denies all client requests. Service role bypasses RLS unconditionally.

---

## Related

- Feature doc: `docs/features/whatsapp-bot.md`
- Design doc: `openspec/changes/whatsapp-bot/design.md`
- Database conventions (Pattern 1 rule): `docs/conventions/database.md`
- Existing INVOKER RPC precedent: `docs/decisions/2026-06-21-document-classification-ocr.md`
- Insights RPCs (share-aware pattern): `docs/decisions/2026-06-20-insights-aggregation-rpcs.md`
