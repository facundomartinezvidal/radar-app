/**
 * Expenses repository — thin layer over Supabase queries.
 *
 * Every function returns `{ data, error }` to keep call sites uniform with
 * @supabase/supabase-js. RLS enforces ownership; we still pass `user_id` on
 * insert because RLS `with check` requires it to match `auth.uid()`.
 */
import type { PostgrestError } from '@supabase/supabase-js';

import { supabase } from '@/lib/supabase';
import type { CreateExpenseInput, ExpenseFilter, UpdateExpenseInput } from '@/lib/schemas/expense';
import type { Tables, TablesUpdate } from '@/types/supabase';

export type CategoryRow = Tables<'categories'>;
export type ExpenseRow = Tables<'expenses'>;

/** Expense row joined with its category (left-join — `category` may be null). */
export interface ExpenseWithCategory extends ExpenseRow {
  category: CategoryRow | null;
}

interface RepoResult<T> {
  data: T | null;
  error: PostgrestError | Error | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const EXPENSE_WITH_CATEGORY_SELECT = '*, category:categories(*)';

async function requireUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    throw new Error('No hay sesión activa. Iniciá sesión.');
  }
  return data.user.id;
}

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

export async function listCategories(): Promise<RepoResult<CategoryRow[]>> {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .order('sort_order', { ascending: true });
  return { data, error };
}

// ---------------------------------------------------------------------------
// Expenses
// ---------------------------------------------------------------------------

export async function listExpenses(
  filter: ExpenseFilter = {},
): Promise<RepoResult<ExpenseWithCategory[]>> {
  let query = supabase
    .from('expenses')
    .select(EXPENSE_WITH_CATEGORY_SELECT)
    .order('occurred_at', { ascending: false });

  if (filter.search && filter.search.length > 0) {
    // Postgres `ilike` — fine for v1, swap for trigram index post-MVP.
    query = query.ilike('description', `%${filter.search}%`);
  }
  if (filter.categoryIds && filter.categoryIds.length > 0) {
    query = query.in('category_id', filter.categoryIds);
  }
  if (filter.currencies && filter.currencies.length > 0) {
    query = query.in('currency', filter.currencies);
  }
  if (filter.from) {
    query = query.gte('occurred_at', filter.from);
  }
  if (filter.to) {
    query = query.lte('occurred_at', filter.to);
  }

  const limit = filter.limit ?? 50;
  const offset = filter.offset ?? 0;
  query = query.range(offset, offset + limit - 1);

  const { data, error } = await query;
  return { data: data as ExpenseWithCategory[] | null, error };
}

export async function getExpense(id: string): Promise<RepoResult<ExpenseWithCategory>> {
  const { data, error } = await supabase
    .from('expenses')
    .select(EXPENSE_WITH_CATEGORY_SELECT)
    .eq('id', id)
    .maybeSingle();
  return { data: data as ExpenseWithCategory | null, error };
}

export async function createExpense(
  input: CreateExpenseInput,
): Promise<RepoResult<ExpenseWithCategory>> {
  try {
    const userId = await requireUserId();
    const { data, error } = await supabase
      .from('expenses')
      .insert({
        user_id: userId,
        amount: input.amount,
        currency: input.currency,
        category_id: input.category_id,
        description: input.description ?? null,
        occurred_at: input.occurred_at ?? new Date().toISOString(),
      })
      .select(EXPENSE_WITH_CATEGORY_SELECT)
      .single();
    return { data: data as ExpenseWithCategory | null, error };
  } catch (e) {
    return { data: null, error: e as Error };
  }
}

export async function updateExpense(
  id: string,
  input: UpdateExpenseInput,
): Promise<RepoResult<ExpenseWithCategory>> {
  const patch: TablesUpdate<'expenses'> = {};
  if (input.amount !== undefined) patch.amount = input.amount;
  if (input.currency !== undefined) patch.currency = input.currency;
  if (input.category_id !== undefined) patch.category_id = input.category_id;
  if (input.description !== undefined) patch.description = input.description;
  if (input.occurred_at !== undefined) patch.occurred_at = input.occurred_at;

  const { data, error } = await supabase
    .from('expenses')
    .update(patch)
    .eq('id', id)
    .select(EXPENSE_WITH_CATEGORY_SELECT)
    .single();
  return { data: data as ExpenseWithCategory | null, error };
}

export async function deleteExpense(id: string): Promise<RepoResult<{ id: string }>> {
  const { error } = await supabase.from('expenses').delete().eq('id', id);
  return { data: error ? null : { id }, error };
}

// ---------------------------------------------------------------------------
// Aggregates
// ---------------------------------------------------------------------------

export interface CurrencyTotal {
  currency: string;
  total: number;
  count: number;
}

/**
 * Sums all expenses in the given window, grouped by currency. Useful for the
 * Home / Expenses balance hero.
 */
export async function sumExpensesByCurrency(
  filter: Pick<ExpenseFilter, 'from' | 'to'> = {},
): Promise<RepoResult<CurrencyTotal[]>> {
  let query = supabase.from('expenses').select('amount, currency');
  if (filter.from) query = query.gte('occurred_at', filter.from);
  if (filter.to) query = query.lte('occurred_at', filter.to);

  const { data, error } = await query;
  if (error || !data) return { data: null, error };

  const totals = new Map<string, { total: number; count: number }>();
  for (const row of data) {
    const prev = totals.get(row.currency) ?? { total: 0, count: 0 };
    prev.total += Number(row.amount);
    prev.count += 1;
    totals.set(row.currency, prev);
  }
  return {
    data: Array.from(totals, ([currency, v]) => ({ currency, ...v })),
    error: null,
  };
}
