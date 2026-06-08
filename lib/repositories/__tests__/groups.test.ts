/**
 * Tests for the groups repository.
 *
 * Drives Supabase through a chainable query builder mock and verifies the SQL
 * shape for every public function. RPC calls are mocked via supabase.rpc.
 *
 * Mirrors the pattern established in expenses.test.ts and categories.test.ts.
 */
import { supabase } from '@/lib/supabase';
import * as repo from '../groups';

// ---------------------------------------------------------------------------
// Chainable Postgrest mock
// ---------------------------------------------------------------------------

type ChainMethod =
  | 'select'
  | 'insert'
  | 'update'
  | 'delete'
  | 'eq'
  | 'order'
  | 'maybeSingle'
  | 'single';

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
  const methods: ChainMethod[] = [
    'select',
    'insert',
    'update',
    'delete',
    'eq',
    'order',
    'maybeSingle',
    'single',
  ];

  for (const m of methods) {
    chain[m] = jest.fn((...args: unknown[]) => {
      calls.push({ method: m, args });
      if (m === 'maybeSingle' || m === 'single') {
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

const GROUP_ROW = {
  id: 'grp-1',
  name: 'Viaje a Bariloche',
  icon: 'UtensilsCrossed',
  color: '#0077B6',
  created_by: 'user-1',
  created_at: '2026-06-01T00:00:00Z',
  updated_at: '2026-06-01T00:00:00Z',
};

const GROUP_WITH_MEMBERS = {
  ...GROUP_ROW,
  members: [
    {
      id: 'mem-1',
      group_id: 'grp-1',
      user_id: 'user-1',
      role: 'owner',
      status: 'active',
      display_name: null,
      invited_by: null,
      joined_at: '2026-06-01T00:00:00Z',
      created_at: '2026-06-01T00:00:00Z',
    },
  ],
};

const MEMBER_ROW = GROUP_WITH_MEMBERS.members[0]!;

// ---------------------------------------------------------------------------
// listGroups
// ---------------------------------------------------------------------------

describe('listGroups', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('selects groups with nested members and orders by created_at desc', async () => {
    const handle = makeChain({ data: [GROUP_WITH_MEMBERS], error: null });
    // order is the terminal call: make it resolve
    handle.chain.order.mockImplementationOnce((...args: unknown[]) => {
      handle.calls.push({ method: 'order', args });
      return Promise.resolve({ data: [GROUP_WITH_MEMBERS], error: null });
    });
    (supabase.from as jest.Mock).mockReturnValueOnce(handle.chain);

    const result = await repo.listGroups();

    expect(result.error).toBeNull();
    expect(result.data).toHaveLength(1);
    expect(result.data?.[0]?.members).toHaveLength(1);

    const orderCall = handle.calls.find((c) => c.method === 'order');
    expect(orderCall?.args).toEqual(['created_at', { ascending: false }]);
  });

  it('returns { data: null, error } when the query errors', async () => {
    const pgError = { code: '42501', message: 'permission denied' };
    const handle = makeChain({ data: null, error: pgError });
    handle.chain.order.mockImplementationOnce((...args: unknown[]) => {
      handle.calls.push({ method: 'order', args });
      return Promise.resolve({ data: null, error: pgError });
    });
    (supabase.from as jest.Mock).mockReturnValueOnce(handle.chain);

    const result = await repo.listGroups();

    expect(result.data).toBeNull();
    expect(result.error).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// getGroup
// ---------------------------------------------------------------------------

describe('getGroup', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('fetches by id using eq + maybeSingle', async () => {
    const handle = makeChain({ data: GROUP_WITH_MEMBERS, error: null });
    (supabase.from as jest.Mock).mockReturnValueOnce(handle.chain);

    const result = await repo.getGroup('grp-1');

    expect(result.error).toBeNull();
    expect(result.data?.id).toBe('grp-1');

    const eqCall = handle.calls.find((c) => c.method === 'eq');
    expect(eqCall?.args).toEqual(['id', 'grp-1']);
    expect(handle.calls.find((c) => c.method === 'maybeSingle')).toBeDefined();
  });

  it('returns { data: null, error: null } when the group is not found', async () => {
    const handle = makeChain({ data: null, error: null });
    (supabase.from as jest.Mock).mockReturnValueOnce(handle.chain);

    const result = await repo.getGroup('non-existent');

    expect(result.data).toBeNull();
    expect(result.error).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// createGroup
// ---------------------------------------------------------------------------

describe('createGroup', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('calls rpc("create_group") with the correct parameters', async () => {
    (supabase.rpc as jest.Mock).mockResolvedValueOnce({ data: GROUP_ROW, error: null });

    const input = {
      name: 'Viaje a Bariloche',
      icon: 'UtensilsCrossed' as const,
      color: '#0077B6' as const,
      placeholders: ['Juan', 'María'],
    };

    await repo.createGroup(input);

    const rpcCall = (supabase.rpc as jest.Mock).mock.calls[0];
    expect(rpcCall?.[0]).toBe('create_group');
    const args = rpcCall?.[1] as Record<string, unknown>;
    expect(args.p_name).toBe('Viaje a Bariloche');
    expect(args.p_icon).toBe('UtensilsCrossed');
    expect(args.p_color).toBe('#0077B6');
    expect(args.p_placeholders).toEqual(['Juan', 'María']);
  });

  it('returns the created group row on success', async () => {
    (supabase.rpc as jest.Mock).mockResolvedValueOnce({ data: GROUP_ROW, error: null });

    const result = await repo.createGroup({
      name: 'Viaje a Bariloche',
      icon: 'UtensilsCrossed' as const,
      color: '#0077B6' as const,
      placeholders: [],
    });

    expect(result.error).toBeNull();
    expect(result.data?.id).toBe('grp-1');
  });

  it('returns { data: null, error } when the rpc fails', async () => {
    const pgError = { code: '42501', message: 'permission denied' };
    (supabase.rpc as jest.Mock).mockResolvedValueOnce({ data: null, error: pgError });

    const result = await repo.createGroup({
      name: 'Test',
      icon: 'UtensilsCrossed' as const,
      color: '#0077B6' as const,
      placeholders: [],
    });

    expect(result.data).toBeNull();
    expect(result.error).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// addPlaceholder
// ---------------------------------------------------------------------------

describe('addPlaceholder', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('calls rpc("add_group_member") with the correct parameters', async () => {
    (supabase.rpc as jest.Mock).mockResolvedValueOnce({ data: MEMBER_ROW, error: null });

    await repo.addPlaceholder('grp-1', 'Pedro');

    const rpcCall = (supabase.rpc as jest.Mock).mock.calls[0];
    expect(rpcCall?.[0]).toBe('add_group_member');
    const args = rpcCall?.[1] as Record<string, unknown>;
    expect(args.p_group_id).toBe('grp-1');
    expect(args.p_display_name).toBe('Pedro');
  });

  it('returns the new member row on success', async () => {
    (supabase.rpc as jest.Mock).mockResolvedValueOnce({ data: MEMBER_ROW, error: null });

    const result = await repo.addPlaceholder('grp-1', 'Pedro');

    expect(result.error).toBeNull();
    expect(result.data?.id).toBe('mem-1');
  });
});

// ---------------------------------------------------------------------------
// inviteMember
// ---------------------------------------------------------------------------

describe('inviteMember', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('calls rpc("invite_group_member") and returns the status', async () => {
    const statusPayload = { status: 'invited', member_id: 'mem-2' };
    (supabase.rpc as jest.Mock).mockResolvedValueOnce({ data: statusPayload, error: null });

    const result = await repo.inviteMember('grp-1', 'invitee@example.com');

    const rpcCall = (supabase.rpc as jest.Mock).mock.calls[0];
    expect(rpcCall?.[0]).toBe('invite_group_member');
    const args = rpcCall?.[1] as Record<string, unknown>;
    expect(args.p_group_id).toBe('grp-1');
    expect(args.p_email).toBe('invitee@example.com');

    expect(result.error).toBeNull();
    expect(result.data?.status).toBe('invited');
    expect(result.data?.member_id).toBe('mem-2');
  });

  it('returns status "not_found" when the email does not match a user', async () => {
    (supabase.rpc as jest.Mock).mockResolvedValueOnce({
      data: { status: 'not_found' },
      error: null,
    });

    const result = await repo.inviteMember('grp-1', 'unknown@example.com');

    expect(result.error).toBeNull();
    expect(result.data?.status).toBe('not_found');
  });

  it('returns { data: null, error } when the rpc fails', async () => {
    const pgError = { code: '42501', message: 'permission denied' };
    (supabase.rpc as jest.Mock).mockResolvedValueOnce({ data: null, error: pgError });

    const result = await repo.inviteMember('grp-1', 'fail@example.com');

    expect(result.data).toBeNull();
    expect(result.error).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// respondInvite
// ---------------------------------------------------------------------------

describe('respondInvite', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('calls rpc("respond_group_invite") with accept=true', async () => {
    const activeMember = { ...MEMBER_ROW, status: 'active', joined_at: '2026-06-02T00:00:00Z' };
    (supabase.rpc as jest.Mock).mockResolvedValueOnce({ data: activeMember, error: null });

    const result = await repo.respondInvite('mem-1', true);

    const rpcCall = (supabase.rpc as jest.Mock).mock.calls[0];
    expect(rpcCall?.[0]).toBe('respond_group_invite');
    const args = rpcCall?.[1] as Record<string, unknown>;
    expect(args.p_member_id).toBe('mem-1');
    expect(args.p_accept).toBe(true);

    expect(result.error).toBeNull();
    expect(result.data?.status).toBe('active');
  });

  it('calls rpc("respond_group_invite") with accept=false', async () => {
    (supabase.rpc as jest.Mock).mockResolvedValueOnce({ data: null, error: null });

    await repo.respondInvite('mem-1', false);

    const rpcCall = (supabase.rpc as jest.Mock).mock.calls[0];
    const args = rpcCall?.[1] as Record<string, unknown>;
    expect(args.p_accept).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// deleteGroup
// ---------------------------------------------------------------------------

describe('deleteGroup', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns { id } on success', async () => {
    const handle = makeChain({ data: null, error: null });
    handle.chain.eq.mockImplementationOnce((...args: unknown[]) => {
      handle.calls.push({ method: 'eq', args });
      return Promise.resolve({ data: null, error: null });
    });
    (supabase.from as jest.Mock).mockReturnValueOnce(handle.chain);

    const result = await repo.deleteGroup('grp-1');

    expect(result.error).toBeNull();
    expect(result.data).toEqual({ id: 'grp-1' });

    const eqCall = handle.calls.find((c) => c.method === 'eq');
    expect(eqCall?.args).toEqual(['id', 'grp-1']);
  });

  it('returns { data: null, error } when the delete fails', async () => {
    const pgError = { code: '42501', message: 'permission denied' };
    const handle = makeChain({ data: null, error: pgError });
    handle.chain.eq.mockImplementationOnce((...args: unknown[]) => {
      handle.calls.push({ method: 'eq', args });
      return Promise.resolve({ data: null, error: pgError });
    });
    (supabase.from as jest.Mock).mockReturnValueOnce(handle.chain);

    const result = await repo.deleteGroup('grp-1');

    expect(result.data).toBeNull();
    expect(result.error).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// checkUserExists
// ---------------------------------------------------------------------------

describe('checkUserExists', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('calls rpc("user_exists_by_email") with the correct parameter', async () => {
    (supabase.rpc as jest.Mock).mockResolvedValueOnce({ data: true, error: null });

    await repo.checkUserExists('user@example.com');

    const rpcCall = (supabase.rpc as jest.Mock).mock.calls[0];
    expect(rpcCall?.[0]).toBe('user_exists_by_email');
    const args = rpcCall?.[1] as Record<string, unknown>;
    expect(args.p_email).toBe('user@example.com');
  });

  it('returns true when the account exists', async () => {
    (supabase.rpc as jest.Mock).mockResolvedValueOnce({ data: true, error: null });

    const result = await repo.checkUserExists('found@example.com');

    expect(result.error).toBeNull();
    expect(result.data).toBe(true);
  });

  it('returns false when the account does not exist', async () => {
    (supabase.rpc as jest.Mock).mockResolvedValueOnce({ data: false, error: null });

    const result = await repo.checkUserExists('notfound@example.com');

    expect(result.error).toBeNull();
    expect(result.data).toBe(false);
  });

  it('returns { data: null, error } when the rpc fails', async () => {
    const pgError = { code: '42501', message: 'permission denied' };
    (supabase.rpc as jest.Mock).mockResolvedValueOnce({ data: null, error: pgError });

    const result = await repo.checkUserExists('fail@example.com');

    expect(result.data).toBeNull();
    expect(result.error).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// getGroupBalances
// ---------------------------------------------------------------------------

describe('getGroupBalances', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('calls rpc("get_group_balances") with the correct group id', async () => {
    const balances = [
      { member_id: 'mem-1', currency: 'ARS', net: 500 },
      { member_id: 'mem-2', currency: 'ARS', net: -500 },
    ];
    (supabase.rpc as jest.Mock).mockResolvedValueOnce({ data: balances, error: null });

    const result = await repo.getGroupBalances('grp-1');

    const rpcCall = (supabase.rpc as jest.Mock).mock.calls[0];
    expect(rpcCall?.[0]).toBe('get_group_balances');
    const args = rpcCall?.[1] as Record<string, unknown>;
    expect(args.p_group_id).toBe('grp-1');

    expect(result.error).toBeNull();
    expect(result.data).toHaveLength(2);
    expect(result.data?.[0]?.net).toBe(500);
  });

  it('returns { data: null, error } when the rpc fails', async () => {
    const pgError = { code: '42501', message: 'permission denied' };
    (supabase.rpc as jest.Mock).mockResolvedValueOnce({ data: null, error: pgError });

    const result = await repo.getGroupBalances('grp-1');

    expect(result.data).toBeNull();
    expect(result.error).toBeTruthy();
  });
});
