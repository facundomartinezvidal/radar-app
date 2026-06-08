/**
 * Unit tests for the pure split-math utilities.
 *
 * Full branch coverage of `computeShares` and `simplifyDebts`.
 * No Supabase dependency — these are pure functions.
 */
import { computeShares, simplifyDebts } from '../split-math';

// ---------------------------------------------------------------------------
// computeShares — equal split
// ---------------------------------------------------------------------------

describe('computeShares — equal', () => {
  it('splits $90 evenly among 3 members (no remainder)', () => {
    const result = computeShares(90, ['a', 'b', 'c'], { type: 'equal' });
    expect(result).toEqual([
      { member_id: 'a', share_amount: 30 },
      { member_id: 'b', share_amount: 30 },
      { member_id: 'c', share_amount: 30 },
    ]);
    const sum = result.reduce((acc, r) => acc + r.share_amount, 0);
    expect(sum).toBe(90);
  });

  it('splits $100 among 3 members — remainder goes to last (33.33/33.33/33.34)', () => {
    const result = computeShares(100, ['a', 'b', 'c'], { type: 'equal' });
    expect(result[0]?.share_amount).toBe(33.33);
    expect(result[1]?.share_amount).toBe(33.33);
    expect(result[2]?.share_amount).toBe(33.34);
    const sum = result.reduce((acc, r) => acc + r.share_amount, 0);
    expect(sum).toBeCloseTo(100, 10);
    // Must be EXACTLY 100 in integer cents
    const sumCents = result.reduce((acc, r) => acc + Math.round(r.share_amount * 100), 0);
    expect(sumCents).toBe(10000);
  });

  it('splits $1 among 3 members with correct penny handling', () => {
    const result = computeShares(1, ['a', 'b', 'c'], { type: 'equal' });
    const sum = result.reduce((acc, r) => acc + Math.round(r.share_amount * 100), 0);
    expect(sum).toBe(100); // exactly $1.00 in cents
  });

  it('single member gets the full amount', () => {
    const result = computeShares(500, ['a'], { type: 'equal' });
    expect(result).toEqual([{ member_id: 'a', share_amount: 500 }]);
  });

  it('two members split $0.01 (edge: last member absorbs)', () => {
    const result = computeShares(0.01, ['a', 'b'], { type: 'equal' });
    // 0.01 / 2 = 0.005 → round2 = 0.01; so first gets 0.01 then remainder = 0.00
    const sum = result.reduce((acc, r) => acc + r.share_amount, 0);
    expect(Math.round(sum * 100)).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// computeShares — percent split
// ---------------------------------------------------------------------------

describe('computeShares — percent', () => {
  it('distributes $200 with 50/30/20 percentages', () => {
    const result = computeShares(200, ['a', 'b', 'c'], {
      type: 'percent',
      values: { a: 50, b: 30, c: 20 },
    });
    expect(result[0]?.share_amount).toBe(100);
    expect(result[1]?.share_amount).toBe(60);
    expect(result[2]?.share_amount).toBe(40);
    const sum = result.reduce((acc, r) => acc + r.share_amount, 0);
    expect(sum).toBeCloseTo(200, 10);
  });

  it('throws when percentages do not sum to 100', () => {
    expect(() =>
      computeShares(100, ['a', 'b'], { type: 'percent', values: { a: 60, b: 60 } }),
    ).toThrow('Los porcentajes deben sumar 100.');
  });

  it('throws when percentages sum is slightly off (> 0.01 tolerance)', () => {
    expect(() =>
      computeShares(100, ['a', 'b'], { type: 'percent', values: { a: 60, b: 41 } }),
    ).toThrow('Los porcentajes deben sumar 100.');
  });

  it('accepts percentages that sum to exactly 100 within ±0.01 tolerance', () => {
    // 33.33 + 33.33 + 33.34 = 100.00 — valid
    expect(() =>
      computeShares(100, ['a', 'b', 'c'], {
        type: 'percent',
        values: { a: 33.33, b: 33.33, c: 33.34 },
      }),
    ).not.toThrow();
  });

  it('throws when a value is missing for a member', () => {
    expect(() => computeShares(100, ['a', 'b'], { type: 'percent', values: { a: 100 } })).toThrow(
      /b/,
    );
  });

  it('last member absorbs rounding remainder so sum equals total exactly', () => {
    const result = computeShares(100, ['a', 'b', 'c'], {
      type: 'percent',
      values: { a: 33.33, b: 33.33, c: 33.34 },
    });
    const sumCents = result.reduce((acc, r) => acc + Math.round(r.share_amount * 100), 0);
    expect(sumCents).toBe(10000);
  });
});

// ---------------------------------------------------------------------------
// computeShares — custom split
// ---------------------------------------------------------------------------

describe('computeShares — custom', () => {
  it('passes through rounded amounts when they sum to total', () => {
    const result = computeShares(100, ['a', 'b', 'c'], {
      type: 'custom',
      values: { a: 50, b: 30, c: 20 },
    });
    expect(result[0]?.share_amount).toBe(50);
    expect(result[1]?.share_amount).toBe(30);
    expect(result[2]?.share_amount).toBe(20);
  });

  it('throws when custom amounts do not sum to total', () => {
    expect(() =>
      computeShares(100, ['a', 'b'], { type: 'custom', values: { a: 60, b: 60 } }),
    ).toThrow('Los montos deben sumar el total.');
  });

  it('throws when a value is missing for a member', () => {
    expect(() => computeShares(100, ['a', 'b'], { type: 'custom', values: { a: 100 } })).toThrow(
      /b/,
    );
  });

  it('allows floating-point custom values that sum within ±0.01', () => {
    // 33.33 + 33.34 = 66.67 vs total 66.67 — valid
    expect(() =>
      computeShares(66.67, ['a', 'b'], {
        type: 'custom',
        values: { a: 33.33, b: 33.34 },
      }),
    ).not.toThrow();
  });

  it('last member absorbs rounding remainder so sum equals total exactly', () => {
    // 99.99 + 0.01 = 100 but stored as 0.01 → last gets remainder
    const result = computeShares(100, ['a', 'b'], {
      type: 'custom',
      values: { a: 99.99, b: 0.01 },
    });
    const sumCents = result.reduce((acc, r) => acc + Math.round(r.share_amount * 100), 0);
    expect(sumCents).toBe(10000);
  });
});

// ---------------------------------------------------------------------------
// computeShares — guard clauses
// ---------------------------------------------------------------------------

describe('computeShares — guard clauses', () => {
  it('throws when memberIds is empty (equal)', () => {
    expect(() => computeShares(100, [], { type: 'equal' })).toThrow('Agregá al menos un miembro.');
  });

  it('throws when memberIds is empty (percent)', () => {
    expect(() => computeShares(100, [], { type: 'percent', values: {} })).toThrow(
      'Agregá al menos un miembro.',
    );
  });

  it('throws when memberIds is empty (custom)', () => {
    expect(() => computeShares(100, [], { type: 'custom', values: {} })).toThrow(
      'Agregá al menos un miembro.',
    );
  });
});

// ---------------------------------------------------------------------------
// simplifyDebts
// ---------------------------------------------------------------------------

describe('simplifyDebts', () => {
  it('simple case: A owes B 50', () => {
    const result = simplifyDebts([
      { member_id: 'A', net: -50 },
      { member_id: 'B', net: 50 },
    ]);
    expect(result).toEqual([{ from: 'A', to: 'B', amount: 50 }]);
  });

  it('nets across multiple creditors and debtors', () => {
    // A owes 100, B owes 50 → C is owed 90, D is owed 60
    // Greedy:
    //   A(100) vs C(90) → A pays C 90, A still owes 10, C settled
    //   A(10) vs D(60)  → A pays D 10, A settled, D still owed 50
    //   B(50) vs D(50)  → B pays D 50, both settled
    const result = simplifyDebts([
      { member_id: 'A', net: -100 },
      { member_id: 'B', net: -50 },
      { member_id: 'C', net: 90 },
      { member_id: 'D', net: 60 },
    ]);
    const totalFrom = result.reduce((acc, r) => acc + r.amount, 0);
    expect(Math.round(totalFrom * 100)).toBe(15000); // 150 total
    expect(result.length).toBe(3);
    // Verify no amount is < 0.01
    result.forEach((p) => expect(p.amount).toBeGreaterThanOrEqual(0.01));
  });

  it('returns [] when all nets are zero', () => {
    const result = simplifyDebts([
      { member_id: 'A', net: 0 },
      { member_id: 'B', net: 0 },
    ]);
    expect(result).toEqual([]);
  });

  it('ignores amounts smaller than 0.01', () => {
    // net of 0.005 is below threshold
    const result = simplifyDebts([
      { member_id: 'A', net: -0.005 },
      { member_id: 'B', net: 0.005 },
    ]);
    expect(result).toEqual([]);
  });

  it('handles single debtor / single creditor where debt < credit', () => {
    // A owes 30, B is owed 100 → B still owed 70 (no second debtor)
    const result = simplifyDebts([
      { member_id: 'A', net: -30 },
      { member_id: 'B', net: 100 },
      { member_id: 'C', net: -70 },
    ]);
    const totalPaid = result.reduce((acc, r) => acc + r.amount, 0);
    expect(Math.round(totalPaid * 100)).toBe(10000); // 100
  });

  it('deterministic order: largest debtor first', () => {
    const result = simplifyDebts([
      { member_id: 'X', net: -10 },
      { member_id: 'Y', net: -100 },
      { member_id: 'Z', net: 110 },
    ]);
    // Y(100) settled first, then X(10)
    expect(result[0]?.from).toBe('Y');
    expect(result[1]?.from).toBe('X');
  });

  it('amounts are rounded to 2 decimals', () => {
    const result = simplifyDebts([
      { member_id: 'A', net: -33.333 },
      { member_id: 'B', net: 33.333 },
    ]);
    expect(result[0]?.amount).toBe(33.33);
  });
});
