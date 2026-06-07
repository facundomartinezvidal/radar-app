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
export type ExpenseItemRow = Tables<'expense_items'>;

/** Expense row joined with its category (left-join — `category` may be null). */
export interface ExpenseWithCategory extends ExpenseRow {
  category: CategoryRow | null;
}

/** Expense row joined with category + line items (items sorted by position asc). */
export interface ExpenseWithItems extends ExpenseWithCategory {
  items: ExpenseItemRow[];
}

interface RepoResult<T> {
  data: T | null;
  error: PostgrestError | Error | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const EXPENSE_WITH_CATEGORY_SELECT = '*, category:categories(*), items:expense_items(*)';

/** Sort items by position ascending (defensive — DB should return them ordered). */
function normalizeItems(row: ExpenseWithItems): ExpenseWithItems {
  return { ...row, items: [...row.items].sort((a, b) => a.position - b.position) };
}

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
): Promise<RepoResult<ExpenseWithItems[]>> {
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
  const rows = data as ExpenseWithItems[] | null;
  return { data: rows ? rows.map(normalizeItems) : null, error };
}

export async function getExpense(id: string): Promise<RepoResult<ExpenseWithItems>> {
  const { data, error } = await supabase
    .from('expenses')
    .select(EXPENSE_WITH_CATEGORY_SELECT)
    .eq('id', id)
    .maybeSingle();
  const row = data as ExpenseWithItems | null;
  return { data: row ? normalizeItems(row) : null, error };
}

/** Map `ExpenseItemInput` fields to the RPC jsonb item shape (no `id`). */
function toRpcItem(item: {
  name: string;
  quantity: number;
  unit_price: number | null;
  line_total: number;
  id?: string;
}): { name: string; quantity: number; unit_price: number | null; line_total: number } {
  return {
    name: item.name,
    quantity: item.quantity,
    unit_price: item.unit_price,
    line_total: item.line_total,
  };
}

export async function createExpense(
  input: CreateExpenseInput,
): Promise<RepoResult<ExpenseWithItems>> {
  try {
    const userId = await requireUserId();

    const rpcItems = (input.items ?? []).map(toRpcItem);

    const { data: rpcData, error: rpcError } = await supabase.rpc('create_expense_with_items', {
      p_amount: input.amount,
      p_currency: input.currency,
      // RPC signature declares p_category_id as string; pass empty string when null
      // (the DB function handles null via the json patch; the RPC type is imprecise).
      p_category_id: (input.category_id ?? '') as string,
      p_description: (input.description ?? null) as string,
      p_occurred_at: input.occurred_at ?? new Date().toISOString(),
      p_items: rpcItems as unknown as import('@/types/supabase').Json,
    });

    if (rpcError) return { data: null, error: rpcError };

    // Re-fetch the full row with nested relations so the returned shape is
    // consistent with all other repo functions.
    const createdId = (rpcData as { id?: string } | null)?.id;
    if (!createdId) {
      return { data: null, error: new Error('No se pudo recuperar el gasto creado.') };
    }

    const { data: fetched, error: fetchError } = await supabase
      .from('expenses')
      .select(EXPENSE_WITH_CATEGORY_SELECT)
      .eq('id', createdId)
      .maybeSingle();

    if (fetchError) return { data: null, error: fetchError };
    const row = fetched as ExpenseWithItems | null;
    // Guard: if the userId is needed but unused at this level, suppress the lint warning.
    void userId;
    return { data: row ? normalizeItems(row) : null, error: null };
  } catch (e) {
    return { data: null, error: e as Error };
  }
}

export async function updateExpense(
  id: string,
  input: UpdateExpenseInput,
): Promise<RepoResult<ExpenseWithItems>> {
  if (input.items !== undefined) {
    // Route through the RPC when items are explicitly provided (array or []).
    // p_items null = leave untouched; array (incl. []) = replace full set.
    const p_items = input.items.map(toRpcItem);

    // Build p_patch with only the column fields that are present (defined) in
    // input. Include keys with null values when explicitly set (e.g. clearing
    // category_id). Exclude keys whose value is undefined.
    const p_patch: Record<string, unknown> = {};
    if (input.amount !== undefined) p_patch.amount = input.amount;
    if (input.currency !== undefined) p_patch.currency = input.currency;
    if (input.category_id !== undefined) p_patch.category_id = input.category_id;
    if (input.description !== undefined) p_patch.description = input.description;
    if (input.occurred_at !== undefined) p_patch.occurred_at = input.occurred_at;

    const { data: rpcData, error: rpcError } = await supabase.rpc('update_expense_with_items', {
      p_id: id,
      p_patch: p_patch as unknown as import('@/types/supabase').Json,
      p_items: p_items as unknown as import('@/types/supabase').Json,
    });

    if (rpcError) return { data: null, error: rpcError };

    const updatedId = (rpcData as { id?: string } | null)?.id ?? id;
    const { data: fetched, error: fetchError } = await supabase
      .from('expenses')
      .select(EXPENSE_WITH_CATEGORY_SELECT)
      .eq('id', updatedId)
      .maybeSingle();

    if (fetchError) return { data: null, error: fetchError };
    const row = fetched as ExpenseWithItems | null;
    return { data: row ? normalizeItems(row) : null, error: null };
  }

  // No items in input — use the column-update path (preserves existing items).
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
  const row = data as ExpenseWithItems | null;
  return { data: row ? normalizeItems(row) : null, error };
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
