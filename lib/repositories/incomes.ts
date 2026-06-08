/**
 * Incomes repository — thin layer over Supabase queries.
 *
 * Incomes have NO line items and NO group splits, so all mutations are
 * single-table inserts/updates/deletes under RLS — mirrors the categories
 * repo pattern (direct CRUD, no transactional RPCs).
 *
 * The non-throwing `{ data, error }` contract and `RepoResult<T>` type are
 * imported from the expenses repo (single source of truth). Every function
 * catches thrown errors (e.g. from `requireUserId`) and returns them in the
 * `error` slot so call sites stay uniform.
 *
 * RLS enforces ownership; we still pass `user_id` on insert because the RLS
 * `with check` requires it to match `auth.uid()`.
 */
import { supabase } from '@/lib/supabase';
import type { CreateIncomeInput, IncomeFilter, UpdateIncomeInput } from '@/lib/schemas/income';
import type { CreateRecurrenceInput, UpdateRecurrenceInput } from '@/lib/schemas/income-recurrence';
import { dayOfMonthFrom, firstFutureOccurrence } from '@/lib/income-recurrence';
import { type CategoryRow, type CurrencyTotal, type RepoResult } from '@/lib/repositories/expenses';
import type { Tables, TablesUpdate } from '@/types/supabase';

// ---------------------------------------------------------------------------
// Row types
// ---------------------------------------------------------------------------

export type IncomeRow = Tables<'incomes'>;
export type IncomeRecurrenceRow = Tables<'income_recurrences'>;

/** Income row joined with its category (left-join — `category` may be null). */
export interface IncomeWithCategory extends IncomeRow {
  category: CategoryRow | null;
}

/** Income recurrence row joined with its category. */
export interface IncomeRecurrenceWithCategory extends IncomeRecurrenceRow {
  category: CategoryRow | null;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const INCOME_WITH_CATEGORY_SELECT = '*, category:categories(*)';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Return the authenticated user's ID, or throw when no session is active.
 * Local copy — mirrors `requireUserId` from expenses.ts without importing
 * the private symbol.
 */
async function requireUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    throw new Error('No hay sesión activa. Iniciá sesión.');
  }
  return data.user.id;
}

// ---------------------------------------------------------------------------
// Income CRUD
// ---------------------------------------------------------------------------

/**
 * List incomes with optional filtering, text search, and cursor pagination.
 *
 * Scoped to `user_id = auth.uid()` — relies on RLS + an explicit eq filter
 * so the personal list is never polluted even if RLS is later broadened.
 */
export async function listIncomes(
  filter: IncomeFilter = {},
): Promise<RepoResult<IncomeWithCategory[]>> {
  try {
    const userId = await requireUserId();

    let query = supabase
      .from('incomes')
      .select(INCOME_WITH_CATEGORY_SELECT)
      .eq('user_id', userId)
      .order('occurred_at', { ascending: false });

    if (filter.search && filter.search.length > 0) {
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
    return { data: data as IncomeWithCategory[] | null, error };
  } catch (e) {
    return { data: null, error: e as Error };
  }
}

/**
 * Fetch a single income by id with its nested category.
 */
export async function getIncome(id: string): Promise<RepoResult<IncomeWithCategory>> {
  const { data, error } = await supabase
    .from('incomes')
    .select(INCOME_WITH_CATEGORY_SELECT)
    .eq('id', id)
    .maybeSingle();
  return { data: data as IncomeWithCategory | null, error };
}

/**
 * Insert a new income row.
 *
 * `source` is always set to `'manual'` for user-created incomes (vs
 * `'recurrence'` for system-materialized ones). `occurred_date` is derived
 * from the ISO timestamp so calendar-date queries are clean.
 */
export async function createIncome(
  input: CreateIncomeInput,
): Promise<RepoResult<IncomeWithCategory>> {
  try {
    const userId = await requireUserId();

    const occurredAt = input.occurred_at ?? new Date().toISOString();
    // Slice the calendar-date portion from the ISO timestamp.
    const occurredDate = occurredAt.slice(0, 10);

    const { data, error } = await supabase
      .from('incomes')
      .insert({
        user_id: userId,
        amount: input.amount,
        currency: input.currency,
        category_id: input.category_id ?? null,
        description: input.description ?? null,
        occurred_at: occurredAt,
        occurred_date: occurredDate,
        source: 'manual',
      })
      .select(INCOME_WITH_CATEGORY_SELECT)
      .single();

    return { data: data as IncomeWithCategory | null, error };
  } catch (e) {
    return { data: null, error: e as Error };
  }
}

/**
 * Update an existing income row (patch — only supplied keys are written).
 *
 * When `patch.occurred_at` is present `occurred_date` is also recomputed so
 * the two columns stay in sync.
 */
export async function updateIncome(
  id: string,
  patch: UpdateIncomeInput,
): Promise<RepoResult<IncomeWithCategory>> {
  const updateObj: TablesUpdate<'incomes'> = {};

  if (patch.amount !== undefined) updateObj.amount = patch.amount;
  if (patch.currency !== undefined) updateObj.currency = patch.currency;
  if (patch.category_id !== undefined) updateObj.category_id = patch.category_id;
  if (patch.description !== undefined) updateObj.description = patch.description;
  if (patch.occurred_at !== undefined) {
    updateObj.occurred_at = patch.occurred_at;
    updateObj.occurred_date = patch.occurred_at.slice(0, 10);
  }

  const { data, error } = await supabase
    .from('incomes')
    .update(updateObj)
    .eq('id', id)
    .select(INCOME_WITH_CATEGORY_SELECT)
    .single();

  return { data: data as IncomeWithCategory | null, error };
}

/**
 * Delete an income row by id.
 */
export async function deleteIncome(id: string): Promise<RepoResult<{ id: string }>> {
  const { error } = await supabase.from('incomes').delete().eq('id', id);
  return { data: error ? null : { id }, error };
}

// ---------------------------------------------------------------------------
// Aggregates
// ---------------------------------------------------------------------------

/**
 * Returns per-currency income totals for the current user.
 *
 * Delegates to the `get_income_totals` RPC which applies RLS-scoped
 * aggregation server-side.
 */
export async function sumIncomesByCurrency(
  range: { from?: string; to?: string } = {},
): Promise<RepoResult<CurrencyTotal[]>> {
  const { data, error } = await supabase.rpc('get_income_totals', {
    p_from: range.from ?? undefined,
    p_to: range.to ?? undefined,
  });
  if (error || !data) return { data: null, error };

  return {
    data: (data as { currency: string; total: number; count: number }[]).map((row) => ({
      currency: row.currency,
      total: Number(row.total),
      count: Number(row.count),
    })),
    error: null,
  };
}

// ---------------------------------------------------------------------------
// Recurrence CRUD
// ---------------------------------------------------------------------------

/**
 * List all active and paused recurrences for the current user, joined with
 * their category.
 */
export async function listRecurrences(): Promise<RepoResult<IncomeRecurrenceWithCategory[]>> {
  const { data, error } = await supabase
    .from('income_recurrences')
    .select(INCOME_WITH_CATEGORY_SELECT)
    .order('created_at', { ascending: false });
  return { data: data as IncomeRecurrenceWithCategory[] | null, error };
}

/**
 * Create a new income recurrence.
 *
 * `day_of_month` and `next_run_on` are computed client-side:
 * - `day_of_month` = day component of `start_date` (anchor for monthly rules)
 * - `next_run_on`  = first occurrence strictly after `today` (injected for testability)
 *
 * The caller must pass `today` as `new Date().toISOString().slice(0, 10)`.
 */
export async function createRecurrence(
  input: CreateRecurrenceInput,
  userId: string,
  today: string,
): Promise<RepoResult<IncomeRecurrenceWithCategory>> {
  const dayOfMonth = dayOfMonthFrom(input.start_date);
  const nextRunOn = firstFutureOccurrence(input.start_date, input.frequency, today);

  const { data, error } = await supabase
    .from('income_recurrences')
    .insert({
      user_id: userId,
      amount: input.amount,
      currency: input.currency,
      category_id: input.category_id ?? null,
      description: input.description ?? null,
      frequency: input.frequency,
      start_date: input.start_date,
      end_date: input.end_date ?? null,
      day_of_month: dayOfMonth,
      next_run_on: nextRunOn,
      status: 'active',
    })
    .select(INCOME_WITH_CATEGORY_SELECT)
    .single();

  return { data: data as IncomeRecurrenceWithCategory | null, error };
}

/**
 * Pause an active recurrence.
 */
export async function pauseRecurrence(
  id: string,
): Promise<RepoResult<IncomeRecurrenceWithCategory>> {
  const { data, error } = await supabase
    .from('income_recurrences')
    .update({ status: 'paused' })
    .eq('id', id)
    .select(INCOME_WITH_CATEGORY_SELECT)
    .single();
  return { data: data as IncomeRecurrenceWithCategory | null, error };
}

/**
 * Resume a paused recurrence.
 *
 * Fetches the row first to retrieve `start_date` + `frequency`, then
 * recomputes `next_run_on` forward from `today` so the paused gap is
 * skipped cleanly.
 *
 * `today` is injected for testability — callers pass `new Date().toISOString().slice(0, 10)`.
 */
export async function resumeRecurrence(
  id: string,
  today: string,
): Promise<RepoResult<IncomeRecurrenceWithCategory>> {
  // Fetch the current row to get the recurrence anchor fields.
  const { data: existing, error: fetchError } = await supabase
    .from('income_recurrences')
    .select('*')
    .eq('id', id)
    .single();

  if (fetchError || !existing) {
    return { data: null, error: fetchError ?? new Error('No se encontró la recurrencia.') };
  }

  const row = existing as IncomeRecurrenceRow;
  const nextRunOn = firstFutureOccurrence(
    row.start_date,
    row.frequency as Parameters<typeof firstFutureOccurrence>[1],
    today,
  );

  const { data, error } = await supabase
    .from('income_recurrences')
    .update({ status: 'active', next_run_on: nextRunOn })
    .eq('id', id)
    .select(INCOME_WITH_CATEGORY_SELECT)
    .single();

  return { data: data as IncomeRecurrenceWithCategory | null, error };
}

/**
 * Update an existing recurrence (patch — only supplied keys are written).
 *
 * When `frequency` or `start_date` change, `day_of_month` and `next_run_on`
 * are recomputed. `today` is required when either scheduling field changes.
 */
export async function updateRecurrence(
  id: string,
  patch: UpdateRecurrenceInput,
  today?: string,
): Promise<RepoResult<IncomeRecurrenceWithCategory>> {
  const updateObj: TablesUpdate<'income_recurrences'> = {};

  if (patch.amount !== undefined) updateObj.amount = patch.amount;
  if (patch.currency !== undefined) updateObj.currency = patch.currency;
  if (patch.category_id !== undefined) updateObj.category_id = patch.category_id;
  if (patch.description !== undefined) updateObj.description = patch.description;
  if (patch.end_date !== undefined) updateObj.end_date = patch.end_date;
  if (patch.start_date !== undefined) updateObj.start_date = patch.start_date;
  if (patch.frequency !== undefined) updateObj.frequency = patch.frequency;

  // Recompute scheduling fields when either anchor changes.
  const scheduleChanged = patch.frequency !== undefined || patch.start_date !== undefined;
  if (scheduleChanged && today !== undefined) {
    // Resolve the effective start_date and frequency (may come from patch or row).
    // We recompute unconditionally for simplicity — the caller already owns the row.
    const effectiveStart = patch.start_date;
    const effectiveFreq = patch.frequency;

    if (effectiveStart !== undefined && effectiveFreq !== undefined) {
      updateObj.day_of_month = dayOfMonthFrom(effectiveStart);
      updateObj.next_run_on = firstFutureOccurrence(effectiveStart, effectiveFreq, today);
    }
  }

  const { data, error } = await supabase
    .from('income_recurrences')
    .update(updateObj)
    .eq('id', id)
    .select(INCOME_WITH_CATEGORY_SELECT)
    .single();

  return { data: data as IncomeRecurrenceWithCategory | null, error };
}

/**
 * Delete a recurrence rule.
 *
 * Already-materialized `incomes` rows survive — the FK is `ON DELETE SET NULL`
 * so `recurrence_id` becomes null on those rows.
 */
export async function deleteRecurrence(id: string): Promise<RepoResult<{ id: string }>> {
  const { error } = await supabase.from('income_recurrences').delete().eq('id', id);
  return { data: error ? null : { id }, error };
}
