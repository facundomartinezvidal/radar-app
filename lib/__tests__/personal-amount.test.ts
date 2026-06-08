/**
 * Unit tests for `personalAmount` pure helper (HU-17).
 *
 * Rules:
 * - Personal expense (group_id == null) → full expense.amount
 * - Shared expense (group_id != null, my split present) → split.share_amount
 * - Shared expense, no split for me → 0
 * - Multiple splits, mine is selected by member.user_id
 */
import { personalAmount } from '@/lib/repositories/expenses';
import type { ExpenseWithItems, ExpenseSplitWithMember } from '@/lib/repositories/expenses';

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

function makeExpense(overrides: Partial<ExpenseWithItems> = {}): ExpenseWithItems {
  return {
    id: 'exp-1',
    user_id: 'user-1',
    amount: 2000,
    currency: 'ARS',
    category_id: null,
    description: null,
    occurred_at: '2026-06-01T00:00:00Z',
    created_at: '2026-06-01T00:00:00Z',
    updated_at: '2026-06-01T00:00:00Z',
    group_id: null,
    paid_by_member_id: null,
    source: 'manual',
    recurrence_id: null,
    occurred_date: null,
    category: null,
    items: [],
    splits: [],
    ...overrides,
  };
}

function makeSplit(userId: string | null, shareAmount: number): ExpenseSplitWithMember {
  return {
    id: `split-${userId ?? 'null'}`,
    expense_id: 'exp-1',
    group_id: 'grp-1',
    member_id: `mem-${userId ?? 'null'}`,
    share_amount: shareAmount,
    created_at: '2026-06-01T00:00:00Z',
    member: { user_id: userId },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('personalAmount', () => {
  describe('personal expense (group_id == null)', () => {
    it('returns the full amount regardless of userId', () => {
      const expense = makeExpense({ amount: 1500, group_id: null });
      expect(personalAmount(expense, 'user-1')).toBe(1500);
    });

    it('coerces string-numeric amount to number', () => {
      // Supabase sometimes returns numeric columns as strings
      const expense = makeExpense({ amount: '3500' as unknown as number, group_id: null });
      expect(personalAmount(expense, 'user-1')).toBe(3500);
    });
  });

  describe('shared expense (group_id != null)', () => {
    it('returns the matching split share_amount', () => {
      const splits = [makeSplit('user-other', 1500), makeSplit('user-1', 500)];
      const expense = makeExpense({ amount: 2000, group_id: 'grp-1', splits });
      expect(personalAmount(expense, 'user-1')).toBe(500);
    });

    it('returns 0 when no split exists for the given userId', () => {
      const splits = [makeSplit('user-other', 2000)];
      const expense = makeExpense({ amount: 2000, group_id: 'grp-1', splits });
      expect(personalAmount(expense, 'user-1')).toBe(0);
    });

    it('returns 0 when splits is empty', () => {
      const expense = makeExpense({ amount: 2000, group_id: 'grp-1', splits: [] });
      expect(personalAmount(expense, 'user-1')).toBe(0);
    });

    it('picks the correct split when there are multiple members', () => {
      const splits = [
        makeSplit('user-a', 1000),
        makeSplit('user-b', 500),
        makeSplit('user-c', 500),
      ];
      const expense = makeExpense({ amount: 2000, group_id: 'grp-1', splits });

      expect(personalAmount(expense, 'user-a')).toBe(1000);
      expect(personalAmount(expense, 'user-b')).toBe(500);
      expect(personalAmount(expense, 'user-c')).toBe(500);
    });

    it('skips splits where member.user_id is null (placeholder members)', () => {
      const splits = [
        makeSplit(null, 1000), // placeholder — no registered user
        makeSplit('user-1', 1000),
      ];
      const expense = makeExpense({ amount: 2000, group_id: 'grp-1', splits });
      expect(personalAmount(expense, 'user-1')).toBe(1000);
    });

    it('coerces string-numeric share_amount to number', () => {
      const splits = [
        {
          ...makeSplit('user-1', 750),
          share_amount: '750' as unknown as number,
        },
      ];
      const expense = makeExpense({ amount: 1500, group_id: 'grp-1', splits });
      expect(personalAmount(expense, 'user-1')).toBe(750);
    });
  });
});
