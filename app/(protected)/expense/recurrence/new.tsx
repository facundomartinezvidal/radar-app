/**
 * RADAR — New expense recurrence screen.
 *
 * Renders ExpenseRecurrenceForm in create mode; on submit calls
 * useCreateExpenseRecurrence and navigates back.
 */
import { router, Stack } from 'expo-router';
import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ExpenseRecurrenceForm } from '@/components/expenses/expense-recurrence-form';
import { Body, H1, Icon, Loader } from '@/components/ui';
import { useCategories, useCreateExpenseRecurrence } from '@/hooks/use-expenses';
import { colors, spacing } from '@/lib/theme';

export default function NewExpenseRecurrenceScreen(): React.JSX.Element {
  const categoriesQuery = useCategories('expense');
  const createMutation = useCreateExpenseRecurrence();
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
            <H1>Nuevo gasto recurrente</H1>
          </View>

          {/* Form / loading */}
          {categoriesQuery.isLoading ? (
            <Loader color={colors.fg[3]} label="Cargando categorías" />
          ) : categoriesQuery.error ? (
            <Body color={colors.money.out}>
              No se pudieron cargar las categorías. Intentá nuevamente.
            </Body>
          ) : (
            <ExpenseRecurrenceForm
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
                      : 'No se pudo crear el gasto recurrente. Intentá nuevamente.',
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
