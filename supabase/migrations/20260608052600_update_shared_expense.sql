-- Migration: update_shared_expense
-- Applied to remote: 20260608052600 via Supabase MCP
-- HU-17 — atomic edit of a shared expense: patch columns, replace items, replace splits.
-- security invoker: runs under the caller's RLS — ownership enforced inline.
-- set search_path='': prevents search-path injection (mirrors existing RPCs).

create or replace function public.update_shared_expense(
  p_id                 uuid,
  p_patch              jsonb    default '{}'::jsonb,
  p_items              jsonb    default null,
  p_paid_by_member_id  uuid     default null,
  p_splits             jsonb    default null
) returns public.expenses
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid      uuid    := (select auth.uid());
  v_patch    jsonb   := coalesce(p_patch, '{}'::jsonb);
  v_expense  public.expenses;
  v_group_id uuid;
  v_eff_amount numeric;
  v_split    jsonb;
  v_split_sum numeric := 0;
  v_split_member_id uuid;
  v_item     jsonb;
  v_pos      integer := 0;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  -- Load current expense; enforce ownership + shared constraint
  select * into v_expense
  from public.expenses
  where id = p_id
    and (select auth.uid()) = user_id;

  if not found then
    raise exception 'expense not found';
  end if;

  if v_expense.group_id is null then
    raise exception 'not a shared expense';
  end if;

  v_group_id := v_expense.group_id;

  -- Items cap (checked before mutating anything)
  if p_items is not null and jsonb_array_length(p_items) > 50 then
    raise exception 'too many items (max 50)';
  end if;

  -- Resolve effective amount for split validation
  v_eff_amount := case
    when v_patch ? 'amount' then (v_patch->>'amount')::numeric
    else v_expense.amount
  end;

  -- Validate p_paid_by_member_id (if provided) belongs to the group
  if p_paid_by_member_id is not null then
    if not exists (
      select 1 from public.group_members gm
      where gm.id = p_paid_by_member_id and gm.group_id = v_group_id
    ) then
      raise exception 'paid_by_member_id does not belong to group';
    end if;
  end if;

  -- Validate splits (if provided)
  if p_splits is not null then
    -- Every split member_id must belong to the group
    for v_split in select * from jsonb_array_elements(p_splits) loop
      v_split_member_id := (v_split->>'member_id')::uuid;
      if not exists (
        select 1 from public.group_members gm
        where gm.id = v_split_member_id and gm.group_id = v_group_id
      ) then
        raise exception 'split member_id % does not belong to group', v_split_member_id;
      end if;
      v_split_sum := v_split_sum + coalesce((v_split->>'share_amount')::numeric, 0);
    end loop;

    -- Σ splits must equal effective amount (±0.01)
    if abs(v_split_sum - v_eff_amount) > 0.01 then
      raise exception 'splits must sum to amount';
    end if;
  end if;

  -- Apply patch: only-present-keys idiom (mirrors update_expense_with_items exactly)
  update public.expenses
  set
    amount             = case when v_patch ? 'amount'      then (v_patch->>'amount')::numeric          else amount      end,
    currency           = case when v_patch ? 'currency'    then v_patch->>'currency'                   else currency    end,
    category_id        = case when v_patch ? 'category_id' then (v_patch->>'category_id')::uuid        else category_id end,
    description        = case when v_patch ? 'description' then v_patch->>'description'                else description end,
    occurred_at        = case when v_patch ? 'occurred_at' then (v_patch->>'occurred_at')::timestamptz else occurred_at end,
    paid_by_member_id  = coalesce(p_paid_by_member_id, paid_by_member_id)
  where id = p_id
  returning * into v_expense;

  -- Replace items if provided (null = leave untouched)
  if p_items is not null then
    delete from public.expense_items where expense_id = p_id;
    for v_item in select * from jsonb_array_elements(p_items) loop
      insert into public.expense_items (expense_id, user_id, name, quantity, unit_price, line_total, position)
      values (
        p_id,
        v_uid,
        v_item->>'name',
        coalesce((v_item->>'quantity')::numeric, 1),
        (v_item->>'unit_price')::numeric,
        (v_item->>'line_total')::numeric,
        v_pos
      );
      v_pos := v_pos + 1;
    end loop;
  end if;

  -- Replace splits if provided (null = leave untouched)
  if p_splits is not null then
    delete from public.expense_splits where expense_id = p_id;
    for v_split in select * from jsonb_array_elements(p_splits) loop
      insert into public.expense_splits (expense_id, group_id, member_id, share_amount)
      values (
        p_id,
        v_group_id,
        (v_split->>'member_id')::uuid,
        (v_split->>'share_amount')::numeric
      );
    end loop;
  end if;

  return v_expense;
end;
$$;
