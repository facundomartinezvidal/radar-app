-- Migration: whatsapp_link_rpcs
-- Applied to remote: 20260622005922 via Supabase MCP
-- WhatsApp bot integration — identity bridge RPCs.
-- Implements 4 functions per AGENTS.md §7 / docs/conventions/database.md:
--
--   create_link_code()               SECURITY INVOKER  — authenticated can call
--   redeem_link_code(text, text)     SECURITY DEFINER  — Pattern 1 (service-role only)
--   resolve_wa_user(text)            SECURITY DEFINER  — Pattern 1 (service-role only)
--   unlink_wa(uuid)                  SECURITY DEFINER  — Pattern 1 (service-role only)
--
-- Pattern 1 functions: REVOKE EXECUTE FROM anon, public, authenticated.
-- Called only by the whatsapp-webhook edge function running with the service-role key.
-- Supabase advisor will NOT flag these (they are not executable by authenticated).
--
-- E.164 normalization: strip non-digits, prepend '+'.
-- Meta Cloud API delivers wa_id as digits only (e.g. "5491122334455") — prepending
-- '+' converts to E.164 ("+5491122334455"). Applied identically in both DEFINER RPCs.
--
-- Link-code alphabet: base32 without ambiguous glyphs 0/O/1/I/L.
-- 6-char code from 27-char alphabet → ~387 million permutations; collision risk
-- negligible; retry loop guards the rare collision against the UNIQUE index.

-- ---------------------------------------------------------------------------
-- 1. create_link_code — SECURITY INVOKER, callable by authenticated
-- ---------------------------------------------------------------------------
-- Generates a fresh 6-char link code for the calling user.
-- Invalidates the user's prior unconsumed codes first (mark consumed_at = now()).
-- Retries up to 5 times on UNIQUE constraint collision (astronomically rare).
-- Returns jsonb: { code, expires_at }.

create or replace function public.create_link_code()
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid       uuid        := (select auth.uid());
  v_code      text;
  v_expires   timestamptz;
  v_alphabet  text        := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';  -- 32 chars, no 0/O/1/I/L
  v_attempts  int         := 0;
  v_inserted  boolean     := false;
begin
  if v_uid is null then
    raise exception 'No autenticado' using errcode = '28000';
  end if;

  -- Invalidate caller's prior unconsumed codes.
  update public.whatsapp_link_codes
     set consumed_at = now()
   where user_id = v_uid
     and consumed_at is null;

  v_expires := now() + interval '10 minutes';

  -- Generate unique code with retry on collision.
  while not v_inserted and v_attempts < 5 loop
    -- Build a random 6-char code from the unambiguous base32 alphabet.
    v_code := (
      select string_agg(
               substr(v_alphabet, (floor(random() * 32)::int + 1), 1),
               ''
             )
        from generate_series(1, 6)
    );

    begin
      insert into public.whatsapp_link_codes (user_id, code, expires_at)
      values (v_uid, v_code, v_expires);
      v_inserted := true;
    exception
      when unique_violation then
        v_attempts := v_attempts + 1;
    end;
  end loop;

  if not v_inserted then
    raise exception 'No se pudo generar un código único; intentá de nuevo';
  end if;

  return jsonb_build_object('code', v_code, 'expires_at', v_expires);
end;
$$;

-- INVOKER function callable by the app (authenticated users).
revoke execute on function public.create_link_code() from anon, public;
grant execute on function public.create_link_code() to authenticated;

-- ---------------------------------------------------------------------------
-- 2. redeem_link_code — SECURITY DEFINER, Pattern 1 (service-role only)
-- ---------------------------------------------------------------------------
-- Called by the whatsapp-webhook edge function (service role) when an inbound
-- message body matches a link-code pattern.
--
-- Normalizes p_wa to E.164 (strip non-digits, prepend '+').
-- Returns jsonb: { status, user_id } where status is one of:
--   'linked'        — success; number now bound to code's user
--   'expired'       — code found but past expires_at
--   'reused'        — code was already consumed
--   'invalid'       — no matching code row
--   'already_linked'— normalized number already active for a DIFFERENT user
--
-- Same-user idempotent re-link (number already linked to the code's own user):
-- marks code consumed and returns 'linked' — treated as success/no-op.
--
-- All logic is atomic (single plpgsql body, no explicit transaction needed
-- since Supabase RPC calls run inside an implicit transaction).

create or replace function public.redeem_link_code(p_code text, p_wa text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_code_row  public.whatsapp_link_codes%rowtype;
  v_link_row  public.whatsapp_links%rowtype;
  v_wa_e164   text;
  v_user_id   uuid;
begin
  -- Normalize to E.164: strip non-digits, prepend '+'.
  v_wa_e164 := '+' || regexp_replace(p_wa, '[^0-9]', '', 'g');

  -- Look up the code (consumed or not — we need to distinguish reused vs expired vs invalid).
  select * into v_code_row
    from public.whatsapp_link_codes
   where code = p_code
   limit 1;

  -- Not found at all.
  if not found then
    return jsonb_build_object('status', 'invalid', 'user_id', null);
  end if;

  -- Already consumed.
  if v_code_row.consumed_at is not null then
    return jsonb_build_object('status', 'reused', 'user_id', null);
  end if;

  -- Expired (not yet consumed but past TTL).
  if v_code_row.expires_at < now() then
    return jsonb_build_object('status', 'expired', 'user_id', null);
  end if;

  -- Valid code — check for an existing active binding for this wa_number.
  select * into v_link_row
    from public.whatsapp_links
   where wa_number = v_wa_e164
     and status = 'linked'
   limit 1;

  if found then
    if v_link_row.user_id <> v_code_row.user_id then
      -- Number is already bound to a DIFFERENT user.
      return jsonb_build_object('status', 'already_linked', 'user_id', null);
    else
      -- Number is already bound to THIS user — idempotent success.
      -- Mark code consumed so it cannot be replayed.
      update public.whatsapp_link_codes
         set consumed_at = now()
       where id = v_code_row.id;
      return jsonb_build_object('status', 'linked', 'user_id', v_code_row.user_id);
    end if;
  end if;

  -- Happy path: mark code consumed and bind the number.
  update public.whatsapp_link_codes
     set consumed_at = now()
   where id = v_code_row.id;

  insert into public.whatsapp_links (user_id, wa_number, status, linked_at)
  values (v_code_row.user_id, v_wa_e164, 'linked', now());

  return jsonb_build_object('status', 'linked', 'user_id', v_code_row.user_id);
end;
$$;

-- Pattern 1: service-role only — revoke from all client roles.
revoke execute on function public.redeem_link_code(text, text)
  from anon, public, authenticated;

-- ---------------------------------------------------------------------------
-- 3. resolve_wa_user — SECURITY DEFINER, Pattern 1 (service-role only)
-- ---------------------------------------------------------------------------
-- Resolves a wa_id / E.164 number to the bound user_id, or NULL if unlinked.
-- Called by the webhook on every inbound message to establish identity.
-- Normalizes p_wa identically to redeem_link_code.

create or replace function public.resolve_wa_user(p_wa text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_wa_e164 text;
  v_uid     uuid;
begin
  -- Normalize to E.164.
  v_wa_e164 := '+' || regexp_replace(p_wa, '[^0-9]', '', 'g');

  select user_id into v_uid
    from public.whatsapp_links
   where wa_number = v_wa_e164
     and status = 'linked'
   limit 1;

  return v_uid;  -- NULL if not found (FOUND check not needed — variable stays NULL)
end;
$$;

-- Pattern 1: service-role only.
revoke execute on function public.resolve_wa_user(text)
  from anon, public, authenticated;

-- ---------------------------------------------------------------------------
-- 4. unlink_wa — SECURITY DEFINER, Pattern 1 (service-role only)
-- ---------------------------------------------------------------------------
-- Sets status='unlinked' and unlinked_at=now() for all active bindings of
-- p_user_id. Called by the webhook on an 'unlink' intent.
-- (App-side unlink uses the RLS UPDATE policy directly under the user's JWT.)
-- After this call, resolve_wa_user returns NULL for the formerly-linked number.

create or replace function public.unlink_wa(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.whatsapp_links
     set status      = 'unlinked',
         unlinked_at = now()
   where user_id = p_user_id
     and status   = 'linked';
end;
$$;

-- Pattern 1: service-role only.
revoke execute on function public.unlink_wa(uuid)
  from anon, public, authenticated;
