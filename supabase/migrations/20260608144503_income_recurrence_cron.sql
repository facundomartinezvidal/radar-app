-- Applied to remote: 20260608144503 via Supabase MCP
-- Migration: income_recurrence_cron
-- HU-20/HU-21 — enable pg_cron and schedule the daily materializer job.
-- Must run AFTER income_recurrence_functions (20260608144434).
--
-- pg_cron is available on Supabase but must be explicitly enabled.
-- The extension is created in the pg_catalog schema (Supabase default for
-- pg_cron) — the cron schema is created by the extension itself.
--
-- Job runs at 06:00 UTC daily.  Using SELECT (not CALL) because
-- materialize_due_incomes is a function, not a procedure.
--
-- Idempotent: unschedule-if-exists via NOT EXISTS guard before scheduling.

create extension if not exists pg_cron;

-- Unschedule any existing job with this name before (re-)scheduling.
do $$
begin
  if exists (select 1 from cron.job where jobname = 'materialize-due-incomes') then
    perform cron.unschedule('materialize-due-incomes');
  end if;
end;
$$;

select cron.schedule(
  'materialize-due-incomes',
  '0 6 * * *',
  $$ select public.materialize_due_incomes(); $$
);
