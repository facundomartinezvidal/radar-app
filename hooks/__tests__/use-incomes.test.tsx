/**
 * Tests for use-incomes hooks.
 *
 * Verifies query/mutation wiring + cache invalidation. We mock the
 * repository (and supabase for auth) to avoid touching supabase-js
 * internals here — those are covered by the repo's own tests.
 * Pattern mirrors hooks/__tests__/use-expenses.test.tsx.
 */
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';

import * as repo from '@/lib/repositories/incomes';
import {
  incomeKeys,
  recurrenceKeys,
  useCreateIncome,
  useCreateRecurrence,
  useDeleteIncome,
  useDeleteRecurrence,
  useIncome,
  useIncomeTotals,
  useIncomes,
  usePauseRecurrence,
  useRecurrences,
  useResumeRecurrence,
  useUpdateIncome,
  useUpdateRecurrence,
} from '../use-incomes';

jest.mock('@/lib/repositories/incomes');

// ---------------------------------------------------------------------------
// Supabase auth mock — used by useCreateRecurrence
// ---------------------------------------------------------------------------

jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: jest.fn().mockResolvedValue({
        data: { user: { id: 'user-1' } },
        error: null,
      }),
    },
  },
}));

const mocked = repo as jest.Mocked<typeof repo>;

// ---------------------------------------------------------------------------
// QueryClient wrapper factory
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

const INCOME_ROW: repo.IncomeWithCategory = {
  id: 'inc-1',
  user_id: 'user-1',
  amount: 5000,
  currency: 'ARS',
  category_id: null,
  description: 'Sueldo',
  occurred_at: '2026-06-01T00:00:00Z',
  occurred_date: '2026-06-01',
  source: 'manual',
  recurrence_id: null,
  created_at: '2026-06-01T00:00:00Z',
  updated_at: '2026-06-01T00:00:00Z',
  category: null,
};

const RECURRENCE_ROW: repo.IncomeRecurrenceWithCategory = {
  id: 'rec-1',
  user_id: 'user-1',
  amount: 5000,
  currency: 'ARS',
  category_id: null,
  description: 'Sueldo mensual',
  frequency: 'monthly',
  start_date: '2026-01-01',
  end_date: null,
  day_of_month: 1,
  next_run_on: '2026-07-01',
  last_materialized_at: null,
  status: 'active',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  category: null,
};

// ---------------------------------------------------------------------------
// Query key shape tests
// ---------------------------------------------------------------------------

describe('query key shapes', () => {
  it('incomeKeys.all is ["incomes"]', () => {
    expect(incomeKeys.all).toEqual(['incomes']);
  });

  it('incomeKeys.list includes filter', () => {
    const key = incomeKeys.list({ search: 'sueldo' });
    expect(key[0]).toBe('incomes');
    expect(key[1]).toBe('list');
    expect(key[2]).toEqual({ search: 'sueldo' });
  });

  it('incomeKeys.detail includes id', () => {
    expect(incomeKeys.detail('inc-1')).toEqual(['incomes', 'detail', 'inc-1']);
  });

  it('incomeKeys.totals includes range', () => {
    const range = { from: '2026-06-01T00:00:00Z', to: '2026-06-30T23:59:59Z' };
    expect(incomeKeys.totals(range)).toEqual(['incomes', 'totals', range]);
  });

  it('recurrenceKeys.all is ["income-recurrences"]', () => {
    expect(recurrenceKeys.all).toEqual(['income-recurrences']);
  });

  it('recurrenceKeys.list starts with recurrenceKeys.all', () => {
    expect(recurrenceKeys.list()[0]).toBe('income-recurrences');
    expect(recurrenceKeys.list()[1]).toBe('list');
  });

  it('recurrenceKeys.detail includes id', () => {
    expect(recurrenceKeys.detail('rec-1')).toEqual(['income-recurrences', 'detail', 'rec-1']);
  });
});

// ---------------------------------------------------------------------------
// useIncomes
// ---------------------------------------------------------------------------

describe('useIncomes', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns rows from the repo', async () => {
    mocked.listIncomes.mockResolvedValueOnce({ data: [INCOME_ROW], error: null });

    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useIncomes({ search: 'sueldo' }), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mocked.listIncomes).toHaveBeenCalledWith({ search: 'sueldo' });
    expect(result.current.data).toHaveLength(1);
  });

  it('returns empty array when repo returns null', async () => {
    mocked.listIncomes.mockResolvedValueOnce({ data: null, error: null });

    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useIncomes(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([]);
  });

  it('throws on repo error', async () => {
    mocked.listIncomes.mockResolvedValueOnce({ data: null, error: new Error('db error') });

    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useIncomes(), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toEqual(new Error('db error'));
  });
});

// ---------------------------------------------------------------------------
// useIncome
// ---------------------------------------------------------------------------

describe('useIncome', () => {
  beforeEach(() => jest.clearAllMocks());

  it('is disabled when id is undefined', () => {
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useIncome(undefined), { wrapper });
    expect(result.current.fetchStatus).toBe('idle');
  });

  it('fetches when id is provided', async () => {
    mocked.getIncome.mockResolvedValueOnce({ data: INCOME_ROW, error: null });

    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useIncome('inc-1'), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mocked.getIncome).toHaveBeenCalledWith('inc-1');
    expect(result.current.data).toEqual(INCOME_ROW);
  });
});

// ---------------------------------------------------------------------------
// useIncomeTotals
// ---------------------------------------------------------------------------

describe('useIncomeTotals', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns currency totals', async () => {
    mocked.sumIncomesByCurrency.mockResolvedValueOnce({
      data: [{ currency: 'ARS', total: 10000, count: 2 }],
      error: null,
    });

    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useIncomeTotals({}), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.[0]?.total).toBe(10000);
  });
});

// ---------------------------------------------------------------------------
// useCreateIncome
// ---------------------------------------------------------------------------

describe('useCreateIncome', () => {
  beforeEach(() => jest.clearAllMocks());

  it('invalidates incomeKeys.all on success', async () => {
    mocked.createIncome.mockResolvedValueOnce({ data: INCOME_ROW, error: null });

    const { wrapper, client } = makeWrapper();
    const invalidate = jest.spyOn(client, 'invalidateQueries');
    const { result } = renderHook(() => useCreateIncome(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ amount: 5000, currency: 'ARS', category_id: null });
    });

    expect(mocked.createIncome).toHaveBeenCalled();
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['incomes'] });
  });

  it('throws on repo error', async () => {
    mocked.createIncome.mockResolvedValueOnce({ data: null, error: new Error('boom') });

    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useCreateIncome(), { wrapper });

    await expect(
      result.current.mutateAsync({ amount: 5000, currency: 'ARS', category_id: null }),
    ).rejects.toThrow('boom');
  });

  it('throws fallback message when data is null and error is null', async () => {
    mocked.createIncome.mockResolvedValueOnce({ data: null, error: null });

    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useCreateIncome(), { wrapper });

    await expect(
      result.current.mutateAsync({ amount: 5000, currency: 'ARS', category_id: null }),
    ).rejects.toThrow('No se pudo guardar el ingreso.');
  });
});

// ---------------------------------------------------------------------------
// useUpdateIncome
// ---------------------------------------------------------------------------

describe('useUpdateIncome', () => {
  beforeEach(() => jest.clearAllMocks());

  it('invalidates incomeKeys.all on success', async () => {
    mocked.updateIncome.mockResolvedValueOnce({ data: INCOME_ROW, error: null });

    const { wrapper, client } = makeWrapper();
    const invalidate = jest.spyOn(client, 'invalidateQueries');
    const { result } = renderHook(() => useUpdateIncome(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ id: 'inc-1', input: { amount: 6000 } });
    });

    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['incomes'] });
  });

  it('updates cache for the detail key on success', async () => {
    mocked.updateIncome.mockResolvedValueOnce({ data: INCOME_ROW, error: null });

    const { wrapper, client } = makeWrapper();
    const setData = jest.spyOn(client, 'setQueryData');
    const { result } = renderHook(() => useUpdateIncome(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ id: 'inc-1', input: { amount: 6000 } });
    });

    expect(setData).toHaveBeenCalledWith(['incomes', 'detail', 'inc-1'], expect.any(Object));
  });

  it('throws on repo error', async () => {
    mocked.updateIncome.mockResolvedValueOnce({ data: null, error: new Error('update failed') });

    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useUpdateIncome(), { wrapper });

    await expect(
      result.current.mutateAsync({ id: 'inc-1', input: { amount: 6000 } }),
    ).rejects.toThrow('update failed');
  });
});

// ---------------------------------------------------------------------------
// useDeleteIncome
// ---------------------------------------------------------------------------

describe('useDeleteIncome', () => {
  beforeEach(() => jest.clearAllMocks());

  it('removes the detail query on success', async () => {
    mocked.deleteIncome.mockResolvedValueOnce({ data: { id: 'inc-1' }, error: null });

    const { wrapper, client } = makeWrapper();
    const remove = jest.spyOn(client, 'removeQueries');
    const { result } = renderHook(() => useDeleteIncome(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync('inc-1');
    });

    expect(remove).toHaveBeenCalledWith({ queryKey: ['incomes', 'detail', 'inc-1'] });
  });

  it('invalidates incomeKeys.all on success', async () => {
    mocked.deleteIncome.mockResolvedValueOnce({ data: { id: 'inc-1' }, error: null });

    const { wrapper, client } = makeWrapper();
    const invalidate = jest.spyOn(client, 'invalidateQueries');
    const { result } = renderHook(() => useDeleteIncome(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync('inc-1');
    });

    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['incomes'] });
  });

  it('throws on repo error', async () => {
    mocked.deleteIncome.mockResolvedValueOnce({ data: null, error: new Error('delete failed') });

    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useDeleteIncome(), { wrapper });

    await expect(result.current.mutateAsync('inc-1')).rejects.toThrow('delete failed');
  });
});

// ---------------------------------------------------------------------------
// useRecurrences
// ---------------------------------------------------------------------------

describe('useRecurrences', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns recurrence rows from the repo', async () => {
    mocked.listRecurrences.mockResolvedValueOnce({ data: [RECURRENCE_ROW], error: null });

    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useRecurrences(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// useCreateRecurrence
// ---------------------------------------------------------------------------

describe('useCreateRecurrence', () => {
  beforeEach(() => jest.clearAllMocks());

  it('invalidates recurrenceKeys.all and incomeKeys.all on success', async () => {
    mocked.createRecurrence.mockResolvedValueOnce({ data: RECURRENCE_ROW, error: null });

    const { wrapper, client } = makeWrapper();
    const invalidate = jest.spyOn(client, 'invalidateQueries');
    const { result } = renderHook(() => useCreateRecurrence(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        amount: 5000,
        currency: 'ARS',
        category_id: null,
        frequency: 'monthly',
        start_date: '2026-06-01',
      });
    });

    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['income-recurrences'] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['incomes'] });
  });

  it('passes userId and today to createRecurrence', async () => {
    mocked.createRecurrence.mockResolvedValueOnce({ data: RECURRENCE_ROW, error: null });

    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useCreateRecurrence(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        amount: 5000,
        currency: 'ARS',
        category_id: null,
        frequency: 'monthly',
        start_date: '2026-06-01',
      });
    });

    expect(mocked.createRecurrence).toHaveBeenCalledWith(
      expect.objectContaining({ frequency: 'monthly', start_date: '2026-06-01' }),
      'user-1',
      expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
    );
  });

  it('throws on repo error', async () => {
    mocked.createRecurrence.mockResolvedValueOnce({ data: null, error: new Error('boom') });

    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useCreateRecurrence(), { wrapper });

    await expect(
      result.current.mutateAsync({
        amount: 5000,
        currency: 'ARS',
        category_id: null,
        frequency: 'monthly',
        start_date: '2026-06-01',
      }),
    ).rejects.toThrow('boom');
  });
});

// ---------------------------------------------------------------------------
// usePauseRecurrence
// ---------------------------------------------------------------------------

describe('usePauseRecurrence', () => {
  beforeEach(() => jest.clearAllMocks());

  it('invalidates recurrenceKeys.all on success', async () => {
    mocked.pauseRecurrence.mockResolvedValueOnce({ data: RECURRENCE_ROW, error: null });

    const { wrapper, client } = makeWrapper();
    const invalidate = jest.spyOn(client, 'invalidateQueries');
    const { result } = renderHook(() => usePauseRecurrence(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync('rec-1');
    });

    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['income-recurrences'] });
  });

  it('sets detail cache on success', async () => {
    mocked.pauseRecurrence.mockResolvedValueOnce({ data: RECURRENCE_ROW, error: null });

    const { wrapper, client } = makeWrapper();
    const setData = jest.spyOn(client, 'setQueryData');
    const { result } = renderHook(() => usePauseRecurrence(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync('rec-1');
    });

    expect(setData).toHaveBeenCalledWith(
      ['income-recurrences', 'detail', 'rec-1'],
      expect.any(Object),
    );
  });

  it('throws on repo error', async () => {
    mocked.pauseRecurrence.mockResolvedValueOnce({ data: null, error: new Error('pause failed') });

    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => usePauseRecurrence(), { wrapper });

    await expect(result.current.mutateAsync('rec-1')).rejects.toThrow('pause failed');
  });
});

// ---------------------------------------------------------------------------
// useResumeRecurrence
// ---------------------------------------------------------------------------

describe('useResumeRecurrence', () => {
  beforeEach(() => jest.clearAllMocks());

  it('invalidates recurrenceKeys.all on success', async () => {
    mocked.resumeRecurrence.mockResolvedValueOnce({ data: RECURRENCE_ROW, error: null });

    const { wrapper, client } = makeWrapper();
    const invalidate = jest.spyOn(client, 'invalidateQueries');
    const { result } = renderHook(() => useResumeRecurrence(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync('rec-1');
    });

    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['income-recurrences'] });
  });

  it('passes today as YYYY-MM-DD to resumeRecurrence', async () => {
    mocked.resumeRecurrence.mockResolvedValueOnce({ data: RECURRENCE_ROW, error: null });

    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useResumeRecurrence(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync('rec-1');
    });

    expect(mocked.resumeRecurrence).toHaveBeenCalledWith(
      'rec-1',
      expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
    );
  });

  it('throws on repo error', async () => {
    mocked.resumeRecurrence.mockResolvedValueOnce({
      data: null,
      error: new Error('resume failed'),
    });

    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useResumeRecurrence(), { wrapper });

    await expect(result.current.mutateAsync('rec-1')).rejects.toThrow('resume failed');
  });
});

// ---------------------------------------------------------------------------
// useUpdateRecurrence
// ---------------------------------------------------------------------------

describe('useUpdateRecurrence', () => {
  beforeEach(() => jest.clearAllMocks());

  it('invalidates recurrenceKeys.all on success', async () => {
    mocked.updateRecurrence.mockResolvedValueOnce({ data: RECURRENCE_ROW, error: null });

    const { wrapper, client } = makeWrapper();
    const invalidate = jest.spyOn(client, 'invalidateQueries');
    const { result } = renderHook(() => useUpdateRecurrence(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ id: 'rec-1', patch: { amount: 6000 } });
    });

    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['income-recurrences'] });
  });

  it('sets detail cache on success', async () => {
    mocked.updateRecurrence.mockResolvedValueOnce({ data: RECURRENCE_ROW, error: null });

    const { wrapper, client } = makeWrapper();
    const setData = jest.spyOn(client, 'setQueryData');
    const { result } = renderHook(() => useUpdateRecurrence(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ id: 'rec-1', patch: { amount: 6000 } });
    });

    expect(setData).toHaveBeenCalledWith(
      ['income-recurrences', 'detail', 'rec-1'],
      expect.any(Object),
    );
  });

  it('passes today as YYYY-MM-DD to updateRecurrence', async () => {
    mocked.updateRecurrence.mockResolvedValueOnce({ data: RECURRENCE_ROW, error: null });

    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useUpdateRecurrence(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ id: 'rec-1', patch: { frequency: 'weekly' } });
    });

    expect(mocked.updateRecurrence).toHaveBeenCalledWith(
      'rec-1',
      expect.objectContaining({ frequency: 'weekly' }),
      expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
    );
  });

  it('throws on repo error', async () => {
    mocked.updateRecurrence.mockResolvedValueOnce({
      data: null,
      error: new Error('update failed'),
    });

    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useUpdateRecurrence(), { wrapper });

    await expect(
      result.current.mutateAsync({ id: 'rec-1', patch: { amount: 6000 } }),
    ).rejects.toThrow('update failed');
  });
});

// ---------------------------------------------------------------------------
// useDeleteRecurrence
// ---------------------------------------------------------------------------

describe('useDeleteRecurrence', () => {
  beforeEach(() => jest.clearAllMocks());

  it('removes the detail query on success', async () => {
    mocked.deleteRecurrence.mockResolvedValueOnce({ data: { id: 'rec-1' }, error: null });

    const { wrapper, client } = makeWrapper();
    const remove = jest.spyOn(client, 'removeQueries');
    const { result } = renderHook(() => useDeleteRecurrence(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync('rec-1');
    });

    expect(remove).toHaveBeenCalledWith({ queryKey: ['income-recurrences', 'detail', 'rec-1'] });
  });

  it('invalidates recurrenceKeys.all and incomeKeys.all on success', async () => {
    mocked.deleteRecurrence.mockResolvedValueOnce({ data: { id: 'rec-1' }, error: null });

    const { wrapper, client } = makeWrapper();
    const invalidate = jest.spyOn(client, 'invalidateQueries');
    const { result } = renderHook(() => useDeleteRecurrence(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync('rec-1');
    });

    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['income-recurrences'] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['incomes'] });
  });

  it('throws on repo error', async () => {
    mocked.deleteRecurrence.mockResolvedValueOnce({
      data: null,
      error: new Error('delete failed'),
    });

    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useDeleteRecurrence(), { wrapper });

    await expect(result.current.mutateAsync('rec-1')).rejects.toThrow('delete failed');
  });
});
