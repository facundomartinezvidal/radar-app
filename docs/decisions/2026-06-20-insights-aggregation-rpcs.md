# ADR: Insights aggregation RPCs and AI recommendations architecture

**Date:** 2026-06-20
**Status:** Accepted
**Scope:** `radar-app` — HU-23 (filtros temporales Insights) + HU-24 (gráfico de barras gastos)

---

## Context

RADAR persists expenses, incomes, and shared-expense splits but had no analytical surface.
The Insights tab was a "Próximamente" placeholder. Building charts requires aggregated data
per category and per time bucket, which raises several open choices:

1. **Where to aggregate** — in Postgres (RPCs) or on the client (fetch all rows, reduce).
2. **Share-aware rule** — shared-expense splits must count only the user's portion, the same
   logic already in `get_personal_totals`. Whether to duplicate or reuse it.
3. **Security model** for the RPCs — SECURITY INVOKER vs SECURITY DEFINER.
4. **Canonical date column** — `expenses` and `incomes` both have `occurred_at`
   (timestamptz) and `occurred_date` (DATE). Which to filter/bucket on.
5. **Multi-currency approach** — FX conversion vs currency-scoped queries.
6. **AI recommendations resilience** — what happens when Groq is unavailable.

---

## Decision

### 1. Aggregation in Postgres (SECURITY INVOKER RPCs), not client-side

Fetching all expense or income rows to the client and reducing them there was rejected:

- **Scale**: a user with 12 months of history has hundreds to thousands of rows. An
  unbounded fetch just to sum them is wasteful and slow on mobile.
- **Share-aware correctness**: the share-aware CASE expression (see §2) must join
  `expense_splits` — that join is far cheaper in Postgres than on the client.
- **`date_trunc` for bucketing**: Postgres `date_trunc` handles time-zone-aware bucketing
  cleanly. Client-side bucketing would require transporting raw timestamps and running
  equivalent logic in JavaScript.

Three RPCs are introduced:

```sql
-- Returns (category_id, category_name, color, icon, total, count)
get_expense_by_category(p_currency text, p_from timestamptz, p_to timestamptz)

-- Returns (bucket date, total numeric, count bigint)
-- p_bucket ∈ {'day','week','month'}
get_expense_by_period(p_currency text, p_bucket text, p_from timestamptz, p_to timestamptz)

-- Returns (bucket date, total numeric, count bigint)
get_income_by_period(p_currency text, p_bucket text, p_from timestamptz, p_to timestamptz)
```

Charts 3 (income-vs-expense) and 4 (monthly trend) are composed client-side by joining
monthly buckets of `get_expense_by_period` and `get_income_by_period` by date — no
additional RPC is needed.

Migrations:

- `supabase/migrations/20260620222455_get_expense_by_category.sql`
- `supabase/migrations/20260620222511_get_expense_by_period.sql`
- `supabase/migrations/20260620222530_get_income_by_period.sql`

### 2. Share-aware CASE expression — verbatim reuse from `get_personal_totals`

For expense aggregation RPCs, the effective amount per row is:

```sql
CASE
  WHEN e.group_id IS NULL THEN e.amount
  ELSE COALESCE(
    (SELECT es.share_amount
     FROM expense_splits es
     JOIN group_members gm ON gm.id = es.member_id
     WHERE es.expense_id = e.id
       AND gm.user_id = auth.uid()),
    0
  )
END
```

This is identical to the rule in `get_personal_totals`. It ensures that group expenses
contribute only the user's allocated share — never the full group amount.

This CASE was deliberately not extracted into a helper function. Inlining it in each RPC
makes the SQL self-contained and avoids a three-way dependency chain between functions that
could complicate migrations or reviews.

### 3. SECURITY INVOKER (not DEFINER) — RLS is sufficient

SECURITY INVOKER means the RPC executes under the caller's session role and is therefore
subject to the existing RLS policies on `expenses`, `incomes`, `expense_splits`, and
`group_members`. No privilege escalation occurs; no explicit REVOKE/GRANT is required.

SECURITY DEFINER was not used because:

- The RPCs do not need elevated privileges — they only read data the caller already owns.
- DEFINER requires explicit REVOKE from `anon` and `authenticated` to prevent unintended
  access via PostgREST (Pattern 1 in AGENTS.md §7 — applied to `materialize_due_expenses`
  and `materialize_due_incomes` where it is genuinely necessary).
- INVOKER is the simpler and safer default for read-only, user-scoped aggregation.

### 4. Filter on `occurred_at` (timestamptz), not `occurred_date` (date)

Both `expenses` and `incomes` carry `occurred_at timestamptz` and `occurred_date date`.
The `WHERE occurred_at BETWEEN p_from AND p_to` clause was chosen for two reasons:

- **Consistent with existing indexes**: `(user_id, occurred_at DESC)` exists on both tables.
  Filtering on `occurred_at` lets Postgres use these indexes without additional index
  creation.
- **`date_trunc` compatibility**: `date_trunc(p_bucket, occurred_at)` returns a
  `timestamptz`/`timestamp` value that Postgres can bucket and group on directly.

`occurred_date` remains the correct column for recurrence idempotency indexes (see
[recurring-expenses ADR](./2026-06-08-recurring-expenses-schema.md)) but is not the
right filter target for analytics.

### 5. Multi-currency via toggle — no FX conversion

Each RPC accepts a `p_currency text` parameter (`'ARS'` or `'USD'`) and filters rows by
currency. The client holds a `CurrencyToggle` (single-select) and passes its value to all
three RPCs.

ARS/USD FX conversion is deferred project-wide (the FX data source — BCRA vs Bluelytics —
has not been decided; see AGENTS.md §10 "Still pending"). The toggle approach means
multi-currency charts are fully functional today with zero FX risk.

### 6. AI edge function `generate-insights` with local-heuristics fallback

A new Supabase edge function (`supabase/functions/generate-insights/index.ts`) clones the
`extract-receipt` pattern:

- Bearer JWT required; `auth.getUser()` validates the caller.
- `GROQ_API_KEY` Supabase secret; `_shared/cors.ts` for CORS headers.
- Model: Groq `llama-4-scout-17b`, `response_format: { type: 'json_object' }`,
  `temperature: 0`.
- `AbortController` with ~15 s timeout guards against slow Groq responses.
- Input: client-computed aggregates — the function never queries the database directly
  (aggregates are already RLS-filtered by the hooks before the call).
- Output: `{ data: { insights: InsightItem[] } }`, normalized and capped to 4 items
  (mirrors `normaliseOcrResult` pattern from `extract-receipt`).

The `useAiInsights` hook wraps the call in a `try/catch`:

```typescript
queryFn: async () => {
  try {
    return await generateInsights(payload);
  } catch {
    return buildLocalInsights(payload);
  }
};
```

`buildLocalInsights` in `lib/insights/heuristics.ts` runs purely client-side rules
(top category by spend, expense-to-income ratio, month-over-month variance) and always
returns up to 4 Spanish insights. The user never sees a failure state for the AI card.

`staleTime: 3600_000` (1 h) per `(period.label, currency)` key limits Groq API calls to
at most one per hour per unique filter combination.

---

## Alternatives considered

### A. Client-side aggregation (fetch all rows, reduce in JS)

Rejected. Unbounded fetches are slow on mobile; the share-aware join would require
fetching `expense_splits` separately and joining in JavaScript — error-prone and expensive.

### B. SECURITY DEFINER for the aggregation RPCs

Rejected. The RPCs only read data the caller owns. RLS is the appropriate gate; DEFINER
would add unnecessary complexity and require REVOKE patterns (Pattern 1) that are reserved
for privileged server-side operations like `materialize_due_expenses`.

### C. Filter on `occurred_date` (date column) in RPCs

Rejected. `occurred_date` is nullable on manual entries and was introduced specifically for
the recurrence idempotency index (not as a general-purpose filter column). `occurred_at`
has the relevant index and is always set on every row.

### D. FX conversion at query time

Rejected. The FX data source is not decided. Converting in the RPC would require an FX
table that does not exist; converting client-side would require a reliable rate feed.
The toggle provides full multi-currency support without any of these dependencies.

### E. Persist AI insights in a database table

Rejected. AI insights are derived from data the client already has. Persisting them would
add a write RPC, a migration, and an invalidation strategy. Client-side TanStack caching
(`staleTime: 1h`) achieves equivalent behavior with no schema change.

### F. `victory-native` for charts

Rejected. victory-native requires Skia (`react-native-skia`) which is a native module.
It cannot run in Expo Go SDK 54 — it requires a dev client build. `react-native-gifted-charts`
is pure JS over `react-native-svg` (already installed) and runs in Expo Go.

---

## Consequences

**Benefits:**

- All charts render accurately from aggregated data — no over-fetching.
- Share-aware rule is reused verbatim; no risk of divergence with `get_personal_totals`.
- SECURITY INVOKER keeps the model simple; no REVOKE bookkeeping.
- AI card is always useful — Groq outage or quota exhaustion degrades gracefully to
  local heuristics without user-visible error.
- Multi-currency toggle works today without waiting for FX data source decision.

**Tradeoffs:**

- Three new RPCs to maintain; their share-aware CASE expression is inlined (not shared
  via a helper function) — if the share logic changes, it must be updated in all three.
- `react-native-gifted-charts` adds a dependency. If the library is abandoned, charts
  require a migration to another library.
- AI insights are not persisted — re-opening the tab after the 1-hour stale window
  triggers a new Groq call (bounded cost, acceptable UX).

---

## Implementation

1. `supabase/migrations/20260620222455_get_expense_by_category.sql` — SECURITY INVOKER RPC;
   share-aware CASE; joins `categories` for name/color/icon; filters by `p_currency` and
   `occurred_at BETWEEN p_from AND p_to`.
2. `supabase/migrations/20260620222511_get_expense_by_period.sql` — SECURITY INVOKER RPC;
   share-aware CASE; `date_trunc(p_bucket, occurred_at)` grouping.
3. `supabase/migrations/20260620222530_get_income_by_period.sql` — SECURITY INVOKER RPC;
   `date_trunc(p_bucket, occurred_at)` grouping on `incomes`.
4. `lib/insights/types.ts` — `InsightPeriod`, `InsightItem`, `AggregateRow` types.
5. `lib/insights/periods.ts` — `PRESETS` (four entries), `buildMonthPreset`, `getDateRange`.
6. `lib/insights/heuristics.ts` — `buildLocalInsights(input)` — local fallback.
7. `lib/insights/client.ts` — `generateInsights(payload)` — calls edge function.
8. `lib/repositories/insights.ts` — `fetchExpenseByCategory`, `fetchExpenseByPeriod`,
   `fetchIncomeByPeriod`; all return `{ data, error }` with `Number(row.total)`.
9. `hooks/use-insights.ts` — `insightKeys` factory; five hooks; `useAiInsights` with
   `staleTime: 3600_000` and try/catch fallback.
10. `components/insights/` — seven chart/UI components using `react-native-gifted-charts`.
11. `app/(protected)/(tabs)/explore.tsx` — full Insights screen replacing placeholder.
12. `supabase/functions/generate-insights/index.ts` — edge function.
