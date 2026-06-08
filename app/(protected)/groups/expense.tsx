/**
 * RADAR — New shared expense screen.
 *
 * Renders ExpenseForm with groupConfig so the user can choose who paid and
 * how to split the amount. On submit calls useCreateSharedExpense and navigates
 * back on success.
 *
 * Route: /(protected)/groups/expense?groupId=<uuid>
 */
import { router, Stack, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ExpenseForm, type SharedExpenseSubmitPayload } from '@/components/expenses/expense-form';
import { Body, H1, Icon, Loader } from '@/components/ui';
import { useCategories } from '@/hooks/use-expenses';
import { useGroup, useCreateSharedExpense } from '@/hooks/use-groups';
import { useAuthStore } from '@/stores/auth-store';
import { colors, spacing } from '@/lib/theme';

export default function NewSharedExpenseScreen(): React.JSX.Element {
  const { groupId } = useLocalSearchParams<{ groupId: string }>();

  const categoriesQuery = useCategories();
  const groupQuery = useGroup(groupId);
  const createMutation = useCreateSharedExpense();
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Resolve the current user's member id within this group
  const currentUserId = useAuthStore((s) => s.user?.id ?? null);
  const group = groupQuery.data;

  const activeMembers = (group?.members ?? []).filter((m) => m.status === 'active');
  const currentMemberId = activeMembers.find((m) => m.user_id === currentUserId)?.id ?? null;

  const isLoading = categoriesQuery.isLoading || groupQuery.isLoading;
  const hasError = categoriesQuery.error != null || groupQuery.error != null;

  async function handleSubmit(payload: SharedExpenseSubmitPayload): Promise<void> {
    if (groupId == null) return;
    // group_id is carried in the payload (set via groupConfig.groupId in ExpenseForm)
    const resolvedGroupId = payload.group_id.length > 0 ? payload.group_id : groupId;
    setSubmitError(null);
    try {
      await createMutation.mutateAsync({
        amount: payload.amount,
        currency: payload.currency ?? 'ARS',
        category_id: payload.category_id,
        description: payload.description,
        occurred_at: payload.occurred_at,
        items: (payload.items ?? []).map((item) => ({
          name: item.name,
          quantity: item.quantity,
          unit_price: item.unit_price,
          line_total: item.line_total,
        })),
        group_id: resolvedGroupId,
        paid_by_member_id: payload.paid_by_member_id,
        splits: payload.splits,
      });
      router.back();
    } catch (e) {
      setSubmitError(
        e instanceof Error ? e.message : 'No se pudo guardar el gasto. Intentá nuevamente.',
      );
    }
  }

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
              gap: spacing[3],
              paddingTop: spacing[4],
              paddingBottom: spacing[5],
            }}
          >
            <Pressable
              onPress={() => router.back()}
              accessibilityLabel="Volver"
              hitSlop={12}
              style={{ padding: spacing[1] }}
            >
              <Icon name="ChevronLeft" size={24} color={colors.fg[1]} />
            </Pressable>
            <H1>Nuevo gasto compartido</H1>
          </View>

          {isLoading ? (
            <Loader color={colors.fg[3]} label="Cargando..." />
          ) : hasError ? (
            <Body color={colors.money.out}>
              No se pudo cargar la información. Intentá nuevamente.
            </Body>
          ) : group == null ? (
            <Body color={colors.fg[3]}>No se encontró el grupo.</Body>
          ) : (
            <ExpenseForm
              categories={categoriesQuery.data ?? []}
              isSubmitting={createMutation.isPending}
              submitError={submitError}
              submitLabel="Registrar gasto"
              groupConfig={{ members: activeMembers, currentMemberId, groupId }}
              onSubmit={() => {
                // No-op: shared path always uses onSubmitShared
              }}
              onSubmitShared={handleSubmit}
            />
          )}

          <View style={{ height: spacing[8] }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
