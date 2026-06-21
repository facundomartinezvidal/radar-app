# Insights (HU-23 + HU-24)

## Overview

The Insights tab (`app/(protected)/(tabs)/explore.tsx`) was a "Próximamente" placeholder.
This feature replaces it with a full analytical surface, closing product pillars 1 (unified
personal tracking) and 3 (AI insights).

- **HU-23 (filtros temporales)**: a filter bar with four presets (Este mes / Mes pasado /
  Últimos 3 meses / Este año) plus a month selector with previous/next navigation. Future
  months are clamped. The active period drives every aggregation query and the AI card.
- **HU-24 (gráfico de barras de gastos)**: an expenses bar chart bucketed by period
  (day/week/month depending on range), reflecting the active temporal filter and currency.
- **Category donut**: expense totals grouped by category, using each category's own color
  and icon. Uncategorized expenses fall into a "Sin categoría" bucket.
- **Income-vs-expense + monthly trend**: two charts composed client-side by joining monthly
  buckets from the expense and income RPCs — no additional RPC needed.
- **AI recommendations**: Spanish actionable insights from the `generate-insights` Groq
  edge function, with a transparent fallback to local heuristics on any failure.
- **Multi-currency**: ARS/USD toggle (reuses `CurrencyToggle`); currencies are never mixed.
- **Empty state**: illustrated empty state when the selected period has no movements.

**Branch:** `feat/insights`
**Release:** Entrega 4
**Complexity:** ALTA
**Test baseline after this feature:** 1668 tests, 102 suites

---

## Requirements

### Functional

| #   | Requirement                                                                      | HU    | Status  |
| --- | -------------------------------------------------------------------------------- | ----- | ------- |
| 1   | Filter all charts by preset (Este mes / Mes pasado / Últimos 3 meses / Este año) | HU-23 | Shipped |
| 2   | Filter by individual month via month selector; future months clamped to today    | HU-23 | Shipped |
| 3   | Toggle ARS / USD; queries re-key; amounts never mixed                            | HU-23 | Shipped |
| 4   | Empty state illustrated when no movements exist for the selected period          | HU-23 | Shipped |
| 5   | Expenses-by-period bar chart reflecting active filter + currency (HU-24)         | HU-24 | Shipped |
| 6   | Category donut chart — one segment per category, color/icon from `categories`    | —     | Shipped |
| 7   | Income-vs-expense chart — monthly bars side-by-side for the selected range       | —     | Shipped |
| 8   | Monthly trend line chart — composed from expense + income monthly bucket data    | —     | Shipped |
| 9   | AI recommendations card — Spanish, actionable, ≤ 4 insights                      | —     | Shipped |
| 10  | AI fallback to local heuristics when Groq fails, times out, or has no quota      | —     | Shipped |

### Non-functional

- **Performance**: aggregation happens in three Postgres RPCs (`get_expense_by_category`,
  `get_expense_by_period`, `get_income_by_period`) — no full table fetches to the client.
  Charts 3 and 4 (income-vs-expense, monthly trend) are composed client-side by joining
  monthly buckets of RPC 2 and RPC 3 by date — no extra RPC needed.
- **Security**: all three RPCs are SECURITY INVOKER under the caller's RLS policies. The
  `generate-insights` edge function requires Bearer JWT + `auth.getUser()`. `GROQ_API_KEY`
  is a Supabase secret; it never reaches the client. The edge function receives aggregates
  computed client-side — it does not query the database.
- **Reliability**: `useAiInsights` catches any throw from `generateInsights` and returns
  `buildLocalInsights(input)` instead. The user never sees an AI error state.
- **Caching**: TanStack Query `staleTime: 3600_000` (1 h) per `(period.label, currency)`
  key for AI insights. Aggregate data uses the default stale time.

---

## Data flow

```
RPCs (Postgres)
  get_expense_by_category(p_currency, p_from, p_to)
  get_expense_by_period(p_currency, p_bucket, p_from, p_to)
  get_income_by_period(p_currency, p_bucket, p_from, p_to)
        ↓
lib/repositories/insights.ts
  fetchExpenseByCategory / fetchExpenseByPeriod / fetchIncomeByPeriod
        ↓
hooks/use-insights.ts
  useExpenseByCategory / useExpenseByPeriod / useIncomeByPeriod
  useTrend  (joins monthly expense + income buckets by date)
  useAiInsights (queryFn → generateInsights → fallback buildLocalInsights)
        ↓
components/insights/*   (charts + filter bar + empty state + AI card)
        ↓
app/(protected)/(tabs)/explore.tsx
```

The `insightKeys` factory in `hooks/use-insights.ts` namespaces all query keys so toggling
currency or changing the period preset invalidates only the relevant queries.

---

## Aggregation RPCs

Three SECURITY INVOKER RPCs added via three migrations. Full schema and decision rationale
are in the [ADR](../decisions/2026-06-20-insights-aggregation-rpcs.md).

### `get_expense_by_category(p_currency, p_from, p_to)`

Returns one row per category with the user's share-aware expense total for the period.

```
Returns: (category_id uuid, category_name text, color text, icon text, total numeric, count bigint)
```

Share-aware rule: for group expenses, the user's share is `share_amount` (from
`expense_splits`); for personal expenses it is `amount`. This mirrors `get_personal_totals`
exactly — never sums full group amounts.

### `get_expense_by_period(p_currency, p_bucket, p_from, p_to)`

Buckets expenses by `date_trunc(p_bucket, occurred_at)`. `p_bucket ∈ {day, week, month}`.

```
Returns: (bucket date, total numeric, count bigint)
```

### `get_income_by_period(p_currency, p_bucket, p_from, p_to)`

Same bucketing pattern as above applied to `incomes`.

```
Returns: (bucket date, total numeric, count bigint)
```

All three RPCs filter on `occurred_at` (the canonical timestamp column on both `expenses`
and `incomes`).

---

## AI recommendations

### Edge function `generate-insights`

File: `supabase/functions/generate-insights/index.ts`

- Clones the `extract-receipt` pattern: Bearer JWT, `auth.getUser()`, `_shared/cors.ts`,
  `AbortController` with ~15 s timeout, `GROQ_API_KEY` secret.
- Model: Groq `llama-4-scout-17b`, `response_format: { type: 'json_object' }`,
  `temperature: 0`.
- Input: client-computed aggregates (already filtered by RLS in the hooks — the function
  never queries the database).
- Output: `{ data: { insights: InsightItem[] } }`, normalized and capped to 4 items client-side
  (mirrors `normaliseOcrResult` pattern).
- System prompt instructs the model to write Spanish, actionable insights and forbids
  inventing numeric amounts outside the input payload.

### Local heuristics fallback

`lib/insights/heuristics.ts` exports `buildLocalInsights(input)`. It computes simple rules
(top spending category, expense-to-income ratio, month-over-month variance) and returns up
to 4 Spanish insights without any network call.

`useAiInsights` wraps `generateInsights` in its `queryFn`:

```typescript
queryFn: async () => {
  try {
    return await generateInsights(payload);
  } catch {
    return buildLocalInsights(payload);
  }
};
```

The user always sees insights — there is no error state for the AI card.

---

## Temporal filters (HU-23)

Implemented in `components/insights/period-filter-bar.tsx` and `lib/insights/periods.ts`.

### Presets

| Label           | `p_from`       | `p_to`       | `p_bucket` |
| --------------- | -------------- | ------------ | ---------- |
| Este mes        | start of month | today        | `week`     |
| Mes pasado      | start of prev. | end of prev. | `week`     |
| Últimos 3 meses | 3 months ago   | today        | `month`    |
| Este año        | Jan 1          | today        | `month`    |

`lib/insights/periods.ts` exports `PRESETS` (the four entries above) and
`buildMonthPreset(year, month)` which produces a `{label, from, to, bucket}` object for
the month selector.

### Month selector

A scrollable month selector renders months from January of the current year to the current
month. Selecting a future month is prevented at the UI level (clamped to today's month per
the `DateField` pattern already established in the codebase).

### Multi-currency toggle

`CurrencyToggle` (existing component) is reused as a single-select ARS / USD toggle. Its
value is passed as `p_currency` to all three RPCs. Queries are re-keyed on currency change
via `insightKeys`; amounts from different currencies are never mixed.

---

## Charts

All charts use `react-native-gifted-charts` (pure JS over `react-native-svg` 15.12.1,
which was already installed). This avoids requiring a dev client (victory-native needs
Skia). `expo-linear-gradient` provides gradient fills.

| Component                                         | Chart type  | Data source                                          |
| ------------------------------------------------- | ----------- | ---------------------------------------------------- |
| `components/insights/category-donut.tsx`          | Donut       | `useExpenseByCategory`                               |
| `components/insights/period-bar-chart.tsx`        | Bar         | `useExpenseByPeriod`                                 |
| `components/insights/income-vs-expense-chart.tsx` | Grouped bar | `useExpenseByPeriod` + `useIncomeByPeriod` (monthly) |
| `components/insights/monthly-trend-chart.tsx`     | Line        | `useTrend` (joined buckets)                          |

Category donut colors and icons come directly from `categories.color` and `categories.icon` —
no hardcoded palette.

---

## Edge cases

| Edge case                                      | Behavior                                                                                    |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Period with no movements                       | `InsightsEmptyState` illustrated component rendered; AI card hidden (insights `[]`)         |
| Group expense in aggregation                   | RPCs sum only `share_amount` for the user (share-aware, identical to `get_personal_totals`) |
| Category `null` on an expense                  | RPCs bucket into "Sin categoría" row with default color/icon                                |
| Groq timeout (>15 s) / no quota / invalid JSON | `useAiInsights` catches throw → `buildLocalInsights`; no error visible                      |
| LLM returns invented amounts                   | System prompt forbids it; client does not trust amounts outside the input payload           |
| Future month selected in month selector        | Clamped to current month (UI level; no network call needed)                                 |
| Rapid toggle/preset changes                    | TanStack re-keys queries; last key wins — no race conditions                                |
| Currency with no data in selected period       | Chart renders empty bars/segments; toggle remains available                                 |

---

## File map

```
lib/insights/
  types.ts          — InsightPeriod, InsightItem, AggregateRow types
  periods.ts        — PRESETS, buildMonthPreset, getDateRange
  heuristics.ts     — buildLocalInsights(input) → InsightItem[]
  client.ts         — generateInsights(payload) → calls generate-insights edge fn

lib/repositories/
  insights.ts       — fetchExpenseByCategory, fetchExpenseByPeriod, fetchIncomeByPeriod

hooks/
  use-insights.ts   — insightKeys factory; useExpenseByCategory, useExpenseByPeriod,
                      useIncomeByPeriod, useTrend, useAiInsights

components/insights/
  category-donut.tsx
  period-bar-chart.tsx
  income-vs-expense-chart.tsx
  monthly-trend-chart.tsx
  period-filter-bar.tsx
  insights-empty-state.tsx
  ai-insights-card.tsx

app/(protected)/(tabs)/
  explore.tsx       — Insights tab (replaced placeholder)

supabase/functions/
  generate-insights/index.ts

supabase/migrations/
  20260620222455_get_expense_by_category.sql
  20260620222511_get_expense_by_period.sql
  20260620222530_get_income_by_period.sql
```

---

## Testing

Tests cover: period computation (presets + month selector + future clamp), heuristics
output, repository wrappers, hook behavior (cache keying, fallback path), and all chart
components (gifted-charts SVG mocked per-test — existing pattern from the codebase).

**Test baseline after this feature:** 1668 tests, 102 suites (was 1432 / 89).

---

## Out of scope (explicit)

- **FX conversion** — ARS/USD are kept separate via the toggle; no exchange rate applied.
- **Persisting AI insights** — client-side TanStack cache only; no `insights` table.
- **Report export / PDF** — out of scope for this HU set.
- **Budget/limits per category** — the AI card may surface a suggestion, but the limits
  feature is a future HU.

---

## Related documents

- [HU-23 user flow](../user-flows/HU-23-filtros-temporales-insights.md)
- [HU-24 user flow](../user-flows/HU-24-grafico-barras-gastos.md)
- [ADR: Insights aggregation RPCs](../decisions/2026-06-20-insights-aggregation-rpcs.md)
- [ADR: Incomes schema](../decisions/2026-06-08-incomes-schema.md) — `occurred_at` column origin
- [Feature: Incomes](./incomes.md) — `get_income_totals` pattern reused
