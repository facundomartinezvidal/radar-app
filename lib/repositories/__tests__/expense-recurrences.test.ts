/**
 * Tests for the expense recurrence CRUD in the expenses repository.
 *
 * Drives Supabase through the same chainable query builder mock used in
 * incomes.test.ts and expenses.test.ts.  The supabase client is auto-mocked
 * by jest.setup.ts; individual test cases override `supabase.from` via
 * `mockReturnValueOnce`.
 *
 * Key assertions:
 * - list  → correct table, select string, order
 * - create → computes day_of_month + next_run_on from start_date / today,
 *            sets status 'active', passes user_id
 * - pause  → sets status 'paused'
 * - resume → fetches row, recomputes next_run_on past today, sets status 'active'
 * - update → recomputes scheduling when frequency/start_date change (fetches row);
 *            skips recompute when only non-scheduling fields change or today absent
 * - delete → issues delete with correct id; returns { id } on success / error on failure
 */
import { supabase } from '@/lib/supabase';
import * as repo from '../expenses';

// ---------------------------------------------------------------------------
// Chainable Postgrest mock — identical scaffold to incomes.test.ts
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
  // `await query` directly — order is the last chained call for list queries.
  chain.order = jest.fn((...args: unknown[]) => {
    calls.push({ method: 'order', args });
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
// Fixtures
// ---------------------------------------------------------------------------

const RECURRENCE_ROW = {
  id: 'erec-1',
  user_id: 'user-1',
  amount: 15000,
  currency: 'ARS',
  category_id: 'cat-1',
  description: 'Alquiler mensual',
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
// listExpenseRecurrences
// ---------------------------------------------------------------------------

describe('expenses repository — listExpenseRecurrences', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('queries expense_recurrences with category join ordered by created_at desc', async () => {
    const handle = makeChain({ data: [RECURRENCE_ROW], error: null });
    (supabase.from as jest.Mock).mockReturnValueOnce(handle.chain);

    const result = await repo.listExpenseRecurrences();

    expect(supabase.from).toHaveBeenCalledWith('expense_recurrences');
    expect(result.error).toBeNull();
    expect(result.data).toEqual([RECURRENCE_ROW]);

    const selectCall = handle.calls.find((c) => c.method === 'select');
    expect(selectCall?.args[0]).toContain('category:categories(*)');

    const orderCall = handle.calls.find((c) => c.method === 'order');
    expect(orderCall?.args).toEqual(['created_at', { ascending: false }]);
  });

  it('returns an empty array when no recurrences exist', async () => {
    const handle = makeChain({ data: [], error: null });
    (supabase.from as jest.Mock).mockReturnValueOnce(handle.chain);

    const result = await repo.listExpenseRecurrences();
    expect(result.data).toEqual([]);
    expect(result.error).toBeNull();
  });

  it('propagates DB errors', async () => {
    const dbError = { message: 'connection error', code: '08006' };
    const handle = makeChain({ data: null, error: dbError });
    (supabase.from as jest.Mock).mockReturnValueOnce(handle.chain);

    const result = await repo.listExpenseRecurrences();
    expect(result.data).toBeNull();
    expect(result.error).toEqual(dbError);
  });
});

// ---------------------------------------------------------------------------
// createExpenseRecurrence
// ---------------------------------------------------------------------------

describe('expenses repository — createExpenseRecurrence', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('computes day_of_month from start_date and next_run_on > today for monthly', async () => {
    const handle = makeChain({ data: RECURRENCE_ROW, error: null });
    (supabase.from as jest.Mock).mockReturnValueOnce(handle.chain);

    await repo.createExpenseRecurrence(
      {
        amount: 15000,
        currency: 'ARS',
        category_id: 'cat-1',
        description: 'Alquiler mensual',
        frequency: 'monthly',
        start_date: '2026-01-15',
      },
      'user-1',
      '2026-06-08', // today
    );

    const insertCall = handle.calls.find((c) => c.method === 'insert');
    const payload = insertCall?.args[0] as Record<string, unknown>;

    // day_of_month = day component of 2026-01-15
    expect(payload.day_of_month).toBe(15);
    // next_run_on must be strictly after today (2026-06-08)
    expect((payload.next_run_on as string) > '2026-06-08').toBe(true);
    // monthly with day=15 and today=2026-06-08 → next is 2026-06-15
    expect(payload.next_run_on).toBe('2026-06-15');
    expect(payload.status).toBe('active');
    expect(payload.user_id).toBe('user-1');
  });

  it('sets next_run_on to start_date when start_date is in the future', async () => {
    const handle = makeChain({ data: RECURRENCE_ROW, error: null });
    (supabase.from as jest.Mock).mockReturnValueOnce(handle.chain);

    await repo.createExpenseRecurrence(
      {
        amount: 500,
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

    // start_date = 2026-06-01, today = 2026-06-08
    // Walk: 2026-06-01 → +7 = 2026-06-08 (not after today) → +7 = 2026-06-15
    await repo.createExpenseRecurrence(
      {
        amount: 2000,
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

    await repo.createExpenseRecurrence(
      {
        amount: 800,
        currency: 'ARS',
        category_id: 'cat-2',
        description: 'Suscripción bimestral',
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
    expect(payload.description).toBe('Suscripción bimestral');
  });

  it('passes category_id and description as null when omitted', async () => {
    const handle = makeChain({ data: RECURRENCE_ROW, error: null });
    (supabase.from as jest.Mock).mockReturnValueOnce(handle.chain);

    await repo.createExpenseRecurrence(
      {
        amount: 1000,
        currency: 'ARS',
        category_id: null,
        frequency: 'monthly',
        start_date: '2026-06-20',
      },
      'user-1',
      '2026-06-08',
    );

    const insertCall = handle.calls.find((c) => c.method === 'insert');
    const payload = insertCall?.args[0] as Record<string, unknown>;
    expect(payload.category_id).toBeNull();
    expect(payload.description).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// pauseExpenseRecurrence
// ---------------------------------------------------------------------------

describe('expenses repository — pauseExpenseRecurrence', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('updates status to paused for the given id', async () => {
    const handle = makeChain({ data: { ...RECURRENCE_ROW, status: 'paused' }, error: null });
    (supabase.from as jest.Mock).mockReturnValueOnce(handle.chain);

    const result = await repo.pauseExpenseRecurrence('erec-1');

    expect(result.error).toBeNull();
    const updateCall = handle.calls.find((c) => c.method === 'update');
    const payload = updateCall?.args[0] as Record<string, unknown>;
    expect(payload.status).toBe('paused');

    const eqCall = handle.calls.find((c) => c.method === 'eq');
    expect(eqCall?.args).toEqual(['id', 'erec-1']);
  });

  it('propagates DB errors', async () => {
    const dbError = { message: 'row not found', code: 'PGRST116' };
    const handle = makeChain({ data: null, error: dbError });
    (supabase.from as jest.Mock).mockReturnValueOnce(handle.chain);

    const result = await repo.pauseExpenseRecurrence('nonexistent');
    expect(result.data).toBeNull();
    expect(result.error).toEqual(dbError);
  });
});

// ---------------------------------------------------------------------------
// resumeExpenseRecurrence
// ---------------------------------------------------------------------------

describe('expenses repository — resumeExpenseRecurrence', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('fetches the row, recomputes next_run_on past today, and updates status to active', async () => {
    // First from() call → fetch of the existing row
    const fetchHandle = makeChain({ data: RECURRENCE_ROW, error: null });
    // Second from() call → the update
    const updateHandle = makeChain({ data: { ...RECURRENCE_ROW, status: 'active' }, error: null });

    (supabase.from as jest.Mock)
      .mockReturnValueOnce(fetchHandle.chain)
      .mockReturnValueOnce(updateHandle.chain);

    await repo.resumeExpenseRecurrence('erec-1', '2026-06-08');

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

    const result = await repo.resumeExpenseRecurrence('nonexistent', '2026-06-08');
    expect(result.data).toBeNull();
    expect(result.error).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// updateExpenseRecurrence
// ---------------------------------------------------------------------------

describe('expenses repository — updateExpenseRecurrence', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('recomputes next_run_on when only frequency changes (fetches row for start_date)', async () => {
    // RECURRENCE_ROW has start_date='2026-01-15', frequency='monthly'.
    // Patch: only frequency='weekly'. today='2026-06-08'.
    // effectiveStart='2026-01-15', effectiveFreq='weekly'.
    // weekly from 2026-01-15 advancing past 2026-06-08 → 2026-06-11
    const fetchHandle = makeChain({ data: RECURRENCE_ROW, error: null });
    const updateHandle = makeChain({ data: RECURRENCE_ROW, error: null });

    (supabase.from as jest.Mock)
      .mockReturnValueOnce(fetchHandle.chain)
      .mockReturnValueOnce(updateHandle.chain);

    const result = await repo.updateExpenseRecurrence(
      'erec-1',
      { frequency: 'weekly' },
      '2026-06-08',
    );

    expect(result.error).toBeNull();

    const updateCall = updateHandle.calls.find((c) => c.method === 'update');
    const payload = updateCall?.args[0] as Record<string, unknown>;

    expect(payload.frequency).toBe('weekly');
    // day_of_month from effectiveStart = existing start_date = 2026-01-15 → 15
    expect(payload.day_of_month).toBe(15);
    expect((payload.next_run_on as string) > '2026-06-08').toBe(true);
    // weekly from 2026-01-15 advancing past 2026-06-08 → 2026-06-11
    expect(payload.next_run_on).toBe('2026-06-11');
  });

  it('recomputes next_run_on when only start_date changes (fetches row for frequency)', async () => {
    // RECURRENCE_ROW has frequency='monthly'. Patch: only start_date='2026-03-20'.
    // effectiveStart='2026-03-20', effectiveFreq='monthly'.
    // monthly with day=20, today='2026-06-08' → next_run_on='2026-06-20'
    const fetchHandle = makeChain({ data: RECURRENCE_ROW, error: null });
    const updateHandle = makeChain({ data: RECURRENCE_ROW, error: null });

    (supabase.from as jest.Mock)
      .mockReturnValueOnce(fetchHandle.chain)
      .mockReturnValueOnce(updateHandle.chain);

    const result = await repo.updateExpenseRecurrence(
      'erec-1',
      { start_date: '2026-03-20' },
      '2026-06-08',
    );

    expect(result.error).toBeNull();

    const updateCall = updateHandle.calls.find((c) => c.method === 'update');
    const payload = updateCall?.args[0] as Record<string, unknown>;

    expect(payload.start_date).toBe('2026-03-20');
    expect(payload.day_of_month).toBe(20);
    expect(payload.next_run_on).toBe('2026-06-20');
  });

  it('recomputes next_run_on when both frequency and start_date change', async () => {
    // Patch: frequency='biweekly', start_date='2026-06-10'. today='2026-06-08'.
    // effectiveStart='2026-06-10' is in the future → next_run_on = '2026-06-10'
    const fetchHandle = makeChain({ data: RECURRENCE_ROW, error: null });
    const updateHandle = makeChain({ data: RECURRENCE_ROW, error: null });

    (supabase.from as jest.Mock)
      .mockReturnValueOnce(fetchHandle.chain)
      .mockReturnValueOnce(updateHandle.chain);

    const result = await repo.updateExpenseRecurrence(
      'erec-1',
      { frequency: 'biweekly', start_date: '2026-06-10' },
      '2026-06-08',
    );

    expect(result.error).toBeNull();

    const updateCall = updateHandle.calls.find((c) => c.method === 'update');
    const payload = updateCall?.args[0] as Record<string, unknown>;

    expect(payload.frequency).toBe('biweekly');
    expect(payload.start_date).toBe('2026-06-10');
    expect(payload.day_of_month).toBe(10);
    // start_date is in the future → next_run_on = start_date
    expect(payload.next_run_on).toBe('2026-06-10');
  });

  it('skips schedule recompute and does NOT fetch the row when no scheduling field changes', async () => {
    const updateHandle = makeChain({ data: RECURRENCE_ROW, error: null });
    (supabase.from as jest.Mock).mockReturnValueOnce(updateHandle.chain);

    const result = await repo.updateExpenseRecurrence('erec-1', { amount: 20000 }, '2026-06-08');

    expect(result.error).toBeNull();
    // Only one from() call (the update); no fetch
    expect((supabase.from as jest.Mock).mock.calls.length).toBe(1);

    const updateCall = updateHandle.calls.find((c) => c.method === 'update');
    const payload = updateCall?.args[0] as Record<string, unknown>;
    expect(payload.amount).toBe(20000);
    expect(payload.day_of_month).toBeUndefined();
    expect(payload.next_run_on).toBeUndefined();
  });

  it('skips schedule recompute when today is absent even if scheduling field changed', async () => {
    const updateHandle = makeChain({ data: RECURRENCE_ROW, error: null });
    (supabase.from as jest.Mock).mockReturnValueOnce(updateHandle.chain);

    const result = await repo.updateExpenseRecurrence('erec-1', { frequency: 'weekly' }); // no today

    expect(result.error).toBeNull();
    expect((supabase.from as jest.Mock).mock.calls.length).toBe(1);

    const updateCall = updateHandle.calls.find((c) => c.method === 'update');
    const payload = updateCall?.args[0] as Record<string, unknown>;
    expect(payload.frequency).toBe('weekly');
    expect(payload.next_run_on).toBeUndefined();
  });

  it('returns error when the existing row fetch fails during schedule recompute', async () => {
    const fetchHandle = makeChain({
      data: null,
      error: { message: 'not found', code: 'PGRST116' },
    });
    (supabase.from as jest.Mock).mockReturnValueOnce(fetchHandle.chain);

    const result = await repo.updateExpenseRecurrence(
      'erec-1',
      { frequency: 'weekly' },
      '2026-06-08',
    );

    expect(result.data).toBeNull();
    expect(result.error).not.toBeNull();
  });

  it('updates non-scheduling fields without touching day_of_month / next_run_on', async () => {
    const updateHandle = makeChain({ data: RECURRENCE_ROW, error: null });
    (supabase.from as jest.Mock).mockReturnValueOnce(updateHandle.chain);

    await repo.updateExpenseRecurrence(
      'erec-1',
      { amount: 18000, description: 'Alquiler actualizado', currency: 'USD' },
      '2026-06-08',
    );

    // Only one from() call — no row fetch because scheduleChanged = false
    expect((supabase.from as jest.Mock).mock.calls.length).toBe(1);

    const updateCall = updateHandle.calls.find((c) => c.method === 'update');
    const payload = updateCall?.args[0] as Record<string, unknown>;
    expect(payload.amount).toBe(18000);
    expect(payload.description).toBe('Alquiler actualizado');
    expect(payload.currency).toBe('USD');
    expect(payload.day_of_month).toBeUndefined();
    expect(payload.next_run_on).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// deleteExpenseRecurrence
// ---------------------------------------------------------------------------

describe('expenses repository — deleteExpenseRecurrence', () => {
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

    const result = await repo.deleteExpenseRecurrence('erec-1');

    expect(result.error).toBeNull();
    expect(result.data).toEqual({ id: 'erec-1' });

    const deleteCall = handle.calls.find((c) => c.method === 'delete');
    expect(deleteCall).toBeDefined();
    const eqCall = handle.calls.find((c) => c.method === 'eq');
    expect(eqCall?.args).toEqual(['id', 'erec-1']);
  });

  it('returns error and null data when delete fails', async () => {
    const dbError = { message: 'foreign key violation', code: '23503' };
    const handle = makeChain({ data: null, error: null });
    handle.chain.eq = jest.fn((...args: unknown[]) => {
      handle.calls.push({ method: 'eq', args });
      return Promise.resolve({ data: null, error: dbError });
    });
    (supabase.from as jest.Mock).mockReturnValueOnce(handle.chain);

    const result = await repo.deleteExpenseRecurrence('erec-1');
    expect(result.data).toBeNull();
    expect(result.error).toEqual(dbError);
  });
});
