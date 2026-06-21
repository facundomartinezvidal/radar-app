/**
 * Transactions repository — bulk import via `import_transactions` RPC.
 *
 * The RPC is SECURITY INVOKER: it respects RLS and inserts rows under the
 * caller's auth.uid(). The call is atomic — either all rows are inserted or
 * none (the RPC wraps its body in a transaction).
 *
 * Returns `{ data, error }` in the same non-throwing `RepoResult<T>` contract
 * used by all other repositories in this project.
 */
import { supabase } from '@/lib/supabase';
import type { RepoResult } from '@/lib/repositories/expenses';
import type { Currency } from '@/lib/schemas/expense';
import type { Json } from '@/types/supabase';

// ---------------------------------------------------------------------------
// Public interface
// ---------------------------------------------------------------------------

export interface ImportTransactionRow {
  direction: 'expense' | 'income';
  amount: number;
  currency: Currency;
  category_id: string | null;
  description: string | null;
  occurred_at: string; // ISO 8601
}

// ---------------------------------------------------------------------------
// importTransactions
// ---------------------------------------------------------------------------

/**
 * Bulk-import transactions via the `import_transactions` RPC.
 *
 * Inserts each row into `expenses` (direction=expense) or `incomes`
 * (direction=income) under the caller's RLS. The operation is atomic.
 *
 * @param rows Non-empty array of rows to import.
 * @returns `{ data: insertedCount, error: null }` on success;
 *          `{ data: null, error }` on failure.
 */
export async function importTransactions(
  rows: ImportTransactionRow[],
): Promise<RepoResult<number>> {
  try {
    const { data, error } = await supabase.rpc('import_transactions', {
      p_rows: rows as unknown as Json,
    });

    if (error) return { data: null, error };

    return { data: typeof data === 'number' ? data : null, error: null };
  } catch (e) {
    return { data: null, error: e as Error };
  }
}
