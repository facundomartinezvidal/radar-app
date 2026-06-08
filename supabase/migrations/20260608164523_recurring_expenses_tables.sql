-- Applied to remote: 20260608164523 via Supabase MCP
-- Migration: recurring_expenses_tables
-- HU-19 — recurring expenses. Rule lives in expense_recurrences; a pg_cron job
-- materializes occurrences directly into the existing expenses table
-- (source='recurrence'). Manual/one-off expenses have recurrence_id null.
-- Occurrence dates are DATE (start_date/end_date/next_run_on) to avoid DST/tz
-- drift in the materializer's occurrence dedup.
--
-- Note on idempotency index: timestamptz::date is STABLE (not IMMUTABLE) in
-- Postgres — session-timezone dependent — and therefore cannot appear in an
-- index expression directly. The idempotency guard instead uses a plain
-- occurred_date DATE column added to expenses (nullable so manual entries need
-- not set it; the materializer always sets it). The unique index on
-- (recurrence_id, occurred_date) WHERE recurrence_id IS NOT NULL is a simple
-- btree on two non-expression columns and has no immutability requirement.

create table public.expense_recurrences (
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
  constraint expense_recurrences_end_after_start check (end_date is null or end_date >= start_date)
);

create index expense_recurrences_user_id_idx on public.expense_recurrences (user_id);
create index expense_recurrences_due_idx on public.expense_recurrences (next_run_on) where status = 'active';

alter table public.expense_recurrences enable row level security;
create policy expense_recurrences_select_own on public.expense_recurrences for select to authenticated using ((select auth.uid()) = user_id);
create policy expense_recurrences_insert_own on public.expense_recurrences for insert to authenticated with check ((select auth.uid()) = user_id);
create policy expense_recurrences_update_own on public.expense_recurrences for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy expense_recurrences_delete_own on public.expense_recurrences for delete to authenticated using ((select auth.uid()) = user_id);

create trigger expense_recurrences_set_updated_at before update on public.expense_recurrences
  for each row execute function public.set_updated_at();

-- extend expenses: source column, recurrence FK, and occurred_date for idempotency.
-- expense_recurrences must exist before this alter so the FK reference resolves.
-- existing rows default to source='manual', recurrence_id null, occurred_date null.
alter table public.expenses
  add column source text not null default 'manual' check (source in ('manual','recurrence')),
  add column recurrence_id uuid references public.expense_recurrences (id) on delete set null,
  add column occurred_date date;

create index expenses_recurrence_id_idx on public.expenses (recurrence_id);
create unique index expenses_recurrence_occurred_day_unique
  on public.expenses (recurrence_id, occurred_date)
  where recurrence_id is not null;
