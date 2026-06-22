## Why

The WhatsApp bot answers expense/income queries with terse deterministic plain-text templates, and
only the free-chat intent uses the LLM. Replies read mechanically and coverage is incomplete: no
income totals, no net balance, no income-by-category, no month-over-month comparison, and chat is
hardcoded to the current month. Users consulting their finances over WhatsApp deserve natural,
complete answers — without ever risking a wrong number in a finance app.

## What Changes

- Route **all** totals and category query replies, plus chat replies, through the LLM for pretty,
  natural rioplatense Spanish with moderate emojis. `listMode` row-lists stay fully deterministic.
- Introduce a shared **financial context assembler** that fetches all relevant data per resolved
  period and computes net balance and month-over-month comparison deterministically.
- Introduce a shared **LLM rendering** module with a verbatim-figures system prompt, a hallucinated-
  number guard, a length guard, and a **deterministic template fallback** on any Groq failure.
- Make chat **period-aware** (resolve the requested period instead of always current month).
- Add new data: income totals per currency, income-by-category, net balance.
- **Constraint:** the LLM never computes or invents figures — all amounts/counts/dates/percentages
  are precomputed, pre-formatted, and copied verbatim.

## Capabilities

### New Capabilities
- `whatsapp-queries`: LLM-rendered expense/income query and chat replies over a shared financial
  context, with complete coverage (income totals, net balance, income-by-category, MoM comparison,
  period-aware chat), a verbatim-figures integrity guarantee, and deterministic fallback.

### Modified Capabilities
<!-- none — no living whatsapp-queries spec exists; all requirements are new -->

## Impact

- **Edge function** `supabase/functions/whatsapp-webhook/`: new `finance_context.ts`, `render.ts`;
  `queries.ts` and `chat.ts` refactored to route through them; template handlers refactored to return
  strings (fallback). New tests `finance_context.test.ts`, `render.test.ts`.
- **Database**: two new SECURITY DEFINER RPCs `get_income_totals_for`, `get_income_by_category_for`
  (service-role only); types regenerated.
- **Dependencies**: Groq (existing) now in the critical path of every query — mitigated by 8s timeout
  + fallback. No new external deps.
- **Docs**: OpenSpec delta spec, function README (latency budget, UTC/AR-3 boundary note),
  AGENTS.md §6/§10.
