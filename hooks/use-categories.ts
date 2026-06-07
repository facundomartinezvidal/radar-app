/**
 * TanStack Query mutation hooks for custom category management.
 *
 * Read hooks (useCategories) live in hooks/use-expenses.ts because they share
 * the same categoryKeys. These mutation hooks are separated here to keep the
 * category-write concern isolated.
 *
 * On success, mutations always invalidate categoryKeys.all. Update and delete
 * also invalidate expenseKeys.all because expense rows embed the category
 * snapshot and the list/detail views would otherwise show stale category data.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { createCategory, deleteCategory, updateCategory } from '@/lib/repositories/categories';
import type { CategoryRow } from '@/lib/repositories/expenses';
import type { CreateCategoryInput, UpdateCategoryInput } from '@/lib/schemas/category';
import { categoryKeys, expenseKeys } from '@/hooks/use-expenses';

// ---------------------------------------------------------------------------
// useCreateCategory
// ---------------------------------------------------------------------------

export function useCreateCategory() {
  const qc = useQueryClient();
  return useMutation<CategoryRow, Error, CreateCategoryInput>({
    mutationFn: async (input) => {
      const { data, error } = await createCategory(input);
      if (error || !data) throw error ?? new Error('No se pudo crear la categoría.');
      return data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: categoryKeys.all });
    },
  });
}

// ---------------------------------------------------------------------------
// useUpdateCategory
// ---------------------------------------------------------------------------

export function useUpdateCategory() {
  const qc = useQueryClient();
  return useMutation<CategoryRow, Error, { id: string; patch: UpdateCategoryInput }>({
    mutationFn: async ({ id, patch }) => {
      const { data, error } = await updateCategory(id, patch);
      if (error || !data) throw error ?? new Error('No se pudo actualizar la categoría.');
      return data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: categoryKeys.all });
      void qc.invalidateQueries({ queryKey: expenseKeys.all });
    },
  });
}

// ---------------------------------------------------------------------------
// useDeleteCategory
// ---------------------------------------------------------------------------

export function useDeleteCategory() {
  const qc = useQueryClient();
  return useMutation<{ id: string }, Error, string>({
    mutationFn: async (id) => {
      const { data, error } = await deleteCategory(id);
      if (error || !data) throw error ?? new Error('No se pudo eliminar la categoría.');
      return data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: categoryKeys.all });
      void qc.invalidateQueries({ queryKey: expenseKeys.all });
    },
  });
}
