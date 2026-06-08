-- Applied to remote: 20260608165317 via Supabase MCP
-- Migration: expense_recurrence_cron
-- HU-19 — schedule the daily expense materializer job via pg_cron.
-- Must run AFTER expense_recurrence_functions (20260608150100).
--
-- pg_cron is available on Supabase but must be explicitly enabled.
-- The extension is created in the pg_catalog schema (Supabase default for
-- pg_cron) — the cron schema is created by the extension itself.
--
-- Job runs at 06:00 UTC daily (same window as materialize-due-incomes).
-- Using SELECT (not CALL) because materialize_due_expenses is a function,
-- not a procedure.
--
-- Idempotent: unschedule-if-exists via NOT EXISTS guard before scheduling.

create extension if not exists pg_cron;

-- Unschedule any existing job with this name before (re-)scheduling.
do $$
begin
  if exists (select 1 from cron.job where jobname = 'materialize-due-expenses') then
    perform cron.unschedule('materialize-due-expenses');
  end if;
end;
$$;

select cron.schedule(
  'materialize-due-expenses',
  '0 6 * * *',
  $$ select public.materialize_due_expenses(); $$
);
