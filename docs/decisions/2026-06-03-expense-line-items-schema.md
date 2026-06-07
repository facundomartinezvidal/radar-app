# ADR: Expense line items — schema and write strategy

**Date:** 2026-06-03
**Status:** Accepted
**Scope:** `radar-app` — HU-18 (items detallados de factura)

---

## Context

RADAR's OCR pipeline (HU-05/06) saves only the receipt total. HU-18 adds
line-item detail so users can see what makes up each purchase. Argentine
supermarket tickets routinely have 20–60 items; the solution must handle
OCR pre-fill, full manual editing, and durable persistence without breaking
the existing expenses CRUD flow.

Open choices at the start of this feature:

1. **Storage shape** — where to store items relative to the `expenses` row.
2. **`line_total` derivation** — stored vs generated.
3. **Write path** — how to keep expense + items consistent without a
   two-phase client commit.
4. **Update strategy** — how to handle edits to an existing item set.
5. **`user_id` on items** — join-based RLS vs denormalized column.
6. **Migration file practice** — established baseline for future features.

---

## Decision

### 1. Separate `expense_items` table (not JSONB)

Items live in `public.expense_items` — a child table with a foreign key
`expense_id uuid references public.expenses(id) on delete cascade`.

JSONB on the `expenses` row was attractive for its simplicity, but a
relational table gives us:

- DB-level constraints on `name`, `quantity`, `line_total` (no partial
  validation in application code).
- Indexed access by `expense_id` and `user_id`.
- A clear hook for the AI insights pipeline (Pillar 3 roadmap) to query
  items without unpacking JSONB.
- Consistent shape with the rest of the schema (all entities are rows,
  not embedded JSON blobs).

### 2. `line_total` stored, not generated

`line_total` is a regular `numeric(14,2)` column rather than a generated
column (`GENERATED ALWAYS AS (quantity * unit_price)`). Reasons:

- Argentine printed tickets show the line total directly; it is the
  authoritative number, not a derivation.
- `unit_price` is nullable — many items on thermal receipts omit it.
- Fractional quantities (weight items, e.g. 0.750 kg) produce rounding
  differences between `qty × unit_price` and the printed total.
- Allowing the user to type `line_total` directly and have the DB validate
  it (via `check (line_total >= 0)`) is simpler than a generated column
  that would conflict with manual overrides.

`quantity` defaults to `1` and is `numeric(14,3)` to support weight sales.

### 3. Atomic write via RPC (`security invoker`)

Two Postgres functions handle all writes:

- **`create_expense_with_items`** — inserts the `expenses` row and all
  `expense_items` rows in a single PL/pgSQL block. One network round-trip;
  either both succeed or neither does.
- **`update_expense_with_items`** — updates the `expenses` row via a sparse
  JSONB patch (only keys present in `p_patch` are touched) and optionally
  replaces the item set.

Both functions are declared `security invoker` (caller's RLS applies) with
`set search_path = ''` (no schema-injection risk). `user_id` is always
read from `auth.uid()` inside the function — the client never supplies it.

The repository's `createExpense` always routes through the RPC (even when
`items` is empty), keeping a single code path. `updateExpense` uses the RPC
only when `input.items !== undefined`; otherwise it falls back to a direct
column update that leaves items untouched.

### 4. Update = delete-all + reinsert

When `p_items` is a non-null JSONB array (including `[]`), the function:

1. `DELETE FROM expense_items WHERE expense_id = p_id`
2. Inserts the new set with `position` assigned sequentially (0, 1, 2 …).

This is the simplest strategy that guarantees the stored set exactly matches
what the user submitted. `position` is preserved from the in-order insert.

**Known limitation:** item UUIDs rotate on every update. If a future HU
needs stable item identity across saves (e.g. per-item comments, split
assignment), the update strategy must change to a diff-based upsert keyed
on a stable client-generated id.

### 5. Denormalized `user_id` on `expense_items`

`expense_items` carries its own `user_id uuid references auth.users`. The
four RLS policies use `(select auth.uid()) = user_id` — the same cached
subquery pattern as `expenses` — rather than a join through `expense_id`.

A join-based policy (`(SELECT user_id FROM expenses WHERE id = expense_id) = auth.uid()`)
would execute a correlated subquery per row, which is expensive and harder
for Postgres to plan efficiently at scale. Denormalizing `user_id` makes
the policy identical to every other table in the schema and avoids the
per-row join.

The RPC always writes `user_id = auth.uid()` — the client cannot supply a
different value.

### 6. Versioned migrations in `supabase/migrations/`

This feature introduces the `supabase/migrations/` directory as the
canonical migration history for the repo. All four applied migrations are
now tracked as files:

| File                                                   | Content                                                   |
| ------------------------------------------------------ | --------------------------------------------------------- |
| `20260517025226_init_profiles_categories_expenses.sql` | Baseline (reconstructed from introspection)               |
| `20260518005107_add_first_last_name_to_profiles.sql`   | Baseline (reconstructed from introspection)               |
| `20260603152601_create_expense_items.sql`              | `expense_items` DDL + RLS + trigger                       |
| `20260603152639_expense_items_rpc.sql`                 | `create_expense_with_items` + `update_expense_with_items` |

The two baseline files are marked **do not re-apply** — they document what
exists remotely. All future migrations follow the same naming convention
(`<timestamp>_<name>.sql`) and are applied to the remote project via
Supabase MCP `apply_migration` using the same filename as the key.

---

## Alternatives considered

### A. JSONB column on `expenses`

`expenses.items jsonb default '[]'` would avoid a new table and a foreign
key. Rejected because: no column-level DB constraints on item shape; no
indexable access; item data is opaque to the AI insights pipeline without
parsing JSON at query time; inconsistent with the rest of the schema.

### B. Join-based RLS on `expense_items`

```sql
using ((select user_id from public.expenses where id = expense_id) = auth.uid())
```

Rejected: correlated subquery per row is expensive and unoptimizable by
the planner. The denormalized `user_id` is the same pattern used by
`expenses` itself and adds negligible storage overhead (~16 bytes / row).

### C. Generated `line_total` column

`line_total numeric(14,2) GENERATED ALWAYS AS (quantity * unit_price) STORED`
was considered for data integrity. Rejected because `unit_price` is nullable
(generated columns cannot be null when the source is null without a
`COALESCE`), and Argentine ticket totals often differ from `qty × price`
due to weight rounding — the printed total is the authoritative value.

### D. Client-side two-phase insert (create expense, then insert items)

A client that first creates the `expenses` row and then inserts items in a
separate request risks leaving an orphan expense row if the item insert
fails (network error, constraint violation, session expiry). The RPC
eliminates this class of failure entirely with no extra application logic.

### E. Diff-based update (upsert by stable client id)

The form could generate a stable UUID per item on `append()` and the RPC
could upsert on that key. This preserves item identity across saves but adds
complexity to the RPC and the form state management. Deferred: no HU
currently requires stable item ids; the delete-all approach is correct for
v1.

---

## Consequences

**Benefits:**

- Single network round-trip for create and update with items.
- No orphan expense rows — transactional rollback on any item constraint
  violation.
- RLS on `expense_items` is trivially verifiable (same pattern as
  `expenses`).
- `supabase/migrations/` in the repo gives the team a durable, reviewable
  migration history from here forward.
- `position` column enables deterministic ordering without an ORDER BY on
  `created_at` (which could be non-deterministic for bulk inserts).

**Tradeoffs:**

- Item ids rotate on every save. Callers must not cache item ids client-side
  between edits.
- `update_expense_with_items` with a large item set performs a full delete
  before reinsert — acceptable for ≤ 50 items but worth revisiting if
  the cap is raised significantly.
- The two baseline migration files are documentation-only; they must not be
  re-applied to the remote project (they are annotated with a header comment
  for this reason).

---

## Implementation

1. `supabase/migrations/20260603152601_create_expense_items.sql` — create
   table, indexes, RLS policies, `set_updated_at` trigger.
2. `supabase/migrations/20260603152639_expense_items_rpc.sql` — both RPCs.
3. `lib/schemas/ocr.ts` — add `ocrItemSchema` + `OcrResult.items`.
4. `lib/schemas/expense.ts` — add `expenseItemInputSchema` + `items` field.
5. `lib/ocr.ts` — add `mapOcrItems`; update `mapOcrToPrefill` to set
   `prefill.items`.
6. `lib/repositories/expenses.ts` — `ExpenseWithItems` type, `toRpcItem`,
   updated `createExpense` and `updateExpense`.
7. `components/expenses/expense-items-field.tsx` — new component with
   `useFieldArray`, qty × price recompute, mismatch warning.
8. `components/expenses/expense-form.tsx` — mount `ExpenseItemsField`.
9. `app/(protected)/expense/review.tsx` — include items in `hasOcrData`
   check.
