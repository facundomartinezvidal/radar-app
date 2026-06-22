## 1. Income aggregation RPCs

- [x] 1.1 Add migration `20260622030000_get_income_totals_for.sql` — clone INVOKER `get_income_totals`, swap `auth.uid()` → `p_user_id`; SECURITY DEFINER; REVOKE from anon/public/authenticated, GRANT service_role
- [x] 1.2 Add migration `20260622030100_get_income_by_category_for.sql` — mirror `get_expense_by_category_for` against `public.incomes` (plain sum, no splits join); same REVOKE/GRANT
- [x] 1.3 Apply both migrations to remote via Supabase MCP `apply_migration` (add "Applied to remote …" header comment)
- [x] 1.4 Regenerate `types/supabase.ts` via Supabase MCP `generate_typescript_types`

## 2. Financial context assembler (`finance_context.ts`)

- [x] 2.1 Define `FinancialContext` / `CurrencyTotals` types; lift `resolvePrevPeriod`
- [x] 2.2 `assembleFinancialContext(userId, period, opts)` — parallel fetch: expense totals, income totals (new RPC), expense-by-category, prev-period expense totals, optional recent movements, optional income-by-category (new RPC); merge into per-currency rows with deterministic net = incomes − expenses
- [x] 2.3 Pure `buildFinancialContextBlock(ctx, opts)` — exact pre-formatted figures via `formatAmount`/`formatMovementLine`; per-currency balance lines, top categories, MoM line, recent movements; `sin datos` sentinels + 5-category cap (fold in `buildChatContextBlock`)
- [x] 2.4 Deterministic MoM % helper with zero-prev guard (no divide-by-zero)

## 3. LLM rendering (`render.ts`)

- [x] 3.1 Lift Groq plumbing from `chat.ts` (constants, types, AbortController); set render timeout to 8s
- [x] 3.2 `renderFinancialAnswer({ contextBlock, userQuestion, deterministicFallback })` — returns Groq text on success, fallback on ANY failure; never throws
- [x] 3.3 Verbatim-figures system prompt (copy exact strings; moderate emojis 1–3; ≈6 lines; voseo)
- [x] 3.4 Verbatim number guard — regex-extract money/`%` tokens; if any absent from context block → return fallback + log
- [x] 3.5 Length guard — output > ~1400 chars → truncate at sentence boundary or fall back

## 4. Wire-through

- [x] 4.1 Refactor `queries.ts` `handleTotalsQuery`/`handleCategoryQuery` into pure `buildTotalsReply`/`buildCategoryReply` returning strings (keep behavior)
- [x] 4.2 Route `handleQuery` totals + category paths through assembler + `renderFinancialAnswer` (deterministic reply as fallback); keep `listMode` deterministic
- [x] 4.3 Refactor `handleChat` to be period-aware and route through assembler + `renderFinancialAnswer`; keep `buildChatContextBlock` re-export for test back-compat
- [x] 4.4 Extend totals path with income totals + net balance; add income-by-category branch when direction = income

## 5. Tests (Deno)

- [x] 5.1 `finance_context.test.ts` — exact figures, net sign, MoM %, multi-currency, USD-only, empty `sin datos`, 5-cat cap, prev-period line
- [x] 5.2 `render.test.ts` — verbatim guard accepts clean output / rejects fabricated figure → fallback; length guard; missing `GROQ_API_KEY` → fallback
- [x] 5.3 Extend `queries.test.ts` — extracted reply builders match current template output
- [x] 5.4 Keep `chat.test.ts` green (re-export) ; run `deno test supabase/functions/whatsapp-webhook/`

## 6. Docs

- [x] 6.1 Validate spec scenarios for the two new RPCs against remote/branch DB
- [x] 6.2 Update function README — latency budget + UTC/AR-3 boundary caveat
- [x] 6.3 Update AGENTS.md §6 (schema row for new RPCs) + §10 (shipped entry) + test baseline; add `docs/decisions` or `docs/features` note as needed
