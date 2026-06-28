-- Migration: get_income_by_category_for
-- Applied to remote: 20260622030100 via Supabase MCP
-- whatsapp-query-llm-render — Pattern 1 SECURITY DEFINER income-by-category for the
-- WhatsApp bot. Mirrors get_expense_by_category_for but against public.incomes
-- with a plain sum (incomes have no group splits). Caller-supplied p_user_id.
-- REVOKE from anon/public/authenticated; GRANT only to service_role.

create function public.get_income_by_category_for(
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
    sum(i.amount) as total,
    count(*)::bigint as count
  from public.incomes i
  left join public.categories c on c.id = i.category_id
  where i.user_id = p_user_id
    and i.currency = p_currency
    and (p_from is null or i.occurred_at >= p_from)
    and (p_to is null or i.occurred_at <= p_to)
  group by c.id, c.name, c.color, c.icon
  order by total desc;
$$;

revoke execute on function public.get_income_by_category_for(uuid, text, timestamptz, timestamptz) from anon, public, authenticated;
grant execute on function public.get_income_by_category_for(uuid, text, timestamptz, timestamptz) to service_role;
