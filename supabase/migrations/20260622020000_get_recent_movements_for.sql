-- Migration: get_recent_movements_for
-- Applied to remote: <timestamp assigned by Supabase MCP apply_migration>
-- WhatsApp bot — Pattern 1 SECURITY DEFINER RPC that lists a user's most recent
-- individual movements (expenses + incomes), ordered newest-first.
--
-- Pattern 1: REVOKE EXECUTE from anon, public, authenticated.
-- Called only by the whatsapp-webhook edge function running with the service-role
-- key. Accepts caller-supplied p_user_id (replaces auth.uid()) — safe because the
-- function is NOT callable by app users at all.
-- Supabase advisor does NOT flag Pattern 1 functions as
-- authenticated_security_definer_function_executable.
--
-- Share-aware expense amount uses the exact same CASE as get_personal_totals_for:
--   if group_id is null → full e.amount
--   else               → the member's share_amount from expense_splits (0 if none)

create function public.get_recent_movements_for(
  p_user_id   uuid,
  p_limit     integer  default null,
  p_direction text     default null
)
returns table(
  direction     text,
  amount        numeric,
  currency      text,
  description   text,
  category_name text,
  occurred_at   timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  with expenses_rows as (
    select
      'expense'::text as direction,
      case when e.group_id is null then e.amount
           else coalesce((
             select s.share_amount
             from public.expense_splits s
             join public.group_members m on m.id = s.member_id
             where s.expense_id = e.id
               and m.user_id = p_user_id
           ), 0)
      end                           as amount,
      e.currency,
      e.description,
      c.name                        as category_name,
      e.occurred_at,
      e.created_at
    from public.expenses e
    left join public.categories c on c.id = e.category_id
    where e.user_id = p_user_id
      and (p_direction is null or p_direction = 'expense')
  ),
  income_rows as (
    select
      'income'::text as direction,
      i.amount,
      i.currency,
      i.description,
      c.name         as category_name,
      i.occurred_at,
      i.created_at
    from public.incomes i
    left join public.categories c on c.id = i.category_id
    where i.user_id = p_user_id
      and (p_direction is null or p_direction = 'income')
  ),
  combined as (
    select * from expenses_rows
    union all
    select * from income_rows
  )
  select
    direction,
    amount,
    currency,
    description,
    category_name,
    occurred_at
  from combined
  order by occurred_at desc, created_at desc
  limit greatest(1, least(20, coalesce(p_limit, 5)));
$$;

revoke execute on function public.get_recent_movements_for(uuid, integer, text) from anon, public, authenticated;
grant  execute on function public.get_recent_movements_for(uuid, integer, text) to service_role;
