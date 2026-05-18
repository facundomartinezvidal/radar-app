/**
 * RADAR — Expense detail / edit / delete screen.
 *
 * Route param: `id`. Loads the expense, renders ExpenseForm with the row as
 * initial values, supports update + delete with a confirmation alert.
 */
import { router, Stack, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ExpenseForm } from '@/components/expenses/expense-form';
import { Body, Button, H1, Icon } from '@/components/ui';
import {
  useCategories,
  useDeleteExpense,
  useExpense,
  useUpdateExpense,
} from '@/hooks/use-expenses';
import { colors, spacing } from '@/lib/theme';

export default function ExpenseDetailScreen(): React.JSX.Element {
  const params = useLocalSearchParams<{ id?: string }>();
  const id = typeof params.id === 'string' ? params.id : '';

  const expenseQuery = useExpense(id);
  const categoriesQuery = useCategories();
  const updateMutation = useUpdateExpense();
  const deleteMutation = useDeleteExpense();

  const [submitError, setSubmitError] = useState<string | null>(null);

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

  const isLoading = expenseQuery.isLoading || categoriesQuery.isLoading;
  const expense = expenseQuery.data;

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
            <Body color={colors.fg[3]}>Cargando…</Body>
          ) : !expense ? (
            <Body color={colors.fg[3]}>No se encontró el gasto solicitado.</Body>
          ) : (
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
