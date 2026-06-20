# Proposal: Insights section (charts, AI recommendations, temporal filters)

## Why

The Insights tab (`app/(protected)/(tabs)/explore.tsx`) is a "Próximamente" placeholder. RADAR already persists expenses, incomes and shared expenses but offers no analytical visibility — product pillars 1 (unified personal tracking) and 3 (AI insights) have no surface. This change closes **HU-23** (temporal filters in Insights) and **HU-24** (expenses bar chart with filter) for Entrega 4, and delivers the rest of the brief's Screen 7: category donut, income-vs-expense, monthly trend, multi-currency toggle and an AI recommendations card.

## What Changes

- **New analytical surface** replacing the Insights placeholder: temporal filter bar (presets + month selector), ARS/USD toggle, and four charts (category donut, expenses-by-period bars, income-vs-expense, monthly trend line).
- **Share-aware aggregation** in three new Postgres RPCs (`get_expense_by_category`, `get_expense_by_period`, `get_income_by_period`), reusing the exact share-aware rule from `get_personal_totals`.
- **AI recommendations** via a new Groq edge function (`generate-insights`) that consumes client-computed aggregates and returns Spanish, actionable insights — with a transparent **fallback to local heuristics** when Groq fails, times out, or has no quota.
- **Empty state** when the selected period has no movements.
- New client layer: `lib/insights/` (types, periods, heuristics, client), `lib/repositories/insights.ts`, `hooks/use-insights.ts`, `components/insights/`.
- New dependency: `react-native-gifted-charts` (pure JS over `react-native-svg`, Expo Go SDK 54 compatible).

## Capabilities

- `insights-analytics` (new) — temporal filters, multi-currency toggle, four charts, share-aware aggregation, empty state.
- `insights-ai-recommendations` (new) — Groq-backed recommendations with local-heuristics fallback and client-side caching.

## Impact

- **Code**: `app/(protected)/(tabs)/explore.tsx` (replace placeholder); new `lib/insights/`, `lib/repositories/insights.ts`, `hooks/use-insights.ts`, `components/insights/`; new `supabase/functions/generate-insights/`; 3 new migrations in `supabase/migrations/`; `types/supabase.ts` regenerated.
- **APIs**: 3 new RPCs (SECURITY INVOKER, under RLS); 1 new edge function (Bearer JWT required; `GROQ_API_KEY` secret).
- **Dependencies**: add `react-native-gifted-charts`.
- **Docs**: `docs/features/insights.md`, `docs/decisions/<date>-insights-aggregation-rpcs.md`, `docs/user-flows/HU-23-*.md` + `HU-24-*.md`, AGENTS.md §6/§9/§10 rows.
- **No FX dependency**: multi-currency handled by toggle, not conversion.
