/**
 * TanStack Query mutation hook for bulk transaction import.
 *
 * Calls `importTransactions` and on success invalidates the expense, income,
 * and totals caches so any list or balance widget refreshes automatically.
 *
 * Mirrors the mutation pattern established in hooks/use-expenses.ts and
 * hooks/use-incomes.ts.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { type ImportTransactionRow, importTransactions } from '@/lib/repositories/transactions';
import { expenseKeys } from '@/hooks/use-expenses';
import { incomeKeys } from '@/hooks/use-incomes';

export type { ImportTransactionRow };

// ---------------------------------------------------------------------------
// useImportTransactions
// ---------------------------------------------------------------------------

/**
 * Mutation that bulk-imports transactions via the `import_transactions` RPC.
 *
 * On success invalidates:
 *  - `expenseKeys.all`  → refreshes the expense list + totals
 *  - `incomeKeys.all`   → refreshes the income list + totals
 *
 * Throws on error so React Query's `isError` / `error` states work as
 * expected for the call site.
 */
export function useImportTransactions() {
  const qc = useQueryClient();

  return useMutation<number, Error, ImportTransactionRow[]>({
    mutationFn: async (rows) => {
      const { data, error } = await importTransactions(rows);
      if (error || data === null) {
        throw error ?? new Error('No se pudieron importar las transacciones.');
      }
      return data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: expenseKeys.all });
      void qc.invalidateQueries({ queryKey: incomeKeys.all });
    },
  });
}
