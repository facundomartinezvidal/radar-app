-- Migration: expense_items_rpc
-- Applied to remote: 2026-06-03 (version 20260603152639, via Supabase MCP)
-- HU-18 — atomic write paths for expenses + line items.
-- security invoker: runs under the caller's RLS — user_id always auth.uid().

create or replace function public.create_expense_with_items(
  p_amount numeric,
  p_currency text,
  p_category_id uuid,
  p_description text,
  p_occurred_at timestamptz,
  p_items jsonb default '[]'::jsonb
) returns public.expenses
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_expense public.expenses;
  v_uid uuid := (select auth.uid());
  v_item jsonb;
  v_pos integer := 0;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  if jsonb_array_length(coalesce(p_items, '[]'::jsonb)) > 50 then
    raise exception 'too many items (max 50)';
  end if;

  insert into public.expenses (user_id, amount, currency, category_id, description, occurred_at)
  values (v_uid, p_amount, p_currency, p_category_id, p_description, coalesce(p_occurred_at, now()))
  returning * into v_expense;

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

  return v_expense;
end;
$$;

-- p_patch: jsonb with optional keys amount/currency/category_id/description/occurred_at —
-- only present keys are updated (supports explicit null for category_id/description).
-- p_items: null = leave items untouched · array (incl. []) = replace full set.
create or replace function public.update_expense_with_items(
  p_id uuid,
  p_patch jsonb default '{}'::jsonb,
  p_items jsonb default null
) returns public.expenses
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_expense public.expenses;
  v_uid uuid := (select auth.uid());
  v_patch jsonb := coalesce(p_patch, '{}'::jsonb);
  v_item jsonb;
  v_pos integer := 0;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  if p_items is not null and jsonb_array_length(p_items) > 50 then
    raise exception 'too many items (max 50)';
  end if;

  update public.expenses
  set
    amount      = case when v_patch ? 'amount'      then (v_patch->>'amount')::numeric          else amount end,
    currency    = case when v_patch ? 'currency'    then v_patch->>'currency'                   else currency end,
    category_id = case when v_patch ? 'category_id' then (v_patch->>'category_id')::uuid        else category_id end,
    description = case when v_patch ? 'description' then v_patch->>'description'                else description end,
    occurred_at = case when v_patch ? 'occurred_at' then (v_patch->>'occurred_at')::timestamptz else occurred_at end
  where id = p_id
  returning * into v_expense;

  if not found then
    raise exception 'expense not found';
  end if;

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

  return v_expense;
end;
$$;
