# Expenses CRUD

Personal expense tracking — create, list, filter, edit, delete — with
Supabase persistence. Foundation for the shared/groups flow.

---

## What ships

| Capability          | Surface                               | Notes                                                           |
| ------------------- | ------------------------------------- | --------------------------------------------------------------- |
| Register an expense | `app/(protected)/expense/new.tsx`     | Amount + currency + category + description + occurred_at        |
| Browse history      | `app/(protected)/(tabs)/expenses.tsx` | Day-grouped FlatList, totals header, pull-to-refresh            |
| Filter + search     | `components/expenses/filter-bar.tsx`  | Description ilike, currency multi-toggle, category multi-select |
| Edit                | `app/(protected)/expense/[id].tsx`    | Same form, hydrated from row                                    |
| Delete              | `app/(protected)/expense/[id].tsx`    | Native `Alert` confirm + destructive button                     |
| Home dashboard      | `app/(protected)/(tabs)/index.tsx`    | Balance hero (ARS + USD) + last 4 expenses                      |

---

## Architecture

```
app/(protected)/(tabs)/expenses.tsx       ← list screen
app/(protected)/expense/new.tsx           ← create
app/(protected)/expense/[id].tsx          ← edit / delete
        │
        ▼
hooks/use-expenses.ts                     ← TanStack Query, cache, mutations
        │
        ▼
lib/repositories/expenses.ts              ← supabase-js calls, typed results
        │
        ▼
Supabase Postgres + RLS                   ← profiles / categories / expenses
```

### State split

- **Server state** (rows, totals, categories): TanStack Query, keys in
  `expenseKeys` / `categoryKeys`.
- **UI state** (filter form, current screen toggles): plain `useState`,
  `useDeferredValue` for search debounce.
- **Auth session**: existing `useAuthStore` (Zustand) — RLS uses it.

### Cache invalidation

- All mutations call `invalidateQueries({ queryKey: expenseKeys.all })`
- `useUpdateExpense` additionally calls `setQueryData(expenseKeys.detail(id))`
  so the detail screen sees the new values without a roundtrip.
- `useDeleteExpense` removes the detail key from the cache.

---

## DB schema

Migration `init_profiles_categories_expenses` (applied via Supabase MCP).

### `profiles`

1:1 with `auth.users(id)`. On every new auth user, a trigger inserts a
matching profile row (`display_name` defaulted to the email prefix). RLS
allows users to read/update only their own row.

### `categories`

Global lookup. Seeded with 9 rows: comida, supermercado, transporte,
ocio, salud, hogar, servicios, viajes, otro. Each row carries:

| Column       | Type        | Why                           |
| ------------ | ----------- | ----------------------------- |
| `slug`       | text unique | machine-friendly identifier   |
| `name`       | text        | ES display label              |
| `icon`       | text        | lucide-react-native icon name |
| `color`      | text        | hex from the DS palette       |
| `sort_order` | int         | UI ordering                   |

RLS: `SELECT` open to any authenticated user; INSERT/UPDATE/DELETE only via
service_role (no policy = denied).

### `expenses`

| Column        | Type               | Notes                       |
| ------------- | ------------------ | --------------------------- |
| `id`          | uuid PK            | default `gen_random_uuid()` |
| `user_id`     | uuid FK auth.users | `on delete cascade`         |
| `amount`      | numeric(14,2)      | `check (amount > 0)`        |
| `currency`    | text               | `check in ('ARS','USD')`    |
| `category_id` | uuid FK categories | `on delete set null`        |
| `description` | text               | `char_length <= 240`        |
| `occurred_at` | timestamptz        | default `now()`             |
| `created_at`  | timestamptz        | default `now()`             |
| `updated_at`  | timestamptz        | trigger keeps it fresh      |

Indexes: `(user_id, occurred_at desc)`, `(category_id)`, `(currency)`.

RLS: owner can CRUD only rows where `auth.uid() = user_id`.

---

## Forms

`lib/schemas/expense.ts` defines:

- `createExpenseSchema` — full validation
- `updateExpenseSchema` — `.partial()` of above
- `expenseFilterSchema` — search / currencies / categoryIds / from / to /
  limit / offset

All error messages are Spanish rioplatense.

---

## Money formatting (`lib/format/money.ts`)

- `formatMoney(amount, 'ARS' | 'USD', { showPlus, hideCurrency })`
- `parseAmount(text)` — handles `12.500,50` / `12500.50` / `100,5`
- Uses `Intl.NumberFormat` with a manual `\B(?=(\d{3})+(?!\d))` fallback
  for engines without ICU.

Numbers always render with `font-variant-numeric: tabular-nums` — the
numbers ARE the UI per DS rules.

---

## Components added

- `components/expenses/amount-input.tsx` — JetBrains-Mono 32px input,
  currency-aware prefix, cleans non-numeric chars on the fly.
- `components/expenses/currency-toggle.tsx` — ARS/USD pill segment.
- `components/expenses/category-picker.tsx` — horizontal-scroll chips,
  single-select for the form.
- `components/expenses/expense-form.tsx` — shared create/edit form.
- `components/expenses/expense-row.tsx` — list-row primitive with icon
  circle, description, category, signed amount.
- `components/expenses/filter-bar.tsx` — search + currency + category
  multi-select bar.

---

## Testing

35 new tests:

- `lib/format/__tests__/money.test.ts` — 11
- `lib/repositories/__tests__/expenses.test.ts` — 8
- `hooks/__tests__/use-expenses.test.tsx` — 9
- `components/expenses/__tests__/filter-bar.test.tsx` — 5
- `app/(protected)/expense/__tests__/new.test.tsx` — 4
- `app/(protected)/expense/__tests__/edit.test.tsx` — 4
- Home tests updated to wrap in `QueryClientProvider`

Total suite: 197 / 197 passing.

---

## Out of scope

- Income / "te deben" amounts (sign-bearing). All rows are treated as
  expenses (`amount > 0`).
- FX conversion ARS ↔ USD.
- Trigram search index (using `ilike` for v1).
- Receipt OCR via camera (placeholder tab exists).
- Date picker for `occurred_at` — `new.tsx` uses `now()` for now.
- Groups + shared splits — separate feature.

---

## Next steps

1. `occurred_at` date picker on the new-expense screen (RN community
   date-time-picker or in-house calendar).
2. Income flow + signed amounts.
3. ARS/USD FX (BCRA or Bluelytics).
4. Receipt OCR pipeline.
5. Groups + splits.
