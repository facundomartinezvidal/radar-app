/**
 * Local heuristics fallback for AI insights.
 *
 * Pure function — no I/O, no side effects, deterministic. Called by
 * `useAiInsights` when the Groq edge function fails for any reason.
 *
 * Rules (evaluated in priority order, capped at 4 results):
 *  1. No movements  → return [] (card is hidden upstream)
 *  2. Negative balance → warning
 *  3. Dominant category (≥40%) → neutral
 *  4. Month-over-month spike (>+15%) → warning
 *  5. Month-over-month drop (<-15%) → positive
 *  6. High savings rate (≥20% of incomes) → positive
 *
 * Spike and drop are mutually exclusive: only one is added per call.
 */

import { formatMoney } from '@/lib/format/money';
import type { GenerateInsightsInput, Insight } from '@/lib/insights/types';

const MAX_INSIGHTS = 4;

export function buildLocalInsights(input: GenerateInsightsInput): Insight[] {
  const { totals, byCategory, prevPeriodExpenses, currency } = input;

  // Rule 1 — no movements at all → empty, card is hidden upstream
  if (totals.expenses === 0 && totals.incomes === 0) {
    return [];
  }

  const results: Insight[] = [];

  // Rule 2 — negative net balance
  if (totals.net < 0) {
    const shortfall = formatMoney(Math.abs(totals.net), currency);
    results.push({
      kind: 'warning',
      title: 'Gastaste más de lo que ingresó',
      body: `Tu balance es negativo por ${shortfall}. Revisá tus gastos para el próximo período.`,
    });
  }

  // Rule 3 — dominant category (≥40%)
  const top = byCategory[0];
  if (top !== undefined && top.pct >= 40) {
    const roundedPct = Math.round(top.pct);
    results.push({
      kind: 'neutral',
      title: `${top.name} concentra el ${roundedPct}%`,
      body: `${top.name} concentra el ${roundedPct}% de tus gastos.`,
    });
  }

  // Rules 4 & 5 — month-over-month change (mutually exclusive)
  if (
    prevPeriodExpenses !== undefined &&
    prevPeriodExpenses > 0 &&
    totals.expenses !== prevPeriodExpenses
  ) {
    const delta = (totals.expenses - prevPeriodExpenses) / prevPeriodExpenses;

    if (delta > 0.15) {
      // Rule 4 — spike
      const roundedPct = Math.round(delta * 100);
      results.push({
        kind: 'warning',
        title: 'Tus gastos subieron este período',
        body: `Tus gastos subieron ${roundedPct}% vs el período anterior.`,
      });
    } else if (delta < -0.15) {
      // Rule 5 — drop
      const roundedPct = Math.round(Math.abs(delta) * 100);
      results.push({
        kind: 'positive',
        title: 'Bajaste tus gastos',
        body: `Bajaste tus gastos un ${roundedPct}%. Buen control.`,
      });
    }
  }

  // Rule 6 — high savings rate (≥20%)
  if (totals.incomes > 0 && totals.net / totals.incomes >= 0.2) {
    const roundedPct = Math.round((totals.net / totals.incomes) * 100);
    results.push({
      kind: 'positive',
      title: `Ahorraste el ${roundedPct}% de tus ingresos`,
      body: `Ahorraste el ${roundedPct}% de tus ingresos.`,
    });
  }

  return results.slice(0, MAX_INSIGHTS);
}
