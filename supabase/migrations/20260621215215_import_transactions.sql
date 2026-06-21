-- Migration: import_transactions
-- Applied to remote: 20260621215215 via Supabase MCP
-- HU-25 document-capture-classify — bulk import of selected transactions from a
-- classified document (e.g. a card statement) into expenses/incomes.
-- SECURITY INVOKER: runs under caller RLS; every row is inserted with
-- user_id = auth.uid() so the RLS with-check passes and no escalation occurs.
-- Atomic: a single plpgsql call — any raised exception rolls back the whole batch.

create function public.import_transactions(p_rows jsonb)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_row jsonb;
  v_direction text;
  v_amount numeric;
  v_currency text;
  v_category_id uuid;
  v_description text;
  v_occurred_at timestamptz;
  v_count integer := 0;
begin
  if v_uid is null then
    raise exception 'No autenticado' using errcode = '28000';
  end if;

  if p_rows is null or jsonb_typeof(p_rows) <> 'array' then
    raise exception 'p_rows debe ser un array JSON';
  end if;

  for v_row in select * from jsonb_array_elements(p_rows)
  loop
    v_direction := v_row->>'direction';
    v_amount := nullif(v_row->>'amount', '')::numeric;
    v_currency := v_row->>'currency';
    v_category_id := nullif(v_row->>'category_id', '')::uuid;
    v_description := nullif(v_row->>'description', '');
    v_occurred_at := coalesce(nullif(v_row->>'occurred_at', '')::timestamptz, now());

    if v_amount is null or v_amount <= 0 then
      raise exception 'Monto inválido en una de las filas';
    end if;
    if v_currency is null or v_currency not in ('ARS', 'USD') then
      raise exception 'Moneda inválida en una de las filas';
    end if;
    if v_direction is null or v_direction not in ('expense', 'income') then
      raise exception 'Dirección inválida en una de las filas';
    end if;

    if v_direction = 'expense' then
      -- manual expenses leave occurred_date NULL (only the recurrence
      -- materializer sets it), matching createExpense behavior.
      insert into public.expenses
        (user_id, amount, currency, category_id, description, occurred_at, source)
      values
        (v_uid, v_amount, v_currency, v_category_id, v_description, v_occurred_at, 'manual');
    else
      -- manual incomes set occurred_date from the timestamp, matching createIncome.
      insert into public.incomes
        (user_id, amount, currency, category_id, description, occurred_at, occurred_date, source)
      values
        (v_uid, v_amount, v_currency, v_category_id, v_description, v_occurred_at, v_occurred_at::date, 'manual');
    end if;

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

revoke execute on function public.import_transactions(jsonb) from anon, public;
grant execute on function public.import_transactions(jsonb) to authenticated;
