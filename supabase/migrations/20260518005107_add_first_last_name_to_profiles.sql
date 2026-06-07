-- Migration: add_first_last_name_to_profiles
-- Applied to remote: 2026-05-18 (version 20260518005107, via Supabase MCP)
-- NOTE: baseline reconstruction — this file documents the migration already
-- applied to the remote project. Do NOT re-apply. See AGENTS.md § migrations.

-- ---------------------------------------------------------------------------
-- profiles: first_name + last_name (captured at sign-up)
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column first_name text not null default '',
  add column last_name text not null default '';

-- ---------------------------------------------------------------------------
-- Sync first/last/display name from auth.users.raw_user_meta_data on signup
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_first text := trim(coalesce(new.raw_user_meta_data->>'first_name', ''));
  v_last  text := trim(coalesce(new.raw_user_meta_data->>'last_name', ''));
  v_display text := trim(v_first || ' ' || v_last);
begin
  insert into public.profiles (id, first_name, last_name, display_name)
  values (
    new.id,
    v_first,
    v_last,
    nullif(v_display, '')
  )
  on conflict (id) do update
  set first_name   = excluded.first_name,
      last_name    = excluded.last_name,
      display_name = excluded.display_name,
      updated_at   = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Keep profiles in sync when user metadata changes (Perfil edit flow)
-- ---------------------------------------------------------------------------
create or replace function public.handle_user_metadata_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_first text := trim(coalesce(new.raw_user_meta_data->>'first_name', ''));
  v_last  text := trim(coalesce(new.raw_user_meta_data->>'last_name', ''));
  v_display text := trim(v_first || ' ' || v_last);
begin
  update public.profiles
  set first_name   = v_first,
      last_name    = v_last,
      display_name = nullif(v_display, ''),
      updated_at   = now()
  where id = new.id;
  if not found then
    insert into public.profiles (id, first_name, last_name, display_name)
    values (new.id, v_first, v_last, nullif(v_display, ''));
  end if;
  return new;
end;
$$;

create trigger on_auth_user_metadata_update
  after update on auth.users
  for each row execute function public.handle_user_metadata_update();
