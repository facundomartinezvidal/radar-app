-- Migration: get_expense_by_period
-- Applied to remote: 20260620222511 via Supabase MCP
-- HU-23/HU-24 Insights — expense totals bucketed by day/week/month for the
-- bar chart. SECURITY INVOKER: runs under caller RLS, no privilege escalation.
-- Share-aware: for group expenses, counts only the caller's split share_amount
-- (same CASE as get_personal_totals). p_bucket accepts 'day', 'week', 'month'
-- (any other value falls back to 'month').

create function public.get_expense_by_period(
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
      e.occurred_at
    )::date as bucket,
    sum(
      case when e.group_id is null then e.amount
           else coalesce((
             select s.share_amount
             from public.expense_splits s
             join public.group_members m on m.id = s.member_id
             where s.expense_id = e.id
               and m.user_id = (select auth.uid())
           ), 0)
      end
    ) as total,
    count(*)::bigint as count
  from public.expenses e
  where e.user_id = (select auth.uid())
    and e.currency = p_currency
    and (p_from is null or e.occurred_at >= p_from)
    and (p_to is null or e.occurred_at <= p_to)
  group by 1
  order by 1;
$$;
