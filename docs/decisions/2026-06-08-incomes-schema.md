# ADR: Incomes — schema and materialization strategy

**Date:** 2026-06-08
**Status:** Accepted
**Scope:** `radar-app` — HU-20 (ingresos recurrentes) + HU-21 (ingresos ocasionales)

---

## Context

RADAR tracks expenses but had no income side. Without income capture the dashboard cannot
show a net balance and the "independiente multi-moneda" persona cannot track cashflow across
ARS and USD. HU-20 adds recurring income rules (sueldo, freelance, etc.); HU-21 adds
one-off manual income entries. Both share the same `incomes` table — they differ only in
the value of the `source` column and whether `recurrence_id` is populated.

Open choices at the start of this feature:

1. **Separate tables or shared** — `incomes` + `income_recurrences` vs extending `expenses`
   with a sign column or a `kind` discriminator.
2. **Occurrence date type** — `timestamptz` vs `DATE` for the idempotency dedup key.
3. **Recurrence materialization** — on-demand (lazy) vs scheduled batch (pg_cron).
4. **Catch-up window** — how to handle rules that were missed while the app was inactive.
5. **No-backfill policy** — whether historical occurrences before today are seeded on creation.
6. **`advance_occurrence` logic** — monthly/yearly date anchoring to avoid drift.
7. **`categories.kind`** — whether to extend the existing categories table or create separate
   income-category tables.
8. **Net balance** — whether to compute net (incomes − expenses) in the DB or the client.

---

## Decision

### 1. Separate `incomes` + `income_recurrences` tables (not extending `expenses`)

Adding a `kind` or `amount_sign` column to `expenses` was considered. Rejected because:

- **Semantics**: an income is not an expense with a negative amount. They have different
  fields (income has no `group_id`, `paid_by_member_id`, or `expense_items`), different
  category sets, and different UI surfaces.
- **RLS**: the expenses table's SELECT policy was already extended for shared-expense members.
  Adding income rows would require further policy branching with no benefit.
- **Query isolation**: `get_personal_totals` and the expense list already aggregate over
  `expenses`. Mixing in incomes would force every consumer to filter by `kind`.
- **Consistency with HU-17**: HU-17 added `group_id` nullable columns to `expenses` for
  shared expenses (structurally similar data, same form). Incomes are structurally different —
  the precedent does not apply.

`income_recurrences` stores the recurrence rule (frequency, amount, start/end dates,
`next_run_on`, `last_materialized_at`). `incomes` stores the occurrence (actual income event),
whether materialized from a rule or entered manually. The FK `incomes.recurrence_id → income_recurrences.id ON DELETE SET NULL` means deleting a rule does not delete its historical income rows.

### 2. Occurrence date stored as DATE (`occurred_date`) — not an expression index

The idempotency guard for the materialization job uses a unique index on
`(recurrence_id, occurred_date) WHERE recurrence_id IS NOT NULL`.

An expression index on `(recurrence_id, occurred_at::date)` was the first approach.
It was rejected because `timestamptz::date` is **STABLE** (not IMMUTABLE) in Postgres —
it is session-timezone dependent and Postgres refuses to build btree indexes on
STABLE expressions. A plain `occurred_date DATE` column (set by the materializer,
nullable for manual entries) is an ordinary non-expression column and has no immutability
requirement.

The materializer sets `occurred_at` to noon UTC on the occurrence date
(`v_occ::timestamp + interval '12 hours') at time zone 'UTC'`) to avoid timezone
off-by-one at midnight boundaries, while `occurred_date` carries the unambiguous calendar
date for the dedup index.

Manual (one-off) incomes set `occurred_date = NULL` and are exempt from the uniqueness
constraint (`WHERE recurrence_id IS NOT NULL`).

### 3. pg_cron daily materialization via `materialize_due_incomes()`

Two approaches were considered:

- **On-demand / lazy**: materialize when the user opens the Ingresos tab (client triggers an
  RPC). Simple, no infrastructure dependency.
- **Scheduled batch (pg_cron)**: a daily cron job runs the materializer server-side.

The scheduled approach was chosen because:

- The Ingresos tab shows totals and a history that must be accurate even if the user has not
  opened the app for several days. Lazy materialization would require the client to detect
  gaps and trigger the job — complex and fragile.
- `pg_cron` is available on Supabase with `create extension if not exists pg_cron`.
- The daily cadence (06:00 UTC) is sufficient for all supported frequencies (weekly, biweekly,
  monthly, yearly). No recurrence fires more than once per day.

The job is idempotent: the unique index on `(recurrence_id, occurred_date)` means a
duplicate run inserts nothing (`ON CONFLICT DO NOTHING`).

#### `materialize_due_incomes()` — implementation notes

- **SECURITY DEFINER**, REVOKE EXECUTE from `anon`, `authenticated`, `public`. This follows
  AGENTS.md §7 Pattern 1 — the function is only called by pg_cron (running as the `postgres`
  role), never directly by the client or from RLS policies. The Supabase security advisor
  does not flag Pattern 1 functions.
- **Catch-up loop**: the inner `while v_occ <= current_date` loop materializes all missed
  occurrences since `next_run_on`, not just today's. A rule paused for two weeks catches up
  on the next run (unless paused — `status='paused'` rules are excluded by the outer query).
- **`FOR UPDATE SKIP LOCKED`**: prevents double-materialization if pg_cron ever fires
  concurrent jobs (e.g. a backlog retry).
- After the inner loop, `next_run_on` is advanced to the first future occurrence and
  `last_materialized_at` is updated.
- **Safety guard**: `exit inner_loop when v_next is null or v_next <= v_occ` prevents
  infinite loops if `advance_occurrence` returns a non-progressing date.
- **No backfill on creation**: `next_run_on` is set to the first occurrence that falls on or
  after today when the user creates the recurrence. Historical occurrences before creation are
  not generated.
- **End-date inclusive**: the materializer checks `v_occ <= v_rule.end_date`; a rule with
  `end_date = 2026-12-31` materializes its December occurrence.

#### `advance_occurrence()` — date math

A pure `IMMUTABLE` SQL function (no session-state dependencies):

| Frequency  | Logic                                                                                                                                                              |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `weekly`   | `p_current + 7`                                                                                                                                                    |
| `biweekly` | `p_current + 14`                                                                                                                                                   |
| `monthly`  | First day of next month + (`min(p_dom OR day(p_start), days_in_next_month)` − 1). Anchors to `p_dom` on every call — never drifts from a previously-clamped value. |
| `yearly`   | Same month/day as `p_start`, `year(p_current) + 1`. Feb-29 → Feb-28 on non-leap years via `last_day` clamping.                                                     |

`p_dom` (day_of_month) is explicitly NOT STRICT — `NULL` is valid for weekly/biweekly/yearly
rules and for monthly rules that inherit the day from `p_start`. STRICT would short-circuit
the whole function to NULL on any NULL argument, breaking all non-monthly frequencies.

REVOKE EXECUTE from `anon`, `authenticated`, `public` — Pattern 1.

Migration `20260608144623` (`income_recurrence_functions_fix_strict`) corrected the initial
STRICT declaration in `20260608144434`. Both are kept for audit history.

### 4. `categories.kind` — extend existing categories table

Adding `kind text NOT NULL DEFAULT 'expense' CHECK (kind IN ('expense','income'))` to
`categories` was chosen over a separate `income_categories` table because:

- All existing category infrastructure (icon picker, color picker, `CategorySelectorSheet`,
  OCR suggestion, `seed_default_categories` trigger) already exists and is reused.
- The slug uniqueness index was updated from `(user_id, slug)` to `(user_id, kind, slug)`,
  allowing a user to own e.g. slug `otros` in both sets.
- `seed_default_categories(uuid)` was extended to seed 7 income defaults on signup:
  Sueldo (`Wallet`), Freelance (`Laptop`), Inversiones (`TrendingUp`), Reintegro (`Undo2`),
  Regalo (`Gift`), Alquiler (`Building2`), Otros (`CircleDashed`).
- Existing users are backfilled in the migration via a `DO $$` loop.
- `expenses.category_id` FK and all expense-side filters are unaffected — they continue to
  pull from the user's `kind='expense'` rows via the category selector filter.

### 5. `get_income_totals` — SECURITY INVOKER

The RPC returns `(currency, total, count)` for the caller's incomes in an optional date
range. SECURITY INVOKER: caller's RLS applies, no privilege escalation. Mirrors
`get_personal_totals` but simpler — incomes have no splits.

### 6. Net balance computed client-side

The Home "Este mes" card computes `net = income_total − expense_total` per currency using
`useIncomeTotals` + `useExpenseTotals` (or `get_personal_totals` for the expense side).
This was chosen over a DB-side `get_net_balance` RPC because:

- Both totals are already queried individually for their respective tabs.
- The computation is trivial arithmetic (`income − expense` per currency row).
- Client-side avoids an additional RPC and keeps the logic testable without DB mocks.

ARS and USD net balances are never mixed or converted (same policy as group balances).

---

## Alternatives considered

### A. `kind` column on `expenses` ("negative expense")

Rejected. Income and expense are semantically distinct. Income has no items, no group, no
split. The existing expense RLS, queries, and form infrastructure would require branching
everywhere. The precedent of adding nullable columns (`group_id`) does not apply here.

### B. Lazy / on-demand materialization (client-triggered RPC)

Rejected. The Ingresos tab must show accurate data after the app has been inactive for days.
Requiring the user to open the tab to trigger catch-up is fragile UX and puts logic in the
client that belongs in the scheduler.

### C. Expression index on `occurred_at::date`

Rejected. `timestamptz::date` is STABLE in Postgres (session-timezone dependent) and cannot
be used in btree index expressions. The plain `occurred_date DATE` column is the
correct and portable solution.

### D. Separate `income_categories` table

Rejected. The existing category infrastructure is reused with minimal schema change. Separate
tables would duplicate all icon/color/seed logic.

---

## Consequences

**Benefits:**

- Clean data boundary: expenses and incomes are independent, queries are isolated.
- pg_cron materializer ensures accuracy even when the user hasn't opened the app.
- `occurred_date` column is a robust, portable idempotency key — no expression index,
  no timezone surprises.
- `advance_occurrence` is IMMUTABLE and fully testable without DB — safe to unit-test.
- Income categories reuse all existing category infrastructure; no new tables or UI flows.
- `get_income_totals` INVOKER keeps RLS as the authority; no privilege escalation.

**Tradeoffs:**

- `income_recurrences` + `incomes` adds two more tables to the schema.
- pg_cron is a Supabase-specific extension — local dev without `supabase start` cannot run
  the cron job (must trigger manually or mock).
- The strict/non-strict fix required two migration files (`144434` → `144623`); both are
  kept for audit history.
- Net balance computation duplicates the ARS/USD "no mixing" logic from group balances.

---

## Implementation

1. `supabase/migrations/20260608143107_add_income_categories_kind.sql` — add `categories.kind`,
   update slug uniqueness index to `(user_id, kind, slug)`, extend `seed_default_categories`
   to seed 7 income defaults, backfill existing users.
2. `supabase/migrations/20260608143926_create_incomes_tables.sql` — create
   `income_recurrences` + `incomes` tables, RLS (owner CRUD), indexes including the
   idempotency unique index, `updated_at` triggers.
3. `supabase/migrations/20260608144434_income_recurrence_functions.sql` — `advance_occurrence`
   IMMUTABLE + `materialize_due_incomes` SECURITY DEFINER; REVOKE from all client roles
   (Pattern 1).
4. `supabase/migrations/20260608144503_income_recurrence_cron.sql` — enable `pg_cron`,
   schedule `'materialize-due-incomes'` at `'0 6 * * *'`; idempotent unschedule-if-exists guard.
5. `supabase/migrations/20260608144623_income_recurrence_functions_fix_strict.sql` — replace
   `advance_occurrence` without STRICT (fixes NULL `p_dom` short-circuit bug).
6. `supabase/migrations/20260608145126_get_income_totals.sql` — `get_income_totals`
   SECURITY INVOKER RPC.
7. `lib/income-recurrence.ts` — TypeScript `computeNextRunOn(start, frequency, today)` for
   client-side `next_run_on` preview.
8. `lib/schemas/income.ts` + `lib/schemas/income-recurrence.ts` — zod schemas.
9. `lib/repositories/incomes.ts` — typed repository functions (`listIncomes`, `createIncome`,
   `updateIncome`, `deleteIncome`, `sumIncomesByCurrency`, `listRecurrences`,
   `createRecurrence`, `updateRecurrence`, `deleteRecurrence`, `pauseRecurrence`,
   `resumeRecurrence`).
10. `hooks/use-incomes.ts` — TanStack Query hooks; invalidates `incomeKeys.*` and
    `recurrenceKeys.*` on mutations.
11. `components/incomes/income-form.tsx` — form for one-off + recurring-sourced income CRUD.
12. `components/incomes/recurrence-form.tsx` — form for recurrence rule CRUD.
13. `components/incomes/income-row.tsx` — list row component.
14. `app/(protected)/(tabs)/incomes.tsx` — Ingresos tab: totals strip + recurrences section +
    day-grouped income list + filter bar.
15. `app/(protected)/income/new.tsx`, `[id].tsx` — income entry screens.
16. `app/(protected)/income/recurrence/new.tsx`, `[id].tsx` — recurrence rule screens.
17. Home `index.tsx` — net balance display using `useIncomeTotals`; "Ingresos" quick action.
