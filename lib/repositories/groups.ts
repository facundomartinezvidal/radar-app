/**
 * Groups repository — thin layer over Supabase queries for shared-expense groups.
 *
 * Every function returns `{ data, error }` matching the RepoResult<T> contract
 * from the expenses repository. RLS enforces membership; the RPCs run under
 * SECURITY INVOKER so the caller's RLS applies automatically.
 */
import { supabase } from '@/lib/supabase';
import type { CreateGroupInput } from '@/lib/schemas/group';
import type { Tables } from '@/types/supabase';
import { type RepoResult } from '@/lib/repositories/expenses';

// ---------------------------------------------------------------------------
// Row types
// ---------------------------------------------------------------------------

export type GroupRow = Tables<'groups'>;
export type GroupMemberRow = Tables<'group_members'>;

/** Group row joined with all its members. */
export interface GroupWithMembers extends GroupRow {
  members: GroupMemberRow[];
}

/** Per-member net balance for one currency. */
export interface GroupBalance {
  member_id: string;
  currency: string;
  net: number;
}

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

const GROUP_WITH_MEMBERS_SELECT = '*, members:group_members(*)';

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/** List all groups the authenticated user belongs to, newest first. */
export async function listGroups(): Promise<RepoResult<GroupWithMembers[]>> {
  const { data, error } = await supabase
    .from('groups')
    .select(GROUP_WITH_MEMBERS_SELECT)
    .order('created_at', { ascending: false });
  return { data: data as GroupWithMembers[] | null, error };
}

/** Fetch a single group by id (returns null when not found). */
export async function getGroup(id: string): Promise<RepoResult<GroupWithMembers>> {
  const { data, error } = await supabase
    .from('groups')
    .select(GROUP_WITH_MEMBERS_SELECT)
    .eq('id', id)
    .maybeSingle();
  return { data: data as GroupWithMembers | null, error };
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

/**
 * Create a new group via the `create_group` RPC.
 *
 * The RPC creates the group row AND seeds the creator as an `owner` member
 * in a single transaction. Placeholder members listed in `input.placeholders`
 * are inserted as `placeholder` status rows.
 */
export async function createGroup(input: CreateGroupInput): Promise<RepoResult<GroupRow>> {
  try {
    const { data, error } = await supabase.rpc('create_group', {
      p_name: input.name,
      p_icon: input.icon,
      p_color: input.color,
      p_placeholders: input.placeholders as unknown as import('@/types/supabase').Json,
    });
    if (error) return { data: null, error };
    return { data: data as GroupRow | null, error: null };
  } catch (e) {
    return { data: null, error: e as Error };
  }
}

/**
 * Add an anonymous placeholder member to a group via the `add_group_member` RPC.
 *
 * Placeholders have no `user_id` and appear as "not yet invited" members.
 * They can later be converted to real members via `inviteMember`.
 */
export async function addPlaceholder(
  groupId: string,
  displayName: string,
): Promise<RepoResult<GroupMemberRow>> {
  try {
    const { data, error } = await supabase.rpc('add_group_member', {
      p_group_id: groupId,
      p_display_name: displayName,
    });
    if (error) return { data: null, error };
    return { data: data as GroupMemberRow | null, error: null };
  } catch (e) {
    return { data: null, error: e as Error };
  }
}

/**
 * Invite a registered user to a group by email via the `invite_group_member` RPC.
 *
 * Returns a status object from the RPC:
 * - `'invited'` — invitation sent (new pending member row created)
 * - `'already_member'` — the user is already an active member
 * - `'not_found'` — no account found for that email
 */
export async function inviteMember(
  groupId: string,
  email: string,
): Promise<RepoResult<{ status: 'invited' | 'already_member' | 'not_found'; member_id?: string }>> {
  try {
    const { data, error } = await supabase.rpc('invite_group_member', {
      p_group_id: groupId,
      p_email: email,
    });
    if (error) return { data: null, error };
    return {
      data: data as {
        status: 'invited' | 'already_member' | 'not_found';
        member_id?: string;
      } | null,
      error: null,
    };
  } catch (e) {
    return { data: null, error: e as Error };
  }
}

/**
 * Accept or decline a pending group invitation via the `respond_group_invite` RPC.
 *
 * On acceptance the member row transitions to `active` status and `joined_at` is set.
 * On rejection the member row is deleted.
 */
export async function respondInvite(
  memberId: string,
  accept: boolean,
): Promise<RepoResult<GroupMemberRow>> {
  try {
    const { data, error } = await supabase.rpc('respond_group_invite', {
      p_member_id: memberId,
      p_accept: accept,
    });
    if (error) return { data: null, error };
    return { data: data as GroupMemberRow | null, error: null };
  } catch (e) {
    return { data: null, error: e as Error };
  }
}

/**
 * Delete a group by id (owner-only; enforced by RLS).
 *
 * Cascade deletes all group_members, expense_splits, and group_settlements
 * referencing this group.
 */
export async function deleteGroup(id: string): Promise<RepoResult<{ id: string }>> {
  try {
    const { error } = await supabase.from('groups').delete().eq('id', id);
    if (error) return { data: null, error };
    return { data: { id }, error: null };
  } catch (e) {
    return { data: null, error: e as Error };
  }
}

/**
 * Fetch per-member net balances for a group via the `get_group_balances` RPC.
 *
 * Each row has `{ member_id, currency, net }` where `net > 0` means the
 * member is owed money and `net < 0` means they owe money.
 */
export async function getGroupBalances(groupId: string): Promise<RepoResult<GroupBalance[]>> {
  try {
    // Suppress the unused requireUserId warning — kept for symmetry with
    // other repo functions that need the user context for RLS.
    void requireUserId;
    const { data, error } = await supabase.rpc('get_group_balances', {
      p_group_id: groupId,
    });
    if (error) return { data: null, error };
    return { data: data as GroupBalance[] | null, error: null };
  } catch (e) {
    return { data: null, error: e as Error };
  }
}
