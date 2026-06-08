-- Applied to remote: 20260608144623 via Supabase MCP
-- Migration: income_recurrence_functions_fix_strict
-- HU-20/HU-21 — fix advance_occurrence: remove STRICT so NULL p_dom is
-- handled by the COALESCE inside the monthly branch (as intended).
-- STRICT made the entire function return NULL whenever p_dom IS NULL, which
-- breaks weekly/biweekly/yearly too because STRICT is all-or-nothing per call.

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
