/**
 * TanStack Query hooks for incomes + income recurrences.
 *
 * One central place that maps repository functions to query keys and handles
 * cache invalidation. Screens import these hooks, never the repo directly.
 * Mirrors the pattern established in hooks/use-expenses.ts.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import {
  type IncomeRecurrenceWithCategory,
  type IncomeWithCategory,
  createIncome,
  createRecurrence,
  deleteIncome,
  deleteRecurrence,
  getIncome,
  listIncomes,
  listRecurrences,
  pauseRecurrence,
  resumeRecurrence,
  sumIncomesByCurrency,
  updateIncome,
  updateRecurrence,
} from '@/lib/repositories/incomes';
import type { CurrencyTotal } from '@/lib/repositories/expenses';
import type { CreateIncomeInput, IncomeFilter, UpdateIncomeInput } from '@/lib/schemas/income';
import type { CreateRecurrenceInput, UpdateRecurrenceInput } from '@/lib/schemas/income-recurrence';

export type { IncomeWithCategory, IncomeRecurrenceWithCategory, CurrencyTotal };

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

export const incomeKeys = {
  all: ['incomes'] as const,
  list: (filter: IncomeFilter) => [...incomeKeys.all, 'list', filter] as const,
  detail: (id: string) => [...incomeKeys.all, 'detail', id] as const,
  totals: (range: Pick<IncomeFilter, 'from' | 'to'>) =>
    [...incomeKeys.all, 'totals', range] as const,
};

export const recurrenceKeys = {
  all: ['income-recurrences'] as const,
  list: () => [...recurrenceKeys.all, 'list'] as const,
  detail: (id: string) => [...recurrenceKeys.all, 'detail', id] as const,
};

// ---------------------------------------------------------------------------
// Incomes — read
// ---------------------------------------------------------------------------

export function useIncomes(filter: IncomeFilter = {}) {
  return useQuery<IncomeWithCategory[]>({
    queryKey: incomeKeys.list(filter),
    queryFn: async () => {
      const { data, error } = await listIncomes(filter);
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useIncome(id: string | undefined) {
  return useQuery<IncomeWithCategory | null>({
    queryKey: incomeKeys.detail(id ?? ''),
    enabled: Boolean(id),
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await getIncome(id);
      if (error) throw error;
      return data;
    },
  });
}

export function useIncomeTotals(range: Pick<IncomeFilter, 'from' | 'to'> = {}) {
  return useQuery<CurrencyTotal[]>({
    queryKey: incomeKeys.totals(range),
    queryFn: async () => {
      const { data, error } = await sumIncomesByCurrency(range);
      if (error) throw error;
      return data ?? [];
    },
  });
}

// ---------------------------------------------------------------------------
// Incomes — mutations
// ---------------------------------------------------------------------------

export function useCreateIncome() {
  const qc = useQueryClient();
  return useMutation<IncomeWithCategory, Error, CreateIncomeInput>({
    mutationFn: async (input) => {
      const { data, error } = await createIncome(input);
      if (error || !data) throw error ?? new Error('No se pudo guardar el ingreso.');
      return data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: incomeKeys.all });
    },
  });
}

export function useUpdateIncome() {
  const qc = useQueryClient();
  return useMutation<IncomeWithCategory, Error, { id: string; input: UpdateIncomeInput }>({
    mutationFn: async ({ id, input }) => {
      const { data, error } = await updateIncome(id, input);
      if (error || !data) throw error ?? new Error('No se pudo actualizar el ingreso.');
      return data;
    },
    onSuccess: (row) => {
      void qc.invalidateQueries({ queryKey: incomeKeys.all });
      qc.setQueryData(incomeKeys.detail(row.id), row);
    },
  });
}

export function useDeleteIncome() {
  const qc = useQueryClient();
  return useMutation<{ id: string }, Error, string>({
    mutationFn: async (id) => {
      const { data, error } = await deleteIncome(id);
      if (error || !data) throw error ?? new Error('No se pudo eliminar el ingreso.');
      return data;
    },
    onSuccess: ({ id }) => {
      void qc.invalidateQueries({ queryKey: incomeKeys.all });
      qc.removeQueries({ queryKey: incomeKeys.detail(id) });
    },
  });
}

// ---------------------------------------------------------------------------
// Recurrences — read
// ---------------------------------------------------------------------------

export function useRecurrences() {
  return useQuery<IncomeRecurrenceWithCategory[]>({
    queryKey: recurrenceKeys.list(),
    queryFn: async () => {
      const { data, error } = await listRecurrences();
      if (error) throw error;
      return data ?? [];
    },
  });
}

/**
 * Fetch a single recurrence by id.
 *
 * Resolves from the list cache — calls `listRecurrences` and finds the row
 * matching `id`. There is no single-row endpoint; the list is small (per-user
 * active/paused rules only) so this is acceptable.
 *
 * Returns `null` when no recurrence matches `id`.
 */
export function useRecurrence(id: string | undefined) {
  return useQuery<IncomeRecurrenceWithCategory | null>({
    queryKey: recurrenceKeys.detail(id ?? ''),
    enabled: Boolean(id),
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await listRecurrences();
      if (error) throw error;
      return (data ?? []).find((r) => r.id === id) ?? null;
    },
  });
}

// ---------------------------------------------------------------------------
// Recurrences — mutations
// ---------------------------------------------------------------------------

/**
 * Create a new recurrence rule.
 *
 * `userId` is resolved via `supabase.auth.getUser()` inside the mutationFn —
 * same pattern as `requireUserId()` in the repos. `today` is computed from
 * `new Date()` so the recurrence scheduler starts from the current date.
 */
export function useCreateRecurrence() {
  const qc = useQueryClient();
  return useMutation<IncomeRecurrenceWithCategory, Error, CreateRecurrenceInput>({
    mutationFn: async (input) => {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError || !authData.user) {
        throw authError ?? new Error('No hay sesión activa. Iniciá sesión.');
      }
      const userId = authData.user.id;
      const today = new Date().toISOString().slice(0, 10);

      const { data, error } = await createRecurrence(input, userId, today);
      if (error || !data) throw error ?? new Error('No se pudo crear la recurrencia.');
      return data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: recurrenceKeys.all });
      // A new recurrence may materialize incomes immediately — be conservative
      void qc.invalidateQueries({ queryKey: incomeKeys.all });
    },
  });
}

export function usePauseRecurrence() {
  const qc = useQueryClient();
  return useMutation<IncomeRecurrenceWithCategory, Error, string>({
    mutationFn: async (id) => {
      const { data, error } = await pauseRecurrence(id);
      if (error || !data) throw error ?? new Error('No se pudo pausar la recurrencia.');
      return data;
    },
    onSuccess: (row) => {
      void qc.invalidateQueries({ queryKey: recurrenceKeys.all });
      qc.setQueryData(recurrenceKeys.detail(row.id), row);
    },
  });
}

export function useResumeRecurrence() {
  const qc = useQueryClient();
  return useMutation<IncomeRecurrenceWithCategory, Error, string>({
    mutationFn: async (id) => {
      const today = new Date().toISOString().slice(0, 10);
      const { data, error } = await resumeRecurrence(id, today);
      if (error || !data) throw error ?? new Error('No se pudo reanudar la recurrencia.');
      return data;
    },
    onSuccess: (row) => {
      void qc.invalidateQueries({ queryKey: recurrenceKeys.all });
      qc.setQueryData(recurrenceKeys.detail(row.id), row);
    },
  });
}

export function useUpdateRecurrence() {
  const qc = useQueryClient();
  return useMutation<
    IncomeRecurrenceWithCategory,
    Error,
    { id: string; patch: UpdateRecurrenceInput }
  >({
    mutationFn: async ({ id, patch }) => {
      const today = new Date().toISOString().slice(0, 10);
      const { data, error } = await updateRecurrence(id, patch, today);
      if (error || !data) throw error ?? new Error('No se pudo actualizar la recurrencia.');
      return data;
    },
    onSuccess: (row) => {
      void qc.invalidateQueries({ queryKey: recurrenceKeys.all });
      qc.setQueryData(recurrenceKeys.detail(row.id), row);
    },
  });
}

export function useDeleteRecurrence() {
  const qc = useQueryClient();
  return useMutation<{ id: string }, Error, string>({
    mutationFn: async (id) => {
      const { data, error } = await deleteRecurrence(id);
      if (error || !data) throw error ?? new Error('No se pudo eliminar la recurrencia.');
      return data;
    },
    onSuccess: ({ id }) => {
      void qc.invalidateQueries({ queryKey: recurrenceKeys.all });
      qc.removeQueries({ queryKey: recurrenceKeys.detail(id) });
      // Deleting a recurrence rule doesn't remove materialized income rows
      // (FK is ON DELETE SET NULL), but be conservative and refresh the list.
      void qc.invalidateQueries({ queryKey: incomeKeys.all });
    },
  });
}
