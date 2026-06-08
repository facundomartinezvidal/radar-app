-- Applied to remote: 20260608143926 via Supabase MCP
-- Migration: create_incomes_tables
-- HU-20/HU-21 — incomes (occurrences/manual) + income_recurrences (rules).
-- incomes mirror expenses minus line-items/groups. A recurring income is a rule
-- in income_recurrences; a scheduled job materializes occurrences into incomes
-- (source='recurrence'). Manual/one-off incomes have recurrence_id null.
-- Occurrence dates are DATE (start_date/end_date/next_run_on) to avoid DST/tz
-- drift in the materializer's occurrence dedup.
--
-- Note on idempotency index: timestamptz::date is STABLE (not IMMUTABLE) in
-- Postgres — session-timezone dependent — and therefore cannot appear in an
-- index expression directly. The idempotency guard instead uses a plain
-- occurred_date DATE column (nullable so manual entries need not set it;
-- the materializer always sets it). The unique index on
-- (recurrence_id, occurred_date) WHERE recurrence_id IS NOT NULL is a simple
-- btree on two non-expression columns and has no immutability requirement.

create table public.income_recurrences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  amount numeric(14,2) not null check (amount > 0),
  currency text not null check (currency in ('ARS','USD')),
  category_id uuid references public.categories (id) on delete set null,
  description text check (char_length(description) <= 240),
  frequency text not null check (frequency in ('weekly','biweekly','monthly','yearly')),
  start_date date not null,
  end_date date,
  day_of_month smallint check (day_of_month between 1 and 31),
  status text not null default 'active' check (status in ('active','paused')),
  next_run_on date not null,
  last_materialized_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint income_recurrences_end_after_start check (end_date is null or end_date >= start_date)
);

create index income_recurrences_user_id_idx on public.income_recurrences (user_id);
create index income_recurrences_due_idx on public.income_recurrences (next_run_on) where status = 'active';

alter table public.income_recurrences enable row level security;
create policy income_recurrences_select_own on public.income_recurrences for select to authenticated using ((select auth.uid()) = user_id);
create policy income_recurrences_insert_own on public.income_recurrences for insert to authenticated with check ((select auth.uid()) = user_id);
create policy income_recurrences_update_own on public.income_recurrences for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy income_recurrences_delete_own on public.income_recurrences for delete to authenticated using ((select auth.uid()) = user_id);

create trigger income_recurrences_set_updated_at before update on public.income_recurrences
  for each row execute function public.set_updated_at();

create table public.incomes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  amount numeric(14,2) not null check (amount > 0),
  currency text not null check (currency in ('ARS','USD')),
  category_id uuid references public.categories (id) on delete set null,
  description text check (char_length(description) <= 240),
  occurred_at timestamptz not null default now(),
  occurred_date date,
  source text not null default 'manual' check (source in ('manual','recurrence')),
  recurrence_id uuid references public.income_recurrences (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index incomes_user_id_occurred_at_idx on public.incomes (user_id, occurred_at desc);
create index incomes_category_id_idx on public.incomes (category_id);
create index incomes_currency_idx on public.incomes (currency);
create index incomes_recurrence_id_idx on public.incomes (recurrence_id);
create unique index incomes_recurrence_occurred_day_unique
  on public.incomes (recurrence_id, occurred_date)
  where recurrence_id is not null;

alter table public.incomes enable row level security;
create policy incomes_select_own on public.incomes for select to authenticated using ((select auth.uid()) = user_id);
create policy incomes_insert_own on public.incomes for insert to authenticated with check ((select auth.uid()) = user_id);
create policy incomes_update_own on public.incomes for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy incomes_delete_own on public.incomes for delete to authenticated using ((select auth.uid()) = user_id);

create trigger incomes_set_updated_at before update on public.incomes
  for each row execute function public.set_updated_at();
