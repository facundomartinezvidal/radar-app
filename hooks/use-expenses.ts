/**
 * TanStack Query hooks for expenses + categories + expense recurrences.
 *
 * One central place that maps repository functions to query keys and handles
 * cache invalidation. Screens import these hooks, never the repo directly.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import {
  type CategoryRow,
  type CurrencyTotal,
  type ExpenseRecurrenceWithCategory,
  type ExpenseWithItems,
  createExpense,
  createExpenseRecurrence,
  deleteExpense,
  deleteExpenseRecurrence,
  getExpense,
  listCategories,
  listExpenseRecurrences,
  listExpenses,
  pauseExpenseRecurrence,
  personalAmount,
  resumeExpenseRecurrence,
  sumExpensesByCurrency,
  updateExpense,
  updateExpenseRecurrence,
} from '@/lib/repositories/expenses';

export { personalAmount };
export type { ExpenseRecurrenceWithCategory };
import type { CreateExpenseInput, ExpenseFilter, UpdateExpenseInput } from '@/lib/schemas/expense';
import type {
  CreateExpenseRecurrenceInput,
  UpdateExpenseRecurrenceInput,
} from '@/lib/schemas/expense-recurrence';

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
  list: (kind?: string) => [...categoryKeys.all, 'list', kind ?? 'all'] as const,
};

export const expenseRecurrenceKeys = {
  all: ['expense-recurrences'] as const,
  list: () => [...expenseRecurrenceKeys.all, 'list'] as const,
  detail: (id: string) => [...expenseRecurrenceKeys.all, 'detail', id] as const,
};

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

/**
 * Fetch categories for the current user.
 *
 * Pass `kind` to restrict to `'expense'` or `'income'` categories.
 * Omitting `kind` (or passing `undefined`) returns all categories — backward
 * compatible with every existing caller.
 *
 * The query key includes `kind` so expense/income lists cache separately
 * while still being invalidated together when `categoryKeys.all` is purged.
 */
export function useCategories(kind?: string) {
  return useQuery<CategoryRow[]>({
    queryKey: categoryKeys.list(kind),
    queryFn: async () => {
      const { data, error } = await listCategories(kind);
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
  return useQuery<ExpenseWithItems[]>({
    queryKey: expenseKeys.list(filter),
    queryFn: async () => {
      const { data, error } = await listExpenses(filter);
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useExpense(id: string | undefined) {
  return useQuery<ExpenseWithItems | null>({
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
  return useMutation<ExpenseWithItems, Error, CreateExpenseInput>({
    mutationFn: async (input) => {
      const { data, error } = await createExpense(input);
      if (error || !data) throw error ?? new Error('No se pudo guardar el gasto.');
      return data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: expenseKeys.all });
    },
  });
}

export function useUpdateExpense() {
  const qc = useQueryClient();
  return useMutation<ExpenseWithItems, Error, { id: string; input: UpdateExpenseInput }>({
    mutationFn: async ({ id, input }) => {
      const { data, error } = await updateExpense(id, input);
      if (error || !data) throw error ?? new Error('No se pudo actualizar el gasto.');
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
      if (error || !data) throw error ?? new Error('No se pudo eliminar el gasto.');
      return data;
    },
    onSuccess: ({ id }) => {
      void qc.invalidateQueries({ queryKey: expenseKeys.all });
      qc.removeQueries({ queryKey: expenseKeys.detail(id) });
    },
  });
}

// ---------------------------------------------------------------------------
// Expense recurrences — read
// ---------------------------------------------------------------------------

export function useExpenseRecurrences() {
  return useQuery<ExpenseRecurrenceWithCategory[]>({
    queryKey: expenseRecurrenceKeys.list(),
    queryFn: async () => {
      const { data, error } = await listExpenseRecurrences();
      if (error) throw error;
      return data ?? [];
    },
  });
}

/**
 * Fetch a single expense recurrence by id.
 *
 * Resolves from the list cache — calls `listExpenseRecurrences` and finds the
 * row matching `id`. There is no single-row endpoint; the list is small
 * (per-user active/paused rules only) so this is acceptable.
 *
 * Returns `null` when no recurrence matches `id`.
 */
export function useExpenseRecurrence(id: string | undefined) {
  return useQuery<ExpenseRecurrenceWithCategory | null>({
    queryKey: expenseRecurrenceKeys.detail(id ?? ''),
    enabled: Boolean(id),
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await listExpenseRecurrences();
      if (error) throw error;
      return (data ?? []).find((r) => r.id === id) ?? null;
    },
  });
}

// ---------------------------------------------------------------------------
// Expense recurrences — mutations
// ---------------------------------------------------------------------------

/**
 * Create a new expense recurrence rule.
 *
 * `userId` is resolved via `supabase.auth.getUser()` — same pattern as
 * `useCreateRecurrence` in use-incomes.ts. `today` is computed from
 * `new Date()` so the scheduler starts from the current date.
 *
 * On success invalidates both `expenseRecurrenceKeys.all` and
 * `expenseKeys.all` — a new recurrence may materialize an expense immediately.
 */
export function useCreateExpenseRecurrence() {
  const qc = useQueryClient();
  return useMutation<ExpenseRecurrenceWithCategory, Error, CreateExpenseRecurrenceInput>({
    mutationFn: async (input) => {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError || !authData.user) {
        throw authError ?? new Error('No hay sesión activa. Iniciá sesión.');
      }
      const userId = authData.user.id;
      const today = new Date().toISOString().slice(0, 10);

      const { data, error } = await createExpenseRecurrence(input, userId, today);
      if (error || !data) throw error ?? new Error('No se pudo crear la recurrencia.');
      return data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: expenseRecurrenceKeys.all });
      // A new recurrence may materialize expenses immediately — be conservative.
      void qc.invalidateQueries({ queryKey: expenseKeys.all });
    },
  });
}

export function usePauseExpenseRecurrence() {
  const qc = useQueryClient();
  return useMutation<ExpenseRecurrenceWithCategory, Error, string>({
    mutationFn: async (id) => {
      const { data, error } = await pauseExpenseRecurrence(id);
      if (error || !data) throw error ?? new Error('No se pudo pausar la recurrencia.');
      return data;
    },
    onSuccess: (row) => {
      void qc.invalidateQueries({ queryKey: expenseRecurrenceKeys.all });
      qc.setQueryData(expenseRecurrenceKeys.detail(row.id), row);
    },
  });
}

export function useResumeExpenseRecurrence() {
  const qc = useQueryClient();
  return useMutation<ExpenseRecurrenceWithCategory, Error, string>({
    mutationFn: async (id) => {
      const today = new Date().toISOString().slice(0, 10);
      const { data, error } = await resumeExpenseRecurrence(id, today);
      if (error || !data) throw error ?? new Error('No se pudo reanudar la recurrencia.');
      return data;
    },
    onSuccess: (row) => {
      void qc.invalidateQueries({ queryKey: expenseRecurrenceKeys.all });
      qc.setQueryData(expenseRecurrenceKeys.detail(row.id), row);
    },
  });
}

export function useUpdateExpenseRecurrence() {
  const qc = useQueryClient();
  return useMutation<
    ExpenseRecurrenceWithCategory,
    Error,
    { id: string; patch: UpdateExpenseRecurrenceInput }
  >({
    mutationFn: async ({ id, patch }) => {
      const today = new Date().toISOString().slice(0, 10);
      const { data, error } = await updateExpenseRecurrence(id, patch, today);
      if (error || !data) throw error ?? new Error('No se pudo actualizar la recurrencia.');
      return data;
    },
    onSuccess: (row) => {
      void qc.invalidateQueries({ queryKey: expenseRecurrenceKeys.all });
      qc.setQueryData(expenseRecurrenceKeys.detail(row.id), row);
    },
  });
}

export function useDeleteExpenseRecurrence() {
  const qc = useQueryClient();
  return useMutation<{ id: string }, Error, string>({
    mutationFn: async (id) => {
      const { data, error } = await deleteExpenseRecurrence(id);
      if (error || !data) throw error ?? new Error('No se pudo eliminar la recurrencia.');
      return data;
    },
    onSuccess: ({ id }) => {
      void qc.invalidateQueries({ queryKey: expenseRecurrenceKeys.all });
      qc.removeQueries({ queryKey: expenseRecurrenceKeys.detail(id) });
      // Deleting a recurrence rule doesn't remove materialized expense rows
      // (FK is ON DELETE SET NULL), but be conservative and refresh the list.
      void qc.invalidateQueries({ queryKey: expenseKeys.all });
    },
  });
}
