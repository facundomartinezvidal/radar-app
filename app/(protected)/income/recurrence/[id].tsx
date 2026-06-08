/**
 * RADAR — Income recurrence detail / edit / delete screen.
 *
 * Route param: `id`. Loads the recurrence rule, renders RecurrenceForm with
 * the row as initial values, and supports:
 *   - Update (useUpdateRecurrence)
 *   - Pause / Resume (usePauseRecurrence / useResumeRecurrence)
 *   - Delete with Alert confirmation (useDeleteRecurrence)
 *
 * Shows current status and next_run_on ("Próximo: <fecha>") in the header area.
 */
import { router, Stack, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { RecurrenceForm } from '@/components/incomes/recurrence-form';
import { Body, BodySm, Button, H1, Icon, Loader, Pill } from '@/components/ui';
import { useCategories } from '@/hooks/use-expenses';
import {
  useDeleteRecurrence,
  usePauseRecurrence,
  useRecurrence,
  useResumeRecurrence,
  useUpdateRecurrence,
} from '@/hooks/use-incomes';
import { colors, spacing } from '@/lib/theme';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ES_AR_DATE = new Intl.DateTimeFormat('es-AR', {
  day: '2-digit',
  month: 'long',
  year: 'numeric',
});

function formatDate(dateStr: string): string {
  // dateStr is YYYY-MM-DD — parse as UTC noon to avoid timezone shifts.
  const [y, m, d] = dateStr.split('-').map(Number);
  if (!y || !m || !d) return dateStr;
  const dt = new Date(Date.UTC(y, m - 1, d, 12));
  return Number.isNaN(dt.getTime()) ? dateStr : ES_AR_DATE.format(dt);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function RecurrenceDetailScreen(): React.JSX.Element {
  const params = useLocalSearchParams<{ id?: string }>();
  const id = typeof params.id === 'string' ? params.id : '';

  const recurrenceQuery = useRecurrence(id);
  const categoriesQuery = useCategories('income');
  const updateMutation = useUpdateRecurrence();
  const pauseMutation = usePauseRecurrence();
  const resumeMutation = useResumeRecurrence();
  const deleteMutation = useDeleteRecurrence();

  const recurrence = recurrenceQuery.data;
  const isActive = recurrence?.status === 'active';

  const [submitError, setSubmitError] = useState<string | null>(null);

  function confirmDelete(): void {
    Alert.alert(
      'Eliminar ingreso recurrente',
      '¿Confirmás que querés eliminar este ingreso recurrente? Los ingresos ya registrados se conservan.',
      [
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
                  : 'No se pudo eliminar el ingreso recurrente. Intentá nuevamente.',
              );
            }
          },
        },
      ],
    );
  }

  async function togglePauseResume(): Promise<void> {
    setSubmitError(null);
    try {
      if (isActive) {
        await pauseMutation.mutateAsync(id);
      } else {
        await resumeMutation.mutateAsync(id);
      }
    } catch (e) {
      setSubmitError(
        e instanceof Error
          ? e.message
          : 'No se pudo actualizar el estado de la recurrencia. Intentá nuevamente.',
      );
    }
  }

  const isLoading = recurrenceQuery.isLoading || categoriesQuery.isLoading;
  const isStatusPending = pauseMutation.isPending || resumeMutation.isPending;

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
              paddingBottom: spacing[3],
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
              <H1>Editar ingreso recurrente</H1>
            </View>
            {recurrence ? (
              <Pressable
                onPress={confirmDelete}
                accessibilityLabel="Eliminar ingreso recurrente"
                hitSlop={12}
                style={{ padding: spacing[1] }}
              >
                <Icon name="Trash2" size={22} color={colors.money.out} />
              </Pressable>
            ) : null}
          </View>

          {/* Status + next run */}
          {recurrence ? (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing[3],
                paddingBottom: spacing[4],
              }}
            >
              <Pill variant={isActive ? 'income' : 'neutral'}>
                {isActive ? 'Activa' : 'Pausada'}
              </Pill>
              <BodySm color={colors.fg[3]}>Próximo: {formatDate(recurrence.next_run_on)}</BodySm>
            </View>
          ) : null}

          {isLoading ? (
            <Loader color={colors.fg[3]} label="Cargando" />
          ) : !recurrence ? (
            <Body color={colors.fg[3]}>No se encontró el ingreso recurrente solicitado.</Body>
          ) : (
            <RecurrenceForm
              categories={categoriesQuery.data ?? []}
              initial={recurrence}
              isSubmitting={updateMutation.isPending}
              submitError={submitError}
              submitLabel="Guardar cambios"
              onSubmit={async (input) => {
                setSubmitError(null);
                try {
                  await updateMutation.mutateAsync({ id, patch: input });
                  router.back();
                } catch (e) {
                  setSubmitError(
                    e instanceof Error
                      ? e.message
                      : 'No se pudo actualizar el ingreso recurrente. Intentá nuevamente.',
                  );
                }
              }}
            />
          )}

          {/* Pause / Resume + Delete buttons */}
          {recurrence ? (
            <View style={{ gap: spacing[3], marginTop: spacing[5], marginBottom: spacing[8] }}>
              <Button
                variant="secondary"
                size="md"
                fullWidth
                loading={isStatusPending}
                disabled={isStatusPending || updateMutation.isPending}
                onPress={togglePauseResume}
                accessibilityLabel={isActive ? 'Pausar' : 'Reanudar'}
                leftIcon={
                  <Icon
                    name={isActive ? 'PauseCircle' : 'PlayCircle'}
                    size={18}
                    color={colors.fg[1]}
                  />
                }
              >
                {isActive ? 'Pausar' : 'Reanudar'}
              </Button>

              <Button
                variant="destructive"
                size="md"
                fullWidth
                loading={deleteMutation.isPending}
                disabled={deleteMutation.isPending}
                onPress={confirmDelete}
                accessibilityLabel="Eliminar ingreso recurrente"
                leftIcon={<Icon name="Trash2" size={18} color={colors.fg.onBrand} />}
              >
                Eliminar ingreso recurrente
              </Button>
            </View>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
