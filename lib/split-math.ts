/**
 * Pure split-math utilities — zero side effects, no Supabase dependency.
 *
 * Used by the shared-expenses repository and UI layer to compute per-member
 * share amounts and simplify a net-balance matrix into minimal payment edges.
 */
import type { SplitType } from '@/lib/schemas/group';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ShareEntry {
  member_id: string;
  share_amount: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Round to exactly 2 decimal places. */
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ---------------------------------------------------------------------------
// computeShares
// ---------------------------------------------------------------------------

/**
 * Compute per-member share amounts for a given total.
 *
 * All share amounts are rounded to 2 decimals; the rounding remainder (±0.01)
 * is absorbed by the **last** member so that Σshares === amount exactly.
 *
 * @param amount     Total expense amount (must be positive).
 * @param memberIds  Ordered list of member IDs to distribute across.
 * @param opts.type  `'equal'` | `'custom'` | `'percent'`
 * @param opts.values  Record<member_id, number>
 *   - equal  — ignored
 *   - custom — each value is the desired ARS/USD amount for that member
 *   - percent — each value is the percentage (0–100) for that member
 *
 * @throws When memberIds is empty.
 * @throws When a value is missing for any member (custom / percent).
 * @throws When percentages do not sum to 100 (±0.01).
 * @throws When custom amounts do not sum to `amount` (±0.01).
 */
export function computeShares(
  amount: number,
  memberIds: string[],
  opts: { type: SplitType; values?: Record<string, number> },
): ShareEntry[] {
  if (memberIds.length === 0) {
    throw new Error('Agregá al menos un miembro.');
  }

  const { type, values = {} } = opts;
  const n = memberIds.length;

  if (type === 'equal') {
    const base = round2(amount / n);
    let sumSoFar = 0;
    return memberIds.map((member_id, idx) => {
      if (idx < n - 1) {
        sumSoFar += base;
        return { member_id, share_amount: base };
      }
      // Last member absorbs the remainder
      return { member_id, share_amount: round2(amount - sumSoFar) };
    });
  }

  if (type === 'percent') {
    // Validate all values present
    for (const member_id of memberIds) {
      if (values[member_id] === undefined) {
        throw new Error(`Falta el porcentaje para el miembro ${member_id}.`);
      }
    }

    const totalPct = memberIds.reduce((acc, id) => acc + (values[id] ?? 0), 0);
    if (Math.abs(totalPct - 100) > 0.01) {
      throw new Error('Los porcentajes deben sumar 100.');
    }

    let sumSoFar = 0;
    return memberIds.map((member_id, idx) => {
      if (idx < n - 1) {
        const share = round2((amount * (values[member_id] ?? 0)) / 100);
        sumSoFar += share;
        return { member_id, share_amount: share };
      }
      return { member_id, share_amount: round2(amount - sumSoFar) };
    });
  }

  // type === 'custom'
  for (const member_id of memberIds) {
    if (values[member_id] === undefined) {
      throw new Error(`Falta el monto para el miembro ${member_id}.`);
    }
  }

  const totalCustom = memberIds.reduce((acc, id) => acc + (values[id] ?? 0), 0);
  if (Math.abs(totalCustom - amount) > 0.01) {
    throw new Error('Los montos deben sumar el total.');
  }

  let sumSoFar = 0;
  return memberIds.map((member_id, idx) => {
    if (idx < n - 1) {
      const share = round2(values[member_id] ?? 0);
      sumSoFar += share;
      return { member_id, share_amount: share };
    }
    return { member_id, share_amount: round2(amount - sumSoFar) };
  });
}

// ---------------------------------------------------------------------------
// simplifyDebts
// ---------------------------------------------------------------------------

/**
 * Reduce a list of per-member net balances into a minimal set of payment edges.
 *
 * `net > 0` means the member is a creditor (others owe them).
 * `net < 0` means the member is a debtor (they owe others).
 *
 * Uses a greedy algorithm: repeatedly match the largest debtor against the
 * largest creditor and settle `min(|debt|, credit)`. Payments smaller than
 * 0.01 are discarded.
 *
 * @param nets  Array of `{ member_id, net }` — single currency, caller groups by currency.
 * @returns     Sorted array of `{ from, to, amount }` payment edges.
 */
export function simplifyDebts(
  nets: { member_id: string; net: number }[],
): { from: string; to: string; amount: number }[] {
  // Work with mutable copies rounded to 2 dp
  const debtors: { id: string; amount: number }[] = [];
  const creditors: { id: string; amount: number }[] = [];

  for (const { member_id, net } of nets) {
    const r = round2(net);
    if (r < -0.005)
      debtors.push({ id: member_id, amount: -r }); // positive debt
    else if (r > 0.005) creditors.push({ id: member_id, amount: r });
    // net ≈ 0 → already settled
  }

  const payments: { from: string; to: string; amount: number }[] = [];

  // Sort for deterministic output: largest first
  debtors.sort((a, b) => b.amount - a.amount);
  creditors.sort((a, b) => b.amount - a.amount);

  let di = 0;
  let ci = 0;

  while (di < debtors.length && ci < creditors.length) {
    const debtor = debtors[di]!;
    const creditor = creditors[ci]!;

    const settle = round2(Math.min(debtor.amount, creditor.amount));

    if (settle >= 0.01) {
      payments.push({ from: debtor.id, to: creditor.id, amount: settle });
    }

    debtor.amount = round2(debtor.amount - settle);
    creditor.amount = round2(creditor.amount - settle);

    if (debtor.amount < 0.005) di++;
    if (creditor.amount < 0.005) ci++;
  }

  return payments;
}
