/**
 * Tests for the expenses repository — drives Supabase through a chainable
 * query builder mock and verifies the SQL pieces (filters, ranges, ordering).
 */
import { supabase } from '@/lib/supabase';
import * as repo from '../expenses';

// ---------------------------------------------------------------------------
// Chainable Postgrest mock
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
  // `await query` directly — range is typically the last chained call.
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

describe('expenses repository', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('listCategories', () => {
    it('orders by sort_order asc', async () => {
      const handle = makeChain({
        data: [{ id: 'c1', slug: 'comida' }],
        error: null,
      });
      (supabase.from as jest.Mock).mockReturnValueOnce(handle.chain);
      // categories.select doesn't end on range — make select+order the terminal thenable
      handle.chain.order.mockImplementationOnce((...args: unknown[]) => {
        handle.calls.push({ method: 'order', args });
        return Promise.resolve({ data: [{ id: 'c1', slug: 'comida' }], error: null });
      });

      const result = await repo.listCategories();
      expect(result.error).toBeNull();
      expect(result.data).toEqual([{ id: 'c1', slug: 'comida' }]);
      expect(handle.calls.find((c) => c.method === 'order')?.args).toEqual([
        'sort_order',
        { ascending: true },
      ]);
    });
  });

  describe('listExpenses', () => {
    it('applies search, currency, category, date filters and pagination', async () => {
      const handle = makeChain({ data: [], error: null });
      (supabase.from as jest.Mock).mockReturnValueOnce(handle.chain);

      await repo.listExpenses({
        search: 'pizza',
        categoryIds: ['cat-1', 'cat-2'],
        currencies: ['ARS'],
        from: '2026-05-01T00:00:00Z',
        to: '2026-05-31T23:59:59Z',
        limit: 10,
        offset: 20,
      });

      const methods = handle.calls.map((c) => c.method);
      expect(methods).toContain('ilike');
      expect(methods).toContain('in');
      expect(methods).toContain('gte');
      expect(methods).toContain('lte');
      expect(methods).toContain('range');

      const range = handle.calls.find((c) => c.method === 'range');
      expect(range?.args).toEqual([20, 29]);
      const ilike = handle.calls.find((c) => c.method === 'ilike');
      expect(ilike?.args).toEqual(['description', '%pizza%']);
    });

    it('uses default pagination when not provided', async () => {
      const handle = makeChain({ data: [], error: null });
      (supabase.from as jest.Mock).mockReturnValueOnce(handle.chain);
      await repo.listExpenses();
      const range = handle.calls.find((c) => c.method === 'range');
      expect(range?.args).toEqual([0, 49]);
    });
  });

  describe('createExpense', () => {
    it('inserts user_id from session + returns row', async () => {
      (supabase.auth.getUser as jest.Mock | undefined)?.mockResolvedValueOnce({
        data: { user: { id: 'user-1' } },
        error: null,
      });

      const insertedRow = {
        id: 'exp-1',
        user_id: 'user-1',
        amount: 1234.56,
        currency: 'ARS',
        category_id: 'cat-1',
        description: 'Pizza',
        occurred_at: '2026-05-16T20:00:00Z',
        created_at: '2026-05-16T20:00:00Z',
        updated_at: '2026-05-16T20:00:00Z',
      };
      const handle = makeChain({ data: insertedRow, error: null });
      (supabase.from as jest.Mock).mockReturnValueOnce(handle.chain);

      const result = await repo.createExpense({
        amount: 1234.56,
        currency: 'ARS',
        category_id: 'cat-1',
        description: 'Pizza',
      });

      expect(result.error).toBeNull();
      expect(result.data).toEqual(insertedRow);
      const insertCall = handle.calls.find((c) => c.method === 'insert');
      const payload = insertCall?.args[0] as Record<string, unknown>;
      expect(payload.user_id).toBe('user-1');
      expect(payload.amount).toBe(1234.56);
      expect(payload.currency).toBe('ARS');
    });

    it('returns error when no session', async () => {
      (supabase.auth.getUser as jest.Mock | undefined)?.mockResolvedValueOnce({
        data: { user: null },
        error: null,
      });
      const result = await repo.createExpense({
        amount: 100,
        currency: 'ARS',
        category_id: null,
      });
      expect(result.data).toBeNull();
      expect(result.error).toBeInstanceOf(Error);
      expect((result.error as Error).message).toMatch(/sesión/i);
    });
  });

  describe('updateExpense', () => {
    it('only sends provided fields', async () => {
      const handle = makeChain({ data: { id: 'exp-1', amount: 50 }, error: null });
      (supabase.from as jest.Mock).mockReturnValueOnce(handle.chain);
      await repo.updateExpense('exp-1', { amount: 50 });
      const updateCall = handle.calls.find((c) => c.method === 'update');
      expect(updateCall?.args[0]).toEqual({ amount: 50 });
      const eqCall = handle.calls.find((c) => c.method === 'eq');
      expect(eqCall?.args).toEqual(['id', 'exp-1']);
    });
  });

  describe('deleteExpense', () => {
    it('returns { id } on success', async () => {
      const handle = makeChain({ data: null, error: null });
      handle.chain.eq.mockImplementationOnce((...args: unknown[]) => {
        handle.calls.push({ method: 'eq', args });
        return Promise.resolve({ data: null, error: null });
      });
      (supabase.from as jest.Mock).mockReturnValueOnce(handle.chain);
      const result = await repo.deleteExpense('exp-1');
      expect(result.error).toBeNull();
      expect(result.data).toEqual({ id: 'exp-1' });
    });
  });

  describe('sumExpensesByCurrency', () => {
    it('groups + totals by currency', async () => {
      const rows = [
        { amount: '100.00', currency: 'ARS' },
        { amount: '50.50', currency: 'ARS' },
        { amount: '20.00', currency: 'USD' },
      ];
      const handle = makeChain({ data: rows, error: null });
      // sumExpensesByCurrency only chains select → optional gte/lte → await
      // Wire chain.select to terminate (no order/range)
      handle.chain.select.mockImplementationOnce((...args: unknown[]) => {
        handle.calls.push({ method: 'select', args });
        return Promise.resolve({ data: rows, error: null });
      });
      (supabase.from as jest.Mock).mockReturnValueOnce(handle.chain);
      const result = await repo.sumExpensesByCurrency();
      expect(result.error).toBeNull();
      expect(result.data).toEqual(
        expect.arrayContaining([
          { currency: 'ARS', total: 150.5, count: 2 },
          { currency: 'USD', total: 20, count: 1 },
        ]),
      );
    });
  });
});
