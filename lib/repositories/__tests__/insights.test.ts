/**
 * Tests for the insights repository.
 *
 * Pattern mirrors expenses.test.ts / incomes.test.ts:
 * - supabase is mocked globally via jest.setup.ts
 * - supabase.rpc is overridden per-test via mockResolvedValueOnce
 * - Each function is tested for: success mapping, error propagation, and
 *   correct rpc name + params
 */
import { supabase } from '@/lib/supabase';
import * as repo from '../insights';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const pgError = { message: 'rpc error', code: '42P01', details: null, hint: null };

// ---------------------------------------------------------------------------
// getExpenseByCategory
// ---------------------------------------------------------------------------

describe('getExpenseByCategory', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('calls get_expense_by_category with correct params', async () => {
    (supabase.rpc as jest.Mock).mockResolvedValueOnce({ data: [], error: null });

    await repo.getExpenseByCategory('ARS', '2026-06-01T00:00:00Z', '2026-06-30T23:59:59Z');

    expect(supabase.rpc).toHaveBeenCalledWith('get_expense_by_category', {
      p_currency: 'ARS',
      p_from: '2026-06-01T00:00:00Z',
      p_to: '2026-06-30T23:59:59Z',
    });
  });

  it('calls get_expense_by_category without optional date params', async () => {
    (supabase.rpc as jest.Mock).mockResolvedValueOnce({ data: [], error: null });

    await repo.getExpenseByCategory('USD');

    expect(supabase.rpc).toHaveBeenCalledWith('get_expense_by_category', {
      p_currency: 'USD',
      p_from: undefined,
      p_to: undefined,
    });
  });

  it('maps rows to CategorySlice with Number()-coerced totals', async () => {
    const rows = [
      {
        category_id: 'cat-1',
        category_name: 'Comida',
        color: '#EF4444',
        icon: 'utensils',
        total: '1500.75',
        count: '3',
      },
      {
        category_id: 'cat-2',
        category_name: 'Transporte',
        color: '#0077B6',
        icon: 'car',
        total: '800',
        count: '2',
      },
    ];
    (supabase.rpc as jest.Mock).mockResolvedValueOnce({ data: rows, error: null });

    const result = await repo.getExpenseByCategory('ARS');

    expect(result.error).toBeNull();
    expect(result.data).toEqual([
      {
        categoryId: 'cat-1',
        name: 'Comida',
        color: '#EF4444',
        icon: 'utensils',
        total: 1500.75,
        count: 3,
      },
      {
        categoryId: 'cat-2',
        name: 'Transporte',
        color: '#0077B6',
        icon: 'car',
        total: 800,
        count: 2,
      },
    ]);
    // Ensure numeric types, not strings — use a local variable to satisfy strict null checks
    const firstSlice = result.data?.[0];
    expect(firstSlice).toBeDefined();
    expect(typeof (firstSlice as NonNullable<typeof firstSlice>).total).toBe('number');
    expect(typeof (firstSlice as NonNullable<typeof firstSlice>).count).toBe('number');
  });

  it('returns { data: null, error } on rpc error', async () => {
    (supabase.rpc as jest.Mock).mockResolvedValueOnce({ data: null, error: pgError });

    const result = await repo.getExpenseByCategory('ARS');

    expect(result.data).toBeNull();
    expect(result.error).toEqual(pgError);
  });

  it('returns { data: null, error: null } when rpc returns null data without error', async () => {
    (supabase.rpc as jest.Mock).mockResolvedValueOnce({ data: null, error: null });

    const result = await repo.getExpenseByCategory('ARS');

    expect(result.data).toBeNull();
    expect(result.error).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// getExpenseByPeriod
// ---------------------------------------------------------------------------

describe('getExpenseByPeriod', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('calls get_expense_by_period with correct params', async () => {
    (supabase.rpc as jest.Mock).mockResolvedValueOnce({ data: [], error: null });

    await repo.getExpenseByPeriod('ARS', 'month', '2026-04-01T00:00:00Z', '2026-06-30T23:59:59Z');

    expect(supabase.rpc).toHaveBeenCalledWith('get_expense_by_period', {
      p_currency: 'ARS',
      p_bucket: 'month',
      p_from: '2026-04-01T00:00:00Z',
      p_to: '2026-06-30T23:59:59Z',
    });
  });

  it('calls get_expense_by_period without optional date params', async () => {
    (supabase.rpc as jest.Mock).mockResolvedValueOnce({ data: [], error: null });

    await repo.getExpenseByPeriod('USD', 'week');

    expect(supabase.rpc).toHaveBeenCalledWith('get_expense_by_period', {
      p_currency: 'USD',
      p_bucket: 'week',
      p_from: undefined,
      p_to: undefined,
    });
  });

  it('maps rows to ChartPoint with Number()-coerced totals', async () => {
    const rows = [
      { bucket: '2026-04-01', total: '5000.50', count: '10' },
      { bucket: '2026-05-01', total: '3200', count: '7' },
      { bucket: '2026-06-01', total: '1800.25', count: '4' },
    ];
    (supabase.rpc as jest.Mock).mockResolvedValueOnce({ data: rows, error: null });

    const result = await repo.getExpenseByPeriod('ARS', 'month');

    expect(result.error).toBeNull();
    expect(result.data).toEqual([
      { bucket: '2026-04-01', total: 5000.5, count: 10 },
      { bucket: '2026-05-01', total: 3200, count: 7 },
      { bucket: '2026-06-01', total: 1800.25, count: 4 },
    ]);
    // Ensure numeric types, not strings — use a local variable to satisfy strict null checks
    const firstPoint = result.data?.[0];
    expect(firstPoint).toBeDefined();
    expect(typeof (firstPoint as NonNullable<typeof firstPoint>).total).toBe('number');
    expect(typeof (firstPoint as NonNullable<typeof firstPoint>).count).toBe('number');
  });

  it('returns { data: null, error } on rpc error', async () => {
    (supabase.rpc as jest.Mock).mockResolvedValueOnce({ data: null, error: pgError });

    const result = await repo.getExpenseByPeriod('ARS', 'month');

    expect(result.data).toBeNull();
    expect(result.error).toEqual(pgError);
  });

  it('returns { data: null, error: null } when rpc returns null data without error', async () => {
    (supabase.rpc as jest.Mock).mockResolvedValueOnce({ data: null, error: null });

    const result = await repo.getExpenseByPeriod('ARS', 'day');

    expect(result.data).toBeNull();
    expect(result.error).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// getIncomeByPeriod
// ---------------------------------------------------------------------------

describe('getIncomeByPeriod', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('calls get_income_by_period with correct params', async () => {
    (supabase.rpc as jest.Mock).mockResolvedValueOnce({ data: [], error: null });

    await repo.getIncomeByPeriod('ARS', 'month', '2026-01-01T00:00:00Z', '2026-12-31T23:59:59Z');

    expect(supabase.rpc).toHaveBeenCalledWith('get_income_by_period', {
      p_currency: 'ARS',
      p_bucket: 'month',
      p_from: '2026-01-01T00:00:00Z',
      p_to: '2026-12-31T23:59:59Z',
    });
  });

  it('calls get_income_by_period without optional date params', async () => {
    (supabase.rpc as jest.Mock).mockResolvedValueOnce({ data: [], error: null });

    await repo.getIncomeByPeriod('USD', 'day');

    expect(supabase.rpc).toHaveBeenCalledWith('get_income_by_period', {
      p_currency: 'USD',
      p_bucket: 'day',
      p_from: undefined,
      p_to: undefined,
    });
  });

  it('maps rows to ChartPoint with Number()-coerced totals', async () => {
    const rows = [
      { bucket: '2026-04-01', total: '120000', count: '2' },
      { bucket: '2026-05-01', total: '95000.50', count: '1' },
    ];
    (supabase.rpc as jest.Mock).mockResolvedValueOnce({ data: rows, error: null });

    const result = await repo.getIncomeByPeriod('ARS', 'month');

    expect(result.error).toBeNull();
    expect(result.data).toEqual([
      { bucket: '2026-04-01', total: 120000, count: 2 },
      { bucket: '2026-05-01', total: 95000.5, count: 1 },
    ]);
    // Ensure numeric types, not strings — use a local variable to satisfy strict null checks
    const firstPoint = result.data?.[0];
    expect(firstPoint).toBeDefined();
    expect(typeof (firstPoint as NonNullable<typeof firstPoint>).total).toBe('number');
    expect(typeof (firstPoint as NonNullable<typeof firstPoint>).count).toBe('number');
  });

  it('returns { data: null, error } on rpc error', async () => {
    (supabase.rpc as jest.Mock).mockResolvedValueOnce({ data: null, error: pgError });

    const result = await repo.getIncomeByPeriod('ARS', 'month');

    expect(result.data).toBeNull();
    expect(result.error).toEqual(pgError);
  });

  it('returns { data: null, error: null } when rpc returns null data without error', async () => {
    (supabase.rpc as jest.Mock).mockResolvedValueOnce({ data: null, error: null });

    const result = await repo.getIncomeByPeriod('USD', 'week');

    expect(result.data).toBeNull();
    expect(result.error).toBeNull();
  });
});
