-- Migration: shared_expenses_rpcs
-- Applied to remote: 20260608013859 via Supabase MCP
-- HU-17 — transactional RPCs for group management + shared expenses.
-- All functions: security invoker (except invite_group_member = security definer),
-- set search_path = '', idiomatic plpgsql mirroring expense_items_rpc style.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. create_group
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.create_group(
  p_name        text,
  p_icon        text    default 'Users',
  p_color       text    default '#0077B6',
  p_placeholders jsonb  default '[]'::jsonb
) returns public.groups
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid   uuid := (select auth.uid());
  v_group public.groups;
  v_name  text;
  v_placeholder text;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  v_name := btrim(p_name);
  if char_length(v_name) < 1 then
    raise exception 'group name cannot be blank';
  end if;

  insert into public.groups (name, icon, color, created_by)
  values (
    v_name,
    case when btrim(coalesce(p_icon,'')) = '' then 'Users' else p_icon end,
    case when btrim(coalesce(p_color,'')) = '' then '#0077B6' else p_color end,
    v_uid
  )
  returning * into v_group;

  -- creator as owner
  insert into public.group_members (group_id, user_id, role, status, joined_at)
  values (v_group.id, v_uid, 'owner', 'active', now());

  -- placeholder members (skip blanks)
  for v_placeholder in
    select jsonb_array_elements_text(coalesce(p_placeholders, '[]'::jsonb))
  loop
    if btrim(v_placeholder) <> '' then
      insert into public.group_members (group_id, display_name, role, status)
      values (v_group.id, btrim(v_placeholder), 'member', 'active');
    end if;
  end loop;

  return v_group;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. add_group_member
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.add_group_member(
  p_group_id    uuid,
  p_display_name text
) returns public.group_members
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid    uuid := (select auth.uid());
  v_member public.group_members;
  v_dname  text;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  v_dname := btrim(coalesce(p_display_name, ''));
  if char_length(v_dname) < 1 then
    raise exception 'display_name cannot be blank';
  end if;

  -- RLS insert policy on group_members enforces caller is member/owner
  insert into public.group_members (group_id, display_name, role, status)
  values (p_group_id, v_dname, 'member', 'active')
  returning * into v_member;

  return v_member;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. invite_group_member  (SECURITY DEFINER — reads auth.users)
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.invite_group_member(
  p_group_id uuid,
  p_email    text
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid       uuid := (select auth.uid());
  v_target_id uuid;
  v_member_id uuid;
  v_status    text;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  -- caller must be active member OR group creator
  if not (
    public.is_group_member(p_group_id, v_uid)
    or exists (
      select 1 from public.groups g
      where g.id = p_group_id and g.created_by = v_uid
    )
  ) then
    raise exception 'not a group member';
  end if;

  -- look up target user by email (case-insensitive)
  select id into v_target_id
  from auth.users
  where lower(email) = lower(btrim(p_email))
  limit 1;

  if v_target_id is null then
    return jsonb_build_object('status', 'not_found');
  end if;

  -- check for existing membership row
  select id, status into v_member_id, v_status
  from public.group_members
  where group_id = p_group_id and user_id = v_target_id
  limit 1;

  if v_member_id is not null then
    if v_status = 'declined' then
      -- re-invite: reset to pending
      update public.group_members
      set status = 'pending', invited_by = v_uid, created_at = now()
      where id = v_member_id;
      return jsonb_build_object('status', 'invited', 'member_id', v_member_id);
    else
      return jsonb_build_object('status', 'already_member', 'member_id', v_member_id);
    end if;
  end if;

  -- new invitation
  insert into public.group_members (group_id, user_id, role, status, invited_by)
  values (p_group_id, v_target_id, 'member', 'pending', v_uid)
  returning id into v_member_id;

  return jsonb_build_object('status', 'invited', 'member_id', v_member_id);
end;
$$;

-- Revoke from anon + public; authenticated retains execute (app RPC).
-- This DEFINER does its own authz (is_group_member guard) — residual
-- authenticated_security_definer_function_executable advisor lint is intentional.
revoke execute on function public.invite_group_member(uuid, text) from anon, public;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. respond_group_invite
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.respond_group_invite(
  p_member_id uuid,
  p_accept    boolean
) returns public.group_members
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid    uuid := (select auth.uid());
  v_member public.group_members;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  update public.group_members
  set
    status    = case when p_accept then 'active' else 'declined' end,
    joined_at = case when p_accept then now() else joined_at end
  where id = p_member_id
    and user_id = v_uid
    and status = 'pending'
  returning * into v_member;

  if not found then
    raise exception 'invite not found or not pending';
  end if;

  return v_member;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. create_shared_expense
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.create_shared_expense(
  p_amount            numeric,
  p_currency          text,
  p_category_id       uuid,
  p_description       text,
  p_occurred_at       timestamptz,
  p_items             jsonb,
  p_group_id          uuid,
  p_paid_by_member_id uuid,
  p_splits            jsonb
) returns public.expenses
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid      uuid := (select auth.uid());
  v_expense  public.expenses;
  v_item     jsonb;
  v_split    jsonb;
  v_pos      integer := 0;
  v_split_sum numeric := 0;
  v_split_member_id uuid;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  -- caller must be active group member
  if not public.is_group_member(p_group_id, v_uid) then
    raise exception 'not a group member';
  end if;

  -- paid_by_member_id must belong to this group
  if not exists (
    select 1 from public.group_members gm
    where gm.id = p_paid_by_member_id and gm.group_id = p_group_id
  ) then
    raise exception 'paid_by_member_id does not belong to group';
  end if;

  -- items cap
  if jsonb_array_length(coalesce(p_items, '[]'::jsonb)) > 50 then
    raise exception 'too many items (max 50)';
  end if;

  -- splits sum validation
  for v_split in select * from jsonb_array_elements(coalesce(p_splits, '[]'::jsonb)) loop
    v_split_sum := v_split_sum + coalesce((v_split->>'share_amount')::numeric, 0);
  end loop;

  if abs(v_split_sum - p_amount) > 0.01 then
    raise exception 'splits must sum to amount';
  end if;

  -- every split member_id must belong to this group
  for v_split in select * from jsonb_array_elements(coalesce(p_splits, '[]'::jsonb)) loop
    v_split_member_id := (v_split->>'member_id')::uuid;
    if not exists (
      select 1 from public.group_members gm
      where gm.id = v_split_member_id and gm.group_id = p_group_id
    ) then
      raise exception 'split member_id % does not belong to group', v_split_member_id;
    end if;
  end loop;

  -- insert expense
  insert into public.expenses (
    user_id, amount, currency, category_id, description,
    occurred_at, group_id, paid_by_member_id
  )
  values (
    v_uid, p_amount, p_currency, p_category_id, p_description,
    coalesce(p_occurred_at, now()), p_group_id, p_paid_by_member_id
  )
  returning * into v_expense;

  -- insert items (mirrors create_expense_with_items exactly)
  for v_item in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) loop
    insert into public.expense_items (expense_id, user_id, name, quantity, unit_price, line_total, position)
    values (
      v_expense.id,
      v_uid,
      v_item->>'name',
      coalesce((v_item->>'quantity')::numeric, 1),
      (v_item->>'unit_price')::numeric,
      (v_item->>'line_total')::numeric,
      v_pos
    );
    v_pos := v_pos + 1;
  end loop;

  -- insert splits
  for v_split in select * from jsonb_array_elements(coalesce(p_splits, '[]'::jsonb)) loop
    insert into public.expense_splits (expense_id, group_id, member_id, share_amount)
    values (
      v_expense.id,
      p_group_id,
      (v_split->>'member_id')::uuid,
      (v_split->>'share_amount')::numeric
    );
  end loop;

  return v_expense;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. create_settlement
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.create_settlement(
  p_group_id       uuid,
  p_from_member_id uuid,
  p_to_member_id   uuid,
  p_amount         numeric,
  p_currency       text
) returns public.group_settlements
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid        uuid := (select auth.uid());
  v_settlement public.group_settlements;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  if not public.is_group_member(p_group_id, v_uid) then
    raise exception 'not a group member';
  end if;

  -- from and to must belong to the group
  if not exists (
    select 1 from public.group_members gm
    where gm.id = p_from_member_id and gm.group_id = p_group_id
  ) then
    raise exception 'from_member_id does not belong to group';
  end if;

  if not exists (
    select 1 from public.group_members gm
    where gm.id = p_to_member_id and gm.group_id = p_group_id
  ) then
    raise exception 'to_member_id does not belong to group';
  end if;

  if p_from_member_id = p_to_member_id then
    raise exception 'from_member_id and to_member_id must differ';
  end if;

  if p_amount <= 0 then
    raise exception 'amount must be positive';
  end if;

  if p_currency not in ('ARS', 'USD') then
    raise exception 'currency must be ARS or USD';
  end if;

  insert into public.group_settlements (
    group_id, from_member_id, to_member_id, amount, currency, created_by
  )
  values (
    p_group_id, p_from_member_id, p_to_member_id, p_amount, p_currency, v_uid
  )
  returning * into v_settlement;

  return v_settlement;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. get_group_balances
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.get_group_balances(
  p_group_id uuid
) returns table(member_id uuid, currency text, net numeric)
language plpgsql
security invoker
set search_path = ''
as $$
begin
  -- Non-members get empty results because underlying SELECTs honor RLS.
  -- Net > 0 means "te deben" (the member is owed money).
  return query
  with
  paid_cte as (
    select
      e.paid_by_member_id                  as mid,
      e.currency                           as cur,
      sum(e.amount)                        as paid
    from public.expenses e
    where e.group_id = p_group_id
      and e.paid_by_member_id is not null
    group by e.paid_by_member_id, e.currency
  ),
  share_cte as (
    select
      es.member_id                         as mid,
      e.currency                           as cur,
      sum(es.share_amount)                 as share
    from public.expense_splits es
    join public.expenses e on e.id = es.expense_id
    where es.group_id = p_group_id
    group by es.member_id, e.currency
  ),
  settle_out_cte as (
    select
      gs.from_member_id                    as mid,
      gs.currency                          as cur,
      sum(gs.amount)                       as settle_out
    from public.group_settlements gs
    where gs.group_id = p_group_id
    group by gs.from_member_id, gs.currency
  ),
  settle_in_cte as (
    select
      gs.to_member_id                      as mid,
      gs.currency                          as cur,
      sum(gs.amount)                       as settle_in
    from public.group_settlements gs
    where gs.group_id = p_group_id
    group by gs.to_member_id, gs.currency
  ),
  all_pairs as (
    select mid, cur from paid_cte
    union
    select mid, cur from share_cte
    union
    select mid, cur from settle_out_cte
    union
    select mid, cur from settle_in_cte
  )
  select
    ap.mid                                                     as member_id,
    ap.cur                                                     as currency,
    coalesce(p.paid, 0)
      - coalesce(s.share, 0)
      + coalesce(so.settle_out, 0)
      - coalesce(si.settle_in, 0)                             as net
  from all_pairs ap
  left join paid_cte       p  on p.mid  = ap.mid and p.cur  = ap.cur
  left join share_cte      s  on s.mid  = ap.mid and s.cur  = ap.cur
  left join settle_out_cte so on so.mid = ap.mid and so.cur = ap.cur
  left join settle_in_cte  si on si.mid = ap.mid and si.cur = ap.cur
  order by ap.mid, ap.cur;
end;
$$;
