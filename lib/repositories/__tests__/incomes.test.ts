/**
 * Tests for the incomes repository — drives Supabase through a chainable
 * query builder mock and verifies the SQL pieces (filters, ranges, ordering).
 *
 * Pattern mirrors expenses.test.ts:
 * - makeChain() builds a reusable chainable Postgrest mock
 * - supabase.auth.getUser must be mocked for functions that call requireUserId()
 * - supabase.rpc is mocked for aggregate calls (get_income_totals)
 * - recurrence helpers (dayOfMonthFrom, firstFutureOccurrence) are tested
 *   indirectly by asserting the values sent to Supabase
 */
import { supabase } from '@/lib/supabase';
import * as repo from '../incomes';

// ---------------------------------------------------------------------------
// Chainable Postgrest mock — identical scaffold to expenses.test.ts
// ---------------------------------------------------------------------------

type ChainMethod =
  | 'select'
  | 'insert'
  | 'update'
  | 'delete'
  | 'eq'
  | 'in'
  | 'gte'
  | 'lte'
  | 'ilike'
  | 'order'
  | 'range'
  | 'maybeSingle'
  | 'single';

type ChainMocks = Record<ChainMethod, jest.Mock>;

interface ChainHandle {
  resolve: (value: { data: unknown; error: unknown }) => void;
  chain: ChainMocks;
  calls: { method: string; args: unknown[] }[];
}

function makeChain(
  result: { data: unknown; error: unknown } = { data: [], error: null },
): ChainHandle {
  const calls: { method: string; args: unknown[] }[] = [];
  let resolved = result;
  const methods: ChainMethod[] = [
    'select',
    'insert',
    'update',
    'delete',
    'eq',
    'in',
    'gte',
    'lte',
    'ilike',
    'order',
    'range',
    'maybeSingle',
    'single',
  ];
  const chain = {} as ChainMocks;
  for (const m of methods) {
    chain[m] = jest.fn((...args: unknown[]) => {
      calls.push({ method: m, args });
      if (m === 'maybeSingle' || m === 'single') {
        return Promise.resolve(resolved);
      }
      return chain;
    });
  }
  // `await query` directly — range is the last chained call for list queries.
  chain.range = jest.fn((...args: unknown[]) => {
    calls.push({ method: 'range', args });
    return Promise.resolve(resolved);
  });
  return {
    chain,
    calls,
    resolve: (v) => {
      resolved = v;
    },
  };
}

// ---------------------------------------------------------------------------
// Auth helper
// ---------------------------------------------------------------------------

function mockAuthUser(userId = 'user-1'): void {
  (supabase.auth.getUser as jest.Mock | undefined)?.mockResolvedValueOnce({
    data: { user: { id: userId } },
    error: null,
  });
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const INCOME_ROW = {
  id: 'inc-1',
  user_id: 'user-1',
  amount: 50000,
  currency: 'ARS',
  category_id: 'cat-1',
  description: 'Sueldo',
  occurred_at: '2026-06-01T09:00:00Z',
  occurred_date: '2026-06-01',
  source: 'manual',
  recurrence_id: null,
  created_at: '2026-06-01T09:00:00Z',
  updated_at: '2026-06-01T09:00:00Z',
  category: null,
};

const RECURRENCE_ROW = {
  id: 'rec-1',
  user_id: 'user-1',
  amount: 50000,
  currency: 'ARS',
  category_id: 'cat-1',
  description: 'Sueldo mensual',
  frequency: 'monthly',
  start_date: '2026-01-15',
  end_date: null,
  day_of_month: 15,
  next_run_on: '2026-07-15',
  status: 'active',
  last_materialized_at: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  category: null,
};

// ---------------------------------------------------------------------------
// listIncomes
// ---------------------------------------------------------------------------

describe('incomes repository — listIncomes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('applies search, currency, category, date filters and pagination', async () => {
    mockAuthUser();
    const handle = makeChain({ data: [], error: null });
    (supabase.from as jest.Mock).mockReturnValueOnce(handle.chain);

    await repo.listIncomes({
      search: 'sueldo',
      categoryIds: ['cat-1', 'cat-2'],
      currencies: ['ARS'],
      from: '2026-06-01T00:00:00Z',
      to: '2026-06-30T23:59:59Z',
      limit: 10,
      offset: 20,
    });

    const methods = handle.calls.map((c) => c.method);
    expect(methods).toContain('eq'); // user_id filter
    expect(methods).toContain('ilike');
    expect(methods).toContain('in');
    expect(methods).toContain('gte');
    expect(methods).toContain('lte');
    expect(methods).toContain('range');

    const range = handle.calls.find((c) => c.method === 'range');
    expect(range?.args).toEqual([20, 29]);

    const ilike = handle.calls.find((c) => c.method === 'ilike');
    expect(ilike?.args).toEqual(['description', '%sueldo%']);

    const eqCall = handle.calls.find((c) => c.method === 'eq');
    expect(eqCall?.args).toEqual(['user_id', 'user-1']);
  });

  it('uses default pagination when no filter provided', async () => {
    mockAuthUser();
    const handle = makeChain({ data: [], error: null });
    (supabase.from as jest.Mock).mockReturnValueOnce(handle.chain);

    await repo.listIncomes();

    const range = handle.calls.find((c) => c.method === 'range');
    expect(range?.args).toEqual([0, 49]);
  });

  it('returns error when no session', async () => {
    // Default getUser mock returns { user: null } → requireUserId throws
    const result = await repo.listIncomes();
    expect(result.data).toBeNull();
    expect(result.error).toBeInstanceOf(Error);
    expect((result.error as Error).message).toMatch(/sesión/i);
  });

  it('does not apply ilike when search is empty string', async () => {
    mockAuthUser();
    const handle = makeChain({ data: [], error: null });
    (supabase.from as jest.Mock).mockReturnValueOnce(handle.chain);

    await repo.listIncomes({ search: '' });

    const methods = handle.calls.map((c) => c.method);
    expect(methods).not.toContain('ilike');
  });

  it('skips in/gte/lte when those filters are absent', async () => {
    mockAuthUser();
    const handle = makeChain({ data: [], error: null });
    (supabase.from as jest.Mock).mockReturnValueOnce(handle.chain);

    await repo.listIncomes({ search: 'sueldo' });

    const methods = handle.calls.map((c) => c.method);
    expect(methods).not.toContain('in');
    expect(methods).not.toContain('gte');
    expect(methods).not.toContain('lte');
  });

  it('orders by occurred_at descending', async () => {
    mockAuthUser();
    const handle = makeChain({ data: [], error: null });
    (supabase.from as jest.Mock).mockReturnValueOnce(handle.chain);

    await repo.listIncomes();

    const orderCall = handle.calls.find((c) => c.method === 'order');
    expect(orderCall?.args).toEqual(['occurred_at', { ascending: false }]);
  });
});

// ---------------------------------------------------------------------------
// createIncome
// ---------------------------------------------------------------------------

describe('incomes repository — createIncome', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('sets source to "manual" and derives occurred_date from occurred_at', async () => {
    mockAuthUser();
    const handle = makeChain({ data: INCOME_ROW, error: null });
    (supabase.from as jest.Mock).mockReturnValueOnce(handle.chain);

    await repo.createIncome({
      amount: 50000,
      currency: 'ARS',
      category_id: 'cat-1',
      description: 'Sueldo',
      occurred_at: '2026-06-15T12:00:00Z',
    });

    const insertCall = handle.calls.find((c) => c.method === 'insert');
    const payload = insertCall?.args[0] as Record<string, unknown>;

    expect(payload.source).toBe('manual');
    expect(payload.occurred_date).toBe('2026-06-15');
    expect(payload.occurred_at).toBe('2026-06-15T12:00:00Z');
    expect(payload.user_id).toBe('user-1');
  });

  it('sets occurred_date correctly regardless of time component', async () => {
    mockAuthUser();
    const handle = makeChain({ data: INCOME_ROW, error: null });
    (supabase.from as jest.Mock).mockReturnValueOnce(handle.chain);

    await repo.createIncome({
      amount: 100,
      currency: 'USD',
      category_id: null,
      occurred_at: '2026-06-30T23:59:59+00:00',
    });

    const insertCall = handle.calls.find((c) => c.method === 'insert');
    const payload = insertCall?.args[0] as Record<string, unknown>;
    expect(payload.occurred_date).toBe('2026-06-30');
  });

  it('defaults occurred_at to now when not supplied and derives occurred_date', async () => {
    mockAuthUser();
    const handle = makeChain({ data: INCOME_ROW, error: null });
    (supabase.from as jest.Mock).mockReturnValueOnce(handle.chain);

    const beforeCall = new Date().toISOString().slice(0, 10);
    await repo.createIncome({
      amount: 200,
      currency: 'ARS',
      category_id: null,
    });

    const insertCall = handle.calls.find((c) => c.method === 'insert');
    const payload = insertCall?.args[0] as Record<string, unknown>;
    // occurred_date must be today or later (race condition guard)
    expect(typeof payload.occurred_date).toBe('string');
    expect((payload.occurred_date as string) >= beforeCall).toBe(true);
  });

  it('returns error when no session', async () => {
    (supabase.auth.getUser as jest.Mock | undefined)?.mockResolvedValueOnce({
      data: { user: null },
      error: null,
    });

    const result = await repo.createIncome({ amount: 100, currency: 'ARS', category_id: null });
    expect(result.data).toBeNull();
    expect(result.error).toBeInstanceOf(Error);
    expect((result.error as Error).message).toMatch(/sesión/i);
  });

  it('passes category_id and description as null when omitted', async () => {
    mockAuthUser();
    const handle = makeChain({ data: INCOME_ROW, error: null });
    (supabase.from as jest.Mock).mockReturnValueOnce(handle.chain);

    await repo.createIncome({ amount: 100, currency: 'ARS', category_id: null });

    const insertCall = handle.calls.find((c) => c.method === 'insert');
    const payload = insertCall?.args[0] as Record<string, unknown>;
    expect(payload.category_id).toBeNull();
    expect(payload.description).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// sumIncomesByCurrency
// ---------------------------------------------------------------------------

describe('incomes repository — sumIncomesByCurrency', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('calls get_income_totals rpc and maps currency/total/count', async () => {
    const rpcRows = [
      { currency: 'ARS', total: 150000, count: 3 },
      { currency: 'USD', total: 500, count: 1 },
    ];
    (supabase.rpc as jest.Mock).mockResolvedValueOnce({ data: rpcRows, error: null });

    const result = await repo.sumIncomesByCurrency();

    expect(supabase.rpc).toHaveBeenCalledWith('get_income_totals', {
      p_from: undefined,
      p_to: undefined,
    });
    expect(result.error).toBeNull();
    expect(result.data).toEqual(
      expect.arrayContaining([
        { currency: 'ARS', total: 150000, count: 3 },
        { currency: 'USD', total: 500, count: 1 },
      ]),
    );
  });

  it('passes date range params to the rpc', async () => {
    (supabase.rpc as jest.Mock).mockResolvedValueOnce({ data: [], error: null });

    await repo.sumIncomesByCurrency({
      from: '2026-06-01T00:00:00Z',
      to: '2026-06-30T23:59:59Z',
    });

    expect(supabase.rpc).toHaveBeenCalledWith('get_income_totals', {
      p_from: '2026-06-01T00:00:00Z',
      p_to: '2026-06-30T23:59:59Z',
    });
  });

  it('returns null data when rpc returns error', async () => {
    const rpcError = { message: 'rpc error', code: '42P01' };
    (supabase.rpc as jest.Mock).mockResolvedValueOnce({ data: null, error: rpcError });

    const result = await repo.sumIncomesByCurrency();
    expect(result.data).toBeNull();
    expect(result.error).toEqual(rpcError);
  });

  it('coerces string totals to numbers', async () => {
    // Postgres numeric may come back as strings in some driver versions.
    const rpcRows = [{ currency: 'ARS', total: '99999.99', count: '5' }];
    (supabase.rpc as jest.Mock).mockResolvedValueOnce({ data: rpcRows, error: null });

    const result = await repo.sumIncomesByCurrency();
    expect(result.data?.[0]?.total).toBe(99999.99);
    expect(result.data?.[0]?.count).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// createRecurrence
// ---------------------------------------------------------------------------

describe('incomes repository — createRecurrence', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('computes day_of_month from start_date and next_run_on > today for monthly', async () => {
    const handle = makeChain({ data: RECURRENCE_ROW, error: null });
    (supabase.from as jest.Mock).mockReturnValueOnce(handle.chain);

    // start_date is in the past → next_run_on must advance past today
    await repo.createRecurrence(
      {
        amount: 50000,
        currency: 'ARS',
        category_id: 'cat-1',
        description: 'Sueldo mensual',
        frequency: 'monthly',
        start_date: '2026-01-15',
      },
      'user-1',
      '2026-06-08', // today
    );

    const insertCall = handle.calls.find((c) => c.method === 'insert');
    const payload = insertCall?.args[0] as Record<string, unknown>;

    // day_of_month must be 15 (day component of 2026-01-15)
    expect(payload.day_of_month).toBe(15);
    // next_run_on must be strictly after today (2026-06-08)
    expect((payload.next_run_on as string) > '2026-06-08').toBe(true);
    // For monthly with day=15 and today=2026-06-08, next should be 2026-06-15
    expect(payload.next_run_on).toBe('2026-06-15');
    expect(payload.status).toBe('active');
    expect(payload.user_id).toBe('user-1');
  });

  it('sets next_run_on to start_date when start_date is in the future', async () => {
    const handle = makeChain({ data: RECURRENCE_ROW, error: null });
    (supabase.from as jest.Mock).mockReturnValueOnce(handle.chain);

    await repo.createRecurrence(
      {
        amount: 100,
        currency: 'USD',
        category_id: null,
        frequency: 'weekly',
        start_date: '2026-07-01', // strictly after today
      },
      'user-2',
      '2026-06-08', // today
    );

    const insertCall = handle.calls.find((c) => c.method === 'insert');
    const payload = insertCall?.args[0] as Record<string, unknown>;

    // start_date is in future → next_run_on = start_date
    expect(payload.next_run_on).toBe('2026-07-01');
    expect(payload.day_of_month).toBe(1); // day component of 2026-07-01
  });

  it('computes next_run_on correctly for weekly frequency', async () => {
    const handle = makeChain({ data: RECURRENCE_ROW, error: null });
    (supabase.from as jest.Mock).mockReturnValueOnce(handle.chain);

    // start_date = 2026-06-01 (Monday), today = 2026-06-08 (next Monday)
    // First future occurrence is 2026-06-08 + 7 = no, must be AFTER today.
    // Walk: 2026-06-01 → +7 = 2026-06-08 (not after 2026-06-08) → +7 = 2026-06-15
    await repo.createRecurrence(
      {
        amount: 1000,
        currency: 'ARS',
        category_id: null,
        frequency: 'weekly',
        start_date: '2026-06-01',
      },
      'user-1',
      '2026-06-08',
    );

    const insertCall = handle.calls.find((c) => c.method === 'insert');
    const payload = insertCall?.args[0] as Record<string, unknown>;
    expect(payload.next_run_on).toBe('2026-06-15');
  });

  it('sets status to active and includes all fields', async () => {
    const handle = makeChain({ data: RECURRENCE_ROW, error: null });
    (supabase.from as jest.Mock).mockReturnValueOnce(handle.chain);

    await repo.createRecurrence(
      {
        amount: 500,
        currency: 'ARS',
        category_id: 'cat-2',
        description: 'Freelance',
        frequency: 'biweekly',
        start_date: '2026-06-10',
        end_date: '2026-12-31',
      },
      'user-1',
      '2026-06-08',
    );

    const insertCall = handle.calls.find((c) => c.method === 'insert');
    const payload = insertCall?.args[0] as Record<string, unknown>;

    expect(payload.status).toBe('active');
    expect(payload.frequency).toBe('biweekly');
    expect(payload.end_date).toBe('2026-12-31');
    expect(payload.description).toBe('Freelance');
  });
});

// ---------------------------------------------------------------------------
// resumeRecurrence
// ---------------------------------------------------------------------------

describe('incomes repository — resumeRecurrence', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('fetches the row, recomputes next_run_on past today, and updates status to active', async () => {
    // First from() call → the single fetch of the existing row
    const fetchHandle = makeChain({ data: RECURRENCE_ROW, error: null });
    // Second from() call → the update
    const updateHandle = makeChain({ data: { ...RECURRENCE_ROW, status: 'active' }, error: null });

    (supabase.from as jest.Mock)
      .mockReturnValueOnce(fetchHandle.chain)
      .mockReturnValueOnce(updateHandle.chain);

    await repo.resumeRecurrence('rec-1', '2026-06-08');

    // Verify the update payload
    const updateCall = updateHandle.calls.find((c) => c.method === 'update');
    const payload = updateCall?.args[0] as Record<string, unknown>;

    expect(payload.status).toBe('active');
    // RECURRENCE_ROW: start_date=2026-01-15, frequency=monthly, today=2026-06-08
    // next_run_on after 2026-06-08 with day=15 → 2026-06-15
    expect(payload.next_run_on).toBe('2026-06-15');
  });

  it('returns error when the row is not found', async () => {
    const fetchHandle = makeChain({
      data: null,
      error: { message: 'not found', code: 'PGRST116' },
    });
    (supabase.from as jest.Mock).mockReturnValueOnce(fetchHandle.chain);

    const result = await repo.resumeRecurrence('nonexistent', '2026-06-08');
    expect(result.data).toBeNull();
    expect(result.error).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// deleteRecurrence
// ---------------------------------------------------------------------------

describe('incomes repository — deleteRecurrence', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('issues a delete with the correct id and returns { id } on success', async () => {
    const handle = makeChain({ data: null, error: null });
    handle.chain.eq = jest.fn((...args: unknown[]) => {
      handle.calls.push({ method: 'eq', args });
      return Promise.resolve({ data: null, error: null });
    });
    (supabase.from as jest.Mock).mockReturnValueOnce(handle.chain);

    const result = await repo.deleteRecurrence('rec-1');

    expect(result.error).toBeNull();
    expect(result.data).toEqual({ id: 'rec-1' });

    const deleteCall = handle.calls.find((c) => c.method === 'delete');
    expect(deleteCall).toBeDefined();
    const eqCall = handle.calls.find((c) => c.method === 'eq');
    expect(eqCall?.args).toEqual(['id', 'rec-1']);
  });

  it('returns error and null data when delete fails', async () => {
    const dbError = { message: 'foreign key violation', code: '23503' };
    const handle = makeChain({ data: null, error: null });
    handle.chain.eq = jest.fn((...args: unknown[]) => {
      handle.calls.push({ method: 'eq', args });
      return Promise.resolve({ data: null, error: dbError });
    });
    (supabase.from as jest.Mock).mockReturnValueOnce(handle.chain);

    const result = await repo.deleteRecurrence('rec-1');
    expect(result.data).toBeNull();
    expect(result.error).toEqual(dbError);
  });
});

// ---------------------------------------------------------------------------
// deleteIncome
// ---------------------------------------------------------------------------

describe('incomes repository — deleteIncome', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('issues a delete with the correct id and returns { id } on success', async () => {
    const handle = makeChain({ data: null, error: null });
    handle.chain.eq = jest.fn((...args: unknown[]) => {
      handle.calls.push({ method: 'eq', args });
      return Promise.resolve({ data: null, error: null });
    });
    (supabase.from as jest.Mock).mockReturnValueOnce(handle.chain);

    const result = await repo.deleteIncome('inc-1');
    expect(result.error).toBeNull();
    expect(result.data).toEqual({ id: 'inc-1' });

    const deleteCall = handle.calls.find((c) => c.method === 'delete');
    expect(deleteCall).toBeDefined();
  });
});
