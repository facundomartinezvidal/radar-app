## Context

The WhatsApp webhook edge function (`supabase/functions/whatsapp-webhook/`) classifies intents with
Groq, then routes `query` → `handleQuery` (deterministic templates in `queries.ts`), `chat` →
`handleChat` (LLM, current-month-only context), `recommendation` → `handleRecommendation`. Six
share-aware service-role RPCs back the queries. The goal is LLM-rendered, complete, pretty query
replies without any risk of wrong figures.

## Goals

- All totals/category/chat replies LLM-rendered; `listMode` stays deterministic.
- Complete coverage: income totals, net balance, income-by-category, MoM, period-aware chat.
- Zero hallucinated figures; deterministic fallback on any LLM failure.

## Non-goals

- Budget tracking, recurring-vs-manual analysis, merchant clustering, multi-currency FX aggregation.
- Merging `query` and `chat` into a single intent (input contracts differ).

## Key Decisions

- **Two shared modules, handlers stay separate.** `finance_context.ts` (assembler + pure
  `buildFinancialContextBlock`) and `render.ts` (`renderFinancialAnswer`). `handleQuery` and
  `handleChat` both: resolve period → assemble context → build deterministic template (fallback) →
  render → `sendText`. Rationale: `query` carries structured entities, `chat` carries free text;
  merging would degrade the classifier and break the deterministic-only `listMode` path.
- **LLM copies, never computes.** System prompt frames the task as reproducing the exact strings of
  the DATOS block (the most effective hallucination guard with small models). Reinforced by a
  post-generation verbatim guard: regex-extract every monetary/`%` token from the output; if any is
  absent from the context block, discard and fall back. Net balance and MoM % are computed and
  pre-formatted by the assembler.
- **Reliability via fallback.** `render.ts` returns the supplied deterministic reply on no key /
  timeout / non-2xx / parse error / empty content / verbatim-guard rejection / length-cap breach.
  Existing template handlers are refactored to *return strings* (`buildTotalsReply`,
  `buildCategoryReply`) — kept, not deleted, as the fallback source.
- **Reuse over reinvention.** Reuse `resolvePeriod`, `formatAmount`, `formatMovementLine` (exported
  from `queries.ts`); lift `resolvePrevPeriod` and the `Promise.all` fetch pattern from
  `recommendations.ts`; fold `buildChatContextBlock` into the new block builder (keep a thin
  re-export so `chat.test.ts` stays green).
- **New RPCs.** `get_income_totals_for` clones the existing INVOKER `get_income_totals`
  (`20260608145126`) with `auth.uid()` → `p_user_id`. `get_income_by_category_for` mirrors
  `get_expense_by_category_for` against `public.incomes` (no splits join). Both follow the Pattern-1
  REVOKE/GRANT convention; applied via Supabase MCP; types regenerated.

## Risks / Trade-offs

- **Latency**: a second Groq call in series → worst case classify(≤10s) + assemble(<1s) +
  render(≤8s) ≈ 19s for an inline-awaited handler. Mitigation: 8s render timeout, parallel RPC
  fetches. If too slow later, reduce classify timeout or render `max_tokens`.
- **LLM quality drift**: verbatim guard + length guard + deterministic fallback bound the blast
  radius — worst case the user gets the (correct) old template.
- **Period boundary**: UTC vs AR-3 ≤3h drift is inherited from `resolvePeriod`, unchanged; documented.

## Migration Plan

Additive only. New RPCs and modules; existing templates retained as fallback. No data migration, no
breaking API change. Regenerate `types/supabase.ts` after applying RPC migrations.
