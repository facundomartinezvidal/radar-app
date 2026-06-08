/**
 * RADAR — MemberManageSheet
 *
 * Bottom-sheet modal for managing group members (owner-only surface).
 *
 * Lists every member with:
 *   - "Vos" label for the current user
 *   - "Pendiente" pill for members with status === 'pending'
 *   - Rename action ONLY for placeholders (user_id == null)
 *   - Remove action for everyone EXCEPT the owner and the current user
 *
 * Rename uses `addPlaceholderSchema` (1–60 chars) validated with react-hook-form.
 * Remove shows an Alert.alert confirmation before calling useRemoveMember.
 *
 * Mirrors the MemberSelectorSheet modal pattern (animationType="slide", scrim).
 */
import { zodResolver } from '@hookform/resolvers/zod';
import React, { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  TouchableOpacity,
  View,
} from 'react-native';

import { Avatar } from '@/components/ui/avatar';
import { Body, Button, Caption, H2, Icon, Input, Text } from '@/components/ui';
import { Pill } from '@/components/ui/pill';
import { useRemoveMember, useUpdateMember } from '@/hooks/use-groups';
import type { GroupMemberRow } from '@/hooks/use-groups';
import { addPlaceholderSchema } from '@/lib/schemas/group';
import type { AddPlaceholderInput } from '@/lib/schemas/group';
import { colors, radii, shadows, spacing } from '@/lib/theme';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MemberManageSheetProps {
  visible: boolean;
  groupId: string;
  members: GroupMemberRow[];
  /** user_id of the current authenticated user */
  currentUserId: string | null;
  /** member_id of the group owner */
  ownerMemberId: string | null;
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Sub-component: RenameForm
// ---------------------------------------------------------------------------

interface RenameFormProps {
  member: GroupMemberRow;
  groupId: string;
  onDone: () => void;
  onCancel: () => void;
}

function RenameForm({ member, groupId, onDone, onCancel }: RenameFormProps): React.JSX.Element {
  const updateMutation = useUpdateMember();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<AddPlaceholderInput>({
    resolver: zodResolver(addPlaceholderSchema),
    defaultValues: { display_name: member.display_name ?? '' },
  });

  async function onSubmit(values: AddPlaceholderInput): Promise<void> {
    setServerError(null);
    try {
      await updateMutation.mutateAsync({
        memberId: member.id,
        displayName: values.display_name,
        groupId,
      });
      onDone();
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'No se pudo actualizar el nombre. Intentá nuevamente.';
      setServerError(msg);
    }
  }

  return (
    <View style={{ gap: spacing[3] }}>
      <Controller
        control={control}
        name="display_name"
        render={({ field: { onChange, onBlur, value } }) => (
          <Input
            label="Nombre del participante"
            placeholder="Nombre del participante"
            value={value}
            onChangeText={onChange}
            onBlur={onBlur}
            autoCapitalize="words"
            returnKeyType="done"
            error={errors.display_name?.message}
            testID={`rename-input-${member.id}`}
            autoFocus
          />
        )}
      />
      {serverError != null && (
        <Text variant="bodySm" color={colors.state.danger}>
          {serverError}
        </Text>
      )}
      <View style={{ flexDirection: 'row', gap: spacing[2] }}>
        <View style={{ flex: 1 }}>
          <Button
            variant="ghost"
            size="sm"
            onPress={onCancel}
            fullWidth
            accessibilityLabel="Cancelar cambio de nombre"
          >
            Cancelar
          </Button>
        </View>
        <View style={{ flex: 1 }}>
          <Button
            variant="primary"
            size="sm"
            onPress={handleSubmit(onSubmit)}
            loading={updateMutation.isPending}
            fullWidth
            accessibilityLabel="Confirmar cambio de nombre"
          >
            Guardar
          </Button>
        </View>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Sub-component: MemberRow
// ---------------------------------------------------------------------------

interface MemberRowProps {
  member: GroupMemberRow;
  groupId: string;
  isCurrentUser: boolean;
  isOwner: boolean;
  canRename: boolean;
  canRemove: boolean;
  onRemove: (member: GroupMemberRow) => void;
}

function MemberRow({
  member,
  groupId,
  isCurrentUser,
  isOwner,
  canRename,
  canRemove,
  onRemove,
}: MemberRowProps): React.JSX.Element {
  const [renaming, setRenaming] = useState(false);

  // Derive display label
  let displayLabel: string;
  if (isCurrentUser) {
    displayLabel = 'Vos';
  } else if (member.display_name != null && member.display_name.trim().length > 0) {
    displayLabel = member.display_name.trim();
  } else {
    displayLabel = 'Miembro';
  }

  // Derive avatar initials
  const nameParts =
    displayLabel !== 'Vos' && displayLabel !== 'Miembro' ? displayLabel.split(' ') : [];
  const firstName = nameParts[0] ?? null;
  const lastName = nameParts.length > 1 ? (nameParts[nameParts.length - 1] ?? null) : null;

  if (renaming) {
    return (
      <View
        style={{
          paddingVertical: spacing[3],
          borderBottomWidth: 1,
          borderBottomColor: colors.line[1],
          gap: spacing[2],
        }}
        testID={`member-row-${member.id}`}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[3] }}>
          <Avatar firstName={firstName} lastName={lastName} size={36} />
          <Body color={colors.fg[2]}>{displayLabel}</Body>
        </View>
        <RenameForm
          member={member}
          groupId={groupId}
          onDone={() => setRenaming(false)}
          onCancel={() => setRenaming(false)}
        />
      </View>
    );
  }

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: spacing[3],
        borderBottomWidth: 1,
        borderBottomColor: colors.line[1],
        gap: spacing[3],
        minHeight: 44,
      }}
      testID={`member-row-${member.id}`}
    >
      {/* Avatar */}
      <Avatar firstName={firstName} lastName={lastName} size={36} />

      {/* Name + tags */}
      <View style={{ flex: 1, gap: spacing[1] }}>
        <Body color={isCurrentUser ? colors.brand[400] : colors.fg[1]}>{displayLabel}</Body>
        {member.status === 'pending' && (
          <View style={{ alignSelf: 'flex-start' }} testID={`pending-pill-${member.id}`}>
            <Pill variant="neutral">Pendiente</Pill>
          </View>
        )}
        {isOwner && !isCurrentUser && <Caption color={colors.fg[3]}>Organizador</Caption>}
      </View>

      {/* Actions */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[2] }}>
        {canRename && (
          <TouchableOpacity
            onPress={() => setRenaming(true)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={`Renombrar ${displayLabel}`}
            testID={`rename-button-${member.id}`}
            style={{ padding: spacing[1], minHeight: 44, justifyContent: 'center' }}
          >
            <Icon name="Pencil" size={16} color={colors.fg[3]} strokeWidth={1.5} />
          </TouchableOpacity>
        )}
        {canRemove && (
          <TouchableOpacity
            onPress={() => onRemove(member)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={`Eliminar ${displayLabel}`}
            testID={`remove-button-${member.id}`}
            style={{ padding: spacing[1], minHeight: 44, justifyContent: 'center' }}
          >
            <Icon name="Trash2" size={16} color={colors.state.danger} strokeWidth={1.5} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function MemberManageSheet({
  visible,
  groupId,
  members,
  currentUserId,
  ownerMemberId,
  onClose,
}: MemberManageSheetProps): React.JSX.Element {
  const removeMutation = useRemoveMember();
  const [removeError, setRemoveError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setRemoveError(null);
    }
  }, [visible]);

  function handleRemove(member: GroupMemberRow): void {
    const label =
      member.display_name != null && member.display_name.trim().length > 0
        ? member.display_name.trim()
        : 'este miembro';
    Alert.alert(`Sacar a ${label}`, '¿Confirmás que querés sacar a este miembro?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Sacar',
        style: 'destructive',
        onPress: () => {
          setRemoveError(null);
          void removeMutation.mutateAsync({ memberId: member.id, groupId }).catch(() => {
            setRemoveError('No se pudo sacar al miembro. Intentá nuevamente.');
          });
        },
      },
    ]);
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
      testID="member-manage-sheet"
    >
      <KeyboardAvoidingView
        style={{ flex: 1, justifyContent: 'flex-end' }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Scrim */}
        <Pressable
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.6)',
          }}
          onPress={onClose}
          accessibilityLabel="Cerrar hoja"
        />

        <View
          style={{
            backgroundColor: colors.bg[1],
            borderTopLeftRadius: radii.lg,
            borderTopRightRadius: radii.lg,
            maxHeight: '80%',
            ...shadows.three,
          }}
        >
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{
              padding: spacing[5],
              paddingBottom: spacing[10],
            }}
            bounces={false}
          >
            {/* Header */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: spacing[5],
              }}
            >
              <H2>Miembros</H2>
              <TouchableOpacity
                onPress={onClose}
                hitSlop={12}
                accessibilityRole="button"
                accessibilityLabel="Cerrar"
              >
                <Icon name="X" size={24} color={colors.fg[2]} strokeWidth={1.5} />
              </TouchableOpacity>
            </View>

            {/* Error banner */}
            {removeError != null && (
              <View
                style={{
                  backgroundColor: `${colors.state.danger}1A`,
                  borderRadius: radii.sm,
                  padding: spacing[3],
                  marginBottom: spacing[4],
                }}
                testID="remove-error"
              >
                <Caption color={colors.state.danger}>{removeError}</Caption>
              </View>
            )}

            {/* Member list */}
            {members.map((member) => {
              const isCurrentUser = currentUserId != null && member.user_id === currentUserId;
              const isOwner = member.id === ownerMemberId;
              // Rename: only placeholders (no user_id)
              const canRename = member.user_id == null;
              // Remove: not the owner row, not the current user
              const canRemove = !isOwner && !isCurrentUser;

              return (
                <MemberRow
                  key={member.id}
                  member={member}
                  groupId={groupId}
                  isCurrentUser={isCurrentUser}
                  isOwner={isOwner}
                  canRename={canRename}
                  canRemove={canRemove}
                  onRemove={handleRemove}
                />
              );
            })}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
