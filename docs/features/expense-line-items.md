# Expense line items

Receipt line-item detail per expense — OCR pre-fill, full manual CRUD,
and atomic Postgres persistence. Covers HU-18.

---

## What ships

| Capability                 | Surface                                                       | Notes                                        |
| -------------------------- | ------------------------------------------------------------- | -------------------------------------------- |
| OCR item extraction        | `supabase/functions/extract-receipt/index.ts`                 | `normaliseItems` + 50-item cap               |
| OCR → form prefill         | `lib/ocr.ts` `mapOcrItems`                                    | Drops empty names; lineTotal fallback chain  |
| Line-item field array (UI) | `components/expenses/expense-items-field.tsx`                 | Collapsible, qty × price recompute, mismatch |
| Atomic create              | `lib/repositories/expenses.ts` `createExpense`                | RPC `create_expense_with_items`              |
| Atomic update              | `lib/repositories/expenses.ts` `updateExpense`                | RPC `update_expense_with_items`              |
| Cascading read             | `lib/repositories/expenses.ts` `EXPENSE_WITH_CATEGORY_SELECT` | Single nested select                         |

---

## Requirements

### User story

> As a user who scans a receipt, I want to see and edit the line-item breakdown
> (name, quantity, unit price, line total) to know exactly what makes up my expense.

Line items are also available on manually entered expenses — OCR pre-fill is
optional, not required.

### Functional requirements

| #   | Requirement                                                                                                              |
| --- | ------------------------------------------------------------------------------------------------------------------------ |
| 1   | OCR returns `items[]`; empty array when no detail is legible                                                             |
| 2   | Full manual CRUD: add / edit / remove items in the form before saving                                                    |
| 3   | Fields: `name` (required, max 120 chars) + `quantity` (decimal, > 0) + `unit_price` (nullable) + `line_total` (required) |
| 4   | `qty × unit_price` recomputes `line_total`; manually editing `line_total` wins                                           |
| 5   | Mismatch warning when `abs(Σ line_total − amount) > 0.5` — non-blocking, amber                                           |
| 6   | Expense total (`amount`) always governs; item sum is informational only                                                  |
| 7   | Create and update are transactional (RPC); a partial failure rolls back everything                                       |
| 8   | Update preserving items: pass `items: undefined` — leaves existing items untouched                                       |
| 9   | Expenses without items work identically to pre-HU-18 behavior (backward compat)                                          |
| 10  | Cap: max 50 items enforced in edge function, zod schema, and RPC                                                         |

---

## Architecture / data flow

```
extract-receipt (edge fn)
  └─ normaliseItems()          ← drops nameless items, caps at 50
        │
        ▼  OcrItem[] (camelCase)
lib/schemas/ocr.ts
  └─ ocrItemSchema             ← defensive .catch() on every field
        │
        ▼  OcrItem[]
lib/ocr.ts
  └─ mapOcrItems()             ← quantity default 1, lineTotal fallback, trim names
  └─ mapOcrToPrefill()         ← sets prefill.items when mapped items > 0
        │
        ▼  ReceiptPrefill.items?: ExpenseItemInput[]
app/(protected)/expense/review.tsx
  └─ <ExpenseForm prefill={...}>
        │
        ▼
components/expenses/expense-items-field.tsx
  └─ useFieldArray('items')    ← add / remove / edit
  └─ mismatch warning          ← |Σ items − amount| > 0.5
        │
        ▼  CreateExpenseInput / UpdateExpenseInput
lib/repositories/expenses.ts
  └─ createExpense()           ← create_expense_with_items RPC (transactional)
  └─ updateExpense()           ← update_expense_with_items RPC when items present
        │                        direct column update when items === undefined
        ▼
Supabase Postgres
  └─ public.expense_items      ← RLS owner-only, cascade delete from expenses
```

---

## Key files

| File                                                          | Role                                                      |
| ------------------------------------------------------------- | --------------------------------------------------------- |
| `supabase/migrations/20260603152601_create_expense_items.sql` | `expense_items` DDL + RLS + trigger                       |
| `supabase/migrations/20260603152639_expense_items_rpc.sql`    | `create_expense_with_items` + `update_expense_with_items` |
| `supabase/functions/extract-receipt/index.ts`                 | Edge fn — `normaliseItems`, Groq prompt updated for items |
| `lib/schemas/ocr.ts`                                          | `ocrItemSchema` + `OcrResult.items`                       |
| `lib/schemas/expense.ts`                                      | `expenseItemInputSchema` + `items` field on create/update |
| `lib/ocr.ts`                                                  | `mapOcrItems`, `mapOcrToPrefill` (sets `prefill.items`)   |
| `lib/repositories/expenses.ts`                                | `createExpense`, `updateExpense`, `ExpenseWithItems` type |
| `components/expenses/expense-items-field.tsx`                 | Collapsible field-array section in `ExpenseForm`          |
| `components/expenses/expense-form.tsx`                        | Mounts `ExpenseItemsField`; passes `prefill.items`        |
| `app/(protected)/expense/review.tsx`                          | OCR screen — `hasOcrData` includes items check            |

---

## DB schema

### `public.expense_items`

| Column       | Type          | Constraints                                   |
| ------------ | ------------- | --------------------------------------------- |
| `id`         | uuid PK       | `gen_random_uuid()`                           |
| `expense_id` | uuid FK       | `references expenses(id) on delete cascade`   |
| `user_id`    | uuid FK       | `references auth.users(id) on delete cascade` |
| `name`       | text          | `not null`; btrim length 1–120                |
| `quantity`   | numeric(14,3) | `not null default 1`; `check (quantity > 0)`  |
| `unit_price` | numeric(14,2) | nullable; `check (unit_price >= 0)`           |
| `line_total` | numeric(14,2) | `not null`; `check (line_total >= 0)`         |
| `position`   | integer       | `not null default 0`                          |
| `created_at` | timestamptz   | `not null default now()`                      |
| `updated_at` | timestamptz   | trigger `set_updated_at()`                    |

Indexes: `(expense_id)`, `(user_id)`.

RLS: four owner-only policies (`select`/`insert`/`update`/`delete`) using
`(select auth.uid()) = user_id` — the cached subquery form matching the
pattern on `expenses`.

### RPCs

**`create_expense_with_items(p_amount, p_currency, p_category_id, p_description, p_occurred_at, p_items jsonb)`**

Inserts the expense row and all items in a single transaction. `p_items`
defaults to `'[]'` when omitted. Returns the new `expenses` row.

**`update_expense_with_items(p_id, p_patch jsonb, p_items jsonb)`**

- `p_patch` — sparse object; only keys present are updated.
- `p_items null` — items left untouched.
- `p_items` array (including `[]`) — existing items deleted, new set inserted.

Both functions run as `security invoker` with `set search_path = ''`; they
read `auth.uid()` from the session and inject it as `user_id` — the client
never supplies a `user_id`.

---

## Edge cases

| Scenario                                              | Behavior                                                                                            |
| ----------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Ticket with no line-item detail                       | `items: []` — form section empty, no warning                                                        |
| OCR payload off-spec (items not an array)             | `normaliseItems` returns `[]`; client `z.array(...).catch([])` → `[]`                               |
| Item name empty or whitespace                         | Dropped silently in edge fn and `mapOcrItems`                                                       |
| `lineTotal` null but qty + unitPrice available        | `round2(qty × unitPrice)` computed in `mapOcrItems`                                                 |
| `lineTotal` null and no usable qty/price              | Item kept with `line_total: 0`; mismatch warning fires                                              |
| Fractional quantities (0.750 kg)                      | `numeric(14,3)` stores; qty × price discrepancy surfaces as mismatch                                |
| Negative amounts (discount line)                      | Coercion rejects negatives; discount appears as total mismatch (warning text mentions "descuentos") |
| > 50 items                                            | Capped in edge fn; zod `max(50)` on form; RPC raises exception                                      |
| RPC partial failure                                   | Transaction rolls back; no orphaned expense row                                                     |
| Update without touching items (`items === undefined`) | Direct column update path; items unchanged                                                          |
| Update explicitly clearing items (`items: []`)        | delete-all + reinsert with empty set                                                                |
| Pre-HU-18 expenses                                    | Nested select returns `items: []`; no data migration needed                                         |
| Delete expense                                        | `on delete cascade` removes all child items automatically                                           |

---

## Known limitations

- **Item ids rotate on update.** `update_expense_with_items` deletes all rows and
  reinserts. If a future feature needs stable item identity between saves, the
  update strategy must change (diff-based or upsert-by-stable-key).
- **No negative line items.** Discount rows on Argentine receipts (e.g. loyalty
  discounts) are dropped; they contribute to the `|Σ − total|` mismatch. The
  mismatch warning text acknowledges "descuentos o propinas".
- **No per-item category.** Each expense has a single category; items inherit it.
- **No cross-item search.** The history filter searches `expenses.description`,
  not item names.

---

## Microcopy

| Context                   | Copy                                                                                                |
| ------------------------- | --------------------------------------------------------------------------------------------------- |
| Section header            | `Detalle` / `Detalle · N`                                                                           |
| Add action                | `Agregar ítem`                                                                                      |
| Remove action (a11y)      | `Quitar ítem`                                                                                       |
| Mismatch warning          | `La suma de los ítems ($ X) no coincide con el total ($ Y). Puede deberse a descuentos o propinas.` |
| Name validation error     | `Ingresá un nombre.`                                                                                |
| Quantity validation error | `La cantidad debe ser mayor a cero.`                                                                |
| Max items error           | `Máximo 50 ítems.`                                                                                  |

---

## Related

- Decision record: `docs/decisions/2026-06-03-expense-line-items-schema.md`
- HU spec: `docs/user-flows/HU-18-items-detallados.md`
- Migrations: `supabase/migrations/20260603152601_create_expense_items.sql`,
  `supabase/migrations/20260603152639_expense_items_rpc.sql`
- Foundation: `docs/features/expenses-crud.md`
- OCR pipeline: `docs/features/receipt-scan-ocr.md`
