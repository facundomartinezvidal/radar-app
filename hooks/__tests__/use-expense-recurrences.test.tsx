/**
 * Tests for expense-recurrence hooks in use-expenses.ts.
 *
 * Verifies query/mutation wiring + cache invalidation. We mock the
 * repository (and supabase for auth) to avoid touching supabase-js
 * internals here — those are covered by the repo's own tests.
 * Pattern mirrors hooks/__tests__/use-incomes.test.tsx.
 */
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';

import * as repo from '@/lib/repositories/expenses';
import {
  expenseKeys,
  expenseRecurrenceKeys,
  useCreateExpenseRecurrence,
  useDeleteExpenseRecurrence,
  useExpenseRecurrence,
  useExpenseRecurrences,
  usePauseExpenseRecurrence,
  useResumeExpenseRecurrence,
  useUpdateExpenseRecurrence,
} from '../use-expenses';

jest.mock('@/lib/repositories/expenses');

// ---------------------------------------------------------------------------
// Supabase auth mock — used by useCreateExpenseRecurrence
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

const EXPENSE_RECURRENCE_ROW: repo.ExpenseRecurrenceWithCategory = {
  id: 'erec-1',
  user_id: 'user-1',
  amount: 15000,
  currency: 'ARS',
  category_id: null,
  description: 'Alquiler',
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

describe('expenseRecurrenceKeys shapes', () => {
  it('expenseRecurrenceKeys.all is ["expense-recurrences"]', () => {
    expect(expenseRecurrenceKeys.all).toEqual(['expense-recurrences']);
  });

  it('expenseRecurrenceKeys.list starts with expenseRecurrenceKeys.all', () => {
    expect(expenseRecurrenceKeys.list()[0]).toBe('expense-recurrences');
    expect(expenseRecurrenceKeys.list()[1]).toBe('list');
  });

  it('expenseRecurrenceKeys.detail includes id', () => {
    expect(expenseRecurrenceKeys.detail('erec-1')).toEqual([
      'expense-recurrences',
      'detail',
      'erec-1',
    ]);
  });
});

// ---------------------------------------------------------------------------
// useExpenseRecurrences
// ---------------------------------------------------------------------------

describe('useExpenseRecurrences', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns recurrence rows from the repo', async () => {
    mocked.listExpenseRecurrences.mockResolvedValueOnce({
      data: [EXPENSE_RECURRENCE_ROW],
      error: null,
    });

    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useExpenseRecurrences(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mocked.listExpenseRecurrences).toHaveBeenCalled();
    expect(result.current.data).toHaveLength(1);
  });

  it('returns empty array when repo returns null', async () => {
    mocked.listExpenseRecurrences.mockResolvedValueOnce({ data: null, error: null });

    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useExpenseRecurrences(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([]);
  });

  it('throws on repo error', async () => {
    mocked.listExpenseRecurrences.mockResolvedValueOnce({
      data: null,
      error: new Error('db error'),
    });

    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useExpenseRecurrences(), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toEqual(new Error('db error'));
  });
});

// ---------------------------------------------------------------------------
// useExpenseRecurrence (single)
// ---------------------------------------------------------------------------

describe('useExpenseRecurrence', () => {
  beforeEach(() => jest.clearAllMocks());

  it('is disabled when id is undefined', () => {
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useExpenseRecurrence(undefined), { wrapper });
    expect(result.current.fetchStatus).toBe('idle');
  });

  it('resolves row from list when id is provided', async () => {
    mocked.listExpenseRecurrences.mockResolvedValueOnce({
      data: [EXPENSE_RECURRENCE_ROW],
      error: null,
    });

    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useExpenseRecurrence('erec-1'), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(EXPENSE_RECURRENCE_ROW);
  });

  it('returns null when id is not found in list', async () => {
    mocked.listExpenseRecurrences.mockResolvedValueOnce({
      data: [EXPENSE_RECURRENCE_ROW],
      error: null,
    });

    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useExpenseRecurrence('no-such-id'), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// useCreateExpenseRecurrence
// ---------------------------------------------------------------------------

describe('useCreateExpenseRecurrence', () => {
  beforeEach(() => jest.clearAllMocks());

  it('invalidates expenseRecurrenceKeys.all and expenseKeys.all on success', async () => {
    mocked.createExpenseRecurrence.mockResolvedValueOnce({
      data: EXPENSE_RECURRENCE_ROW,
      error: null,
    });

    const { wrapper, client } = makeWrapper();
    const invalidate = jest.spyOn(client, 'invalidateQueries');
    const { result } = renderHook(() => useCreateExpenseRecurrence(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        amount: 15000,
        currency: 'ARS',
        category_id: null,
        frequency: 'monthly',
        start_date: '2026-01-01',
      });
    });

    expect(invalidate).toHaveBeenCalledWith({ queryKey: expenseRecurrenceKeys.all });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: expenseKeys.all });
  });

  it('passes userId and today to createExpenseRecurrence', async () => {
    mocked.createExpenseRecurrence.mockResolvedValueOnce({
      data: EXPENSE_RECURRENCE_ROW,
      error: null,
    });

    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useCreateExpenseRecurrence(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        amount: 15000,
        currency: 'ARS',
        category_id: null,
        frequency: 'monthly',
        start_date: '2026-01-01',
      });
    });

    expect(mocked.createExpenseRecurrence).toHaveBeenCalledWith(
      expect.objectContaining({ frequency: 'monthly', start_date: '2026-01-01' }),
      'user-1',
      expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
    );
  });

  it('throws on repo error', async () => {
    mocked.createExpenseRecurrence.mockResolvedValueOnce({
      data: null,
      error: new Error('boom'),
    });

    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useCreateExpenseRecurrence(), { wrapper });

    await expect(
      result.current.mutateAsync({
        amount: 15000,
        currency: 'ARS',
        category_id: null,
        frequency: 'monthly',
        start_date: '2026-01-01',
      }),
    ).rejects.toThrow('boom');
  });

  it('throws fallback message when data is null and error is null', async () => {
    mocked.createExpenseRecurrence.mockResolvedValueOnce({ data: null, error: null });

    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useCreateExpenseRecurrence(), { wrapper });

    await expect(
      result.current.mutateAsync({
        amount: 15000,
        currency: 'ARS',
        category_id: null,
        frequency: 'monthly',
        start_date: '2026-01-01',
      }),
    ).rejects.toThrow('No se pudo crear la recurrencia.');
  });
});

// ---------------------------------------------------------------------------
// usePauseExpenseRecurrence
// ---------------------------------------------------------------------------

describe('usePauseExpenseRecurrence', () => {
  beforeEach(() => jest.clearAllMocks());

  it('invalidates expenseRecurrenceKeys.all on success', async () => {
    mocked.pauseExpenseRecurrence.mockResolvedValueOnce({
      data: EXPENSE_RECURRENCE_ROW,
      error: null,
    });

    const { wrapper, client } = makeWrapper();
    const invalidate = jest.spyOn(client, 'invalidateQueries');
    const { result } = renderHook(() => usePauseExpenseRecurrence(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync('erec-1');
    });

    expect(invalidate).toHaveBeenCalledWith({ queryKey: expenseRecurrenceKeys.all });
  });

  it('sets detail cache on success', async () => {
    mocked.pauseExpenseRecurrence.mockResolvedValueOnce({
      data: EXPENSE_RECURRENCE_ROW,
      error: null,
    });

    const { wrapper, client } = makeWrapper();
    const setData = jest.spyOn(client, 'setQueryData');
    const { result } = renderHook(() => usePauseExpenseRecurrence(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync('erec-1');
    });

    expect(setData).toHaveBeenCalledWith(
      ['expense-recurrences', 'detail', 'erec-1'],
      expect.any(Object),
    );
  });

  it('throws on repo error', async () => {
    mocked.pauseExpenseRecurrence.mockResolvedValueOnce({
      data: null,
      error: new Error('pause failed'),
    });

    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => usePauseExpenseRecurrence(), { wrapper });

    await expect(result.current.mutateAsync('erec-1')).rejects.toThrow('pause failed');
  });
});

// ---------------------------------------------------------------------------
// useResumeExpenseRecurrence
// ---------------------------------------------------------------------------

describe('useResumeExpenseRecurrence', () => {
  beforeEach(() => jest.clearAllMocks());

  it('invalidates expenseRecurrenceKeys.all on success', async () => {
    mocked.resumeExpenseRecurrence.mockResolvedValueOnce({
      data: EXPENSE_RECURRENCE_ROW,
      error: null,
    });

    const { wrapper, client } = makeWrapper();
    const invalidate = jest.spyOn(client, 'invalidateQueries');
    const { result } = renderHook(() => useResumeExpenseRecurrence(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync('erec-1');
    });

    expect(invalidate).toHaveBeenCalledWith({ queryKey: expenseRecurrenceKeys.all });
  });

  it('passes today as YYYY-MM-DD to resumeExpenseRecurrence', async () => {
    mocked.resumeExpenseRecurrence.mockResolvedValueOnce({
      data: EXPENSE_RECURRENCE_ROW,
      error: null,
    });

    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useResumeExpenseRecurrence(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync('erec-1');
    });

    expect(mocked.resumeExpenseRecurrence).toHaveBeenCalledWith(
      'erec-1',
      expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
    );
  });

  it('sets detail cache on success', async () => {
    mocked.resumeExpenseRecurrence.mockResolvedValueOnce({
      data: EXPENSE_RECURRENCE_ROW,
      error: null,
    });

    const { wrapper, client } = makeWrapper();
    const setData = jest.spyOn(client, 'setQueryData');
    const { result } = renderHook(() => useResumeExpenseRecurrence(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync('erec-1');
    });

    expect(setData).toHaveBeenCalledWith(
      ['expense-recurrences', 'detail', 'erec-1'],
      expect.any(Object),
    );
  });

  it('throws on repo error', async () => {
    mocked.resumeExpenseRecurrence.mockResolvedValueOnce({
      data: null,
      error: new Error('resume failed'),
    });

    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useResumeExpenseRecurrence(), { wrapper });

    await expect(result.current.mutateAsync('erec-1')).rejects.toThrow('resume failed');
  });
});

// ---------------------------------------------------------------------------
// useUpdateExpenseRecurrence
// ---------------------------------------------------------------------------

describe('useUpdateExpenseRecurrence', () => {
  beforeEach(() => jest.clearAllMocks());

  it('invalidates expenseRecurrenceKeys.all on success', async () => {
    mocked.updateExpenseRecurrence.mockResolvedValueOnce({
      data: EXPENSE_RECURRENCE_ROW,
      error: null,
    });

    const { wrapper, client } = makeWrapper();
    const invalidate = jest.spyOn(client, 'invalidateQueries');
    const { result } = renderHook(() => useUpdateExpenseRecurrence(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ id: 'erec-1', patch: { amount: 20000 } });
    });

    expect(invalidate).toHaveBeenCalledWith({ queryKey: expenseRecurrenceKeys.all });
  });

  it('sets detail cache on success', async () => {
    mocked.updateExpenseRecurrence.mockResolvedValueOnce({
      data: EXPENSE_RECURRENCE_ROW,
      error: null,
    });

    const { wrapper, client } = makeWrapper();
    const setData = jest.spyOn(client, 'setQueryData');
    const { result } = renderHook(() => useUpdateExpenseRecurrence(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ id: 'erec-1', patch: { amount: 20000 } });
    });

    expect(setData).toHaveBeenCalledWith(
      ['expense-recurrences', 'detail', 'erec-1'],
      expect.any(Object),
    );
  });

  it('passes today as YYYY-MM-DD to updateExpenseRecurrence', async () => {
    mocked.updateExpenseRecurrence.mockResolvedValueOnce({
      data: EXPENSE_RECURRENCE_ROW,
      error: null,
    });

    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useUpdateExpenseRecurrence(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ id: 'erec-1', patch: { frequency: 'weekly' } });
    });

    expect(mocked.updateExpenseRecurrence).toHaveBeenCalledWith(
      'erec-1',
      expect.objectContaining({ frequency: 'weekly' }),
      expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
    );
  });

  it('throws on repo error', async () => {
    mocked.updateExpenseRecurrence.mockResolvedValueOnce({
      data: null,
      error: new Error('update failed'),
    });

    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useUpdateExpenseRecurrence(), { wrapper });

    await expect(
      result.current.mutateAsync({ id: 'erec-1', patch: { amount: 20000 } }),
    ).rejects.toThrow('update failed');
  });
});

// ---------------------------------------------------------------------------
// useDeleteExpenseRecurrence
// ---------------------------------------------------------------------------

describe('useDeleteExpenseRecurrence', () => {
  beforeEach(() => jest.clearAllMocks());

  it('removes the detail query on success', async () => {
    mocked.deleteExpenseRecurrence.mockResolvedValueOnce({
      data: { id: 'erec-1' },
      error: null,
    });

    const { wrapper, client } = makeWrapper();
    const remove = jest.spyOn(client, 'removeQueries');
    const { result } = renderHook(() => useDeleteExpenseRecurrence(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync('erec-1');
    });

    expect(remove).toHaveBeenCalledWith({
      queryKey: ['expense-recurrences', 'detail', 'erec-1'],
    });
  });

  it('invalidates expenseRecurrenceKeys.all and expenseKeys.all on success', async () => {
    mocked.deleteExpenseRecurrence.mockResolvedValueOnce({
      data: { id: 'erec-1' },
      error: null,
    });

    const { wrapper, client } = makeWrapper();
    const invalidate = jest.spyOn(client, 'invalidateQueries');
    const { result } = renderHook(() => useDeleteExpenseRecurrence(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync('erec-1');
    });

    expect(invalidate).toHaveBeenCalledWith({ queryKey: expenseRecurrenceKeys.all });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: expenseKeys.all });
  });

  it('throws on repo error', async () => {
    mocked.deleteExpenseRecurrence.mockResolvedValueOnce({
      data: null,
      error: new Error('delete failed'),
    });

    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useDeleteExpenseRecurrence(), { wrapper });

    await expect(result.current.mutateAsync('erec-1')).rejects.toThrow('delete failed');
  });
});
