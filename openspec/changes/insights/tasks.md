# Tasks: Insights section

## 1. Aggregation RPCs (AC1)

- [x] 1.1 Confirm canonical date column (`occurred_at` vs `occurred_date`) on `expenses`/`incomes` against `types/supabase.ts`
- [x] 1.2 Write `get_expense_by_category` migration (SECURITY INVOKER, share-aware subquery copied from `get_personal_totals`)
- [x] 1.3 Write `get_expense_by_period` migration (`date_trunc` bucketing, share-aware)
- [x] 1.4 Write `get_income_by_period` migration
- [x] 1.5 Apply migrations via Supabase MCP, run `get_advisors`, confirm `(user_id, occurred_*)` indexes
- [x] 1.6 Regenerate `types/supabase.ts`
- [x] 1.7 Verify RPC totals match `get_personal_totals` for a range including a group expense

## 2. Pure period/types layer (AC2)

- [x] 2.1 `lib/insights/types.ts` — Insight, GenerateInsightsInput, ChartPoint, Bucket, PeriodPreset
- [x] 2.2 `lib/insights/periods.ts` — presets (Este mes / Mes pasado / Últimos 3 meses / Este año) → `{from,to,label,bucket}`, month navigation, future clamp
- [x] 2.3 Unit tests: each preset range, month navigation, year boundaries, future clamp

## 3. Local heuristics fallback (AC3)

- [x] 3.1 `lib/insights/heuristics.ts` — `buildLocalInsights(input)` pure, cap 4 (negative balance, dominant category ≥40%, ±15% MoM, savings ≥20%, `[]` empty)
- [x] 3.2 Unit tests: each rule fires, cap 4, empty → `[]`, amounts via `formatMoney`

## 4. Repository layer (AC4)

- [x] 4.1 `lib/repositories/insights.ts` — `getExpenseByCategory/getExpenseByPeriod/getIncomeByPeriod` → `RepoResult`, `.rpc(...)`, `Number(row.total)`
- [x] 4.2 Unit tests: mock `supabase.rpc` — mapping + error propagation

## 5. Edge-function client (AC5)

- [x] 5.1 `lib/insights/client.ts` — `generateInsights()` + `InsightsError`, mirror of `lib/ocr.ts` (`invoke('generate-insights')`, unwrap `{ data }`)
- [x] 5.2 Unit tests: mock `functions.invoke` — success unwrap, network error → `InsightsError`

## 6. Hooks (AC6)

- [x] 6.1 `hooks/use-insights.ts` — `insightKeys` factory; `useExpenseByCategory`, `useExpenseByPeriod`, `useIncomeByPeriod`, `useTrend` (composes monthly buckets)
- [x] 6.2 `useAiInsights` — `staleTime` 1h, key `(currency, period)`, `catch` → `buildLocalInsights`
- [x] 6.3 RNTL `renderHook` tests: data OK; AI error → heuristic fallback returned without throw

## 7. Chart components (AC7)

- [x] 7.1 `category-donut.tsx` (PieChart, per-category color/icon)
- [x] 7.2 `period-bar-chart.tsx` (HU-24)
- [x] 7.3 `income-vs-expense-chart.tsx`
- [x] 7.4 `monthly-trend-chart.tsx` (LineChart)
- [x] 7.5 RNTL tests: render with data, empty array, a11y; mock `react-native-gifted-charts`

## 8. Filter / empty / AI card (AC8)

- [x] 8.1 `period-filter-bar.tsx` — presets + month selector (visual pattern of `filter-bar.tsx`)
- [x] 8.2 `insights-empty-state.tsx` — illustration + CTA
- [x] 8.3 `ai-insights-card.tsx` — `kind`→color/icon, N insights, optional CTA
- [x] 8.4 RNTL tests for each

## 9. Screen orchestration (AC9)

- [x] 9.1 Replace `app/(protected)/(tabs)/explore.tsx`: period state + `CurrencyToggle`, mount hooks + charts + AI card, empty state when no movements
- [x] 9.2 RNTL integration: happy path, loading, empty, currency-toggle re-key

## 10. Edge function (AC10)

- [x] 10.1 `supabase/functions/generate-insights/index.ts` — clone `extract-receipt`; system prompt (Spanish, JSON-only, no invented numbers); normalize/clamp output
- [x] 10.2 Deploy via Supabase MCP; set `GROQ_API_KEY` secret; manual contract test

## 11. Docs & dependency (cross-cutting)

- [x] 11.1 `npx expo install react-native-gifted-charts`; verify version vs RN 0.81
- [x] 11.2 `docs/features/insights.md`, `docs/decisions/<date>-insights-aggregation-rpcs.md`, `docs/user-flows/HU-23-*.md` + `HU-24-*.md` (mirror to vault)
- [x] 11.3 AGENTS.md §6 (RPC summary rows) + §9 (test baseline) + §10 (shipped/pending)
