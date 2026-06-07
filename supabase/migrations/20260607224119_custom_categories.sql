-- Applied to remote: 20260607224119 via Supabase MCP
-- Migration: custom_categories
-- HU-16 — per-user custom categories on the shared categories table.
-- user_id NULL = system category (read by all authenticated users);
-- user_id = auth.uid() = user-owned (full CRUD under RLS).

-- 1. columns
alter table public.categories
  add column user_id uuid references auth.users (id) on delete cascade,
  add column updated_at timestamptz not null default now();

-- 2. slug uniqueness: global unique → partial (system global + per-user)
alter table public.categories drop constraint categories_slug_key;
create unique index categories_slug_system_unique
  on public.categories (slug) where user_id is null;
create unique index categories_slug_user_unique
  on public.categories (user_id, slug) where user_id is not null;
create index categories_user_id_idx on public.categories (user_id);

-- 3. name length guard (existing seed rows pass)
alter table public.categories
  add constraint categories_name_nonempty check (char_length(btrim(name)) between 1 and 40);

-- 4. RLS — replace the open SELECT with ownership-aware policies
drop policy categories_select_authenticated on public.categories;
create policy categories_select_visible on public.categories
  for select to authenticated
  using (user_id is null or (select auth.uid()) = user_id);
create policy categories_insert_own on public.categories
  for insert to authenticated
  with check ((select auth.uid()) = user_id and user_id is not null);
create policy categories_update_own on public.categories
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy categories_delete_own on public.categories
  for delete to authenticated
  using ((select auth.uid()) = user_id);

-- 5. updated_at trigger
create trigger categories_set_updated_at
  before update on public.categories
  for each row execute function public.set_updated_at();
