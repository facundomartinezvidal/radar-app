# ADR: Recurring expenses — schema and materialization strategy

**Date:** 2026-06-08
**Status:** Accepted
**Scope:** `radar-app` — HU-19 (gastos recurrentes)

---

## Context

RADAR users have predictable periodic expenses — rent, subscriptions, gym, etc. — that
they currently register manually every month. HU-19 adds recurring expense rules so these
expenses are recorded automatically without user intervention.

Open choices at the start of this feature:

1. **Separate occurrences table or extend `expenses`** — a new `expense_occurrences` table
   vs materializing directly into the existing `expenses` table.
2. **Occurrence date type** — `timestamptz` vs `DATE` for the idempotency dedup key.
3. **Recurrence materialization** — on-demand (lazy) vs scheduled batch (pg_cron).
4. **Reuse `advance_occurrence`** — the incomes feature (HU-20) already ships this IMMUTABLE
   SQL function; whether to reuse it or redefine it for expenses.
5. **Personal-only scope** — whether recurring expenses can be shared (group-assigned).

---

## Decision

### 1. Materialize directly into the existing `expenses` table (not a separate occurrences table)

A new `expense_occurrences` table was considered. Rejected because:

- **Query isolation is already handled by columns**: the `source` column (`'manual'` vs
  `'recurrence'`) and `recurrence_id` FK let every consumer distinguish materialized rows
  from manual entries without a schema split.
- **Existing infrastructure reuse**: the expense list, `get_personal_totals`, category
  filtering, and the dashboard already query `expenses`. Materializing into `expenses` means
  all of this works for recurring entries at zero cost.
- **Precedent from HU-17**: the `expenses` table already carries nullable `group_id` +
  `paid_by_member_id` columns for shared expenses. Adding `source`, `recurrence_id`, and
  `occurred_date` is structurally identical — the table is designed to be extended.

The contrast with incomes (HU-20/21) is intentional: income is semantically distinct from
expense (different category sets, no items, no group splits). Recurring expenses _are_
expenses — same form, same list, same totals.

Three columns are added to `expenses`:

- `source text NOT NULL DEFAULT 'manual' CHECK (source IN ('manual','recurrence'))` —
  distinguishes materialized rows from manual entries.
- `recurrence_id uuid REFERENCES expense_recurrences(id) ON DELETE SET NULL` — links
  a materialized expense to its rule; SET NULL means deleting the rule preserves history.
- `occurred_date date` — plain DATE column for the idempotency index (see §2).

### 2. Occurrence date stored as DATE (`occurred_date`) — not an expression index

Same rationale as HU-20: `timestamptz::date` is **STABLE** (session-timezone dependent)
in Postgres and cannot appear in a btree index expression. A plain `occurred_date DATE`
column (set by the materializer, nullable for manual entries) carries no immutability
requirement and is the correct portable solution.

The idempotency index is:

```sql
UNIQUE (recurrence_id, occurred_date) WHERE recurrence_id IS NOT NULL
```

Manual entries (`recurrence_id IS NULL`) are excluded from the constraint and may leave
`occurred_date = NULL`.

### 3. pg_cron daily materialization via `materialize_due_expenses()`

Same approach as `materialize_due_incomes` (HU-20):

- **Scheduled batch** chosen over lazy/on-demand for the same reasons: expense history
  must be accurate even when the app has been inactive for days; the client should not
  need to detect and trigger catch-up.
- Job name: `'materialize-due-expenses'`, schedule `'0 6 * * *'` (same window as incomes).
- SECURITY DEFINER, REVOKE from all client roles (Pattern 1 — AGENTS.md §7).
- Catch-up loop + `FOR UPDATE SKIP LOCKED` + `ON CONFLICT DO NOTHING` — mirrors
  `materialize_due_incomes` exactly.
- Materialized rows have `group_id = NULL` and `paid_by_member_id = NULL` — recurring
  expenses are personal only (HU-19 scope).

### 4. Reuse `advance_occurrence()` — no redefinition

`advance_occurrence(date, text, smallint, date)` was defined in migration
`20260608144434_income_recurrence_functions.sql` (HU-20). The function is IMMUTABLE SQL
with no schema coupling to incomes — it is pure date arithmetic. `materialize_due_expenses`
calls it directly without modification.

Migration `20260608165308` explicitly notes: _"reuses the existing advance_occurrence
(defined in 20260608144434 — do NOT redefine it here)"_.

The TypeScript side similarly reuses `lib/income-recurrence.ts` — `firstFutureOccurrence`
and `dayOfMonthFrom` are imported directly. `lib/schemas/expense-recurrence.ts` re-exports
`FREQUENCIES` and `Frequency` from `lib/schemas/income-recurrence.ts`.

### 5. Personal-only scope

Recurring expenses are always personal — `group_id` and `paid_by_member_id` are hardcoded
to `NULL` in `materialize_due_expenses`. This is a deliberate HU-19 scope decision:
scheduling a shared recurring expense requires consent from all group members and a
settlement strategy, which belongs to a future HU.

---

## Alternatives considered

### A. Separate `expense_occurrences` table

Rejected. Materializing into `expenses` reuses all existing query infrastructure. A
separate table would duplicate list queries, totals RPCs, and category filtering.

### B. Expression index on `occurred_at::date`

Rejected. `timestamptz::date` is STABLE in Postgres and cannot be used in btree index
expressions. The plain `occurred_date DATE` column is the correct portable solution.
Same decision as HU-20.

### C. Lazy / on-demand materialization (client-triggered)

Rejected. The Gastos tab must show accurate data after the app has been inactive for days.
Same reasoning as HU-20.

### D. Redefine `advance_occurrence` for expenses

Rejected. The function is pure date arithmetic with no schema dependencies. Redefining
it would create a maintenance hazard (two diverging implementations).

### E. Allow group-assigned recurrences

Deferred. Scheduling a shared recurring expense requires member consent and a split
strategy. HU-19 is personal-only; shared recurrences are a future scope item.

---

## Consequences

**Benefits:**

- Recurring expenses appear in the existing expense list, totals, and dashboard at zero
  query cost — no new query paths needed.
- `advance_occurrence` and `lib/income-recurrence.ts` date math are reused verbatim.
- `occurred_date` column is a robust, portable idempotency key — no expression index,
  no timezone surprises.
- Deleting a rule preserves historical expense rows (FK `ON DELETE SET NULL`).

**Tradeoffs:**

- `expenses` now carries three extra nullable columns; consumers that care about the
  distinction must filter by `source`.
- `materialize_due_expenses` is a second pg_cron SECURITY DEFINER function alongside
  `materialize_due_incomes` — two jobs to monitor.
- Recurring expenses cannot be shared (personal-only in HU-19); shared recurrences require
  a future HU.

---

## Implementation

1. `supabase/migrations/20260608164523_recurring_expenses_tables.sql` — create
   `expense_recurrences` table + RLS; add `source`, `recurrence_id`, `occurred_date` to
   `expenses`; create idempotency unique index.
2. `supabase/migrations/20260608165308_expense_recurrence_functions.sql` —
   `materialize_due_expenses()` SECURITY DEFINER; REVOKE from all client roles (Pattern 1).
   Reuses `advance_occurrence` from migration `20260608144434` — not redefined.
3. `supabase/migrations/20260608165317_expense_recurrence_cron.sql` — schedule
   `'materialize-due-expenses'` at `'0 6 * * *'`; idempotent unschedule-if-exists guard.
4. `lib/income-recurrence.ts` — reused directly (`firstFutureOccurrence`, `dayOfMonthFrom`,
   `FREQUENCIES`). No changes required.
5. `lib/schemas/expense-recurrence.ts` — zod schemas; re-exports `FREQUENCIES`/`Frequency`
   from `income-recurrence`.
6. `lib/repositories/expenses.ts` — extended with `ExpenseRecurrenceRow`,
   `ExpenseRecurrenceWithCategory`, `listExpenseRecurrences`, `createExpenseRecurrence`,
   `updateExpenseRecurrence`, `pauseExpenseRecurrence`, `resumeExpenseRecurrence`,
   `deleteExpenseRecurrence`.
7. `hooks/use-expenses.ts` — extended with `useExpenseRecurrences`, `useExpenseRecurrence`,
   `useCreateExpenseRecurrence`, `useUpdateExpenseRecurrence`, `usePauseExpenseRecurrence`,
   `useResumeExpenseRecurrence`, `useDeleteExpenseRecurrence`.
8. `components/expenses/expense-recurrence-form.tsx` — form for recurrence rule CRUD
   (amount, currency, category, description, frequency, start/end date, indefinite toggle).
9. `app/(protected)/expense/recurrence/new.tsx` — create recurrence rule screen.
10. `app/(protected)/expense/recurrence/[id].tsx` — edit / pause / resume / delete screen.
11. `app/(protected)/(tabs)/expenses.tsx` — "Gastos recurrentes" section added above the
    expense list; `ExpenseRow` extended with "Recurrente" badge for `source='recurrence'` rows.
