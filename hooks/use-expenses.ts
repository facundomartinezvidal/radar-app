/**
 * TanStack Query hooks for expenses + categories.
 *
 * One central place that maps repository functions to query keys and handles
 * cache invalidation. Screens import these hooks, never the repo directly.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  type CategoryRow,
  type CurrencyTotal,
  type ExpenseWithCategory,
  createExpense,
  deleteExpense,
  getExpense,
  listCategories,
  listExpenses,
  sumExpensesByCurrency,
  updateExpense,
} from '@/lib/repositories/expenses';
import type { CreateExpenseInput, ExpenseFilter, UpdateExpenseInput } from '@/lib/schemas/expense';

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

export const expenseKeys = {
  all: ['expenses'] as const,
  list: (filter: ExpenseFilter) => [...expenseKeys.all, 'list', filter] as const,
  detail: (id: string) => [...expenseKeys.all, 'detail', id] as const,
  totals: (range: Pick<ExpenseFilter, 'from' | 'to'>) =>
    [...expenseKeys.all, 'totals', range] as const,
};

export const categoryKeys = {
  all: ['categories'] as const,
};

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

export function useCategories() {
  return useQuery<CategoryRow[]>({
    queryKey: categoryKeys.all,
    queryFn: async () => {
      const { data, error } = await listCategories();
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 1000 * 60 * 60, // categories rarely change
  });
}

// ---------------------------------------------------------------------------
// Expenses — read
// ---------------------------------------------------------------------------

export function useExpenses(filter: ExpenseFilter = {}) {
  return useQuery<ExpenseWithCategory[]>({
    queryKey: expenseKeys.list(filter),
    queryFn: async () => {
      const { data, error } = await listExpenses(filter);
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useExpense(id: string | undefined) {
  return useQuery<ExpenseWithCategory | null>({
    queryKey: expenseKeys.detail(id ?? ''),
    enabled: Boolean(id),
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await getExpense(id);
      if (error) throw error;
      return data;
    },
  });
}

export function useExpenseTotals(range: Pick<ExpenseFilter, 'from' | 'to'> = {}) {
  return useQuery<CurrencyTotal[]>({
    queryKey: expenseKeys.totals(range),
    queryFn: async () => {
      const { data, error } = await sumExpensesByCurrency(range);
      if (error) throw error;
      return data ?? [];
    },
  });
}

// ---------------------------------------------------------------------------
// Expenses — mutations
// ---------------------------------------------------------------------------

export function useCreateExpense() {
  const qc = useQueryClient();
  return useMutation<ExpenseWithCategory, Error, CreateExpenseInput>({
    mutationFn: async (input) => {
      const { data, error } = await createExpense(input);
      if (error || !data) throw error ?? new Error('No pudimos guardar el gasto.');
      return data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: expenseKeys.all });
    },
  });
}

export function useUpdateExpense() {
  const qc = useQueryClient();
  return useMutation<ExpenseWithCategory, Error, { id: string; input: UpdateExpenseInput }>({
    mutationFn: async ({ id, input }) => {
      const { data, error } = await updateExpense(id, input);
      if (error || !data) throw error ?? new Error('No pudimos actualizar el gasto.');
      return data;
    },
    onSuccess: (row) => {
      void qc.invalidateQueries({ queryKey: expenseKeys.all });
      qc.setQueryData(expenseKeys.detail(row.id), row);
    },
  });
}

export function useDeleteExpense() {
  const qc = useQueryClient();
  return useMutation<{ id: string }, Error, string>({
    mutationFn: async (id) => {
      const { data, error } = await deleteExpense(id);
      if (error || !data) throw error ?? new Error('No pudimos borrar el gasto.');
      return data;
    },
    onSuccess: ({ id }) => {
      void qc.invalidateQueries({ queryKey: expenseKeys.all });
      qc.removeQueries({ queryKey: expenseKeys.detail(id) });
    },
  });
}
