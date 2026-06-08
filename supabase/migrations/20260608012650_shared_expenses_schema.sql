-- Applied to remote: 20260608012650 via Supabase MCP
-- Migration: shared_expenses_schema
-- HU-17 — shared expenses schema: groups, group_members, expense_splits,
-- group_settlements. Adds group_id + paid_by_member_id to expenses.
-- Helper SECURITY DEFINER fn is_group_member() breaks RLS recursion.

-- groups
create table public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 60),
  icon text not null default 'Users',
  color text not null default '#0077B6',
  created_by uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- group_members  (user_id null = placeholder no registrado)
create table public.group_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  user_id uuid references auth.users (id) on delete cascade,
  display_name text check (char_length(btrim(display_name)) between 1 and 60),
  role text not null default 'member' check (role in ('owner','member')),
  status text not null default 'pending' check (status in ('active','pending','declined')),
  invited_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  joined_at timestamptz
);
create unique index group_members_group_user_unique
  on public.group_members (group_id, user_id) where user_id is not null;
create index group_members_group_id_idx on public.group_members (group_id);
create index group_members_user_id_idx on public.group_members (user_id);

-- expenses: columnas para compartidos
alter table public.expenses
  add column group_id uuid references public.groups (id) on delete set null,
  add column paid_by_member_id uuid references public.group_members (id) on delete set null;
create index expenses_group_id_idx on public.expenses (group_id);

-- expense_splits
create table public.expense_splits (
  id uuid primary key default gen_random_uuid(),
  expense_id uuid not null references public.expenses (id) on delete cascade,
  group_id uuid not null references public.groups (id) on delete cascade,
  member_id uuid not null references public.group_members (id) on delete cascade,
  share_amount numeric(14,2) not null check (share_amount >= 0),
  created_at timestamptz not null default now()
);
create index expense_splits_expense_id_idx on public.expense_splits (expense_id);
create index expense_splits_group_id_idx on public.expense_splits (group_id);

-- group_settlements
create table public.group_settlements (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  from_member_id uuid not null references public.group_members (id) on delete cascade,
  to_member_id uuid not null references public.group_members (id) on delete cascade,
  amount numeric(14,2) not null check (amount > 0),
  currency text not null check (currency in ('ARS','USD')),
  created_by uuid not null references auth.users (id) on delete cascade,
  settled_at timestamptz not null default now()
);
create index group_settlements_group_id_idx on public.group_settlements (group_id);

-- helper SECURITY DEFINER (rompe recursión RLS)
create function public.is_group_member(p_group_id uuid, p_user_id uuid)
returns boolean language sql security definer set search_path = '' as $$
  select exists (
    select 1 from public.group_members gm
    where gm.group_id = p_group_id and gm.user_id = p_user_id and gm.status = 'active'
  );
$$;
revoke execute on function public.is_group_member(uuid, uuid) from anon, authenticated, public;

create trigger groups_set_updated_at before update on public.groups
  for each row execute function public.set_updated_at();

alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.expense_splits enable row level security;
alter table public.group_settlements enable row level security;

create policy groups_select_member on public.groups for select to authenticated
  using (public.is_group_member(id, (select auth.uid())) or created_by = (select auth.uid()));
create policy groups_insert_own on public.groups for insert to authenticated
  with check (created_by = (select auth.uid()));
create policy groups_update_owner on public.groups for update to authenticated
  using (created_by = (select auth.uid())) with check (created_by = (select auth.uid()));
create policy groups_delete_owner on public.groups for delete to authenticated
  using (created_by = (select auth.uid()));

create policy group_members_select on public.group_members for select to authenticated
  using (user_id = (select auth.uid()) or public.is_group_member(group_id, (select auth.uid())));
create policy group_members_insert on public.group_members for insert to authenticated
  with check (public.is_group_member(group_id, (select auth.uid()))
              or exists (select 1 from public.groups g where g.id = group_id and g.created_by = (select auth.uid())));
create policy group_members_update_self_or_owner on public.group_members for update to authenticated
  using (user_id = (select auth.uid())
         or exists (select 1 from public.groups g where g.id = group_id and g.created_by = (select auth.uid())));
create policy group_members_delete_owner on public.group_members for delete to authenticated
  using (exists (select 1 from public.groups g where g.id = group_id and g.created_by = (select auth.uid())));

drop policy expenses_select_own on public.expenses;
create policy expenses_select_own_or_group on public.expenses for select to authenticated
  using ((select auth.uid()) = user_id
         or (group_id is not null and public.is_group_member(group_id, (select auth.uid()))));

create policy expense_splits_select on public.expense_splits for select to authenticated
  using (public.is_group_member(group_id, (select auth.uid())));
create policy expense_splits_write on public.expense_splits for all to authenticated
  using (public.is_group_member(group_id, (select auth.uid())))
  with check (public.is_group_member(group_id, (select auth.uid())));
create policy group_settlements_select on public.group_settlements for select to authenticated
  using (public.is_group_member(group_id, (select auth.uid())));
create policy group_settlements_write on public.group_settlements for all to authenticated
  using (public.is_group_member(group_id, (select auth.uid())))
  with check (public.is_group_member(group_id, (select auth.uid())));
