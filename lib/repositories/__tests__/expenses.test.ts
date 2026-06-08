/**
 * Tests for the expenses repository — drives Supabase through a chainable
 * query builder mock and verifies the SQL pieces (filters, ranges, ordering).
 *
 * HU-18 additions:
 * - createExpense routes through rpc('create_expense_with_items')
 * - updateExpense routes through rpc('update_expense_with_items') when items present
 * - updateExpense uses the column-update path when items are absent
 * - Returned items are sorted by position ascending
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

// ---------------------------------------------------------------------------
// RPC mock helper
// ---------------------------------------------------------------------------

/** Wire supabase.rpc to resolve with `rpcResult`, then supabase.from to the
 *  re-fetch chain (so the nested select after rpc is covered). */
function setupRpcThenFetch(
  rpcResult: { data: unknown; error: unknown },
  fetchedRow: unknown,
): ChainHandle {
  (supabase.rpc as jest.Mock).mockResolvedValueOnce(rpcResult);
  const fetchHandle = makeChain({ data: fetchedRow, error: null });
  (supabase.from as jest.Mock).mockReturnValueOnce(fetchHandle.chain);
  return fetchHandle;
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const EXPENSE_ROW = {
  id: 'exp-1',
  user_id: 'user-1',
  amount: 1234.56,
  currency: 'ARS',
  category_id: 'cat-1',
  description: 'Pizza',
  occurred_at: '2026-05-16T20:00:00Z',
  created_at: '2026-05-16T20:00:00Z',
  updated_at: '2026-05-16T20:00:00Z',
  category: null,
  items: [],
};

describe('expenses repository', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('listCategories', () => {
    it('orders by sort_order asc then name asc', async () => {
      const DATA = [{ id: 'c1', slug: 'comida' }];
      const handle = makeChain({ data: DATA, error: null });
      (supabase.from as jest.Mock).mockReturnValueOnce(handle.chain);

      // listCategories chains two .order() calls.
      // The first returns the chain (non-terminal), the second is the terminal thenable.
      handle.chain.order
        .mockImplementationOnce((...args: unknown[]) => {
          handle.calls.push({ method: 'order', args });
          return handle.chain; // continue chaining
        })
        .mockImplementationOnce((...args: unknown[]) => {
          handle.calls.push({ method: 'order', args });
          return Promise.resolve({ data: DATA, error: null }); // terminal
        });

      const result = await repo.listCategories();
      expect(result.error).toBeNull();
      expect(result.data).toEqual(DATA);

      const orderCalls = handle.calls.filter((c) => c.method === 'order');
      expect(orderCalls).toHaveLength(2);
      expect(orderCalls[0]?.args).toEqual(['sort_order', { ascending: true }]);
      expect(orderCalls[1]?.args).toEqual(['name', { ascending: true }]);
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

    it('sorts returned items by position ascending', async () => {
      const rowWithItems = {
        ...EXPENSE_ROW,
        items: [
          { id: 'i2', position: 2, name: 'B', quantity: 1, unit_price: null, line_total: 0 },
          { id: 'i1', position: 1, name: 'A', quantity: 1, unit_price: null, line_total: 0 },
        ],
      };
      const handle = makeChain({ data: [rowWithItems], error: null });
      (supabase.from as jest.Mock).mockReturnValueOnce(handle.chain);
      const result = await repo.listExpenses();
      expect(result.data?.[0]?.items[0]?.name).toBe('A');
      expect(result.data?.[0]?.items[1]?.name).toBe('B');
    });
  });

  describe('createExpense', () => {
    it('calls rpc create_expense_with_items with snake_case item fields and no id', async () => {
      (supabase.auth.getUser as jest.Mock | undefined)?.mockResolvedValueOnce({
        data: { user: { id: 'user-1' } },
        error: null,
      });
      setupRpcThenFetch({ data: { id: 'exp-1' }, error: null }, EXPENSE_ROW);

      await repo.createExpense({
        amount: 1234.56,
        currency: 'ARS',
        category_id: 'cat-1',
        description: 'Pizza',
        items: [
          { id: 'local-id', name: 'Empanada', quantity: 2, unit_price: 300, line_total: 600 },
        ],
      });

      const rpcCall = (supabase.rpc as jest.Mock).mock.calls[0];
      expect(rpcCall?.[0]).toBe('create_expense_with_items');
      const args = rpcCall?.[1] as Record<string, unknown>;
      expect(args.p_amount).toBe(1234.56);
      expect(args.p_currency).toBe('ARS');
      // items should be mapped to RPC shape — no id field
      const sentItems = args.p_items as Array<Record<string, unknown>>;
      expect(sentItems).toHaveLength(1);
      expect(sentItems[0]).toEqual({
        name: 'Empanada',
        quantity: 2,
        unit_price: 300,
        line_total: 600,
      });
      expect(sentItems[0]).not.toHaveProperty('id');
    });

    it('sends p_items as empty array when input has no items', async () => {
      (supabase.auth.getUser as jest.Mock | undefined)?.mockResolvedValueOnce({
        data: { user: { id: 'user-1' } },
        error: null,
      });
      setupRpcThenFetch({ data: { id: 'exp-1' }, error: null }, EXPENSE_ROW);

      await repo.createExpense({
        amount: 100,
        currency: 'ARS',
        category_id: null,
      });

      const rpcCall = (supabase.rpc as jest.Mock).mock.calls[0];
      const args = rpcCall?.[1] as Record<string, unknown>;
      expect(args.p_items).toEqual([]);
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

    it('returns the re-fetched row with items sorted by position', async () => {
      (supabase.auth.getUser as jest.Mock | undefined)?.mockResolvedValueOnce({
        data: { user: { id: 'user-1' } },
        error: null,
      });
      const rowWithItems = {
        ...EXPENSE_ROW,
        items: [
          { id: 'i2', position: 2, name: 'B', quantity: 1, unit_price: null, line_total: 0 },
          { id: 'i1', position: 1, name: 'A', quantity: 1, unit_price: null, line_total: 0 },
        ],
      };
      setupRpcThenFetch({ data: { id: 'exp-1' }, error: null }, rowWithItems);

      const result = await repo.createExpense({
        amount: 1000,
        currency: 'ARS',
        category_id: 'cat-1',
        items: [{ name: 'A', quantity: 1, unit_price: null, line_total: 0 }],
      });

      expect(result.error).toBeNull();
      expect(result.data?.items[0]?.name).toBe('A');
      expect(result.data?.items[1]?.name).toBe('B');
    });
  });

  describe('updateExpense', () => {
    it('calls rpc update_expense_with_items when items are provided', async () => {
      setupRpcThenFetch({ data: { id: 'exp-1' }, error: null }, EXPENSE_ROW);

      await repo.updateExpense('exp-1', {
        amount: 500,
        items: [{ name: 'Milanesa', quantity: 1, unit_price: 500, line_total: 500 }],
      });

      const rpcCall = (supabase.rpc as jest.Mock).mock.calls[0];
      expect(rpcCall?.[0]).toBe('update_expense_with_items');
      const args = rpcCall?.[1] as Record<string, unknown>;
      expect(args.p_id).toBe('exp-1');

      // p_patch must include only defined fields (excluding items)
      const patch = args.p_patch as Record<string, unknown>;
      expect(patch.amount).toBe(500);
      expect(patch).not.toHaveProperty('items');
      expect(patch).not.toHaveProperty('currency'); // not in input → excluded

      // p_items shape: no id field
      const sentItems = args.p_items as Array<Record<string, unknown>>;
      expect(sentItems).toHaveLength(1);
      expect(sentItems[0]).toEqual({
        name: 'Milanesa',
        quantity: 1,
        unit_price: 500,
        line_total: 500,
      });
      expect(sentItems[0]).not.toHaveProperty('id');
    });

    it('sends p_items as [] when items array is empty (replace / clear all)', async () => {
      setupRpcThenFetch({ data: { id: 'exp-1' }, error: null }, EXPENSE_ROW);

      await repo.updateExpense('exp-1', { items: [] });

      const rpcCall = (supabase.rpc as jest.Mock).mock.calls[0];
      expect(rpcCall?.[0]).toBe('update_expense_with_items');
      const args = rpcCall?.[1] as Record<string, unknown>;
      expect(args.p_items).toEqual([]);
    });

    it('excludes undefined fields from p_patch but includes explicitly-set null values', async () => {
      setupRpcThenFetch({ data: { id: 'exp-1' }, error: null }, EXPENSE_ROW);

      await repo.updateExpense('exp-1', {
        category_id: null, // explicitly clearing category
        items: [],
      });

      const rpcCall = (supabase.rpc as jest.Mock).mock.calls[0];
      const args = rpcCall?.[1] as Record<string, unknown>;
      const patch = args.p_patch as Record<string, unknown>;
      // category_id was explicitly set to null — must be in patch
      expect(Object.prototype.hasOwnProperty.call(patch, 'category_id')).toBe(true);
      expect(patch.category_id).toBeNull();
      // amount was undefined in input — must not be in patch
      expect(Object.prototype.hasOwnProperty.call(patch, 'amount')).toBe(false);
    });

    it('uses the column-update path (no rpc) when items are NOT in input', async () => {
      const handle = makeChain({ data: { ...EXPENSE_ROW, amount: 50 }, error: null });
      (supabase.from as jest.Mock).mockReturnValueOnce(handle.chain);

      await repo.updateExpense('exp-1', { amount: 50 });

      // rpc should NOT have been called
      expect(supabase.rpc as jest.Mock).not.toHaveBeenCalled();

      const updateCall = handle.calls.find((c) => c.method === 'update');
      expect(updateCall?.args[0]).toEqual({ amount: 50 });
      const eqCall = handle.calls.find((c) => c.method === 'eq');
      expect(eqCall?.args).toEqual(['id', 'exp-1']);
    });

    it('returns items sorted by position ascending after update', async () => {
      const rowWithItems = {
        ...EXPENSE_ROW,
        items: [
          { id: 'i3', position: 3, name: 'C', quantity: 1, unit_price: null, line_total: 0 },
          { id: 'i1', position: 1, name: 'A', quantity: 1, unit_price: null, line_total: 0 },
          { id: 'i2', position: 2, name: 'B', quantity: 1, unit_price: null, line_total: 0 },
        ],
      };
      setupRpcThenFetch({ data: { id: 'exp-1' }, error: null }, rowWithItems);

      const result = await repo.updateExpense('exp-1', { items: [] });

      expect(result.data?.items.map((i) => i.name)).toEqual(['A', 'B', 'C']);
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
