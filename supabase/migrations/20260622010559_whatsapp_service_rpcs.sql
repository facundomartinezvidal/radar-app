-- Migration: whatsapp_service_rpcs
-- Applied to remote: 20260622010000 via Supabase MCP
-- WhatsApp bot — Pattern 1 SECURITY DEFINER variants of the existing INVOKER RPCs.
-- These are called by the whatsapp-webhook edge function (service-role only) when
-- acting on behalf of a resolved user without a JWT session (D1 from design.md).
--
-- Pattern 1: REVOKE EXECUTE from anon, public, authenticated.
-- Granted only to service_role + postgres (superuser always retains privilege).
-- Caller-supplied p_user_id replaces auth.uid() in each body — logic is otherwise
-- identical to the source INVOKER function. This keeps all business rules
-- (amount>0, currency/direction checks, atomicity, share-aware CASE, etc.)
-- in one reviewable place and will NOT add advisor
-- authenticated_security_definer_function_executable lints.

-- ──────────────────────────────────────────────────────────────
-- 1. import_transactions_for(p_user_id uuid, p_rows jsonb)
--    Clone of import_transactions; p_user_id replaces auth.uid().
-- ──────────────────────────────────────────────────────────────
create function public.import_transactions_for(p_user_id uuid, p_rows jsonb)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row jsonb;
  v_direction text;
  v_amount numeric;
  v_currency text;
  v_category_id uuid;
  v_description text;
  v_occurred_at timestamptz;
  v_count integer := 0;
begin
  if p_user_id is null then
    raise exception 'p_user_id requerido' using errcode = '28000';
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
        (p_user_id, v_amount, v_currency, v_category_id, v_description, v_occurred_at, 'manual');
    else
      -- manual incomes set occurred_date from the timestamp, matching createIncome.
      insert into public.incomes
        (user_id, amount, currency, category_id, description, occurred_at, occurred_date, source)
      values
        (p_user_id, v_amount, v_currency, v_category_id, v_description, v_occurred_at, v_occurred_at::date, 'manual');
    end if;

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

revoke execute on function public.import_transactions_for(uuid, jsonb) from anon, public, authenticated;
grant execute on function public.import_transactions_for(uuid, jsonb) to service_role;

-- ──────────────────────────────────────────────────────────────
-- 2. get_personal_totals_for(p_user_id uuid, p_from, p_to)
--    Clone of get_personal_totals; p_user_id replaces auth.uid().
-- ──────────────────────────────────────────────────────────────
create function public.get_personal_totals_for(
  p_user_id uuid,
  p_from timestamptz default null,
  p_to timestamptz default null
)
returns table(currency text, total numeric, count bigint)
language sql security definer set search_path = '' as $$
  select e.currency,
    sum(
      case when e.group_id is null then e.amount
           else coalesce((
             select s.share_amount from public.expense_splits s
             join public.group_members m on m.id = s.member_id
             where s.expense_id = e.id and m.user_id = p_user_id
           ), 0)
      end
    ) as total,
    count(*)::bigint as count
  from public.expenses e
  where e.user_id = p_user_id
    and (p_from is null or e.occurred_at >= p_from)
    and (p_to is null or e.occurred_at <= p_to)
  group by e.currency;
$$;

revoke execute on function public.get_personal_totals_for(uuid, timestamptz, timestamptz) from anon, public, authenticated;
grant execute on function public.get_personal_totals_for(uuid, timestamptz, timestamptz) to service_role;

-- ──────────────────────────────────────────────────────────────
-- 3. get_expense_by_category_for(p_user_id uuid, p_currency, p_from, p_to)
--    Clone of get_expense_by_category; p_user_id replaces auth.uid().
-- ──────────────────────────────────────────────────────────────
create function public.get_expense_by_category_for(
  p_user_id uuid,
  p_currency text,
  p_from timestamptz default null,
  p_to timestamptz default null
)
returns table(
  category_id uuid,
  category_name text,
  color text,
  icon text,
  total numeric,
  count bigint
)
language sql security definer set search_path = '' as $$
  select
    c.id as category_id,
    coalesce(c.name, 'Sin categoría') as category_name,
    coalesce(c.color, '#888888') as color,
    coalesce(c.icon, 'Tag') as icon,
    sum(
      case when e.group_id is null then e.amount
           else coalesce((
             select s.share_amount
             from public.expense_splits s
             join public.group_members m on m.id = s.member_id
             where s.expense_id = e.id
               and m.user_id = p_user_id
           ), 0)
      end
    ) as total,
    count(*)::bigint as count
  from public.expenses e
  left join public.categories c on c.id = e.category_id
  where e.user_id = p_user_id
    and e.currency = p_currency
    and (p_from is null or e.occurred_at >= p_from)
    and (p_to is null or e.occurred_at <= p_to)
  group by c.id, c.name, c.color, c.icon
  order by total desc;
$$;

revoke execute on function public.get_expense_by_category_for(uuid, text, timestamptz, timestamptz) from anon, public, authenticated;
grant execute on function public.get_expense_by_category_for(uuid, text, timestamptz, timestamptz) to service_role;

-- ──────────────────────────────────────────────────────────────
-- 4. get_expense_by_period_for(p_user_id uuid, p_currency, p_bucket, p_from, p_to)
--    Clone of get_expense_by_period; p_user_id replaces auth.uid().
-- ──────────────────────────────────────────────────────────────
create function public.get_expense_by_period_for(
  p_user_id uuid,
  p_currency text,
  p_bucket text default 'month',
  p_from timestamptz default null,
  p_to timestamptz default null
)
returns table(
  bucket date,
  total numeric,
  count bigint
)
language sql security definer set search_path = '' as $$
  select
    date_trunc(
      case when p_bucket in ('day', 'week', 'month') then p_bucket else 'month' end,
      e.occurred_at
    )::date as bucket,
    sum(
      case when e.group_id is null then e.amount
           else coalesce((
             select s.share_amount
             from public.expense_splits s
             join public.group_members m on m.id = s.member_id
             where s.expense_id = e.id
               and m.user_id = p_user_id
           ), 0)
      end
    ) as total,
    count(*)::bigint as count
  from public.expenses e
  where e.user_id = p_user_id
    and e.currency = p_currency
    and (p_from is null or e.occurred_at >= p_from)
    and (p_to is null or e.occurred_at <= p_to)
  group by 1
  order by 1;
$$;

revoke execute on function public.get_expense_by_period_for(uuid, text, text, timestamptz, timestamptz) from anon, public, authenticated;
grant execute on function public.get_expense_by_period_for(uuid, text, text, timestamptz, timestamptz) to service_role;

-- ──────────────────────────────────────────────────────────────
-- 5. get_income_by_period_for(p_user_id uuid, p_currency, p_bucket, p_from, p_to)
--    Clone of get_income_by_period; p_user_id replaces auth.uid().
-- ──────────────────────────────────────────────────────────────
create function public.get_income_by_period_for(
  p_user_id uuid,
  p_currency text,
  p_bucket text default 'month',
  p_from timestamptz default null,
  p_to timestamptz default null
)
returns table(
  bucket date,
  total numeric,
  count bigint
)
language sql security definer set search_path = '' as $$
  select
    date_trunc(
      case when p_bucket in ('day', 'week', 'month') then p_bucket else 'month' end,
      i.occurred_at
    )::date as bucket,
    sum(i.amount) as total,
    count(*)::bigint as count
  from public.incomes i
  where i.user_id = p_user_id
    and i.currency = p_currency
    and (p_from is null or i.occurred_at >= p_from)
    and (p_to is null or i.occurred_at <= p_to)
  group by 1
  order by 1;
$$;

revoke execute on function public.get_income_by_period_for(uuid, text, text, timestamptz, timestamptz) from anon, public, authenticated;
grant execute on function public.get_income_by_period_for(uuid, text, text, timestamptz, timestamptz) to service_role;
