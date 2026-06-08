# Incomes (HU-20 + HU-21)

## Overview

HU-20 and HU-21 add the income side of RADAR's financial picture. Without income data the
dashboard cannot show net cashflow and the "independiente multi-moneda" persona cannot track
ARS/USD earnings.

- **HU-20 (ingresos recurrentes)**: recurring income rules — sueldo, freelance, alquiler,
  etc. The user defines a rule (amount, currency, category, frequency, start/end date) and
  pg_cron materializes the occurrences daily. The user can pause, resume, edit, or delete rules.
- **HU-21 (ingresos ocasionales)**: one-off manual income entries — reintegro, regalo, etc.
  Direct CRUD on the `incomes` table, no recurrence machinery involved.

Both HUs share the Ingresos tab and the same `incomes` table. They differ only in
`source` (`'recurrence'` vs `'manual'`) and whether `recurrence_id` is set.

**Branch:** `feat/incomes`
**Release:** Entrega 3
**Complexity:** MEDIO
**Test baseline after this feature:** 1276 tests, 82 suites

---

## Requirements

### Functional

| #   | Requirement                                                                            | HU       | Status  |
| --- | -------------------------------------------------------------------------------------- | -------- | ------- |
| 1   | Create a recurring income rule (amount, currency, category, frequency, start/end date) | HU-20    | Shipped |
| 2   | Pause and resume a recurrence                                                          | HU-20    | Shipped |
| 3   | Edit a recurrence rule                                                                 | HU-20    | Shipped |
| 4   | Delete a recurrence rule (materialized incomes survive with `recurrence_id=null`)      | HU-20    | Shipped |
| 5   | pg_cron materializes due occurrences daily; catches up missed days                     | HU-20    | Shipped |
| 6   | Idempotent materialization — duplicate runs insert nothing                             | HU-20    | Shipped |
| 7   | Register a one-off income (amount, currency, category, description, date)              | HU-21    | Shipped |
| 8   | Edit and delete a one-off income                                                       | HU-21    | Shipped |
| 9   | List incomes day-grouped with filter by search / currency / category                   | HU-20/21 | Shipped |
| 10  | View per-currency income totals (ARS / USD) on the Ingresos tab                        | HU-20/21 | Shipped |
| 11  | Home dashboard shows net balance per currency (income − expense)                       | HU-20/21 | Shipped |
| 12  | Home quick-action "Ingresos" navigates to income/new                                   | HU-21    | Shipped |

### Non-functional

- **Security**: all tables are owner-RLS only. `materialize_due_incomes` and `advance_occurrence`
  are SECURITY DEFINER with REVOKE from all client roles (AGENTS.md §7 Pattern 1). The Supabase
  advisor does not flag them.
- **Idempotency**: `incomes` has a unique index `(recurrence_id, occurred_date) WHERE recurrence_id IS NOT NULL`. Duplicate cron runs are no-ops.
- **Integrity**: `amount > 0` enforced at the DB level. `end_date >= start_date` constraint.
- **No backfill**: `next_run_on` is set to the first future occurrence date on creation. Historical occurrences before today are not generated.

---

## Data model

See [ADR: Incomes schema](../decisions/2026-06-08-incomes-schema.md) for full decision rationale.

### `categories.kind` (extension to HU-16)

Migration `20260608143107` adds `kind text NOT NULL DEFAULT 'expense' CHECK (kind IN ('expense','income'))` to `categories`. The slug uniqueness index changes from `(user_id, slug)` to `(user_id, kind, slug)` — a user can own `otros` in both sets. `seed_default_categories` seeds 7 income defaults on signup (and backfills existing users):

| Slug             | Name        | Icon           |
| ---------------- | ----------- | -------------- |
| `sueldo`         | Sueldo      | `Wallet`       |
| `freelance`      | Freelance   | `Laptop`       |
| `inversiones`    | Inversiones | `TrendingUp`   |
| `reintegro`      | Reintegro   | `Undo2`        |
| `regalo`         | Regalo      | `Gift`         |
| `alquiler`       | Alquiler    | `Building2`    |
| `otros-ingresos` | Otros       | `CircleDashed` |

### `income_recurrences`

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
| `day_of_month`              | smallint      | 1–31; nullable; monthly-only override         |
| `status`                    | text          | `active` (default) or `paused`                |
| `next_run_on`               | date          | NOT NULL; first future occurrence on creation |
| `last_materialized_at`      | timestamptz   | nullable; updated by materializer             |
| `created_at` / `updated_at` | timestamptz   | `updated_at` trigger                          |

RLS: owner CRUD (select/insert/update/delete — own rows only).

Indexes: `(user_id)`, `(next_run_on) WHERE status='active'`.

### `incomes`

| Column                      | Type          | Constraints                                                     |
| --------------------------- | ------------- | --------------------------------------------------------------- |
| `id`                        | uuid PK       | `gen_random_uuid()`                                             |
| `user_id`                   | uuid          | NOT NULL, FK `auth.users` CASCADE                               |
| `amount`                    | numeric(14,2) | `> 0`                                                           |
| `currency`                  | text          | `'ARS'` or `'USD'`                                              |
| `category_id`               | uuid          | FK `categories` SET NULL                                        |
| `description`               | text          | `<= 240` chars                                                  |
| `occurred_at`               | timestamptz   | NOT NULL; noon UTC on the occurrence date for materialized rows |
| `occurred_date`             | date          | nullable; always set for `source='recurrence'`; null for manual |
| `source`                    | text          | `'manual'` (default) or `'recurrence'`                          |
| `recurrence_id`             | uuid          | FK `income_recurrences` SET NULL; null for manual entries       |
| `created_at` / `updated_at` | timestamptz   | `updated_at` trigger                                            |

RLS: owner CRUD.

Indexes: `(user_id, occurred_at DESC)`, `(category_id)`, `(currency)`, `(recurrence_id)`.

Idempotency index: `UNIQUE (recurrence_id, occurred_date) WHERE recurrence_id IS NOT NULL`.

**Why `occurred_date` is a separate column**: `timestamptz::date` is STABLE (not IMMUTABLE)
in Postgres — it is session-timezone dependent and cannot appear in a btree expression index.
A plain `DATE` column has no immutability requirement and is the correct portable solution.
See [ADR §2](../decisions/2026-06-08-incomes-schema.md).

---

## Recurrence materialization

### pg_cron job

- Name: `'materialize-due-incomes'`
- Schedule: `'0 6 * * *'` (daily, 06:00 UTC)
- Command: `select public.materialize_due_incomes();`
- Enabled by: migration `20260608144503` (`create extension if not exists pg_cron`)
- Idempotent scheduling: unschedule-if-exists guard before `cron.schedule()`

### `materialize_due_incomes()`

SECURITY DEFINER, REVOKE from all client roles (Pattern 1 — never callable by the client).

For each `active` rule with `next_run_on <= current_date`:

1. Lock the rule with `FOR UPDATE SKIP LOCKED` (prevents double-materialization).
2. Inner catch-up loop: while `v_occ <= current_date AND v_occ <= end_date`:
   - Insert into `incomes` with `source='recurrence'`, `occurred_date=v_occ`,
     `occurred_at=(v_occ + 12h) AT TIME ZONE 'UTC'`.
   - `ON CONFLICT (recurrence_id, occurred_date) WHERE recurrence_id IS NOT NULL DO NOTHING` — idempotent.
   - Advance `v_occ` via `advance_occurrence(v_occ, frequency, day_of_month, start_date)`.
   - Safety guard: exit if `advance_occurrence` returns null or no progress.
3. Update rule: `next_run_on = v_occ`, `last_materialized_at = now()`.

Returns total rows inserted.

### `advance_occurrence(p_current, p_freq, p_dom, p_start) → date`

IMMUTABLE SQL, REVOKE from all client roles (Pattern 1). NOT STRICT — `p_dom` is
legitimately `NULL` for non-monthly rules.

| Frequency  | Result                                                                       |
| ---------- | ---------------------------------------------------------------------------- |
| `weekly`   | `p_current + 7`                                                              |
| `biweekly` | `p_current + 14`                                                             |
| `monthly`  | First of next month + (`min(p_dom OR day(p_start), days_in_next_month)` − 1) |
| `yearly`   | Same month/day as `p_start`, next year; Feb-29 → Feb-28 on non-leap years    |

---

## RPC

| Function                                         | Security                | Purpose                                                                            |
| ------------------------------------------------ | ----------------------- | ---------------------------------------------------------------------------------- |
| `materialize_due_incomes()`                      | **DEFINER**, REVOKE all | Daily cron: insert due occurrences, advance `next_run_on`                          |
| `advance_occurrence(date, text, smallint, date)` | IMMUTABLE, REVOKE all   | Date arithmetic for occurrence advancement                                         |
| `get_income_totals(p_from, p_to)`                | INVOKER                 | Per-currency `(currency, total, count)` for the caller's incomes in the date range |

---

## TypeScript modules

- **`lib/income-recurrence.ts`**: `computeNextRunOn(start, frequency, today)` — client-side
  preview of the first `next_run_on` date, used by `RecurrenceForm` before the rule is saved.
- **`lib/schemas/income.ts`**: zod schemas — `CreateIncomeInput`, `UpdateIncomeInput`,
  `IncomeFilter`.
- **`lib/schemas/income-recurrence.ts`**: zod schemas — `CreateRecurrenceInput`,
  `UpdateRecurrenceInput`.
- **`lib/repositories/incomes.ts`**: typed repository wrappers (`listIncomes`, `createIncome`,
  `updateIncome`, `deleteIncome`, `sumIncomesByCurrency`, `listRecurrences`,
  `createRecurrence`, `updateRecurrence`, `deleteRecurrence`, `pauseRecurrence`,
  `resumeRecurrence`).
- **`hooks/use-incomes.ts`**: TanStack Query hooks; query keys `incomeKeys.*` and
  `recurrenceKeys.*`; mutations invalidate all income + recurrence queries.

---

## UI surface

### Ingresos tab (`app/(protected)/(tabs)/incomes.tsx`)

Added as the 4th tab. Contains:

1. **Header** — "Ingresos" title + "Nuevo" CTA (→ `income/new`).
2. **Totals strip** — ARS and USD total/count cards via `useIncomeTotals`.
3. **Ingresos recurrentes section** — compact card listing all `active`/`paused` rules;
   `+` button and empty-state CTA both navigate to `income/recurrence/new`. Shows
   frequency label (`Semanal` / `Quincenal` / `Mensual` / `Anual`), pause indicator, and
   `Próximo: YYYY-MM-DD` for active rules.
4. **Filter bar** — reuses `FilterBar` with income categories.
5. **Day-grouped income list** — same `groupByDay` pattern as expenses, using `FlatList`.

### Income screens

| Screen                                       | Purpose                                        |
| -------------------------------------------- | ---------------------------------------------- |
| `app/(protected)/income/new.tsx`             | Create one-off income (IncomeForm)             |
| `app/(protected)/income/[id].tsx`            | Edit / delete one-off income                   |
| `app/(protected)/income/recurrence/new.tsx`  | Create recurrence rule (RecurrenceForm)        |
| `app/(protected)/income/recurrence/[id].tsx` | Edit / pause / resume / delete recurrence rule |

### Components

| Component                                | Purpose                                                                |
| ---------------------------------------- | ---------------------------------------------------------------------- |
| `components/incomes/income-form.tsx`     | Amount, currency, category (income kind), description, date            |
| `components/incomes/recurrence-form.tsx` | Same fields + frequency, start date, end date (optional), day_of_month |
| `components/incomes/income-row.tsx`      | List row — category icon + color, description, date, amount in green   |

### Home net balance

`app/(protected)/(tabs)/index.tsx` uses `useIncomeTotals` and `useExpenseTotals` (via
`get_personal_totals`) to compute and display `net = incomes − expenses` per currency in
the "Este mes" hero card. Green when net > 0, red when net < 0. ARS and USD shown separately.

---

## Edge cases

| Edge case                                        | Behavior                                                                                                                                              |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Rule created today (no prior occurrences)        | `next_run_on` = first future date; no backfill                                                                                                        |
| Rule missed while app inactive (several days)    | Catch-up loop materializes all missed dates in one cron run                                                                                           |
| Duplicate cron run                               | `ON CONFLICT DO NOTHING` — idempotent, zero insertions on repeat                                                                                      |
| `end_date` in the past at creation               | DB allows it (user may be entering historical data); materializer inserts nothing since `next_run_on > current_date` would be false after advancement |
| Paused rule                                      | Excluded from materializer query (`status = 'active'`); no occurrences are generated while paused                                                     |
| Resume paused rule                               | `next_run_on` reset to today via client; materializer will catch up from that date forward                                                            |
| Monthly on the 31st in a 30-day month            | `advance_occurrence` clamps to last day of month                                                                                                      |
| Yearly on Feb 29 in a non-leap year              | Clamped to Feb 28                                                                                                                                     |
| Delete recurrence                                | FK `ON DELETE SET NULL` — historical `incomes.recurrence_id` becomes `null`; income rows survive                                                      |
| ARS + USD incomes in same month                  | `get_income_totals` returns separate rows; UI shows two currency cards; never mixed                                                                   |
| Manual income with same category as a recurrence | Allowed; `source='manual'`, `recurrence_id=null`, exempt from dedup index                                                                             |

---

## Migrations

| File                                                                            | Applied | Content                                                            |
| ------------------------------------------------------------------------------- | ------- | ------------------------------------------------------------------ |
| `supabase/migrations/20260608143107_add_income_categories_kind.sql`             | Yes     | `categories.kind`, new slug uniqueness index, income defaults seed |
| `supabase/migrations/20260608143926_create_incomes_tables.sql`                  | Yes     | `income_recurrences` + `incomes` tables, RLS, indexes              |
| `supabase/migrations/20260608144434_income_recurrence_functions.sql`            | Yes     | `advance_occurrence` + `materialize_due_incomes`; REVOKE all       |
| `supabase/migrations/20260608144503_income_recurrence_cron.sql`                 | Yes     | Enable pg_cron; schedule daily job                                 |
| `supabase/migrations/20260608144623_income_recurrence_functions_fix_strict.sql` | Yes     | Replace `advance_occurrence` without STRICT (fixes NULL `p_dom`)   |
| `supabase/migrations/20260608145126_get_income_totals.sql`                      | Yes     | `get_income_totals` INVOKER RPC                                    |

---

## Out of scope (explicit)

- **Push notifications** for recurring income events (requires `device_tokens` table — still pending).
- **OCR-triggered income capture** — the camera flow is expense-only; income entry is manual form only.
- **Income → expense conversion** — there is no "pay expense from income" workflow.
- **FX conversion** — ARS/USD net balance is two separate figures; no FX rate applied.

---

## Related documents

- [HU-20 user flow](../user-flows/HU-20-ingresos-recurrentes.md)
- [HU-21 user flow](../user-flows/HU-21-ingresos-ocasionales.md)
- [ADR: Incomes schema](../decisions/2026-06-08-incomes-schema.md)
- [HU-16 custom categories](../user-flows/HU-16-categorias-personalizadas.md) — category infrastructure reused
