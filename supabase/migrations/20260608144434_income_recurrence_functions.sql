-- Applied to remote: 20260608144434 via Supabase MCP
-- Migration: income_recurrence_functions
-- HU-20/HU-21 — pg_cron materializer for recurring incomes.
--
-- advance_occurrence: pure IMMUTABLE date math — no session-state functions.
-- materialize_due_incomes: SECURITY DEFINER, called only by pg_cron as the
--   postgres role. REVOKE EXECUTE from anon/authenticated/public (AGENTS.md
--   §7 Pattern 1 — helper called only by scheduled job; advisor must NOT flag).
-- pg_cron job: runs daily at 06:00 UTC.

-- ---------------------------------------------------------------------------
-- advance_occurrence
-- ---------------------------------------------------------------------------
-- Returns the next occurrence date given a current occurrence date, frequency,
-- day-of-month override (monthly only), and the rule's start_date (for anchoring).
--
-- Monthly anchor logic:
--   target_day = least(coalesce(p_dom, extract(day from p_start)::int), days_in_next_month)
--   result     = first day of next month + (target_day - 1) days
--   This anchors to p_dom (or p_start day) on EVERY call — never drifts from
--   a previously-clamped value.
--
-- Yearly anchor logic:
--   Same month/day as p_start; year = year(p_current)+1 (or +2 if same year
--   as p_current after the last occurrence overshot — handled by advancing
--   until year > year(p_current)).
--   Feb-29 → Feb-28 on non-leap years via last_day clamping.

create or replace function public.advance_occurrence(
  p_current  date,
  p_freq     text,
  p_dom      smallint,
  p_start    date
) returns date
language sql
immutable
-- NOT strict: p_dom is legitimately null for non-monthly rules and for
-- monthly rules that inherit day from p_start. STRICT would short-circuit
-- the entire function to NULL whenever p_dom is null.
set search_path = ''
as $$
  select case p_freq
    when 'weekly'   then p_current + 7
    when 'biweekly' then p_current + 14
    when 'monthly'  then (
      -- First day of the month after p_current
      with next_month as (
        select date_trunc('month', p_current + interval '1 month')::date as fm
      ),
      target as (
        select
          fm,
          -- Desired day: p_dom if provided, else day of p_start
          least(
            coalesce(p_dom::int, extract(day from p_start)::int),
            extract(day from (date_trunc('month', fm) + interval '1 month' - interval '1 day')::date)::int
          ) as tday
        from next_month
      )
      select (fm + (tday - 1) * interval '1 day')::date from target
    )
    when 'yearly'   then (
      -- Same month/day as p_start, next year (year(p_current) + 1)
      -- Clamp Feb-29 → Feb-28 on non-leap years
      with base as (
        select
          extract(year  from p_current)::int + 1 as ny,
          extract(month from p_start)::int        as sm,
          extract(day   from p_start)::int        as sd
      ),
      candidate as (
        select
          (make_date(ny, sm, 1) + interval '1 month' - interval '1 day')::date as ldom_c
        from base
      )
      select make_date(
               (select ny  from base),
               (select sm  from base),
               least((select sd from base),
                     extract(day from (select ldom_c from candidate))::int)
             )
    )
    else null
  end
$$;

-- Cron / trigger-only helper — revoke client execution.
revoke execute on function public.advance_occurrence(date, text, smallint, date)
  from anon, authenticated, public;

-- ---------------------------------------------------------------------------
-- materialize_due_incomes
-- ---------------------------------------------------------------------------
-- Loops over all active income_recurrences that are due (next_run_on <=
-- current_date) and inserts one income row per occurrence day in the
-- catch-up window up to current_date (inclusive), then advances the rule's
-- next_run_on to the next future date.
--
-- Idempotency: the unique index incomes_recurrence_occurred_day_unique
-- (recurrence_id, occurred_date) WHERE recurrence_id IS NOT NULL ensures
-- duplicate runs are no-ops (ON CONFLICT DO NOTHING).
--
-- SECURITY DEFINER — needed so the postgres/cron role can bypass RLS when
-- writing to incomes (owned by individual users). REVOKE from client roles.

create or replace function public.materialize_due_incomes()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rule   public.income_recurrences%rowtype;
  v_occ    date;
  v_next   date;
  v_count  integer := 0;
begin
  for v_rule in
    select *
      from public.income_recurrences
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
      insert into public.incomes (
        user_id,
        amount,
        currency,
        category_id,
        description,
        occurred_at,
        occurred_date,
        source,
        recurrence_id
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
        v_rule.id
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
    update public.income_recurrences
       set next_run_on          = v_occ,
           last_materialized_at = now()
     where id = v_rule.id;

  end loop;

  return v_count;
end;
$$;

-- Cron-only helper — revoke client execution (AGENTS.md §7 Pattern 1).
revoke execute on function public.materialize_due_incomes()
  from anon, authenticated, public;
