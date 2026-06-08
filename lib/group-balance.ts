/**
 * Pure balance-helper utilities for shared-expense groups.
 *
 * These functions are side-effect-free and contain no Supabase or UI
 * dependencies, making them straightforward to unit-test.
 */
import { simplifyDebts } from '@/lib/split-math';
import type { GroupBalance } from '@/lib/repositories/groups';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BalanceBadge {
  tone: 'in' | 'out' | 'neutral';
  label: 'Te deben' | 'Debés' | 'Al día';
}

// ---------------------------------------------------------------------------
// currentUserNet
// ---------------------------------------------------------------------------

/**
 * Extract the per-currency net balance for a specific member.
 *
 * Returns an empty record when `memberId` is null (e.g. unauthenticated,
 * or the current user is not a member of the group).
 *
 * @param balances  Full list returned by `getGroupBalances`.
 * @param memberId  The member row id to filter by (NOT the user_id).
 */
export function currentUserNet(
  balances: GroupBalance[],
  memberId: string | null,
): Record<string, number> {
  if (memberId === null) return {};

  const result: Record<string, number> = {};
  for (const row of balances) {
    if (row.member_id === memberId) {
      result[row.currency] = row.net;
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// balanceBadge
// ---------------------------------------------------------------------------

/**
 * Determine the tone and label for a balance badge.
 *
 * - |net| < 0.01 → neutral / "Al día"
 * - net > 0      → in    / "Te deben"  (others owe the user)
 * - net < 0      → out   / "Debés"     (the user owes others)
 */
export function balanceBadge(net: number): BalanceBadge {
  if (Math.abs(net) < 0.01) {
    return { tone: 'neutral', label: 'Al día' };
  }
  if (net > 0) {
    return { tone: 'in', label: 'Te deben' };
  }
  return { tone: 'out', label: 'Debés' };
}

// ---------------------------------------------------------------------------
// pairwiseByCurrency
// ---------------------------------------------------------------------------

/**
 * Group balances by currency and compute the minimal payment edges per currency.
 *
 * For each currency, `simplifyDebts` is called with all member nets so the UI
 * shows the smallest possible set of "who pays whom" arrows.
 *
 * @returns  Record keyed by currency code (`'ARS'`, `'USD'`, …).
 *           Each value is an array of `{ from, to, amount }` edges.
 */
export function pairwiseByCurrency(
  balances: GroupBalance[],
): Record<string, { from: string; to: string; amount: number }[]> {
  // Group by currency
  const byCurrency = new Map<string, { member_id: string; net: number }[]>();
  for (const row of balances) {
    const existing = byCurrency.get(row.currency);
    if (existing !== undefined) {
      existing.push({ member_id: row.member_id, net: row.net });
    } else {
      byCurrency.set(row.currency, [{ member_id: row.member_id, net: row.net }]);
    }
  }

  const result: Record<string, { from: string; to: string; amount: number }[]> = {};
  for (const [currency, nets] of byCurrency) {
    result[currency] = simplifyDebts(nets);
  }
  return result;
}
