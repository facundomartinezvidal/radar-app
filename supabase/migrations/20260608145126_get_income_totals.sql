-- Migration: get_income_totals
-- Applied to remote: 20260608145126 via Supabase MCP
-- HU-20/HU-21 — per-currency totals for the current user's incomes. SECURITY
-- INVOKER: runs under caller RLS, no privilege escalation. Mirrors
-- get_personal_totals but incomes have no splits, so it's a plain sum.

create function public.get_income_totals(p_from timestamptz default null, p_to timestamptz default null)
returns table(currency text, total numeric, count bigint)
language sql security invoker set search_path = '' as $$
  select i.currency, sum(i.amount) as total, count(*)::bigint as count
  from public.incomes i
  where i.user_id = (select auth.uid())
    and (p_from is null or i.occurred_at >= p_from)
    and (p_to is null or i.occurred_at <= p_to)
  group by i.currency;
$$;
