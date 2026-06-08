/**
 * Tests for use-groups hooks.
 *
 * Verifies query/mutation wiring and cache invalidation. The repository layer
 * is mocked so these tests focus purely on hook behaviour and cache logic.
 *
 * Follows the same pattern as hooks/__tests__/use-expenses.test.tsx.
 */
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';

import * as groupsRepo from '@/lib/repositories/groups';
import * as sharedExpensesRepo from '@/lib/repositories/shared-expenses';
import {
  groupKeys,
  useCheckUserExists,
  useCreateSharedExpense,
  useRespondInvite,
  useCreateGroup,
  useCreateSettlement,
  useDeleteGroup,
  useGroups,
  useGroupBalances,
  useGroupExpenses,
  usePendingInvites,
} from '../use-groups';
import { expenseKeys } from '../use-expenses';

jest.mock('@/lib/repositories/groups');
jest.mock('@/lib/repositories/shared-expenses');

const mockedGroups = groupsRepo as jest.Mocked<typeof groupsRepo>;
const mockedShared = sharedExpensesRepo as jest.Mocked<typeof sharedExpensesRepo>;

// ---------------------------------------------------------------------------
// Test wrapper factory
// ---------------------------------------------------------------------------

function makeWrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { wrapper, client };
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const GROUP_ROW = {
  id: 'grp-1',
  name: 'Amigos',
  icon: 'UtensilsCrossed',
  color: '#0077B6',
  created_by: 'user-1',
  created_at: '2026-06-01T00:00:00Z',
  updated_at: '2026-06-01T00:00:00Z',
} as groupsRepo.GroupRow;

const GROUP_WITH_MEMBERS = {
  ...GROUP_ROW,
  members: [],
} as groupsRepo.GroupWithMembers;

const MEMBER_ROW = {
  id: 'mem-1',
  group_id: 'grp-1',
  user_id: 'user-1',
  role: 'owner',
  status: 'active',
  display_name: null,
  invited_by: null,
  joined_at: '2026-06-01T00:00:00Z',
  created_at: '2026-06-01T00:00:00Z',
} as groupsRepo.GroupMemberRow;

const SHARED_EXPENSE_ROW = {
  id: 'exp-1',
  amount: 3000,
  currency: 'ARS',
  category_id: null,
  group_id: 'grp-1',
  paid_by_member_id: 'mem-1',
  user_id: 'user-1',
  description: null,
  occurred_at: '2026-06-01T00:00:00Z',
  created_at: '2026-06-01T00:00:00Z',
  updated_at: '2026-06-01T00:00:00Z',
  category: null,
  items: [],
  splits: [],
} as unknown as sharedExpensesRepo.GroupExpense;

const SETTLEMENT_ROW = {
  id: 'settle-1',
  group_id: 'grp-1',
  from_member_id: 'mem-2',
  to_member_id: 'mem-1',
  amount: 1500,
  currency: 'ARS',
  settled_at: '2026-06-02T00:00:00Z',
  created_by: 'user-2',
};

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

describe('useGroups', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns groups from the repo', async () => {
    mockedGroups.listGroups.mockResolvedValueOnce({
      data: [GROUP_WITH_MEMBERS],
      error: null,
    });

    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useGroups(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(1);
    expect(result.current.data?.[0]?.id).toBe('grp-1');
  });
});

describe('useGroupBalances', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('is disabled when id is undefined', () => {
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useGroupBalances(undefined), { wrapper });
    expect(result.current.fetchStatus).toBe('idle');
  });

  it('returns balances from the repo when id is provided', async () => {
    const balances: groupsRepo.GroupBalance[] = [{ member_id: 'mem-1', currency: 'ARS', net: 500 }];
    mockedGroups.getGroupBalances.mockResolvedValueOnce({ data: balances, error: null });

    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useGroupBalances('grp-1'), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.[0]?.net).toBe(500);
  });
});

describe('useGroupExpenses', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('is disabled when id is undefined', () => {
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useGroupExpenses(undefined), { wrapper });
    expect(result.current.fetchStatus).toBe('idle');
  });

  it('returns group expenses from the repo', async () => {
    mockedShared.listGroupExpenses.mockResolvedValueOnce({
      data: [SHARED_EXPENSE_ROW],
      error: null,
    });

    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useGroupExpenses('grp-1'), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(1);
  });
});

describe('usePendingInvites', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns pending invites from the repo', async () => {
    const invites = [{ ...MEMBER_ROW, status: 'pending', group: GROUP_ROW }];
    mockedShared.listPendingInvites.mockResolvedValueOnce({ data: invites, error: null });

    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => usePendingInvites(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// useCreateSharedExpense — invalidation
// ---------------------------------------------------------------------------

describe('useCreateSharedExpense', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('invalidates both groupKeys.all and expenseKeys.all on success', async () => {
    mockedShared.createSharedExpense.mockResolvedValueOnce({
      data: SHARED_EXPENSE_ROW,
      error: null,
    });

    const { wrapper, client } = makeWrapper();
    const invalidate = jest.spyOn(client, 'invalidateQueries');
    const { result } = renderHook(() => useCreateSharedExpense(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        amount: 3000,
        currency: 'ARS',
        category_id: null,
        group_id: 'grp-1',
        paid_by_member_id: 'mem-1',
        splits: [{ member_id: 'mem-1', share_amount: 3000 }],
        items: [],
      });
    });

    expect(mockedShared.createSharedExpense).toHaveBeenCalled();

    // Must invalidate personal expense list
    expect(invalidate).toHaveBeenCalledWith({ queryKey: expenseKeys.all });
    // Must invalidate groups (the shared expense changes group state)
    expect(invalidate).toHaveBeenCalledWith({ queryKey: groupKeys.all });
  });

  it('also invalidates groupKeys.balances and groupKeys.expenses for the group', async () => {
    mockedShared.createSharedExpense.mockResolvedValueOnce({
      data: SHARED_EXPENSE_ROW,
      error: null,
    });

    const { wrapper, client } = makeWrapper();
    const invalidate = jest.spyOn(client, 'invalidateQueries');
    const { result } = renderHook(() => useCreateSharedExpense(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        amount: 3000,
        currency: 'ARS',
        category_id: null,
        group_id: 'grp-1',
        paid_by_member_id: 'mem-1',
        splits: [],
        items: [],
      });
    });

    expect(invalidate).toHaveBeenCalledWith({ queryKey: groupKeys.balances('grp-1') });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: groupKeys.expenses('grp-1') });
  });

  it('throws on repo error', async () => {
    mockedShared.createSharedExpense.mockResolvedValueOnce({
      data: null,
      error: new Error('DB error'),
    });

    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useCreateSharedExpense(), { wrapper });

    await expect(
      result.current.mutateAsync({
        amount: 100,
        currency: 'ARS',
        category_id: null,
        group_id: 'grp-1',
        paid_by_member_id: 'mem-1',
        splits: [],
        items: [],
      }),
    ).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// useRespondInvite — invalidation
// ---------------------------------------------------------------------------

describe('useRespondInvite', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('invalidates invites and groupKeys.all on success', async () => {
    const activeMember = { ...MEMBER_ROW, status: 'active', joined_at: '2026-06-02T00:00:00Z' };
    mockedGroups.respondInvite.mockResolvedValueOnce({ data: activeMember, error: null });

    const { wrapper, client } = makeWrapper();
    const invalidate = jest.spyOn(client, 'invalidateQueries');
    const { result } = renderHook(() => useRespondInvite(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ memberId: 'mem-1', accept: true });
    });

    expect(mockedGroups.respondInvite).toHaveBeenCalledWith('mem-1', true);
    // Invites list must be invalidated
    expect(invalidate).toHaveBeenCalledWith({ queryKey: groupKeys.invites() });
    // Accepting reveals the group — all groups must be refreshed
    expect(invalidate).toHaveBeenCalledWith({ queryKey: groupKeys.all });
  });

  it('throws on repo error', async () => {
    mockedGroups.respondInvite.mockResolvedValueOnce({
      data: null,
      error: new Error('Not found'),
    });

    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useRespondInvite(), { wrapper });

    await expect(
      result.current.mutateAsync({ memberId: 'mem-1', accept: false }),
    ).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// useCreateGroup
// ---------------------------------------------------------------------------

describe('useCreateGroup', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('invalidates groupKeys.all on success', async () => {
    mockedGroups.createGroup.mockResolvedValueOnce({ data: GROUP_ROW, error: null });

    const { wrapper, client } = makeWrapper();
    const invalidate = jest.spyOn(client, 'invalidateQueries');
    const { result } = renderHook(() => useCreateGroup(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        name: 'Amigos',
        icon: 'UtensilsCrossed' as const,
        color: '#0077B6' as const,
        placeholders: [],
      });
    });

    expect(invalidate).toHaveBeenCalledWith({ queryKey: groupKeys.all });
  });
});

// ---------------------------------------------------------------------------
// useCreateSettlement
// ---------------------------------------------------------------------------

describe('useCreateSettlement', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('invalidates balances and detail for the group on success', async () => {
    mockedShared.createSettlement.mockResolvedValueOnce({
      data: SETTLEMENT_ROW as unknown as import('@/types/supabase').Tables<'group_settlements'>,
      error: null,
    });

    const { wrapper, client } = makeWrapper();
    const invalidate = jest.spyOn(client, 'invalidateQueries');
    const { result } = renderHook(() => useCreateSettlement(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        group_id: 'grp-1',
        from_member_id: 'mem-2',
        to_member_id: 'mem-1',
        amount: 1500,
        currency: 'ARS' as const,
      });
    });

    expect(invalidate).toHaveBeenCalledWith({ queryKey: groupKeys.balances('grp-1') });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: groupKeys.detail('grp-1') });
  });
});

// ---------------------------------------------------------------------------
// useCheckUserExists
// ---------------------------------------------------------------------------

describe('useCheckUserExists', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns true when the repo confirms the account exists', async () => {
    mockedGroups.checkUserExists.mockResolvedValueOnce({ data: true, error: null });

    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useCheckUserExists(), { wrapper });

    let outcome: boolean | undefined;
    await act(async () => {
      outcome = await result.current.mutateAsync('found@example.com');
    });

    expect(mockedGroups.checkUserExists).toHaveBeenCalledWith('found@example.com');
    expect(outcome).toBe(true);
  });

  it('returns false when the repo says the account does not exist', async () => {
    mockedGroups.checkUserExists.mockResolvedValueOnce({ data: false, error: null });

    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useCheckUserExists(), { wrapper });

    let outcome: boolean | undefined;
    await act(async () => {
      outcome = await result.current.mutateAsync('notfound@example.com');
    });

    expect(outcome).toBe(false);
  });

  it('throws on repo error', async () => {
    mockedGroups.checkUserExists.mockResolvedValueOnce({
      data: null,
      error: new Error('auth required'),
    });

    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useCheckUserExists(), { wrapper });

    await expect(result.current.mutateAsync('bad@example.com')).rejects.toThrow('auth required');
  });
});

// ---------------------------------------------------------------------------
// useDeleteGroup
// ---------------------------------------------------------------------------

describe('useDeleteGroup', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('invalidates groupKeys.all and removes the detail query on success', async () => {
    mockedGroups.deleteGroup.mockResolvedValueOnce({ data: { id: 'grp-1' }, error: null });

    const { wrapper, client } = makeWrapper();
    const invalidate = jest.spyOn(client, 'invalidateQueries');
    const remove = jest.spyOn(client, 'removeQueries');
    const { result } = renderHook(() => useDeleteGroup(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync('grp-1');
    });

    expect(invalidate).toHaveBeenCalledWith({ queryKey: groupKeys.all });
    expect(remove).toHaveBeenCalledWith({ queryKey: groupKeys.detail('grp-1') });
  });
});
