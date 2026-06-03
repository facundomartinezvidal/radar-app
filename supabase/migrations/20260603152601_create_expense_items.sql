-- Migration: create_expense_items
-- Applied to remote: 2026-06-03 (version 20260603152601, via Supabase MCP)
-- HU-18 — detailed receipt line items per expense.

create table public.expense_items (
  id uuid primary key default gen_random_uuid(),
  expense_id uuid not null references public.expenses (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  quantity numeric(14,3) not null default 1 check (quantity > 0),
  unit_price numeric(14,2) check (unit_price >= 0),
  line_total numeric(14,2) not null check (line_total >= 0),
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint expense_items_name_nonempty check (char_length(btrim(name)) between 1 and 120)
);

create index expense_items_expense_id_idx on public.expense_items (expense_id);
create index expense_items_user_id_idx on public.expense_items (user_id);

alter table public.expense_items enable row level security;

create policy expense_items_select_own on public.expense_items
  for select to authenticated using ((select auth.uid()) = user_id);
create policy expense_items_insert_own on public.expense_items
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy expense_items_update_own on public.expense_items
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy expense_items_delete_own on public.expense_items
  for delete to authenticated using ((select auth.uid()) = user_id);

create trigger expense_items_set_updated_at
  before update on public.expense_items
  for each row execute function public.set_updated_at();
