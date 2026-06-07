/**
 * Categories repository — CRUD for user-owned (custom) categories.
 *
 * All mutations are single-table inserts/updates/deletes under RLS; no RPCs
 * are needed because category writes are simple and non-transactional.
 *
 * The non-throwing contract (`{ data, error }`) mirrors the expenses repo.
 * Errors from `getUserId()` are caught and returned as `{ data: null, error }`.
 */
import type { PostgrestError } from '@supabase/supabase-js';

import { supabase } from '@/lib/supabase';
import { normalizeName } from '@/lib/ocr';
import type { CreateCategoryInput, UpdateCategoryInput } from '@/lib/schemas/category';
import { type CategoryRow, type RepoResult } from '@/lib/repositories/expenses';
import type { TablesUpdate } from '@/types/supabase';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DUPLICATE_NAME_MESSAGE = 'Ya tenés una categoría con ese nombre.';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Convert a category name to a URL-safe slug.
 *
 * Uses `normalizeName` (NFD strip diacritics + lowercase + trim) then
 * collapses non-alphanumeric runs to hyphens and strips leading/trailing ones.
 * Falls back to `'categoria'` when the result would be empty.
 *
 * Exported for unit tests.
 */
export function slugify(name: string): string {
  const slug = normalizeName(name)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug.length > 0 ? slug : 'categoria';
}

/** True when the Postgrest error code indicates a unique-constraint violation. */
function isUniqueViolation(error: unknown): boolean {
  return (error as PostgrestError).code === '23505';
}

/**
 * Return the authenticated user's ID, or throw when no session is active.
 * Local copy — mirrors `requireUserId` from expenses.ts without importing
 * the private symbol.
 */
async function getUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    throw new Error('No hay sesión activa. Iniciá sesión.');
  }
  return data.user.id;
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

/**
 * Create a new user-owned category with sort_order 100 (after all system rows).
 *
 * Returns a friendly duplicate-name error when the slug already exists for
 * the same user (unique constraint `categories_user_id_slug_key`).
 */
export async function createCategory(input: CreateCategoryInput): Promise<RepoResult<CategoryRow>> {
  try {
    const userId = await getUserId();

    const { data, error } = await supabase
      .from('categories')
      .insert({
        user_id: userId,
        name: input.name,
        slug: slugify(input.name),
        icon: input.icon,
        color: input.color,
        sort_order: 100,
      })
      .select('*')
      .single();

    if (error) {
      if (isUniqueViolation(error)) {
        return { data: null, error: new Error(DUPLICATE_NAME_MESSAGE) };
      }
      return { data: null, error };
    }

    return { data, error: null };
  } catch (e) {
    return { data: null, error: e as Error };
  }
}

/**
 * Update an existing user-owned category (patch — only supplied keys are written).
 *
 * When `patch.name` is present the slug is recomputed. RLS limits the update
 * to the authenticated user's own rows. Returns a friendly duplicate-name
 * error on slug collision.
 */
export async function updateCategory(
  id: string,
  patch: UpdateCategoryInput,
): Promise<RepoResult<CategoryRow>> {
  try {
    const updateObj: TablesUpdate<'categories'> = {};

    if (patch.name !== undefined) {
      updateObj.name = patch.name;
      updateObj.slug = slugify(patch.name);
    }
    if (patch.icon !== undefined) {
      updateObj.icon = patch.icon;
    }
    if (patch.color !== undefined) {
      updateObj.color = patch.color;
    }

    const { data, error } = await supabase
      .from('categories')
      .update(updateObj)
      .eq('id', id)
      .select('*')
      .single();

    if (error) {
      if (isUniqueViolation(error)) {
        return { data: null, error: new Error(DUPLICATE_NAME_MESSAGE) };
      }
      return { data: null, error };
    }

    return { data, error: null };
  } catch (e) {
    return { data: null, error: e as Error };
  }
}

/**
 * Delete a user-owned category by id.
 *
 * RLS ensures only the owner's rows are deleted. Expenses referencing the
 * deleted category get `category_id = NULL` via the DB foreign-key
 * `ON DELETE SET NULL` constraint — no application-level cleanup needed.
 */
export async function deleteCategory(id: string): Promise<RepoResult<{ id: string }>> {
  try {
    const { error } = await supabase.from('categories').delete().eq('id', id);

    if (error) {
      return { data: null, error };
    }

    return { data: { id }, error: null };
  } catch (e) {
    return { data: null, error: e as Error };
  }
}
