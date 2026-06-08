# RADAR — Database conventions

---

## Database migrations (MANDATORY practice)

Every schema change ships as **both**:

1. A SQL file in `supabase/migrations/<version>_<name>.sql` (committed to the repo), AND
2. The same SQL applied to the remote project via Supabase MCP `apply_migration` with the **same name** — the MCP assigns the version timestamp; rename the local file to match it (`list_migrations` to confirm).

Remote migration history and local files must always be 1:1. The two pre-existing migrations (`20260517025226`, `20260518005107`) are baseline reconstructions — documented in-file, never re-applied. After applying: run `get_advisors` (security) and regenerate `types/supabase.ts`.

---

## SECURITY DEFINER RPCs — intentional advisor lints

RADAR uses two patterns for SECURITY DEFINER functions:

1. **Helper functions called only from triggers/other functions** (`seed_default_categories`, `materialize_due_incomes`, `advance_occurrence`): REVOKE EXECUTE from anon, public, authenticated. Never invoked by a client or inside an RLS policy evaluated as the client role. Supabase advisor does not flag these.
2. **DEFINER functions invoked from RLS policies** (`is_group_member`): MUST retain EXECUTE for `authenticated`. RLS policies that call a function are evaluated as the _querying_ role, so Postgres checks EXECUTE on `authenticated` even though the function is SECURITY DEFINER. Revoking it makes every query on `expenses`/`groups`/`group_members`/`expense_splits`/`group_settlements` fail with 403 (permission denied for function). REVOKE from anon/public only. The advisor `authenticated_security_definer_function_executable` lint is an **accepted false positive** — the function is a pure boolean membership check. (Learned the hard way: migration `20260608013250` revoked it and broke all expense reads/writes; `20260608033734` re-granted it.)
3. **RPCs callable by authenticated but DEFINER by necessity** (`invite_group_member`, `user_exists_by_email`): need to read `auth.users` by email — impossible with INVOKER. REVOKE from anon/public; `authenticated` retains EXECUTE. The Supabase advisor flags `authenticated_security_definer_function_executable` for these functions. **This lint is intentional and accepted by design.** `invite_group_member` contains its own `is_group_member` authorization guard. `user_exists_by_email` is a pure boolean check used for on-blur form validation; it intentionally permits email enumeration by authenticated users (same information already leaks via `invite_group_member` status codes). Document any future DEFINER RPC that follows this pattern with a comment in the migration file and an entry here.

---

## pg_cron materialization jobs

RADAR uses pg_cron for two daily materializers running at 06:00 UTC:

- `'materialize-due-incomes'` (`'0 6 * * *'`) — recurring income occurrences into `incomes`.
- `'materialize-due-expenses'` (`'0 6 * * *'`) — recurring expense occurrences into `expenses` (HU-19).

Key rules:

- **Materialization functions follow Pattern 1** (`materialize_due_incomes`, `materialize_due_expenses`, `advance_occurrence`): SECURITY DEFINER, REVOKE EXECUTE from `anon`, `authenticated`, `public`. Called only by pg_cron (running as the `postgres` role). Supabase advisor does not flag Pattern 1.
- **`advance_occurrence` is IMMUTABLE, NOT STRICT**: pure date arithmetic, no session-state calls. NOT STRICT because `p_dom` is legitimately NULL for weekly/biweekly/yearly rules — STRICT would short-circuit the entire function to NULL on any NULL argument, breaking non-monthly frequencies. Shared by both materializers — defined once in migration `20260608144434`, not redefined for HU-19.
- **Idempotency via `occurred_date DATE` column**: `timestamptz::date` is STABLE (session-timezone dependent) and cannot appear in a btree expression index. Both `incomes.occurred_date` and `expenses.occurred_date` are plain DATE columns; the unique index `(recurrence_id, occurred_date) WHERE recurrence_id IS NOT NULL` on each table is a standard non-expression btree index. Manual entries leave `occurred_date = NULL` and are excluded from the uniqueness constraint.
- **Local dev without pg_cron**: run `select public.materialize_due_incomes();` or `select public.materialize_due_expenses();` manually via Supabase MCP to simulate the cron jobs.
