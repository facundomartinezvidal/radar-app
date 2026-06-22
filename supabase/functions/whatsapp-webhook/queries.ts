/**
 * queries.ts
 * Handles movement query intents for the WhatsApp bot.
 *
 * Exports:
 *   handleQuery — called when intent is 'query'
 *
 * STUB IMPLEMENTATION — to be completed by group 9.
 * // TODO(group-9): implement full query pipeline:
 *   - resolve queryPeriod to {from, to} timestamps (default: current month)
 *   - call get_personal_totals_for / get_expense_by_category_for /
 *     get_expense_by_period_for / get_income_by_period_for (DEFINER RPCs)
 *   - format the results into a WhatsApp-friendly text reply per currency
 *   - handle "no movements for this period" gracefully
 *   - queries are read-only; no confirmation required
 */

import { sendText } from './graph.ts';
import type { Classification } from './classify.ts';

/**
 * Answers a natural-language query about the user's movements.
 *
 * Group 9 will replace this body with:
 *   resolve period → call DEFINER read RPCs → format → sendText
 *
 * @param userId         RADAR user UUID (caller already verified linked).
 * @param waNumber       Sender E.164 number (for replies).
 * @param classification Pre-classified intent + entities (queryPeriod, queryCategory).
 */
export async function handleQuery(
  userId: string,
  waNumber: string,
  classification: Classification,
): Promise<void> {
  // TODO(group-9): resolve classification.entities.queryPeriod, call DEFINER
  // read RPCs (get_personal_totals_for, get_expense_by_category_for,
  // get_expense_by_period_for, get_income_by_period_for) using serviceClient(),
  // format response, handle empty period gracefully.
  console.info(
    '[queries] handleQuery stub — userId:',
    userId,
    'period:',
    classification.entities.queryPeriod,
  );
  await sendText(waNumber, 'Estoy procesando tu consulta... (función en construcción)');
}
