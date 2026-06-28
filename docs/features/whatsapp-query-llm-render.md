# Feature: WhatsApp bot — LLM-rendered query experience

**Status:** shipped 2026-06-22 · **HU:** HU-28 (consultas), extends HU-29
**Decision:** [`docs/decisions/2026-06-22-whatsapp-query-llm-render.md`](../decisions/2026-06-22-whatsapp-query-llm-render.md)

## Overview

Every expense/income query and chat reply over WhatsApp is now rendered by the Groq LLM into natural
rioplatense Spanish with moderate emojis, over a shared, complete financial context — while
guaranteeing no figure is ever invented. When the LLM is unavailable, replies degrade transparently
to deterministic templates.

## Modules

| File                                                     | Role                                                                                                                                                                                                                                                            |
| -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `supabase/functions/whatsapp-webhook/finance_context.ts` | `assembleFinancialContext` (parallel RPC fetch → typed `FinancialContext`; net + MoM computed here) and pure `buildFinancialContextBlock`. Helpers: `computeMoMPercent`, `formatSignedAmount`, `formatPercent`.                                                 |
| `supabase/functions/whatsapp-webhook/render.ts`          | `renderFinancialAnswer({contextBlock, userQuestion, deterministicFallback})` — Groq call (8s), verbatim-figures system prompt, number guard, length guard. Never throws. Pure helpers: `extractMoneyTokens`, `outputUsesOnlyKnownFigures`, `withinLengthLimit`. |
| `queries.ts`                                             | `handleQuery` routes totals + category paths through assemble → render with deterministic fallback. Pure fallback builders `buildTotalsReply`, `buildCategoryReply`. `listMode` stays deterministic.                                                            |
| `chat.ts`                                                | `handleChat` is period-aware and routes through assemble → render; fallback is a complete balance summary.                                                                                                                                                      |

## Coverage

- Expense totals, **income totals** (`get_income_totals_for`), **net balance** (incomes − expenses,
  computed deterministically), expense-by-category, **income-by-category** (`get_income_by_category_for`),
  recent movements, **month-over-month** expense comparison.
- Period-aware: today / week / month / prev_month / year / custom range.

## Data-integrity guarantee

The LLM only reframes a precomputed context block of exact, pre-formatted figures. A verbatim number
guard rejects any output containing a money/`%` token not present (whitespace-normalised) in the
context block, falling back to the deterministic reply. This is the load-bearing test
(`render.test.ts`: "REJECTS FABRICATED FIGURE NOT IN CONTEXT BLOCK").

## Reliability & latency

Any Groq failure → deterministic template, no user-visible error. Worst-case latency ≈ 19s
(classify + assemble + render), inline-awaited. Period boundaries are UTC-based (≤3h AR-3 drift).

## Tests

Deno edge-fn suite 193 → 241 (1 env-gated test runs under `--allow-env`). New RPCs verified live:
per-currency grouping matches raw aggregation; `authenticated`/`anon` cannot execute.

Run: `deno test --no-check supabase/functions/whatsapp-webhook/`
