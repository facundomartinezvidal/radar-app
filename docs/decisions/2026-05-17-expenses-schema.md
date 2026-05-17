# ADR: Expenses data model

**Date:** 2026-05-17
**Status:** Accepted
**Scope:** mobile app (`radar-app`) + Supabase Postgres

---

## Context

RADAR's first piece of business logic is personal expense tracking. The
target persona (Argentine young adults 18–35) tracks money across multiple
wallets and two currencies (ARS, USD). Subsequent features — shared
expenses, AI insights, multi-currency dashboards — all read from the same
`expenses` table, so getting the shape right early matters.

Constraints we accepted up front:

- **Single Postgres backend** — Supabase. No separate cache or write-path.
- **Row-level security per user** — every read/write must enforce
  `auth.uid() = user_id` from the start, not as a follow-up.
- **No client trust** — the app passes `user_id` because RLS `with check`
  requires it to match `auth.uid()`, but the constraint is server-side.
- **Mobile-first, offline-tolerant later** — we don't try to solve offline
  in v1 but we don't model anything that would block it (no DB-side joins
  the app can't replicate).
- **Spanish rioplatense everywhere** — including category names. The
  taxonomy is fixed for v1.

---

## Decision

### Tables

`profiles` (1:1 with `auth.users`), `categories` (global lookup),
`expenses` (the heart of the feature).

Full DDL lives in the migration; key shape decisions are recorded below.

### `expenses.amount` — `numeric(14,2)`, positive

`numeric(14,2)` survives ARS hyperinflation comfortably (up to
`999,999,999,999.99`) without the rounding pitfalls of `double precision`.
The `check (amount > 0)` constraint makes "expense" semantically explicit;
income / "te deben" will arrive as a separate flow with its own sign or its
own table — TBD.

### `expenses.currency` — `text check ('ARS','USD')`

Two-currency reality of the target market. Kept as `text` + check
constraint instead of a Postgres enum because Supabase migrations through
the dashboard are easier on `text`, and we don't expect dozens of
currencies. We can add `EUR`/`BRL` later by relaxing the check; we will
never need `decimal` symbols.

### `expenses.occurred_at` vs `created_at`

Distinct columns. `created_at` is the audit timestamp (when the row landed
in the DB); `occurred_at` is the user-meaningful "when did this happen".
The list/totals UI sorts and groups by `occurred_at`. The index
`(user_id, occurred_at DESC)` reflects that.

### `categories` is a global lookup, not per-user

Rationale: the v1 taxonomy is fixed by product design (9 categories
covering ~95% of personal spend in our research). Per-user categories
would mean joins, free-form chaos, and dead categories. We will add a
"custom category" flow as a separate feature with its own table or its own
`user_id` nullable column — not now.

`categories.icon` stores a `lucide-react-native` icon **name** (string),
not a path or SVG blob. The client maps it to the actual icon component.
Same for `categories.color` (hex string from the DS palette).

### RLS policies

- `profiles` — owner select/insert/update; no delete (account deletion is
  a separate sensitive flow).
- `categories` — `select` open to authenticated; mutations require
  `service_role`.
- `expenses` — owner select/insert/update/delete.

All policies use the `(select auth.uid())` form so Postgres can cache the
subquery per statement.

### Auto profile creation trigger

`handle_new_user()` on `auth.users insert` creates the matching
`profiles` row, with `display_name` defaulted to the email prefix. This
removes a class of "missing profile" bugs we'd otherwise hit on first
login.

---

## Alternatives considered

### A. Single `transactions` table (income + expense)

Discarded for now. Mixing signed amounts ties the schema to a money-flow
direction it doesn't need yet, complicates RLS reasoning, and makes the
queries we ship for v1 (sums, grouping, category breakdown) less obvious.
We can add `direction in ('in','out')` later or a separate `incomes`
table — neither breaks the current model.

### B. Per-user `categories`

Discarded — see "decision" above. The v1 product wants a stable taxonomy
for the AI insights pipeline to lock on.

### C. UUID `category_id` constraint client-side via zod `.uuid()`

Discarded. The DB FK already enforces validity; client-side `.uuid()` was
brittle in tests with non-UUID fixtures and added no value once RLS is on.

### D. Postgres-side aggregate views for "totals by currency"

Deferred. We do the aggregation client-side (`sumExpensesByCurrency` in
the repo) because the dataset is small (< 1k rows per user typical) and
the cache layer (TanStack Query) makes it cheap. A view becomes useful
when groups + splits arrive.

---

## Consequences

- Schema is friendly to the next two features (groups + AI insights)
  without rework — they reference `expenses.id` + `expenses.user_id`.
- `numeric(14,2)` round-trips through `supabase-js` as `string` JSON when
  precision matters. The repo and components cast via `Number(...)` for
  display; this is fine for ARS amounts that fit in JS number range (no
  loss until ~9 quadrillion).
- Generated TS types (`types/supabase.ts`) treat `amount` as `number`,
  which matches the repo's runtime cast. If we ever exceed JS-safe
  integers, we'll switch to a `string`-typed wrapper.
- No "categories" UI for users to manage exists — they cannot rename or
  add categories in v1. This is a deliberate UX call.

---

## How to evolve this

- **Add `EUR` / `BRL`**: drop and re-create `currency`'s check
  constraint via a migration; update `CURRENCIES` in
  `lib/schemas/expense.ts`; add FX rates.
- **Per-user categories**: add `user_id uuid` nullable + index, change
  the RLS policy to allow owner CRUD on rows where `user_id is not null`.
- **Income flow**: add `kind text check ('expense','income')` with
  default `expense`; or split into a sibling table — the call depends on
  the AI/insights surface.
