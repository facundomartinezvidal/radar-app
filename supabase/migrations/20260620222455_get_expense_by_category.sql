-- Migration: get_expense_by_category
-- Applied to remote: 20260620222455 via Supabase MCP
-- HU-23/HU-24 Insights — per-category expense breakdown for the donut chart.
-- SECURITY INVOKER: runs under caller RLS, no privilege escalation.
-- Share-aware: for group expenses, counts only the caller's split share_amount
-- (same CASE as get_personal_totals). p_currency filters to a single currency;
-- p_from/p_to filter by occurred_at.

create function public.get_expense_by_category(
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
language sql security invoker set search_path = '' as $$
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
               and m.user_id = (select auth.uid())
           ), 0)
      end
    ) as total,
    count(*)::bigint as count
  from public.expenses e
  left join public.categories c on c.id = e.category_id
  where e.user_id = (select auth.uid())
    and e.currency = p_currency
    and (p_from is null or e.occurred_at >= p_from)
    and (p_to is null or e.occurred_at <= p_to)
  group by c.id, c.name, c.color, c.icon
  order by total desc;
$$;
