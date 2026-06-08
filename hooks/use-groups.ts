/**
 * TanStack Query hooks for shared-expense groups.
 *
 * One central place that maps repository functions to query keys and handles
 * cache invalidation. Screens import these hooks, never the repo directly.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  type GroupBalance,
  type GroupMemberRow,
  type GroupRow,
  type GroupWithMembers,
  addPlaceholder,
  checkUserExists,
  createGroup,
  deleteGroup,
  getGroup,
  getGroupBalances,
  inviteMember,
  listGroups,
  removeMember,
  respondInvite,
  updateMember,
} from '@/lib/repositories/groups';
import {
  type CreateSharedExpenseInput,
  type ExpenseSplitRow,
  type GroupExpense,
  type UpdateSharedExpenseInput,
  createSettlement,
  createSharedExpense,
  listGroupExpenses,
  listPendingInvites,
  updateSharedExpense,
} from '@/lib/repositories/shared-expenses';
import type { CreateGroupInput, InviteMemberInput, SettlementInput } from '@/lib/schemas/group';
import type { Tables } from '@/types/supabase';
import { expenseKeys } from '@/hooks/use-expenses';

// Re-export types so consumers don't need to import from two places
export type {
  GroupBalance,
  GroupExpense,
  GroupMemberRow,
  GroupRow,
  GroupWithMembers,
  ExpenseSplitRow,
  UpdateSharedExpenseInput,
};

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

export const groupKeys = {
  all: ['groups'] as const,
  list: () => [...groupKeys.all, 'list'] as const,
  detail: (id: string) => [...groupKeys.all, 'detail', id] as const,
  balances: (id: string) => [...groupKeys.all, 'balances', id] as const,
  expenses: (id: string) => [...groupKeys.all, 'expenses', id] as const,
  invites: () => [...groupKeys.all, 'invites'] as const,
};

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export function useGroups() {
  return useQuery<GroupWithMembers[]>({
    queryKey: groupKeys.list(),
    queryFn: async () => {
      const { data, error } = await listGroups();
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useGroup(id: string | undefined) {
  return useQuery<GroupWithMembers | null>({
    queryKey: groupKeys.detail(id ?? ''),
    enabled: Boolean(id),
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await getGroup(id);
      if (error) throw error;
      return data;
    },
  });
}

export function useGroupBalances(id: string | undefined) {
  return useQuery<GroupBalance[]>({
    queryKey: groupKeys.balances(id ?? ''),
    enabled: Boolean(id),
    queryFn: async () => {
      if (!id) return [];
      const { data, error } = await getGroupBalances(id);
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useGroupExpenses(id: string | undefined) {
  return useQuery<GroupExpense[]>({
    queryKey: groupKeys.expenses(id ?? ''),
    enabled: Boolean(id),
    queryFn: async () => {
      if (!id) return [];
      const { data, error } = await listGroupExpenses(id);
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function usePendingInvites() {
  return useQuery<(GroupMemberRow & { group: GroupRow | null })[]>({
    queryKey: groupKeys.invites(),
    queryFn: async () => {
      const { data, error } = await listPendingInvites();
      if (error) throw error;
      return data ?? [];
    },
  });
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export function useCreateGroup() {
  const qc = useQueryClient();
  return useMutation<GroupRow, Error, CreateGroupInput>({
    mutationFn: async (input) => {
      const { data, error } = await createGroup(input);
      if (error || !data) throw error ?? new Error('No se pudo crear el grupo.');
      return data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: groupKeys.all });
    },
  });
}

export function useAddPlaceholder() {
  const qc = useQueryClient();
  return useMutation<GroupMemberRow, Error, { groupId: string; displayName: string }>({
    mutationFn: async ({ groupId, displayName }) => {
      const { data, error } = await addPlaceholder(groupId, displayName);
      if (error || !data) throw error ?? new Error('No se pudo agregar el participante.');
      return data;
    },
    onSuccess: (row) => {
      void qc.invalidateQueries({ queryKey: groupKeys.detail(row.group_id) });
      void qc.invalidateQueries({ queryKey: groupKeys.all });
    },
  });
}

export function useInviteMember() {
  const qc = useQueryClient();
  return useMutation<
    { status: 'invited' | 'already_member' | 'not_found'; member_id?: string },
    Error,
    { groupId: string; input: InviteMemberInput }
  >({
    mutationFn: async ({ groupId, input }) => {
      const { data, error } = await inviteMember(groupId, input.email);
      if (error || !data) throw error ?? new Error('No se pudo enviar la invitación.');
      return data;
    },
    onSuccess: (_result, { groupId }) => {
      void qc.invalidateQueries({ queryKey: groupKeys.detail(groupId) });
    },
  });
}

export function useRespondInvite() {
  const qc = useQueryClient();
  return useMutation<GroupMemberRow, Error, { memberId: string; accept: boolean }>({
    mutationFn: async ({ memberId, accept }) => {
      const { data, error } = await respondInvite(memberId, accept);
      if (error || !data) throw error ?? new Error('No se pudo responder la invitación.');
      return data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: groupKeys.invites() });
      // Accepting reveals the group in the list; invalidate all groups
      void qc.invalidateQueries({ queryKey: groupKeys.all });
    },
  });
}

export function useCreateSharedExpense() {
  const qc = useQueryClient();
  return useMutation<Tables<'expenses'>, Error, CreateSharedExpenseInput>({
    mutationFn: async (input) => {
      const { data, error } = await createSharedExpense(input);
      if (error || !data) throw error ?? new Error('No se pudo guardar el gasto compartido.');
      return data;
    },
    onSuccess: (_row, input) => {
      // Shared expense also appears in the personal expense list
      void qc.invalidateQueries({ queryKey: expenseKeys.all });
      void qc.invalidateQueries({ queryKey: groupKeys.all });
      void qc.invalidateQueries({ queryKey: groupKeys.balances(input.group_id) });
      void qc.invalidateQueries({ queryKey: groupKeys.expenses(input.group_id) });
    },
  });
}

export function useCreateSettlement() {
  const qc = useQueryClient();
  return useMutation<Tables<'group_settlements'>, Error, SettlementInput & { group_id: string }>({
    mutationFn: async (input) => {
      const { data, error } = await createSettlement(input);
      if (error || !data) throw error ?? new Error('No se pudo registrar la liquidación.');
      return data;
    },
    onSuccess: (_row, input) => {
      void qc.invalidateQueries({ queryKey: groupKeys.balances(input.group_id) });
      void qc.invalidateQueries({ queryKey: groupKeys.detail(input.group_id) });
    },
  });
}

/**
 * Mutation to check whether a registered account exists for an email address.
 *
 * Usage: `const { mutateAsync, isPending } = useCheckUserExists()`
 *        `const exists = await mutateAsync(email)`
 *
 * Returns `true` when an account exists, `false` when not found.
 * No cache invalidation needed — this is a pure read with no side effects.
 */
export function useCheckUserExists() {
  return useMutation<boolean, Error, string>({
    mutationFn: async (email: string) => {
      const { data, error } = await checkUserExists(email);
      if (error) throw error;
      return data ?? false;
    },
  });
}

export function useUpdateSharedExpense() {
  const qc = useQueryClient();
  return useMutation<
    import('@/lib/repositories/expenses').ExpenseWithItems,
    Error,
    { id: string; input: UpdateSharedExpenseInput; groupId: string }
  >({
    mutationFn: async ({ id, input }) => {
      const { data, error } = await updateSharedExpense(id, input);
      if (error || !data) throw error ?? new Error('No se pudo actualizar el gasto compartido.');
      return data;
    },
    onSuccess: (row, { groupId }) => {
      // Shared expense also appears in personal list
      void qc.invalidateQueries({ queryKey: expenseKeys.all });
      void qc.invalidateQueries({ queryKey: groupKeys.all });
      void qc.invalidateQueries({ queryKey: groupKeys.balances(groupId) });
      void qc.invalidateQueries({ queryKey: groupKeys.expenses(groupId) });
      // Update the individual expense detail cache immediately
      qc.setQueryData(expenseKeys.detail(row.id), row);
    },
  });
}

export function useUpdateMember() {
  const qc = useQueryClient();
  return useMutation<
    GroupMemberRow,
    Error,
    { memberId: string; displayName: string; groupId: string }
  >({
    mutationFn: async ({ memberId, displayName }) => {
      const { data, error } = await updateMember(memberId, displayName);
      if (error || !data) throw error ?? new Error('No se pudo actualizar el miembro.');
      return data;
    },
    onSuccess: (_row, { groupId }) => {
      void qc.invalidateQueries({ queryKey: groupKeys.detail(groupId) });
      void qc.invalidateQueries({ queryKey: groupKeys.all });
    },
  });
}

export function useRemoveMember() {
  const qc = useQueryClient();
  return useMutation<{ id: string }, Error, { memberId: string; groupId: string }>({
    mutationFn: async ({ memberId }) => {
      const { data, error } = await removeMember(memberId);
      if (error || !data) throw error ?? new Error('No se pudo eliminar el miembro.');
      return data;
    },
    onSuccess: (_row, { groupId }) => {
      void qc.invalidateQueries({ queryKey: groupKeys.detail(groupId) });
      void qc.invalidateQueries({ queryKey: groupKeys.balances(groupId) });
      void qc.invalidateQueries({ queryKey: groupKeys.all });
    },
  });
}

export function useDeleteGroup() {
  const qc = useQueryClient();
  return useMutation<{ id: string }, Error, string>({
    mutationFn: async (id) => {
      const { data, error } = await deleteGroup(id);
      if (error || !data) throw error ?? new Error('No se pudo eliminar el grupo.');
      return data;
    },
    onSuccess: ({ id }) => {
      void qc.invalidateQueries({ queryKey: groupKeys.all });
      qc.removeQueries({ queryKey: groupKeys.detail(id) });
    },
  });
}
