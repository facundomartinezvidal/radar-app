/**
 * Tests for use-categories hooks.
 *
 * Verifies mutation wiring and cache invalidation. The repository is mocked
 * to avoid supabase-js internals — those are covered by the repo's own tests.
 * Pattern mirrors hooks/__tests__/use-expenses.test.tsx.
 */
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';

import type { CategoryRow } from '@/lib/repositories/expenses';
import * as repo from '@/lib/repositories/categories';
import { useCreateCategory, useDeleteCategory, useUpdateCategory } from '../use-categories';

jest.mock('@/lib/repositories/categories');

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

const CATEGORY_ROW = {
  id: 'cat-1',
  user_id: 'user-1',
  slug: 'mascotas',
  name: 'Mascotas',
  icon: 'PawPrint',
  color: '#10B981',
  sort_order: 100,
  created_at: '2026-06-01T00:00:00Z',
  updated_at: '2026-06-01T00:00:00Z',
} as unknown as CategoryRow;

const CREATE_INPUT = {
  name: 'Mascotas',
  icon: 'PawPrint' as const,
  color: '#10B981' as const,
};

// ---------------------------------------------------------------------------
// useCreateCategory
// ---------------------------------------------------------------------------

describe('useCreateCategory', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('calls createCategory with the provided input', async () => {
    mocked.createCategory.mockResolvedValueOnce({ data: CATEGORY_ROW, error: null });

    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useCreateCategory(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync(CREATE_INPUT);
    });

    expect(mocked.createCategory).toHaveBeenCalledWith(CREATE_INPUT);
  });

  it('invalidates categoryKeys.all on success', async () => {
    mocked.createCategory.mockResolvedValueOnce({ data: CATEGORY_ROW, error: null });

    const { wrapper, client } = makeWrapper();
    const invalidate = jest.spyOn(client, 'invalidateQueries');
    const { result } = renderHook(() => useCreateCategory(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync(CREATE_INPUT);
    });

    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['categories'] });
  });

  it('does NOT invalidate expenseKeys on create', async () => {
    mocked.createCategory.mockResolvedValueOnce({ data: CATEGORY_ROW, error: null });

    const { wrapper, client } = makeWrapper();
    const invalidate = jest.spyOn(client, 'invalidateQueries');
    const { result } = renderHook(() => useCreateCategory(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync(CREATE_INPUT);
    });

    const expenseCalls = invalidate.mock.calls.filter(
      (call) => JSON.stringify(call[0]) === JSON.stringify({ queryKey: ['expenses'] }),
    );
    expect(expenseCalls).toHaveLength(0);
  });

  it('throws on repo error', async () => {
    mocked.createCategory.mockResolvedValueOnce({ data: null, error: new Error('boom') });

    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useCreateCategory(), { wrapper });

    await expect(result.current.mutateAsync(CREATE_INPUT)).rejects.toThrow('boom');
  });

  it('throws fallback message when data is null and error is null', async () => {
    mocked.createCategory.mockResolvedValueOnce({ data: null, error: null });

    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useCreateCategory(), { wrapper });

    await expect(result.current.mutateAsync(CREATE_INPUT)).rejects.toThrow(
      'No se pudo crear la categoría.',
    );
  });
});

// ---------------------------------------------------------------------------
// useUpdateCategory
// ---------------------------------------------------------------------------

describe('useUpdateCategory', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('invalidates categoryKeys.all on success', async () => {
    mocked.updateCategory.mockResolvedValueOnce({ data: CATEGORY_ROW, error: null });

    const { wrapper, client } = makeWrapper();
    const invalidate = jest.spyOn(client, 'invalidateQueries');
    const { result } = renderHook(() => useUpdateCategory(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ id: 'cat-1', patch: { name: 'Nueva' } });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['categories'] });
  });

  it('invalidates expenseKeys.all on success', async () => {
    mocked.updateCategory.mockResolvedValueOnce({ data: CATEGORY_ROW, error: null });

    const { wrapper, client } = makeWrapper();
    const invalidate = jest.spyOn(client, 'invalidateQueries');
    const { result } = renderHook(() => useUpdateCategory(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ id: 'cat-1', patch: { name: 'Nueva' } });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['expenses'] });
  });

  it('throws on repo error', async () => {
    mocked.updateCategory.mockResolvedValueOnce({ data: null, error: new Error('db error') });

    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useUpdateCategory(), { wrapper });

    await expect(
      result.current.mutateAsync({ id: 'cat-1', patch: { icon: 'Gift' } }),
    ).rejects.toThrow('db error');
  });
});

// ---------------------------------------------------------------------------
// useDeleteCategory
// ---------------------------------------------------------------------------

describe('useDeleteCategory', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('calls deleteCategory with the provided id', async () => {
    mocked.deleteCategory.mockResolvedValueOnce({ data: { id: 'cat-1' }, error: null });

    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useDeleteCategory(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync('cat-1');
    });

    expect(mocked.deleteCategory).toHaveBeenCalledWith('cat-1');
  });

  it('invalidates categoryKeys.all on success', async () => {
    mocked.deleteCategory.mockResolvedValueOnce({ data: { id: 'cat-1' }, error: null });

    const { wrapper, client } = makeWrapper();
    const invalidate = jest.spyOn(client, 'invalidateQueries');
    const { result } = renderHook(() => useDeleteCategory(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync('cat-1');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['categories'] });
  });

  it('invalidates expenseKeys.all on success', async () => {
    mocked.deleteCategory.mockResolvedValueOnce({ data: { id: 'cat-1' }, error: null });

    const { wrapper, client } = makeWrapper();
    const invalidate = jest.spyOn(client, 'invalidateQueries');
    const { result } = renderHook(() => useDeleteCategory(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync('cat-1');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['expenses'] });
  });

  it('throws on repo error', async () => {
    mocked.deleteCategory.mockResolvedValueOnce({ data: null, error: new Error('cannot delete') });

    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useDeleteCategory(), { wrapper });

    await expect(result.current.mutateAsync('cat-1')).rejects.toThrow('cannot delete');
  });
});
