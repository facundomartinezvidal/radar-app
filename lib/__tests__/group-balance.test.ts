/**
 * Unit tests for the pure group-balance helper utilities.
 *
 * Full branch coverage of `currentUserNet`, `balanceBadge`, and
 * `pairwiseByCurrency`. No Supabase or UI dependencies.
 */
import { balanceBadge, currentUserNet, pairwiseByCurrency } from '../group-balance';
import type { GroupBalance } from '@/lib/repositories/groups';

// ---------------------------------------------------------------------------
// currentUserNet
// ---------------------------------------------------------------------------

describe('currentUserNet', () => {
  const balances: GroupBalance[] = [
    { member_id: 'm1', currency: 'ARS', net: 1500 },
    { member_id: 'm1', currency: 'USD', net: -50 },
    { member_id: 'm2', currency: 'ARS', net: -1500 },
    { member_id: 'm2', currency: 'USD', net: 50 },
  ];

  it('returns per-currency net for the specified member', () => {
    expect(currentUserNet(balances, 'm1')).toEqual({ ARS: 1500, USD: -50 });
  });

  it('returns per-currency net for a different member', () => {
    expect(currentUserNet(balances, 'm2')).toEqual({ ARS: -1500, USD: 50 });
  });

  it('returns empty record when memberId is null', () => {
    expect(currentUserNet(balances, null)).toEqual({});
  });

  it('returns empty record when member has no balance rows', () => {
    expect(currentUserNet(balances, 'unknown-member')).toEqual({});
  });

  it('returns empty record for empty balances array', () => {
    expect(currentUserNet([], 'm1')).toEqual({});
  });
});

// ---------------------------------------------------------------------------
// balanceBadge
// ---------------------------------------------------------------------------

describe('balanceBadge', () => {
  it('returns neutral / "Al día" for net === 0', () => {
    expect(balanceBadge(0)).toEqual({ tone: 'neutral', label: 'Al día' });
  });

  it('returns neutral / "Al día" for |net| < 0.01 (near-zero positive)', () => {
    expect(balanceBadge(0.005)).toEqual({ tone: 'neutral', label: 'Al día' });
  });

  it('returns neutral / "Al día" for |net| < 0.01 (near-zero negative)', () => {
    expect(balanceBadge(-0.009)).toEqual({ tone: 'neutral', label: 'Al día' });
  });

  it('returns in / "Te deben" for positive net', () => {
    expect(balanceBadge(500)).toEqual({ tone: 'in', label: 'Te deben' });
  });

  it('returns in / "Te deben" for net exactly at threshold (0.01)', () => {
    expect(balanceBadge(0.01)).toEqual({ tone: 'in', label: 'Te deben' });
  });

  it('returns out / "Debés" for negative net', () => {
    expect(balanceBadge(-200)).toEqual({ tone: 'out', label: 'Debés' });
  });

  it('returns out / "Debés" for net exactly at negative threshold (-0.01)', () => {
    expect(balanceBadge(-0.01)).toEqual({ tone: 'out', label: 'Debés' });
  });
});

// ---------------------------------------------------------------------------
// pairwiseByCurrency
// ---------------------------------------------------------------------------

describe('pairwiseByCurrency', () => {
  it('separates ARS and USD balances into independent currency buckets', () => {
    const balances: GroupBalance[] = [
      { member_id: 'm1', currency: 'ARS', net: -300 },
      { member_id: 'm2', currency: 'ARS', net: 300 },
      { member_id: 'm1', currency: 'USD', net: 50 },
      { member_id: 'm3', currency: 'USD', net: -50 },
    ];

    const result = pairwiseByCurrency(balances);

    expect(Object.keys(result).sort()).toEqual(['ARS', 'USD']);

    // ARS: m1 owes m2
    expect(result['ARS']).toEqual([{ from: 'm1', to: 'm2', amount: 300 }]);

    // USD: m3 owes m1
    expect(result['USD']).toEqual([{ from: 'm3', to: 'm1', amount: 50 }]);
  });

  it('returns empty arrays when all nets are zero for a currency', () => {
    const balances: GroupBalance[] = [
      { member_id: 'm1', currency: 'ARS', net: 0 },
      { member_id: 'm2', currency: 'ARS', net: 0 },
    ];

    const result = pairwiseByCurrency(balances);
    expect(result['ARS']).toEqual([]);
  });

  it('calls simplifyDebts per currency (multi-debtor simplification)', () => {
    // A owes 100 ARS, B owes 50 ARS → C is owed 90, D is owed 60
    const balances: GroupBalance[] = [
      { member_id: 'A', currency: 'ARS', net: -100 },
      { member_id: 'B', currency: 'ARS', net: -50 },
      { member_id: 'C', currency: 'ARS', net: 90 },
      { member_id: 'D', currency: 'ARS', net: 60 },
    ];

    const result = pairwiseByCurrency(balances);
    const arsEdges = result['ARS'] ?? [];

    // simplifyDebts should produce 3 payment edges for this scenario
    expect(arsEdges.length).toBe(3);
    const totalPaid = arsEdges.reduce((acc, e) => acc + e.amount, 0);
    expect(Math.round(totalPaid * 100)).toBe(15000); // 150 ARS total
  });

  it('returns empty object for empty balances array', () => {
    expect(pairwiseByCurrency([])).toEqual({});
  });

  it('handles a single currency with a single debtor and creditor', () => {
    const balances: GroupBalance[] = [
      { member_id: 'X', currency: 'ARS', net: -500 },
      { member_id: 'Y', currency: 'ARS', net: 500 },
    ];

    const result = pairwiseByCurrency(balances);
    expect(result['ARS']).toEqual([{ from: 'X', to: 'Y', amount: 500 }]);
  });
});
