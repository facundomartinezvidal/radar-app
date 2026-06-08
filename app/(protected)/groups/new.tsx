/**
 * RADAR — Nuevo grupo screen
 *
 * Create flow: renders GroupForm. On success navigates to the group detail.
 * Mirrors profile/category-form.tsx structure.
 */
import { router } from 'expo-router';
import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GroupForm } from '@/components/groups/group-form';
import { H1, Icon } from '@/components/ui';
import { useCreateGroup } from '@/hooks/use-groups';
import type { CreateGroupInput } from '@/lib/schemas/group';
import { colors, spacing } from '@/lib/theme';

export default function NewGroupScreen(): React.JSX.Element {
  const createMutation = useCreateGroup();
  const [serverError, setServerError] = useState<string | null>(null);

  async function handleSubmit(values: CreateGroupInput): Promise<void> {
    setServerError(null);
    try {
      const created = await createMutation.mutateAsync(values);
      router.replace(`/(protected)/groups/${created.id}` as Parameters<typeof router.replace>[0]);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'No se pudo crear el grupo. Intentá nuevamente.';
      setServerError(message);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg[0] }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, paddingHorizontal: spacing[5] }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
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
              <Icon name="ChevronLeft" size={24} color={colors.fg[1]} strokeWidth={1.5} />
            </Pressable>
            <H1>Nuevo grupo</H1>
          </View>

          {/* Form */}
          <GroupForm
            onSubmit={handleSubmit}
            submitLabel="Crear grupo"
            isSubmitting={createMutation.isPending}
            submitError={serverError}
          />

          {/* Bottom spacing */}
          <View style={{ height: spacing[8] }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
