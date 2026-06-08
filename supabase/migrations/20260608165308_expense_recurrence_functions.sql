-- Applied to remote: 20260608165308 via Supabase MCP
-- Migration: expense_recurrence_functions
-- HU-19 pg_cron materializer for recurring expenses; mirror of
-- materialize_due_incomes; reuses the existing advance_occurrence (defined in
-- 20260608144434_income_recurrence_functions.sql — do NOT redefine it here).
-- SECURITY DEFINER called only by pg_cron as the postgres role.
-- REVOKE EXECUTE from anon/authenticated/public (AGENTS.md §7 Pattern 1).

-- ---------------------------------------------------------------------------
-- materialize_due_expenses
-- ---------------------------------------------------------------------------
-- Loops over all active expense_recurrences that are due (next_run_on <=
-- current_date) and inserts one expense row per occurrence day in the
-- catch-up window up to current_date (inclusive), then advances the rule's
-- next_run_on to the next future date.
--
-- Recurring expenses are PERSONAL only (HU-19 scope): group_id and
-- paid_by_member_id are always NULL on materialized rows.
--
-- Idempotency: the unique index expenses_recurrence_occurred_day_unique
-- (recurrence_id, occurred_date) WHERE recurrence_id IS NOT NULL ensures
-- duplicate runs are no-ops (ON CONFLICT DO NOTHING).
--
-- SECURITY DEFINER — needed so the postgres/cron role can bypass RLS when
-- writing to expenses (owned by individual users). REVOKE from client roles.

create or replace function public.materialize_due_expenses()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rule   public.expense_recurrences%rowtype;
  v_occ    date;
  v_next   date;
  v_count  integer := 0;
begin
  for v_rule in
    select *
      from public.expense_recurrences
     where status = 'active'
       and next_run_on <= current_date
       and (end_date is null or next_run_on <= end_date)
     for update skip locked
  loop
    v_occ := v_rule.next_run_on;

    <<inner_loop>>
    while v_occ <= current_date
      and (v_rule.end_date is null or v_occ <= v_rule.end_date)
    loop
      insert into public.expenses (
        user_id,
        amount,
        currency,
        category_id,
        description,
        occurred_at,
        occurred_date,
        source,
        recurrence_id,
        group_id,
        paid_by_member_id
      ) values (
        v_rule.user_id,
        v_rule.amount,
        v_rule.currency,
        v_rule.category_id,
        v_rule.description,
        -- Noon UTC on the occurrence date — avoids off-by-one for any tz
        (v_occ::timestamp + interval '12 hours') at time zone 'UTC',
        v_occ,
        'recurrence',
        v_rule.id,
        null,  -- recurring expenses are PERSONAL only (HU-19 scope)
        null
      )
      on conflict (recurrence_id, occurred_date)
        where recurrence_id is not null
        do nothing;

      if found then
        v_count := v_count + 1;
      end if;

      -- Advance to next occurrence
      v_next := public.advance_occurrence(
        v_occ,
        v_rule.frequency,
        v_rule.day_of_month,
        v_rule.start_date
      );

      -- Safety guard: advance_occurrence must always return a strictly later
      -- date. If it doesn't (null or no progress), exit to avoid infinite loop.
      exit inner_loop when v_next is null or v_next <= v_occ;

      v_occ := v_next;
    end loop inner_loop;

    -- Update rule: next_run_on = first future occurrence, last_materialized_at = now
    update public.expense_recurrences
       set next_run_on          = v_occ,
           last_materialized_at = now()
     where id = v_rule.id;

  end loop;

  return v_count;
end;
$$;

-- Cron-only helper — revoke client execution (AGENTS.md §7 Pattern 1).
revoke execute on function public.materialize_due_expenses()
  from anon, authenticated, public;
