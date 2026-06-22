-- Migration: get_income_totals_for
-- Applied to remote: 20260622030000 via Supabase MCP
-- whatsapp-query-llm-render — Pattern 1 SECURITY DEFINER variant of get_income_totals.
-- Per-currency totals for a resolved user's incomes. Caller-supplied p_user_id
-- replaces auth.uid(). Incomes have no splits, so it's a plain sum.
-- REVOKE from anon/public/authenticated; GRANT only to service_role.

create function public.get_income_totals_for(
  p_user_id uuid,
  p_from timestamptz default null,
  p_to timestamptz default null
)
returns table(currency text, total numeric, count bigint)
language sql security definer set search_path = '' as $$
  select i.currency, sum(i.amount) as total, count(*)::bigint as count
  from public.incomes i
  where i.user_id = p_user_id
    and (p_from is null or i.occurred_at >= p_from)
    and (p_to is null or i.occurred_at <= p_to)
  group by i.currency;
$$;

revoke execute on function public.get_income_totals_for(uuid, timestamptz, timestamptz) from anon, public, authenticated;
grant execute on function public.get_income_totals_for(uuid, timestamptz, timestamptz) to service_role;
