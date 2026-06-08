/**
 * Tests for the shared-expenses repository.
 *
 * Drives Supabase through a chainable query builder mock and verifies the SQL
 * shape for every public function. RPC calls are mocked via supabase.rpc.
 *
 * Mirrors the pattern established in expenses.test.ts and groups.test.ts.
 */
import { supabase } from '@/lib/supabase';
import * as repo from '../shared-expenses';

// ---------------------------------------------------------------------------
// Chainable Postgrest mock
// ---------------------------------------------------------------------------

type ChainMethod = 'select' | 'eq' | 'order' | 'maybeSingle';

type ChainMocks = Record<ChainMethod, jest.Mock>;

interface ChainHandle {
  chain: ChainMocks;
  calls: { method: string; args: unknown[] }[];
}

function makeChain(
  result: { data: unknown; error: unknown } = { data: null, error: null },
): ChainHandle {
  const calls: { method: string; args: unknown[] }[] = [];
  const chain = {} as ChainMocks;
  const methods: ChainMethod[] = ['select', 'eq', 'order', 'maybeSingle'];

  for (const m of methods) {
    chain[m] = jest.fn((...args: unknown[]) => {
      calls.push({ method: m, args });
      if (m === 'maybeSingle') {
        return Promise.resolve(result);
      }
      return chain;
    });
  }

  return { chain, calls };
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const EXPENSE_ROW = {
  id: 'exp-shared-1',
  user_id: 'user-1',
  group_id: 'grp-1',
  paid_by_member_id: 'mem-1',
  amount: 3000,
  currency: 'ARS',
  category_id: 'cat-1',
  description: 'Pizza',
  occurred_at: '2026-06-01T20:00:00Z',
  created_at: '2026-06-01T20:00:00Z',
  updated_at: '2026-06-01T20:00:00Z',
  category: null,
  items: [],
  splits: [
    {
      id: 'split-1',
      expense_id: 'exp-shared-1',
      group_id: 'grp-1',
      member_id: 'mem-1',
      share_amount: 1500,
      created_at: '2026-06-01T20:00:00Z',
    },
    {
      id: 'split-2',
      expense_id: 'exp-shared-1',
      group_id: 'grp-1',
      member_id: 'mem-2',
      share_amount: 1500,
      created_at: '2026-06-01T20:00:00Z',
    },
  ],
};

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

const MEMBER_WITH_GROUP = {
  id: 'mem-invite-1',
  group_id: 'grp-invite-1',
  user_id: 'user-1',
  role: 'member',
  status: 'pending',
  display_name: null,
  invited_by: 'user-2',
  joined_at: null,
  created_at: '2026-06-01T00:00:00Z',
  group: {
    id: 'grp-invite-1',
    name: 'Depto',
    icon: 'Home',
    color: '#0077B6',
    created_by: 'user-2',
    created_at: '2026-06-01T00:00:00Z',
    updated_at: '2026-06-01T00:00:00Z',
  },
};

// ---------------------------------------------------------------------------
// createSharedExpense
// ---------------------------------------------------------------------------

describe('createSharedExpense', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('calls rpc("create_shared_expense") with all required parameters', async () => {
    (supabase.rpc as jest.Mock).mockResolvedValueOnce({
      data: { id: 'exp-shared-1' },
      error: null,
    });
    const fetchHandle = makeChain({ data: EXPENSE_ROW, error: null });
    (supabase.from as jest.Mock).mockReturnValueOnce(fetchHandle.chain);

    const input: repo.CreateSharedExpenseInput = {
      amount: 3000,
      currency: 'ARS',
      category_id: 'cat-1',
      description: 'Pizza',
      occurred_at: '2026-06-01T20:00:00Z',
      items: [{ name: 'Pizza margherita', quantity: 1, unit_price: 3000, line_total: 3000 }],
      group_id: 'grp-1',
      paid_by_member_id: 'mem-1',
      splits: [
        { member_id: 'mem-1', share_amount: 1500 },
        { member_id: 'mem-2', share_amount: 1500 },
      ],
    };

    await repo.createSharedExpense(input);

    const rpcCall = (supabase.rpc as jest.Mock).mock.calls[0];
    expect(rpcCall?.[0]).toBe('create_shared_expense');
    const args = rpcCall?.[1] as Record<string, unknown>;
    expect(args.p_amount).toBe(3000);
    expect(args.p_currency).toBe('ARS');
    expect(args.p_category_id).toBe('cat-1');
    expect(args.p_group_id).toBe('grp-1');
    expect(args.p_paid_by_member_id).toBe('mem-1');
    expect(Array.isArray(args.p_splits)).toBe(true);
    expect(Array.isArray(args.p_items)).toBe(true);
  });

  it('re-fetches the created expense after the rpc succeeds', async () => {
    (supabase.rpc as jest.Mock).mockResolvedValueOnce({
      data: { id: 'exp-shared-1' },
      error: null,
    });
    const fetchHandle = makeChain({ data: EXPENSE_ROW, error: null });
    (supabase.from as jest.Mock).mockReturnValueOnce(fetchHandle.chain);

    const result = await repo.createSharedExpense({
      amount: 3000,
      currency: 'ARS',
      category_id: null,
      group_id: 'grp-1',
      paid_by_member_id: 'mem-1',
      splits: [{ member_id: 'mem-1', share_amount: 3000 }],
      items: [],
    });

    // Verifies the re-fetch: supabase.from was called (for the refetch)
    expect(supabase.from).toHaveBeenCalledWith('expenses');
    // maybeSingle was used for the re-fetch
    expect(fetchHandle.calls.find((c) => c.method === 'maybeSingle')).toBeDefined();
    // The eq filter must reference the id returned from the rpc
    const eqCall = fetchHandle.calls.find((c) => c.method === 'eq');
    expect(eqCall?.args).toEqual(['id', 'exp-shared-1']);

    expect(result.error).toBeNull();
    expect(result.data?.id).toBe('exp-shared-1');
  });

  it('returns { data: null, error } when the rpc fails', async () => {
    const pgError = { code: '42501', message: 'permission denied' };
    (supabase.rpc as jest.Mock).mockResolvedValueOnce({ data: null, error: pgError });

    const result = await repo.createSharedExpense({
      amount: 100,
      currency: 'ARS',
      category_id: null,
      group_id: 'grp-1',
      paid_by_member_id: 'mem-1',
      splits: [],
      items: [],
    });

    expect(result.data).toBeNull();
    expect(result.error).toBeTruthy();
    // No re-fetch should happen after rpc error
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it('returns { data: null, error } when rpc returns no id', async () => {
    (supabase.rpc as jest.Mock).mockResolvedValueOnce({ data: null, error: null });

    const result = await repo.createSharedExpense({
      amount: 100,
      currency: 'ARS',
      category_id: null,
      group_id: 'grp-1',
      paid_by_member_id: 'mem-1',
      splits: [],
      items: [],
    });

    expect(result.data).toBeNull();
    expect(result.error).toBeInstanceOf(Error);
  });
});

// ---------------------------------------------------------------------------
// listGroupExpenses
// ---------------------------------------------------------------------------

describe('listGroupExpenses', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('filters by group_id and orders by occurred_at desc', async () => {
    const handle = makeChain({ data: null, error: null });
    // order is the terminal step
    handle.chain.order.mockImplementationOnce((...args: unknown[]) => {
      handle.calls.push({ method: 'order', args });
      return Promise.resolve({ data: [EXPENSE_ROW], error: null });
    });
    (supabase.from as jest.Mock).mockReturnValueOnce(handle.chain);

    const result = await repo.listGroupExpenses('grp-1');

    expect(result.error).toBeNull();
    expect(result.data).toHaveLength(1);

    const eqCall = handle.calls.find((c) => c.method === 'eq');
    expect(eqCall?.args).toEqual(['group_id', 'grp-1']);

    const orderCall = handle.calls.find((c) => c.method === 'order');
    expect(orderCall?.args).toEqual(['occurred_at', { ascending: false }]);
  });

  it('uses the correct nested select with splits', async () => {
    const handle = makeChain({ data: null, error: null });
    handle.chain.order.mockImplementationOnce(() => Promise.resolve({ data: [], error: null }));
    (supabase.from as jest.Mock).mockReturnValueOnce(handle.chain);

    await repo.listGroupExpenses('grp-1');

    const selectCall = handle.calls.find((c) => c.method === 'select');
    const selectArg = selectCall?.args[0] as string;
    // Must include splits relation
    expect(selectArg).toContain('splits');
    expect(selectArg).toContain('expense_splits');
    // Must include items and category like personal expenses
    expect(selectArg).toContain('items');
    expect(selectArg).toContain('category');
  });

  it('sorts items by position ascending within each expense', async () => {
    const rowWithUnsortedItems = {
      ...EXPENSE_ROW,
      items: [
        { id: 'i2', position: 2, name: 'B', quantity: 1, unit_price: null, line_total: 0 },
        { id: 'i1', position: 1, name: 'A', quantity: 1, unit_price: null, line_total: 0 },
      ],
    };
    const handle = makeChain({ data: null, error: null });
    handle.chain.order.mockImplementationOnce(() =>
      Promise.resolve({ data: [rowWithUnsortedItems], error: null }),
    );
    (supabase.from as jest.Mock).mockReturnValueOnce(handle.chain);

    const result = await repo.listGroupExpenses('grp-1');

    expect(result.data?.[0]?.items[0]?.name).toBe('A');
    expect(result.data?.[0]?.items[1]?.name).toBe('B');
  });

  it('returns { data: null, error } when the query fails', async () => {
    const pgError = { code: '42501', message: 'permission denied' };
    const handle = makeChain({ data: null, error: null });
    handle.chain.order.mockImplementationOnce(() =>
      Promise.resolve({ data: null, error: pgError }),
    );
    (supabase.from as jest.Mock).mockReturnValueOnce(handle.chain);

    const result = await repo.listGroupExpenses('grp-1');

    expect(result.data).toBeNull();
    expect(result.error).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// createSettlement
// ---------------------------------------------------------------------------

describe('createSettlement', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('calls rpc("create_settlement") with all parameters', async () => {
    (supabase.rpc as jest.Mock).mockResolvedValueOnce({ data: SETTLEMENT_ROW, error: null });

    const input = {
      group_id: 'grp-1',
      from_member_id: 'mem-2',
      to_member_id: 'mem-1',
      amount: 1500,
      currency: 'ARS' as const,
    };

    await repo.createSettlement(input);

    const rpcCall = (supabase.rpc as jest.Mock).mock.calls[0];
    expect(rpcCall?.[0]).toBe('create_settlement');
    const args = rpcCall?.[1] as Record<string, unknown>;
    expect(args.p_from_member_id).toBe('mem-2');
    expect(args.p_to_member_id).toBe('mem-1');
    expect(args.p_amount).toBe(1500);
    expect(args.p_currency).toBe('ARS');
    expect(args.p_group_id).toBe('grp-1');
  });

  it('returns the settlement row on success', async () => {
    (supabase.rpc as jest.Mock).mockResolvedValueOnce({ data: SETTLEMENT_ROW, error: null });

    const result = await repo.createSettlement({
      group_id: 'grp-1',
      from_member_id: 'mem-2',
      to_member_id: 'mem-1',
      amount: 1500,
      currency: 'ARS' as const,
    });

    expect(result.error).toBeNull();
    expect(result.data?.id).toBe('settle-1');
    expect(result.data?.amount).toBe(1500);
  });

  it('returns { data: null, error } when the rpc fails', async () => {
    const pgError = { code: '42501', message: 'permission denied' };
    (supabase.rpc as jest.Mock).mockResolvedValueOnce({ data: null, error: pgError });

    const result = await repo.createSettlement({
      group_id: 'grp-1',
      from_member_id: 'mem-2',
      to_member_id: 'mem-1',
      amount: 1500,
      currency: 'ARS' as const,
    });

    expect(result.data).toBeNull();
    expect(result.error).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// listPendingInvites
// ---------------------------------------------------------------------------

describe('listPendingInvites', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('queries group_members filtered by user_id and status=pending', async () => {
    (supabase.auth.getUser as jest.Mock).mockResolvedValueOnce({
      data: { user: { id: 'user-1' } },
      error: null,
    });

    const handle = makeChain({ data: null, error: null });
    // eq('status', 'pending') is the terminal call
    let eqCallCount = 0;
    handle.chain.eq.mockImplementation((...args: unknown[]) => {
      handle.calls.push({ method: 'eq', args });
      eqCallCount++;
      if (eqCallCount === 2) {
        // second eq call (status filter) resolves
        return Promise.resolve({ data: [MEMBER_WITH_GROUP], error: null });
      }
      return handle.chain;
    });
    (supabase.from as jest.Mock).mockReturnValueOnce(handle.chain);

    const result = await repo.listPendingInvites();

    expect(result.error).toBeNull();
    expect(result.data).toHaveLength(1);
    expect(result.data?.[0]?.status).toBe('pending');

    const eqCalls = handle.calls.filter((c) => c.method === 'eq');
    // First eq: user_id filter, second eq: status filter
    expect(eqCalls.some((c) => c.args[0] === 'user_id' && c.args[1] === 'user-1')).toBe(true);
    expect(eqCalls.some((c) => c.args[0] === 'status' && c.args[1] === 'pending')).toBe(true);
  });

  it('joins the group relation in the select', async () => {
    (supabase.auth.getUser as jest.Mock).mockResolvedValueOnce({
      data: { user: { id: 'user-1' } },
      error: null,
    });

    const handle = makeChain({ data: null, error: null });
    let eqCallCount = 0;
    handle.chain.eq.mockImplementation((...args: unknown[]) => {
      handle.calls.push({ method: 'eq', args });
      eqCallCount++;
      if (eqCallCount === 2) {
        return Promise.resolve({ data: [], error: null });
      }
      return handle.chain;
    });
    (supabase.from as jest.Mock).mockReturnValueOnce(handle.chain);

    await repo.listPendingInvites();

    const selectCall = handle.calls.find((c) => c.method === 'select');
    expect(selectCall?.args[0]).toContain('group');
    expect(selectCall?.args[0]).toContain('groups');
  });

  it('returns { data: null, error } when there is no active session', async () => {
    (supabase.auth.getUser as jest.Mock).mockResolvedValueOnce({
      data: { user: null },
      error: null,
    });

    const result = await repo.listPendingInvites();

    expect(result.data).toBeNull();
    expect(result.error).toBeInstanceOf(Error);
    expect((result.error as Error).message).toMatch(/sesión/i);
  });
});
