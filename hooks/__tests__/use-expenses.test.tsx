/**
 * Tests for use-expenses hooks.
 *
 * Verifies query/mutation wiring + cache invalidation. We mock the
 * repository to avoid touching supabase-js internals here — those are
 * covered by the repo's own tests.
 */
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';

import * as repo from '@/lib/repositories/expenses';
import {
  useCategories,
  useCreateExpense,
  useDeleteExpense,
  useExpense,
  useExpenseTotals,
  useExpenses,
  useUpdateExpense,
} from '../use-expenses';

jest.mock('@/lib/repositories/expenses');

const mocked = repo as jest.Mocked<typeof repo>;

function makeWrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { wrapper, client };
}

describe('use-expenses hooks', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('useCategories', () => {
    it('returns categories from the repo', async () => {
      mocked.listCategories.mockResolvedValueOnce({
        data: [{ id: 'c1', slug: 'comida' } as repo.CategoryRow],
        error: null,
      });

      const { wrapper } = makeWrapper();
      const { result } = renderHook(() => useCategories(), { wrapper });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual([{ id: 'c1', slug: 'comida' }]);
    });
  });

  describe('useExpenses', () => {
    it('returns rows from the repo', async () => {
      mocked.listExpenses.mockResolvedValueOnce({
        data: [
          { id: 'e1', amount: 100, currency: 'ARS', items: [] } as unknown as repo.ExpenseWithItems,
        ],
        error: null,
      });

      const { wrapper } = makeWrapper();
      const { result } = renderHook(() => useExpenses({ search: 'pizza' }), { wrapper });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mocked.listExpenses).toHaveBeenCalledWith({ search: 'pizza' });
      expect(result.current.data).toHaveLength(1);
    });
  });

  describe('useExpense', () => {
    it('is disabled when id is undefined', () => {
      const { wrapper } = makeWrapper();
      const { result } = renderHook(() => useExpense(undefined), { wrapper });
      expect(result.current.fetchStatus).toBe('idle');
    });

    it('fetches when id is provided', async () => {
      mocked.getExpense.mockResolvedValueOnce({
        data: { id: 'e1', items: [] } as unknown as repo.ExpenseWithItems,
        error: null,
      });
      const { wrapper } = makeWrapper();
      const { result } = renderHook(() => useExpense('e1'), { wrapper });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mocked.getExpense).toHaveBeenCalledWith('e1');
    });
  });

  describe('useExpenseTotals', () => {
    it('returns currency totals', async () => {
      mocked.sumExpensesByCurrency.mockResolvedValueOnce({
        data: [{ currency: 'ARS', total: 150, count: 2 }],
        error: null,
      });
      const { wrapper } = makeWrapper();
      const { result } = renderHook(() => useExpenseTotals({}), { wrapper });
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data?.[0]?.total).toBe(150);
    });
  });

  describe('useCreateExpense', () => {
    it('invalidates list + totals queries on success', async () => {
      mocked.createExpense.mockResolvedValueOnce({
        data: {
          id: 'e1',
          amount: 100,
          currency: 'ARS',
          items: [],
        } as unknown as repo.ExpenseWithItems,
        error: null,
      });

      const { wrapper, client } = makeWrapper();
      const invalidate = jest.spyOn(client, 'invalidateQueries');
      const { result } = renderHook(() => useCreateExpense(), { wrapper });

      await act(async () => {
        await result.current.mutateAsync({
          amount: 100,
          currency: 'ARS',
          category_id: null,
        });
      });

      expect(mocked.createExpense).toHaveBeenCalled();
      expect(invalidate).toHaveBeenCalledWith({ queryKey: ['expenses'] });
    });

    it('throws on repo error', async () => {
      mocked.createExpense.mockResolvedValueOnce({
        data: null,
        error: new Error('boom'),
      });
      const { wrapper } = makeWrapper();
      const { result } = renderHook(() => useCreateExpense(), { wrapper });

      await expect(
        result.current.mutateAsync({ amount: 100, currency: 'ARS', category_id: null }),
      ).rejects.toThrow('boom');
    });
  });

  describe('useUpdateExpense', () => {
    it('updates cache for the detail key on success', async () => {
      mocked.updateExpense.mockResolvedValueOnce({
        data: {
          id: 'e1',
          amount: 200,
          currency: 'ARS',
          items: [],
        } as unknown as repo.ExpenseWithItems,
        error: null,
      });
      const { wrapper, client } = makeWrapper();
      const setData = jest.spyOn(client, 'setQueryData');
      const { result } = renderHook(() => useUpdateExpense(), { wrapper });

      await act(async () => {
        await result.current.mutateAsync({ id: 'e1', input: { amount: 200 } });
      });

      expect(setData).toHaveBeenCalledWith(['expenses', 'detail', 'e1'], expect.any(Object));
    });
  });

  describe('useDeleteExpense', () => {
    it('removes the detail query on success', async () => {
      mocked.deleteExpense.mockResolvedValueOnce({
        data: { id: 'e1' },
        error: null,
      });
      const { wrapper, client } = makeWrapper();
      const remove = jest.spyOn(client, 'removeQueries');
      const { result } = renderHook(() => useDeleteExpense(), { wrapper });

      await act(async () => {
        await result.current.mutateAsync('e1');
      });

      expect(remove).toHaveBeenCalledWith({ queryKey: ['expenses', 'detail', 'e1'] });
    });
  });
});
