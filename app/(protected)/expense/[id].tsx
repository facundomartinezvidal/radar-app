/**
 * RADAR — Expense detail / edit / delete screen.
 *
 * Route param: `id`. Loads the expense, renders ExpenseForm with the row as
 * initial values, supports update + delete with a confirmation alert.
 *
 * Branch logic (HU-17):
 *   - Shared expense (group_id != null): uses useUpdateSharedExpense, renders
 *     ExpenseForm with groupConfig + prefilled split state reconstructed from
 *     the existing splits. Prefilling uses type='custom' so saved amounts are
 *     reproduced faithfully regardless of how they were originally entered.
 *   - Personal expense (group_id == null): existing useUpdateExpense flow,
 *     unchanged.
 *
 * NOTE: Converting a personal expense to shared (or vice-versa) on edit is
 * intentionally out of scope for HU-17. The RPC will reject such attempts.
 */
import { router, Stack, useLocalSearchParams } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  ExpenseForm,
  type InitialSplitState,
  type SharedExpenseSubmitPayload,
} from '@/components/expenses/expense-form';
import { Body, Button, H1, Icon, Loader } from '@/components/ui';
import {
  useCategories,
  useDeleteExpense,
  useExpense,
  useUpdateExpense,
} from '@/hooks/use-expenses';
import { useGroup, useUpdateSharedExpense } from '@/hooks/use-groups';
import type { UpdateSharedExpenseInput } from '@/hooks/use-groups';
import { useAuthStore } from '@/stores/auth-store';
import { colors, spacing } from '@/lib/theme';

export default function ExpenseDetailScreen(): React.JSX.Element {
  const params = useLocalSearchParams<{ id?: string }>();
  const id = typeof params.id === 'string' ? params.id : '';

  const expenseQuery = useExpense(id);
  const categoriesQuery = useCategories();
  const updateMutation = useUpdateExpense();
  const deleteMutation = useDeleteExpense();
  const updateSharedMutation = useUpdateSharedExpense();

  const expense = expenseQuery.data;
  const isShared = expense?.group_id != null;

  // Fetch group only when the expense is shared
  const groupQuery = useGroup(isShared ? (expense?.group_id ?? undefined) : undefined);

  // Authenticated user id — needed to find the currentMemberId in the group
  const currentUserId = useAuthStore((s) => s.user?.id ?? null);

  const [submitError, setSubmitError] = useState<string | null>(null);

  // ---------------------------------------------------------------------------
  // Derive groupConfig + initialSplit for the shared edit path
  // ---------------------------------------------------------------------------

  const groupConfig = useMemo(() => {
    if (!isShared || groupQuery.data == null) return undefined;
    const group = groupQuery.data;
    const activeMembers = group.members.filter((m) => m.status === 'active');
    const currentMemberId = activeMembers.find((m) => m.user_id === currentUserId)?.id ?? null;
    return {
      members: activeMembers,
      currentMemberId,
      groupId: group.id,
    };
  }, [isShared, groupQuery.data, currentUserId]);

  /**
   * Reconstruct split state from the expense's existing splits.
   *
   * Strategy: always use type='custom' so the exact saved share_amount values
   * are reproduced in the SplitEditor inputs, regardless of whether they were
   * originally entered as equal / percent / custom. `includedMemberIds` is
   * populated from the member_ids present in the splits so members who were
   * excluded from the original split stay unchecked in the editor.
   */
  const initialSplit = useMemo((): InitialSplitState | undefined => {
    if (!isShared || expense == null) return undefined;
    const splits = expense.splits ?? [];
    const values: Record<string, number> = {};
    const includedMemberIds: string[] = [];
    for (const s of splits) {
      values[s.member_id] = Number(s.share_amount);
      includedMemberIds.push(s.member_id);
    }
    return {
      paidByMemberId: expense.paid_by_member_id ?? null,
      splitState: {
        type: 'custom',
        values,
        includedMemberIds,
      },
    };
  }, [isShared, expense]);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  function confirmDelete(): void {
    Alert.alert('Eliminar gasto', '¿Confirmás que querés eliminar este gasto?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteMutation.mutateAsync(id);
            router.back();
          } catch (e) {
            setSubmitError(
              e instanceof Error ? e.message : 'No se pudo eliminar el gasto. Intentá nuevamente.',
            );
          }
        },
      },
    ]);
  }

  async function handleSharedSubmit(payload: SharedExpenseSubmitPayload): Promise<void> {
    if (expense?.group_id == null) return;
    setSubmitError(null);
    try {
      const input: UpdateSharedExpenseInput = {
        patch: {
          amount: payload.amount,
          currency: payload.currency,
          category_id: payload.category_id ?? undefined,
          description: payload.description ?? undefined,
          occurred_at: payload.occurred_at,
        },
        items: payload.items,
        paid_by_member_id: payload.paid_by_member_id,
        splits: payload.splits,
      };
      await updateSharedMutation.mutateAsync({ id, input, groupId: expense.group_id });
      router.back();
    } catch (e) {
      setSubmitError(
        e instanceof Error
          ? e.message
          : 'No se pudo actualizar el gasto compartido. Intentá nuevamente.',
      );
    }
  }

  // ---------------------------------------------------------------------------
  // Loading state: for shared expenses, wait for both expense + group
  // ---------------------------------------------------------------------------

  const isLoading =
    expenseQuery.isLoading || categoriesQuery.isLoading || (isShared && groupQuery.isLoading);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg[0] }}>
      <Stack.Screen options={{ headerShown: false }} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, paddingHorizontal: spacing[5] }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingTop: spacing[4],
              paddingBottom: spacing[5],
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[3] }}>
              <Pressable
                onPress={() => router.back()}
                accessibilityLabel="Volver"
                hitSlop={12}
                style={{ padding: spacing[1] }}
              >
                <Icon name="ChevronLeft" size={24} color={colors.fg[1]} />
              </Pressable>
              <H1>Editar gasto</H1>
            </View>
            {expense ? (
              <Pressable
                onPress={confirmDelete}
                accessibilityLabel="Eliminar gasto"
                hitSlop={12}
                style={{ padding: spacing[1] }}
              >
                <Icon name="Trash2" size={22} color={colors.money.out} />
              </Pressable>
            ) : null}
          </View>

          {isLoading ? (
            <Loader color={colors.fg[3]} label="Cargando" />
          ) : !expense ? (
            <Body color={colors.fg[3]}>No se encontró el gasto solicitado.</Body>
          ) : isShared ? (
            /* ----------------------------------------------------------------
             * Shared expense edit path (HU-17)
             * groupConfig may still be undefined while the group query loads;
             * we gate on isLoading above so by the time we get here both the
             * expense and the group are available.
             * ---------------------------------------------------------------- */
            <ExpenseForm
              categories={categoriesQuery.data ?? []}
              initial={expense}
              groupConfig={groupConfig}
              initialSplit={initialSplit}
              isSubmitting={updateSharedMutation.isPending}
              submitError={submitError}
              submitLabel="Guardar cambios"
              onSubmit={async () => {
                // onSubmit is required by the prop type but will not be called
                // when groupConfig is present — onSubmitShared is used instead.
              }}
              onSubmitShared={handleSharedSubmit}
            />
          ) : (
            /* ----------------------------------------------------------------
             * Personal expense edit path (unchanged)
             * ---------------------------------------------------------------- */
            <ExpenseForm
              categories={categoriesQuery.data ?? []}
              initial={expense}
              isSubmitting={updateMutation.isPending}
              submitError={submitError}
              submitLabel="Guardar cambios"
              onSubmit={async (input) => {
                setSubmitError(null);
                try {
                  await updateMutation.mutateAsync({ id, input });
                  router.back();
                } catch (e) {
                  setSubmitError(
                    e instanceof Error
                      ? e.message
                      : 'No se pudo actualizar el gasto. Intentá nuevamente.',
                  );
                }
              }}
            />
          )}

          {expense ? (
            <View style={{ marginTop: spacing[5], marginBottom: spacing[8] }}>
              <Button
                variant="destructive"
                size="md"
                fullWidth
                loading={deleteMutation.isPending}
                onPress={confirmDelete}
                accessibilityLabel="Eliminar gasto"
                leftIcon={<Icon name="Trash2" size={18} color={colors.fg.onBrand} />}
              >
                Eliminar gasto
              </Button>
            </View>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
