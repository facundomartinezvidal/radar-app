/**
 * Shared expenses repository — reads and writes expense rows that belong to a group.
 *
 * All writes go through transactional Supabase RPCs (SECURITY INVOKER) so RLS
 * applies to both the expense row and the related split rows atomically.
 *
 * The `{ data, error }` contract mirrors all other repositories in this project.
 */
import { supabase } from '@/lib/supabase';
import type { SettlementInput } from '@/lib/schemas/group';
import type { ShareEntry } from '@/lib/split-math';
import type { Tables } from '@/types/supabase';
import { type ExpenseWithItems, type RepoResult } from '@/lib/repositories/expenses';
import type { GroupMemberRow, GroupRow } from '@/lib/repositories/groups';

// ---------------------------------------------------------------------------
// Row types
// ---------------------------------------------------------------------------

export type ExpenseSplitRow = Tables<'expense_splits'>;

/**
 * Expense row joined with category + line items + per-member splits.
 * `splits` carries the nested `member` join so `personalAmount()` can
 * identify each member's share by `member.user_id`.
 */
export type GroupExpense = ExpenseWithItems;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function requireUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    throw new Error('No hay sesión activa. Iniciá sesión.');
  }
  return data.user.id;
}

const GROUP_EXPENSE_SELECT =
  '*, category:categories(*), items:expense_items(*), splits:expense_splits(*, member:group_members(user_id))';

/** Sort items by position ascending (defensive normalisation). */
function normalizeItems<T extends ExpenseWithItems>(row: T): T {
  return { ...row, items: [...row.items].sort((a, b) => a.position - b.position) };
}

// ---------------------------------------------------------------------------
// Input types
// ---------------------------------------------------------------------------

export interface CreateSharedExpenseInput {
  amount: number;
  currency: string;
  category_id: string | null;
  description?: string | null;
  occurred_at?: string;
  items: { name: string; quantity: number; unit_price: number | null; line_total: number }[];
  group_id: string;
  paid_by_member_id: string;
  splits: ShareEntry[];
}

/**
 * Input for `updateSharedExpense`.
 *
 * `patch` follows the only-present-keys idiom: include a key only when you
 * want to change it. `items` null = leave items untouched; array (incl. [])
 * = replace the full set. `splits` null = leave splits untouched; array =
 * replace the full set (same semantics as items).
 */
export interface UpdateSharedExpenseInput {
  patch: {
    amount?: number;
    currency?: string;
    category_id?: string | null;
    description?: string | null;
    occurred_at?: string;
  };
  items?:
    | { name: string; quantity: number; unit_price: number | null; line_total: number }[]
    | null;
  paid_by_member_id: string;
  splits: ShareEntry[];
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

/**
 * Create a shared expense via the `create_shared_expense` RPC.
 *
 * The RPC inserts the `expenses` row, the `expense_items` rows, and the
 * `expense_splits` rows in a single transaction. On success the full expense
 * (with category, items, and splits) is re-fetched and returned so callers
 * get a consistent shape.
 */
export async function createSharedExpense(
  input: CreateSharedExpenseInput,
): Promise<RepoResult<ExpenseWithItems>> {
  try {
    const { data: rpcData, error: rpcError } = await supabase.rpc('create_shared_expense', {
      p_amount: input.amount,
      p_currency: input.currency,
      p_category_id: (input.category_id ?? '') as string,
      p_description: (input.description ?? null) as string,
      p_occurred_at: input.occurred_at ?? new Date().toISOString(),
      p_items: input.items as unknown as import('@/types/supabase').Json,
      p_group_id: input.group_id,
      p_paid_by_member_id: input.paid_by_member_id,
      p_splits: input.splits as unknown as import('@/types/supabase').Json,
    });

    if (rpcError) return { data: null, error: rpcError };

    const createdId = (rpcData as { id?: string } | null)?.id;
    if (!createdId) {
      return { data: null, error: new Error('No se pudo recuperar el gasto compartido creado.') };
    }

    // Re-fetch the full row with nested relations (consistent with createExpense pattern)
    const { data: fetched, error: fetchError } = await supabase
      .from('expenses')
      .select(GROUP_EXPENSE_SELECT)
      .eq('id', createdId)
      .maybeSingle();

    if (fetchError) return { data: null, error: fetchError };
    const row = fetched as GroupExpense | null;
    return { data: row ? normalizeItems(row) : null, error: null };
  } catch (e) {
    return { data: null, error: e as Error };
  }
}

/**
 * Update a shared expense via the `update_shared_expense` RPC.
 *
 * The RPC patches only the columns present in `input.patch`, optionally
 * replaces items and/or splits atomically, and enforces group membership /
 * split-sum validation in the DB. On success the full expense (with category,
 * items, and splits) is re-fetched so the returned shape is consistent with
 * all other repo functions.
 *
 * Converting a personal expense to shared (or vice-versa) is intentionally
 * out of scope — the RPC will raise 'not a shared expense' if called on a
 * personal expense.
 */
export async function updateSharedExpense(
  id: string,
  input: UpdateSharedExpenseInput,
): Promise<RepoResult<ExpenseWithItems>> {
  try {
    // Build p_patch: include only explicitly-set keys (undefined keys must not
    // be forwarded so the RPC's only-present-keys logic works correctly).
    const p_patch: Record<string, unknown> = {};
    if (input.patch.amount !== undefined) p_patch.amount = input.patch.amount;
    if (input.patch.currency !== undefined) p_patch.currency = input.patch.currency;
    if (input.patch.category_id !== undefined) p_patch.category_id = input.patch.category_id;
    if (input.patch.description !== undefined) p_patch.description = input.patch.description;
    if (input.patch.occurred_at !== undefined) p_patch.occurred_at = input.patch.occurred_at;

    // Map items to the RPC shape (strip `id` — the DB assigns new ids on
    // every replace, which is the documented known limitation for items).
    const p_items =
      input.items != null
        ? input.items.map((item) => ({
            name: item.name,
            quantity: item.quantity,
            unit_price: item.unit_price,
            line_total: item.line_total,
          }))
        : null;

    const { data: rpcData, error: rpcError } = await supabase.rpc('update_shared_expense', {
      p_id: id,
      p_patch: p_patch as unknown as import('@/types/supabase').Json,
      p_items: p_items as unknown as import('@/types/supabase').Json,
      p_paid_by_member_id: input.paid_by_member_id,
      p_splits: input.splits as unknown as import('@/types/supabase').Json,
    });

    if (rpcError) return { data: null, error: rpcError };

    const updatedId = (rpcData as { id?: string } | null)?.id ?? id;

    // Re-fetch the full row with nested relations
    const { data: fetched, error: fetchError } = await supabase
      .from('expenses')
      .select(GROUP_EXPENSE_SELECT)
      .eq('id', updatedId)
      .maybeSingle();

    if (fetchError) return { data: null, error: fetchError };
    const row = fetched as GroupExpense | null;
    return { data: row ? normalizeItems(row) : null, error: null };
  } catch (e) {
    return { data: null, error: e as Error };
  }
}

/**
 * List all expenses belonging to a group, newest first.
 *
 * Items within each expense are sorted by position ascending.
 */
export async function listGroupExpenses(groupId: string): Promise<RepoResult<GroupExpense[]>> {
  const { data, error } = await supabase
    .from('expenses')
    .select(GROUP_EXPENSE_SELECT)
    .eq('group_id', groupId)
    .order('occurred_at', { ascending: false });

  const rows = data as GroupExpense[] | null;
  return { data: rows ? rows.map(normalizeItems) : null, error };
}

/**
 * Record a settlement (payment from one member to another) via the
 * `create_settlement` RPC.
 *
 * The RPC inserts a `group_settlements` row and, if applicable, adjusts the
 * running balances (logic lives in the DB function).
 */
export async function createSettlement(
  input: SettlementInput & { group_id: string },
): Promise<RepoResult<Tables<'group_settlements'>>> {
  try {
    const { data, error } = await supabase.rpc('create_settlement', {
      p_from_member_id: input.from_member_id,
      p_to_member_id: input.to_member_id,
      p_amount: input.amount,
      p_currency: input.currency,
      p_group_id: input.group_id,
    });
    if (error) return { data: null, error };
    return { data: data as Tables<'group_settlements'> | null, error: null };
  } catch (e) {
    return { data: null, error: e as Error };
  }
}

/**
 * List all pending group invitations for the authenticated user.
 *
 * Returns member rows joined with their parent group so the UI can display
 * which group each invitation is for.
 */
export async function listPendingInvites(): Promise<
  RepoResult<(GroupMemberRow & { group: GroupRow | null })[]>
> {
  try {
    const userId = await requireUserId();

    const { data, error } = await supabase
      .from('group_members')
      .select('*, group:groups(*)')
      .eq('user_id', userId)
      .eq('status', 'pending');

    if (error) return { data: null, error };
    return {
      data: data as (GroupMemberRow & { group: GroupRow | null })[] | null,
      error: null,
    };
  } catch (e) {
    return { data: null, error: e as Error };
  }
}
