/**
 * RADAR — Nuevo grupo screen
 *
 * Create flow: renders GroupForm. On success:
 *   1. Creates the group (create_group RPC)
 *   2. Sequentially invites each email from the "con cuenta" section
 *      — tolerates each status; never aborts the whole flow
 *   3. Alerts the user about any `not_found` emails (non-blocking)
 *   4. Navigates to the group detail
 *
 * Mirrors profile/category-form.tsx structure.
 */
import { router } from 'expo-router';
import React, { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { GroupFormValues } from '@/components/groups/group-form';
import { GroupForm } from '@/components/groups/group-form';
import { H1, Icon } from '@/components/ui';
import { useCreateGroup, useInviteMember } from '@/hooks/use-groups';
import { colors, spacing } from '@/lib/theme';

export default function NewGroupScreen(): React.JSX.Element {
  const createMutation = useCreateGroup();
  const inviteMutation = useInviteMember();
  const [serverError, setServerError] = useState<string | null>(null);

  async function handleSubmit(values: GroupFormValues): Promise<void> {
    setServerError(null);
    const { invites, ...createInput } = values;

    let groupId: string;
    try {
      const created = await createMutation.mutateAsync(createInput);
      groupId = created.id;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'No se pudo crear el grupo. Intentá nuevamente.';
      setServerError(message);
      return;
    }

    // Invite each email sequentially — tolerate every status
    const notFound: string[] = [];
    for (const email of invites) {
      try {
        const result = await inviteMutation.mutateAsync({ groupId, input: { email } });
        if (result.status === 'not_found') {
          notFound.push(email);
        }
      } catch {
        // A failed invite must not abort the flow — the group is already created.
      }
    }

    // Navigate first, then show non-blocking alert if any emails had no account
    router.replace(`/(protected)/groups/${groupId}` as Parameters<typeof router.replace>[0]);

    if (notFound.length > 0) {
      const emailList = notFound.join(', ');
      Alert.alert(
        'Invitaciones no enviadas',
        `No encontramos una cuenta para: ${emailList}. Podés agregarlos como participantes sin cuenta.`,
      );
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
