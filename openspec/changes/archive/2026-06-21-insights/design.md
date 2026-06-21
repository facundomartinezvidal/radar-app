# Design: Insights section

## Context

Insights tab is a placeholder. The repo already has share-aware per-currency totals (`get_personal_totals`, `sumExpensesByCurrency`), paginated list hooks (`use-expenses.ts`, `use-incomes.ts`), a Groq edge function template (`extract-receipt`), `CurrencyToggle`, `DateField`, `formatMoney`, and `react-native-svg 15.12.1`. There is no charting library and no per-category / per-period aggregation.

## Goals

- Close HU-23 (temporal filters) and HU-24 (expenses bar chart with filter).
- Deliver category donut, income-vs-expense, monthly trend, multi-currency, AI recommendations.
- Reuse the exact share-aware rule; never duplicate it in the client.
- Keep AI optional and resilient (always-useful fallback).

## Non-goals

- ARS↔USD FX conversion (handled by toggle).
- Persisting AI insights (client cache only).
- Budgets/limits feature, report export.

## Key decisions

1. **Aggregation in Postgres (SECURITY INVOKER RPCs), not client-side.** Reuses the share-aware subquery from `get_personal_totals` verbatim; avoids unpaginated client fetches; `date_trunc` does bucketing. Three RPCs:
   - `get_expense_by_category(p_currency, p_from, p_to)` → `(category_id, category_name, color, icon, total, count)`.
   - `get_expense_by_period(p_currency, p_bucket, p_from, p_to)` → `(bucket date, total, count)`, `p_bucket ∈ {day,week,month}`.
   - `get_income_by_period(p_currency, p_bucket, p_from, p_to)` → `(bucket date, total, count)`.
   Charts 3 & 4 are composed in the client by joining monthly buckets of RPC2 and RPC3 by date — no extra RPC.
2. **`react-native-gifted-charts`** for donut/bars/line. Pure JS over `react-native-svg` (already installed) → runs in Expo Go SDK 54, no native module. (victory-native needs Skia → dev-client; rejected.)
3. **Edge function `generate-insights`** clones `extract-receipt`: Bearer JWT, `auth.getUser()`, Groq `llama-4-scout-17b`, `response_format json_object`, `temperature 0`, ~15s `AbortController`, `_shared/cors.ts`, `GROQ_API_KEY`. It receives client aggregates (does not query DB) and returns `{ data: { insights } }`, normalized/clamped manually (mirror of `normaliseOcrResult`).
4. **Fallback in the hook**: `useAiInsights` calls `generateInsights` in `queryFn`; on any throw it returns `buildLocalInsights(input)`. The user never sees an AI error. `staleTime` 1h, key `[...ai, currency, period.label]`.
5. **Multi-currency via `CurrencyToggle` reuse** (single-select), not the multi-select chips of `filter-bar.tsx`.

## Risks / trade-offs

- **Date column ambiguity**: `types/supabase.ts` exposes both `occurred_at` and `occurred_date`. Must confirm the canonical filter column on `expenses`/`incomes` before writing the RPC `WHERE`/`date_trunc` clauses (verify in /build).
- **Chart lib in jsdom**: gifted-charts' SVG may not render under jest-expo → mock the module per-test (existing pattern).
- **Groq cost/latency**: bounded by 1h client cache + single call per (period, currency).
- **LLM hallucinated numbers**: system prompt forbids numbers outside the payload; client does not trust amounts beyond what it sent.

## Migration plan

Dual-ship per `docs/conventions/database.md`: write each RPC SQL to `supabase/migrations/<ts>_*.sql`, `apply_migration` via MCP with matching name, run `get_advisors`, regenerate `types/supabase.ts`. Confirm `(user_id, occurred_*)` indexes exist; add if missing. RPCs are INVOKER → no REVOKE/GRANT special handling.

## File structure

```
lib/insights/{types,periods,heuristics,client}.ts
lib/repositories/insights.ts
hooks/use-insights.ts
components/insights/{category-donut,period-bar-chart,income-vs-expense-chart,monthly-trend-chart,ai-insights-card,period-filter-bar,insights-empty-state}.tsx
app/(protected)/(tabs)/explore.tsx   (replace placeholder)
supabase/functions/generate-insights/index.ts
supabase/migrations/<ts>_*.sql        (×3)
```

Conventions: repos return `{data,error}` with `Number(row.total)`; `insightKeys` query-key factory; screens import hooks not repos; donut colors/icons from `categories.color/icon`.
