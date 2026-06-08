/**
 * RADAR — New income screen.
 */
import { router, Stack } from 'expo-router';
import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { IncomeForm } from '@/components/incomes/income-form';
import { Body, H1, Icon, Loader } from '@/components/ui';
import { useCategories } from '@/hooks/use-expenses';
import { useCreateIncome } from '@/hooks/use-incomes';
import { colors, spacing } from '@/lib/theme';

export default function NewIncomeScreen(): React.JSX.Element {
  const categoriesQuery = useCategories('income');
  const createMutation = useCreateIncome();
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
            <H1>Nuevo ingreso</H1>
          </View>

          {/* Form / loading */}
          {categoriesQuery.isLoading ? (
            <Loader color={colors.fg[3]} label="Cargando categorías" />
          ) : categoriesQuery.error ? (
            <Body color={colors.money.out}>
              No se pudieron cargar las categorías. Intentá nuevamente.
            </Body>
          ) : (
            <IncomeForm
              categories={categoriesQuery.data ?? []}
              isSubmitting={createMutation.isPending}
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
                      : 'No se pudo guardar el ingreso. Intentá nuevamente.',
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
