-- user_exists_by_email: check whether an email belongs to a registered user.
--
-- SECURITY DEFINER is intentional — the caller is authenticated (enforced by
-- the auth-required guard inside the body) and needs to query auth.users which
-- is not accessible via SECURITY INVOKER from authenticated role.
--
-- The EXECUTE grant to `authenticated` is intentional: this RPC is the
-- on-blur existence check in the member-invite UI. Authenticated email
-- enumeration is an accepted trade-off for this app (mirrors the
-- invite_group_member RPC which already reveals not_found status).
-- See AGENTS.md §7 "Database migrations" — pattern #3 (SECURITY DEFINER
-- with intentional authenticated grant).
create function public.user_exists_by_email(p_email text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := (select auth.uid());
begin
  if v_uid is null then raise exception 'auth required'; end if;
  return exists (select 1 from auth.users where lower(email) = lower(btrim(p_email)));
end; $$;
revoke execute on function public.user_exists_by_email(text) from anon, public;
grant execute on function public.user_exists_by_email(text) to authenticated;
