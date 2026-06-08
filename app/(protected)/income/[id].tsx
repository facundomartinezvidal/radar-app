/**
 * RADAR — Income detail / edit / delete screen.
 *
 * Route param: `id`. Loads the income, renders IncomeForm with the row as
 * initial values, supports update + delete with a confirmation alert.
 *
 * Incomes are always personal (no group/split path).
 */
import { router, Stack, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { IncomeForm } from '@/components/incomes/income-form';
import { Body, Button, H1, Icon, Loader } from '@/components/ui';
import { useCategories } from '@/hooks/use-expenses';
import { useDeleteIncome, useIncome, useUpdateIncome } from '@/hooks/use-incomes';
import { colors, spacing } from '@/lib/theme';

export default function IncomeDetailScreen(): React.JSX.Element {
  const params = useLocalSearchParams<{ id?: string }>();
  const id = typeof params.id === 'string' ? params.id : '';

  const incomeQuery = useIncome(id);
  const categoriesQuery = useCategories('income');
  const updateMutation = useUpdateIncome();
  const deleteMutation = useDeleteIncome();

  const income = incomeQuery.data;

  const [submitError, setSubmitError] = useState<string | null>(null);

  function confirmDelete(): void {
    Alert.alert('Eliminar ingreso', '¿Confirmás que querés eliminar este ingreso?', [
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
              e instanceof Error
                ? e.message
                : 'No se pudo eliminar el ingreso. Intentá nuevamente.',
            );
          }
        },
      },
    ]);
  }

  const isLoading = incomeQuery.isLoading || categoriesQuery.isLoading;

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
              <H1>Editar ingreso</H1>
            </View>
            {income ? (
              <Pressable
                onPress={confirmDelete}
                accessibilityLabel="Eliminar ingreso"
                hitSlop={12}
                style={{ padding: spacing[1] }}
              >
                <Icon name="Trash2" size={22} color={colors.money.out} />
              </Pressable>
            ) : null}
          </View>

          {isLoading ? (
            <Loader color={colors.fg[3]} label="Cargando" />
          ) : !income ? (
            <Body color={colors.fg[3]}>No se encontró el ingreso solicitado.</Body>
          ) : (
            <IncomeForm
              categories={categoriesQuery.data ?? []}
              initial={income}
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
                      : 'No se pudo actualizar el ingreso. Intentá nuevamente.',
                  );
                }
              }}
            />
          )}

          {income ? (
            <View style={{ marginTop: spacing[5], marginBottom: spacing[8] }}>
              <Button
                variant="destructive"
                size="md"
                fullWidth
                loading={deleteMutation.isPending}
                onPress={confirmDelete}
                accessibilityLabel="Eliminar ingreso"
                leftIcon={<Icon name="Trash2" size={18} color={colors.fg.onBrand} />}
              >
                Eliminar ingreso
              </Button>
            </View>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
