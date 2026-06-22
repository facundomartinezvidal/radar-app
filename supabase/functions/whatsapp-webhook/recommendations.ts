/**
 * recommendations.ts
 * Handles recommendation/insights intents for the WhatsApp bot.
 *
 * Exports:
 *   handleRecommendation — called when intent is 'recommendation'
 *
 * STUB IMPLEMENTATION — to be completed by group 10.
 * // TODO(group-10): implement full recommendation pipeline:
 *   - build generate-insights payload from DEFINER read RPCs for current +
 *     previous period (get_personal_totals_for, get_expense_by_category_for,
 *     get_expense_by_period_for, get_income_by_period_for)
 *   - call generate-insights edge function via fetch with WHATSAPP_INTERNAL_SECRET
 *   - format top 1–3 insights into a WhatsApp-friendly text reply
 *   - handle insufficient data gracefully (empty insights array)
 *   - handle generate-insights timeout/error gracefully (don't crash conversation)
 */

import { sendText } from './graph.ts';
import type { Classification } from './classify.ts';

/**
 * Produces spending recommendations for the user via the generate-insights function.
 *
 * Group 10 will replace this body with:
 *   gather aggregates → call generate-insights → format top 1-3 → sendText
 *
 * @param userId         RADAR user UUID (caller already verified linked).
 * @param waNumber       Sender E.164 number (for replies).
 * @param classification Pre-classified intent + entities (for period hints).
 */
export async function handleRecommendation(
  userId: string,
  waNumber: string,
  classification: Classification,
): Promise<void> {
  // TODO(group-10): gather aggregates from DEFINER read RPCs, call
  // generate-insights edge function (using WHATSAPP_INTERNAL_SECRET for
  // service-to-service auth), format top 1-3 insights, reply via sendText.
  // On generate-insights timeout or error reply gracefully; don't crash.
  console.info(
    '[recommendations] handleRecommendation stub — userId:',
    userId,
    'intent:',
    classification.intent,
  );
  await sendText(waNumber, 'Estoy preparando tus recomendaciones... (función en construcción)');
}
