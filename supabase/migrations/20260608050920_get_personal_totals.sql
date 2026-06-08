-- Migration: get_personal_totals
-- Applied to remote: 20260608050920 via Supabase MCP
-- HU-17 personal-share — RPC returns per-currency totals for the current user's
-- OWN expenses, substituting each shared expense's amount with the caller's split
-- share_amount (via expense_splits + group_members). SECURITY INVOKER — runs
-- under caller's RLS so no privilege escalation is possible.

create function public.get_personal_totals(p_from timestamptz default null, p_to timestamptz default null)
returns table(currency text, total numeric, count bigint)
language sql security invoker set search_path = '' as $$
  select e.currency,
    sum(
      case when e.group_id is null then e.amount
           else coalesce((
             select s.share_amount from public.expense_splits s
             join public.group_members m on m.id = s.member_id
             where s.expense_id = e.id and m.user_id = (select auth.uid())
           ), 0)
      end
    ) as total,
    count(*)::bigint as count
  from public.expenses e
  where e.user_id = (select auth.uid())
    and (p_from is null or e.occurred_at >= p_from)
    and (p_to is null or e.occurred_at <= p_to)
  group by e.currency;
$$;
