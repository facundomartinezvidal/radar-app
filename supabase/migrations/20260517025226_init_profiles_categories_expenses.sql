-- Migration: init_profiles_categories_expenses
-- Applied to remote: 2026-05-17 (version 20260517025226, via Supabase MCP)
-- NOTE: baseline reconstruction — this file documents the migration already
-- applied to the remote project. Do NOT re-apply. See AGENTS.md § migrations.

-- ---------------------------------------------------------------------------
-- updated_at helper
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- profiles — 1:1 with auth.users
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy profiles_select_own on public.profiles
  for select to authenticated using ((select auth.uid()) = id);
create policy profiles_insert_own on public.profiles
  for insert to authenticated with check ((select auth.uid()) = id);
create policy profiles_update_own on public.profiles
  for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Auto-create profile on signup (original version: display_name = email prefix;
-- superseded by 20260518005107 which derives it from first/last name metadata).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, split_part(new.email, '@', 1))
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- categories — global lookup (seeded, mutations via service_role only)
-- ---------------------------------------------------------------------------
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  icon text not null,
  color text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.categories enable row level security;

create policy categories_select_authenticated on public.categories
  for select to authenticated using (true);

insert into public.categories (slug, name, icon, color, sort_order) values
  ('comida', 'Comida', 'UtensilsCrossed', '#F59E0B', 10),
  ('supermercado', 'Supermercado', 'ShoppingCart', '#10B981', 20),
  ('transporte', 'Transporte', 'Bus', '#4FB3DC', 30),
  ('ocio', 'Ocio', 'PartyPopper', '#A855F7', 40),
  ('salud', 'Salud', 'HeartPulse', '#EF4444', 50),
  ('hogar', 'Hogar', 'Home', '#0077B6', 60),
  ('servicios', 'Servicios', 'Zap', '#F59E0B', 70),
  ('viajes', 'Viajes', 'Plane', '#1E99CC', 80),
  ('otro', 'Otro', 'CircleDashed', '#7E8AA0', 99);

-- ---------------------------------------------------------------------------
-- expenses — core table
-- ---------------------------------------------------------------------------
create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  amount numeric(14,2) not null check (amount > 0),
  currency text not null check (currency in ('ARS', 'USD')),
  category_id uuid references public.categories (id) on delete set null,
  description text check (char_length(description) <= 240),
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index expenses_user_id_occurred_at_idx on public.expenses (user_id, occurred_at desc);
create index expenses_category_id_idx on public.expenses (category_id);
create index expenses_currency_idx on public.expenses (currency);

alter table public.expenses enable row level security;

create policy expenses_select_own on public.expenses
  for select to authenticated using ((select auth.uid()) = user_id);
create policy expenses_insert_own on public.expenses
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy expenses_update_own on public.expenses
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy expenses_delete_own on public.expenses
  for delete to authenticated using ((select auth.uid()) = user_id);

create trigger expenses_set_updated_at
  before update on public.expenses
  for each row execute function public.set_updated_at();
