# Recurring expenses (HU-19)

## Overview

HU-19 adds recurring expense rules so periodic costs — rent, subscriptions, gym, etc. —
are recorded automatically without manual entry each period.

The user defines a rule (`expense_recurrences` table) and a pg_cron job materializes the
due occurrences daily as plain rows in the existing `expenses` table. Materialized rows are
indistinguishable from manual expenses in queries; they carry `source='recurrence'` and a
"Recurrente" badge in the UI.

**Branch:** `feat/recurring-expenses`
**Release:** Entrega 3
**Complexity:** MEDIO
**Test baseline after this feature:** 1432 tests, 89 suites

---

## Requirements

### Functional

| #   | Requirement                                                                             | Status  |
| --- | --------------------------------------------------------------------------------------- | ------- |
| 1   | Create a recurring expense rule (amount, currency, category, frequency, start/end date) | Shipped |
| 2   | Pause and resume a recurrence                                                           | Shipped |
| 3   | Edit a recurrence rule                                                                  | Shipped |
| 4   | Delete a recurrence rule (materialized expenses survive with `recurrence_id=null`)      | Shipped |
| 5   | pg_cron materializes due occurrences daily; catches up missed days                      | Shipped |
| 6   | Idempotent materialization — duplicate runs insert nothing                              | Shipped |
| 7   | "Recurrente" badge on expense rows with `source='recurrence'`                           | Shipped |
| 8   | "Gastos recurrentes" section in Gastos tab listing active/paused rules                  | Shipped |

### Non-functional

- **Scope**: recurring expenses are personal only — `group_id` and `paid_by_member_id` are
  always `NULL` on materialized rows. Shared recurrences are out of HU-19 scope.
- **Security**: `expense_recurrences` is owner-RLS only. `materialize_due_expenses` is
  SECURITY DEFINER with REVOKE from all client roles (AGENTS.md §7 Pattern 1).
- **Idempotency**: `expenses` has a unique index
  `(recurrence_id, occurred_date) WHERE recurrence_id IS NOT NULL`. Duplicate cron runs
  are no-ops.
- **No backfill**: `next_run_on` is set to the first future occurrence date on creation.

---

## Data model

See [ADR: Recurring expenses schema](../decisions/2026-06-08-recurring-expenses-schema.md)
for full decision rationale.

### `expense_recurrences`

| Column                      | Type          | Constraints                                   |
| --------------------------- | ------------- | --------------------------------------------- |
| `id`                        | uuid PK       | `gen_random_uuid()`                           |
| `user_id`                   | uuid          | NOT NULL, FK `auth.users` CASCADE             |
| `amount`                    | numeric(14,2) | `> 0`                                         |
| `currency`                  | text          | `'ARS'` or `'USD'`                            |
| `category_id`               | uuid          | FK `categories` SET NULL                      |
| `description`               | text          | `<= 240` chars                                |
| `frequency`                 | text          | `weekly` / `biweekly` / `monthly` / `yearly`  |
| `start_date`                | date          | NOT NULL                                      |
| `end_date`                  | date          | nullable; `>= start_date` if set (constraint) |
| `day_of_month`              | smallint      | 1–31; nullable; computed server-side          |
| `status`                    | text          | `active` (default) or `paused`                |
| `next_run_on`               | date          | NOT NULL; first future occurrence on creation |
| `last_materialized_at`      | timestamptz   | nullable; updated by materializer             |
| `created_at` / `updated_at` | timestamptz   | `updated_at` trigger                          |

RLS: owner CRUD (select/insert/update/delete — own rows only).

Indexes: `(user_id)`, `(next_run_on) WHERE status='active'`.

### `expenses` extensions (HU-19)

Three columns added to the existing `expenses` table:

| Column          | Type | Constraints                                                  |
| --------------- | ---- | ------------------------------------------------------------ |
| `source`        | text | `NOT NULL DEFAULT 'manual' CHECK IN ('manual','recurrence')` |
| `recurrence_id` | uuid | FK `expense_recurrences` SET NULL; null for manual           |
| `occurred_date` | date | nullable; always set for `source='recurrence'`               |

Idempotency index:

```sql
UNIQUE (recurrence_id, occurred_date) WHERE recurrence_id IS NOT NULL
```

**Why `occurred_date` is a separate column**: `timestamptz::date` is STABLE (not IMMUTABLE)
in Postgres — it is session-timezone dependent and cannot appear in a btree expression index.
A plain `DATE` column is the correct portable solution. See
[ADR §2](../decisions/2026-06-08-recurring-expenses-schema.md).

---

## Recurrence materialization

### pg_cron job

- Name: `'materialize-due-expenses'`
- Schedule: `'0 6 * * *'` (daily, 06:00 UTC — same window as `'materialize-due-incomes'`)
- Command: `select public.materialize_due_expenses();`
- Enabled by: migration `20260608165317` (`create extension if not exists pg_cron`)
- Idempotent scheduling: unschedule-if-exists guard before `cron.schedule()`

### `materialize_due_expenses()`

SECURITY DEFINER, REVOKE from all client roles (Pattern 1 — never callable by the client).

For each `active` rule with `next_run_on <= current_date`:

1. Lock the rule with `FOR UPDATE SKIP LOCKED` (prevents double-materialization).
2. Inner catch-up loop: while `v_occ <= current_date AND v_occ <= end_date`:
   - Insert into `expenses` with `source='recurrence'`, `occurred_date=v_occ`,
     `occurred_at=(v_occ + 12h) AT TIME ZONE 'UTC'`, `group_id=NULL`,
     `paid_by_member_id=NULL`.
   - `ON CONFLICT (recurrence_id, occurred_date) WHERE recurrence_id IS NOT NULL DO NOTHING`
     — idempotent.
   - Advance `v_occ` via `advance_occurrence(v_occ, frequency, day_of_month, start_date)`.
   - Safety guard: exit if `advance_occurrence` returns null or no progress.
3. Update rule: `next_run_on = v_occ`, `last_materialized_at = now()`.

Returns total rows inserted.

### `advance_occurrence()` — reused from HU-20

The IMMUTABLE SQL function defined in migration `20260608144434` (HU-20/incomes) is reused
verbatim. Not redefined in the HU-19 migrations.

| Frequency  | Result                                                                       |
| ---------- | ---------------------------------------------------------------------------- |
| `weekly`   | `p_current + 7`                                                              |
| `biweekly` | `p_current + 14`                                                             |
| `monthly`  | First of next month + (`min(p_dom OR day(p_start), days_in_next_month)` − 1) |
| `yearly`   | Same month/day as `p_start`, next year; Feb-29 → Feb-28 on non-leap years    |

---

## TypeScript modules

- **`lib/income-recurrence.ts`**: `firstFutureOccurrence` and `dayOfMonthFrom` are
  imported directly by `lib/repositories/expenses.ts` — no new file needed.
- **`lib/schemas/expense-recurrence.ts`**: zod schemas — `createExpenseRecurrenceSchema`,
  `updateExpenseRecurrenceSchema`, `CreateExpenseRecurrenceInput`,
  `UpdateExpenseRecurrenceInput`. Re-exports `FREQUENCIES` and `Frequency` from
  `lib/schemas/income-recurrence.ts`.
- **`lib/repositories/expenses.ts`**: extended with `ExpenseRecurrenceRow`,
  `ExpenseRecurrenceWithCategory`, `listExpenseRecurrences`, `createExpenseRecurrence`,
  `updateExpenseRecurrence`, `pauseExpenseRecurrence`, `resumeExpenseRecurrence`,
  `deleteExpenseRecurrence`.
- **`hooks/use-expenses.ts`**: extended with `useExpenseRecurrences`,
  `useExpenseRecurrence`, `useCreateExpenseRecurrence`, `useUpdateExpenseRecurrence`,
  `usePauseExpenseRecurrence`, `useResumeExpenseRecurrence`,
  `useDeleteExpenseRecurrence`. Query keys under `expenseRecurrenceKeys.*`; mutations
  invalidate both `expenseRecurrenceKeys.all` and `expenseKeys.all` (a new recurrence
  may materialize an expense immediately).

---

## UI surface

### Gastos tab (`app/(protected)/(tabs)/expenses.tsx`)

A **"Gastos recurrentes"** section is rendered above the expense list. It shows:

1. Section header "Gastos recurrentes" + `+` button (→ `expense/recurrence/new`).
2. **Empty state** CTA: "Crear gasto recurrente" when no active rules exist.
3. **Rule list**: one row per `active` rule — category icon, description/category name,
   frequency label (`Semanal` / `Quincenal` / `Mensual` / `Anual`), `Próximo: <date>`.
   Tapping a row navigates to `expense/recurrence/[id]`.

Only `active` rules appear in the section list (paused rules are not shown inline but are
accessible from `expense/recurrence/[id]`).

### Expense row badge

`components/expenses/expense-row.tsx` checks `expense.source === 'recurrence'` and renders
a "Recurrente" pill badge alongside the expense description, so materialized rows are
visually distinguishable in the expense list.

### Recurrence screens

| Screen                                        | Purpose                                        |
| --------------------------------------------- | ---------------------------------------------- |
| `app/(protected)/expense/recurrence/new.tsx`  | Create recurrence rule (ExpenseRecurrenceForm) |
| `app/(protected)/expense/recurrence/[id].tsx` | Edit / pause / resume / delete recurrence rule |

### Components

| Component                                         | Purpose                                                                                                                    |
| ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `components/expenses/expense-recurrence-form.tsx` | Amount, currency, category (kind='expense'), description, frequency, start date, end date (with "Sin fecha de fin" toggle) |

---

## Edge cases

| Edge case                                          | Behavior                                                                                           |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Rule created today (no prior occurrences)          | `next_run_on` = first future date; no backfill                                                     |
| Rule missed while app inactive (several days)      | Catch-up loop materializes all missed dates in one cron run                                        |
| Duplicate cron run                                 | `ON CONFLICT DO NOTHING` — idempotent, zero insertions on repeat                                   |
| Paused rule                                        | Excluded from materializer query (`status = 'active'`); no occurrences generated while paused      |
| Resume paused rule                                 | `next_run_on` reset to today via client; materializer catches up from that date                    |
| Monthly on the 31st in a 30-day month              | `advance_occurrence` clamps to last day of month                                                   |
| Yearly on Feb 29 in a non-leap year                | Clamped to Feb 28                                                                                  |
| Delete recurrence                                  | FK `ON DELETE SET NULL` — historical `expenses.recurrence_id` becomes `null`; expense rows survive |
| ARS + USD rules in same period                     | Each rule materializes independently; `get_personal_totals` sums per currency as usual             |
| Materialized expense appears in group member query | `group_id = NULL` on all materialized rows — never visible to group members; always personal       |

---

## Migrations

| File                                                                  | Applied | Content                                                                                                                 |
| --------------------------------------------------------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------- |
| `supabase/migrations/20260608164523_recurring_expenses_tables.sql`    | Yes     | `expense_recurrences` table + RLS; extend `expenses` with `source`, `recurrence_id`, `occurred_date`; idempotency index |
| `supabase/migrations/20260608165308_expense_recurrence_functions.sql` | Yes     | `materialize_due_expenses` SECURITY DEFINER; REVOKE all (Pattern 1)                                                     |
| `supabase/migrations/20260608165317_expense_recurrence_cron.sql`      | Yes     | Enable pg_cron; schedule `'materialize-due-expenses'` daily                                                             |

---

## Out of scope (explicit)

- **Shared recurring expenses** — group-assigned recurrences require member consent and a
  split strategy; deferred to a future HU.
- **Push notifications** for upcoming recurring expenses (requires `device_tokens` table —
  still pending).
- **OCR-triggered recurrence creation** — the camera flow captures single expenses; the
  recurrence form is standalone.

---

## Related documents

- [HU-19 user flow](../user-flows/HU-19-gastos-recurrentes.md)
- [ADR: Recurring expenses schema](../decisions/2026-06-08-recurring-expenses-schema.md)
- [ADR: Incomes schema](../decisions/2026-06-08-incomes-schema.md) — advance_occurrence + pg_cron pattern origin
- [HU-20 recurring incomes](../user-flows/HU-20-ingresos-recurrentes.md) — parallel implementation
