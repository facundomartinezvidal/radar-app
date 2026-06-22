-- Migration: whatsapp_bot_schema
-- Applied to remote: 20260621220000 via Supabase MCP
-- WhatsApp bot integration — 4 tables: whatsapp_links, whatsapp_link_codes,
-- whatsapp_messages, whatsapp_conversations.
-- RPC schema (create_link_code, redeem_link_code, resolve_wa_user, unlink_wa,
-- and DEFINER *_for variants) ships in a subsequent migration.
--
-- Identity bridge (Design D1): whatsapp_links binds a verified E.164 number to
-- a user_id. Client app reads/unlinks its own row (RLS: auth.uid() = user_id).
-- Webhook writes via service role (bypasses RLS) or DEFINER RPCs.
--
-- Idempotency (Design D5 / spec): whatsapp_messages.provider_message_id UNIQUE —
-- duplicate Meta retries short-circuit before any side effect.
--
-- Confirmation state (Design D4): whatsapp_conversations holds one pending action
-- per user (pk = user_id); consumed on first confirm, no-op on duplicate confirm.
--
-- Service-role-only tables (whatsapp_messages, whatsapp_conversations): RLS
-- enabled, zero policies — PostgREST denies all JWT-authenticated client access;
-- service role bypasses RLS unconditionally. No advisor lint because Pattern 1
-- DEFINER RPCs (future migration) will be REVOKED from anon/authenticated.

-- ---------------------------------------------------------------------------
-- whatsapp_links — number ↔ user binding
-- ---------------------------------------------------------------------------
create table public.whatsapp_links (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null references auth.users (id) on delete cascade,
  wa_number   text        not null,
  status      text        not null default 'linked'
                check (status in ('linked', 'unlinked')),
  linked_at   timestamptz not null default now(),
  unlinked_at timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Only one active (linked) binding per number, and per user.
create unique index whatsapp_links_number_active_unique
  on public.whatsapp_links (wa_number)
  where status = 'linked';

create unique index whatsapp_links_user_active_unique
  on public.whatsapp_links (user_id)
  where status = 'linked';

create index whatsapp_links_user_id_idx on public.whatsapp_links (user_id);

alter table public.whatsapp_links enable row level security;

-- Owner can read their own binding(s) — e.g. to show link status in the app.
create policy whatsapp_links_select_own on public.whatsapp_links
  for select to authenticated
  using ((select auth.uid()) = user_id);

-- Owner can unlink by updating status to 'unlinked' (client-side unlink flow).
-- Webhook uses service role for all inserts and DEFINER RPCs for unlink_wa.
create policy whatsapp_links_update_own on public.whatsapp_links
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create trigger whatsapp_links_set_updated_at
  before update on public.whatsapp_links
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- whatsapp_link_codes — one-time link codes (10-minute TTL)
-- ---------------------------------------------------------------------------
create table public.whatsapp_link_codes (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null references auth.users (id) on delete cascade,
  code        text        not null unique,
  expires_at  timestamptz not null,
  consumed_at timestamptz,
  created_at  timestamptz not null default now()
);

-- Fast lookup by code during redemption (webhook, service role).
-- Only active (unconsumed) codes matter for the UNIQUE index scan.
create unique index whatsapp_link_codes_active_code_unique
  on public.whatsapp_link_codes (code)
  where consumed_at is null;

create index whatsapp_link_codes_user_id_idx on public.whatsapp_link_codes (user_id);

alter table public.whatsapp_link_codes enable row level security;

-- Owner can read their own codes (e.g. to display current code status in app).
create policy whatsapp_link_codes_select_own on public.whatsapp_link_codes
  for select to authenticated
  using ((select auth.uid()) = user_id);

-- Owner generates their own code via create_link_code() INVOKER RPC.
-- Direct client insert is also allowed here so the RPC (INVOKER) can write
-- under auth.uid() RLS check without needing DEFINER escalation.
create policy whatsapp_link_codes_insert_own on public.whatsapp_link_codes
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- whatsapp_messages — inbound idempotency log + audit (service-role only)
-- ---------------------------------------------------------------------------
create table public.whatsapp_messages (
  id                  uuid        primary key default gen_random_uuid(),
  provider_message_id text        not null unique,  -- Meta message `id` field
  wa_number           text        not null,
  user_id             uuid        references auth.users (id),  -- NULL = unlinked sender
  direction           text        check (direction in ('inbound', 'outbound')),
  body                text,
  num_media           int         not null default 0,
  status              text        check (status in ('received', 'processing', 'done', 'failed')),
  intent              text,
  received_at         timestamptz not null default now(),
  processed_at        timestamptz
);

create index whatsapp_messages_wa_number_idx on public.whatsapp_messages (wa_number);
create index whatsapp_messages_user_id_idx   on public.whatsapp_messages (user_id);

-- RLS enabled, zero policies → PostgREST denies all client access.
-- Service role bypasses RLS; the webhook edge function runs with service role key.
alter table public.whatsapp_messages enable row level security;

-- ---------------------------------------------------------------------------
-- whatsapp_conversations — pending confirmation state (service-role only)
-- ---------------------------------------------------------------------------
create table public.whatsapp_conversations (
  user_id        uuid        primary key references auth.users (id) on delete cascade,
  wa_number      text        not null,
  pending_action jsonb,
  pending_kind   text,
  expires_at     timestamptz,
  updated_at     timestamptz not null default now()
);

create index whatsapp_conversations_wa_number_idx on public.whatsapp_conversations (wa_number);

-- RLS enabled, zero policies → PostgREST denies all client access.
alter table public.whatsapp_conversations enable row level security;

create trigger whatsapp_conversations_set_updated_at
  before update on public.whatsapp_conversations
  for each row execute function public.set_updated_at();
