# Decision: WhatsApp query replies rendered by LLM with verbatim-figures guard + deterministic fallback

Date: 2026-06-22
Status: Accepted
Related: [`2026-06-22-whatsapp-twilio-transport.md`](2026-06-22-whatsapp-twilio-transport.md), [`2026-06-21-whatsapp-bot-schema.md`](2026-06-21-whatsapp-bot-schema.md), [`2026-06-20-insights-aggregation-rpcs.md`](2026-06-20-insights-aggregation-rpcs.md)

## Context

The WhatsApp bot answered expense/income queries with terse deterministic plain-text templates
(`queries.ts`); only the open `chat` intent used the LLM, and it was hardcoded to the current month.
Coverage was incomplete: no income totals per currency, no net balance, no income-by-category, no
month-over-month comparison. We wanted every query reply to read naturally (pretty rioplatense
Spanish, moderate emojis) and to cover all of querying — without ever risking a wrong number in a
finance app.

## Decision

1. **All totals/category/chat replies are LLM-rendered**; `listMode` row-lists stay deterministic
   (the rows are the answer — nothing to reframe, and it saves a Groq round-trip).
2. **The LLM never computes figures.** All amounts/counts/dates/percentages are computed
   deterministically via RPCs, pre-formatted, and assembled into a context block. Two new modules:
   - `finance_context.ts` — `assembleFinancialContext` (parallel RPC fetch → typed `FinancialContext`,
     net = incomes − expenses and MoM % computed here) + pure `buildFinancialContextBlock`.
   - `render.ts` — `renderFinancialAnswer` (Groq, 8s timeout) with a verbatim-figures system prompt.
3. **Defense in depth — verbatim number guard.** `render.ts` regex-extracts every money/`%` token
   from the LLM output and, after whitespace-normalisation, rejects the output (→ fallback) if any
   token is absent from the context block.
4. **Deterministic fallback.** Because the LLM is now in the critical path of every query, ANY Groq
   failure (no key, timeout, non-2xx, parse error, empty content, guard rejection, length-cap breach)
   transparently returns the deterministic template reply. `renderFinancialAnswer` never throws.
5. **New data RPCs** (Pattern-1 SECURITY DEFINER, service-role only): `get_income_totals_for`
   (clone of INVOKER `get_income_totals`) and `get_income_by_category_for` (mirror of
   `get_expense_by_category_for` against `incomes`; incomes have no splits → plain sum).

## Consequences

- **Latency**: worst case ≈ classify (≤10s) + assemble (<1s) + render (≤8s) ≈ 19s for an
  inline-awaited handler. Acceptable but tight; lever to pull later is the render `max_tokens`/timeout.
- **Boundary caveat**: period resolution stays UTC-based (inherited from `resolvePeriod`); Argentina
  is UTC-3, so period edges can drift ≤3h. Unchanged from prior behaviour.
- **Reliability**: a Groq outage degrades to the (already-tested) deterministic templates — no
  user-visible error, no wrong numbers.
- **Tests**: pure functions (`buildFinancialContextBlock`, `computeMoMPercent`, `formatSignedAmount`,
  `formatPercent`, `extractMoneyTokens`, `outputUsesOnlyKnownFigures`, `withinLengthLimit`,
  `buildTotalsReply`, `buildCategoryReply`) carry the integrity guarantees. Deno edge-fn tests
  193 → 241.

## Alternatives considered

- **All-deterministic, prettier templates**: reliable but not "natural"; rejected per product
  decision to render everything via the LLM.
- **Let the LLM compute from raw rows**: rejected — unacceptable hallucination risk in a finance app.
- **Merge `query` and `chat` intents**: rejected — different input contracts; merging degrades the
  classifier and breaks the deterministic `listMode` path.
