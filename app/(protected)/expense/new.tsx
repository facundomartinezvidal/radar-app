/**
 * RADAR — New expense screen.
 */
import { router, Stack } from 'expo-router';
import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ExpenseForm, type SharedExpenseSubmitPayload } from '@/components/expenses/expense-form';
import { Body, H1, Icon, Loader } from '@/components/ui';
import { useCategories, useCreateExpense } from '@/hooks/use-expenses';
import { useGroups, useCreateSharedExpense } from '@/hooks/use-groups';
import { useAuthStore } from '@/stores/auth-store';
import { colors, spacing } from '@/lib/theme';

export default function NewExpenseScreen(): React.JSX.Element {
  const categoriesQuery = useCategories();
  const createMutation = useCreateExpense();
  const groupsQuery = useGroups();
  const createSharedMutation = useCreateSharedExpense();
  const currentUserId = useAuthStore((s) => s.user?.id ?? null);
  const [submitError, setSubmitError] = useState<string | null>(null);

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
            <H1>Nuevo gasto</H1>
          </View>

          {/* Form / loading */}
          {categoriesQuery.isLoading ? (
            <Loader color={colors.fg[3]} label="Cargando categorías" />
          ) : categoriesQuery.error ? (
            <Body color={colors.money.out}>
              No se pudieron cargar las categorías. Intentá nuevamente.
            </Body>
          ) : (
            <ExpenseForm
              categories={categoriesQuery.data ?? []}
              shareableGroups={groupsQuery.data ?? []}
              currentUserId={currentUserId}
              isSubmitting={createMutation.isPending || createSharedMutation.isPending}
              submitError={submitError}
              onSubmit={async (input) => {
                setSubmitError(null);
                try {
                  await createMutation.mutateAsync(input);
                  router.back();
                } catch (e) {
                  setSubmitError(
                    e instanceof Error
                      ? e.message
                      : 'No se pudo guardar el gasto. Intentá nuevamente.',
                  );
                }
              }}
              onSubmitShared={async (payload: SharedExpenseSubmitPayload) => {
                setSubmitError(null);
                try {
                  await createSharedMutation.mutateAsync({
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
                    group_id: payload.group_id,
                    paid_by_member_id: payload.paid_by_member_id,
                    splits: payload.splits,
                  });
                  router.back();
                } catch (e) {
                  setSubmitError(
                    e instanceof Error
                      ? e.message
                      : 'No se pudo guardar el gasto. Intentá nuevamente.',
                  );
                }
              }}
            />
          )}

          <View style={{ height: spacing[8] }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
