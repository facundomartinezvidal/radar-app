-- Migration: get_income_by_period
-- Applied to remote: 20260620222530 via Supabase MCP
-- HU-23/HU-24 Insights — income totals bucketed by day/week/month for the
-- line chart. SECURITY INVOKER: runs under caller RLS, no privilege escalation.
-- Incomes have no group splits, so it is a plain sum (mirrors get_income_totals
-- but adds date bucketing). p_bucket accepts 'day', 'week', 'month'
-- (any other value falls back to 'month').

create function public.get_income_by_period(
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
language sql security invoker set search_path = '' as $$
  select
    date_trunc(
      case when p_bucket in ('day', 'week', 'month') then p_bucket else 'month' end,
      i.occurred_at
    )::date as bucket,
    sum(i.amount) as total,
    count(*)::bigint as count
  from public.incomes i
  where i.user_id = (select auth.uid())
    and i.currency = p_currency
    and (p_from is null or i.occurred_at >= p_from)
    and (p_to is null or i.occurred_at <= p_to)
  group by 1
  order by 1;
$$;
