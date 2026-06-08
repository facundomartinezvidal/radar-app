/**
 * RADAR — MemberSelectorSheet
 *
 * Bottom-sheet modal for adding members to a group.
 * Two modes, toggled by a segmented control:
 *   - "Sin cuenta"  → add an anonymous placeholder by display name
 *   - "Con cuenta"  → invite a registered user by email
 *
 * Mirrors the category-selector-sheet/category-create-sheet RN Modal pattern:
 * animationType="slide", transparent, scrim overlay.
 */
import { zodResolver } from '@hookform/resolvers/zod';
import React, { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Modal, Pressable, TouchableOpacity, View } from 'react-native';

import { Body, Button, Caption, H2, Icon, Input, Text } from '@/components/ui';
import { useAddPlaceholder, useInviteMember } from '@/hooks/use-groups';
import { addPlaceholderSchema, inviteMemberSchema } from '@/lib/schemas/group';
import type { AddPlaceholderInput, InviteMemberInput } from '@/lib/schemas/group';
import { colors, radii, shadows, spacing } from '@/lib/theme';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MemberSelectorSheetProps {
  visible: boolean;
  groupId: string;
  onClose: () => void;
}

type SheetSegment = 'placeholder' | 'invite';

type InviteStatus = 'invited' | 'already_member' | 'not_found' | null;

// ---------------------------------------------------------------------------
// Sub-component: SegmentedControl
// ---------------------------------------------------------------------------

interface SegmentedControlProps {
  active: SheetSegment;
  onChange: (seg: SheetSegment) => void;
}

function SegmentedControl({ active, onChange }: SegmentedControlProps): React.JSX.Element {
  return (
    <View
      style={{
        flexDirection: 'row',
        backgroundColor: colors.bg[2],
        borderRadius: radii.md,
        padding: 3,
        marginBottom: spacing[5],
      }}
    >
      {(['placeholder', 'invite'] as SheetSegment[]).map((seg) => {
        const isActive = active === seg;
        return (
          <Pressable
            key={seg}
            onPress={() => onChange(seg)}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
            accessibilityLabel={seg === 'placeholder' ? 'Sin cuenta' : 'Con cuenta'}
            style={{
              flex: 1,
              paddingVertical: spacing[2],
              borderRadius: radii.sm,
              backgroundColor: isActive ? colors.bg[3] : 'transparent',
              alignItems: 'center',
              minHeight: 36,
              justifyContent: 'center',
            }}
          >
            <Body
              color={isActive ? colors.fg[1] : colors.fg[3]}
              style={{ fontWeight: isActive ? '600' : '400' }}
            >
              {seg === 'placeholder' ? 'Sin cuenta' : 'Con cuenta'}
            </Body>
          </Pressable>
        );
      })}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Sub-component: PlaceholderForm
// ---------------------------------------------------------------------------

interface PlaceholderFormProps {
  groupId: string;
  onSuccess: () => void;
}

function PlaceholderForm({ groupId, onSuccess }: PlaceholderFormProps): React.JSX.Element {
  const addMutation = useAddPlaceholder();

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<AddPlaceholderInput>({
    resolver: zodResolver(addPlaceholderSchema),
    defaultValues: { display_name: '' },
  });

  const [serverError, setServerError] = useState<string | null>(null);

  useEffect(() => {
    setServerError(null);
  }, []);

  async function onSubmit(values: AddPlaceholderInput): Promise<void> {
    setServerError(null);
    try {
      await addMutation.mutateAsync({ groupId, displayName: values.display_name });
      reset();
      onSuccess();
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : 'No se pudo agregar el participante. Intentá nuevamente.';
      setServerError(msg);
    }
  }

  return (
    <View style={{ gap: spacing[4] }}>
      <Controller
        control={control}
        name="display_name"
        render={({ field: { onChange, onBlur, value } }) => (
          <Input
            label="Nombre"
            placeholder="Nombre del participante"
            value={value}
            onChangeText={onChange}
            onBlur={onBlur}
            autoCapitalize="words"
            returnKeyType="done"
            error={errors.display_name?.message}
            testID="placeholder-name-input"
          />
        )}
      />

      {serverError != null && (
        <Text variant="bodySm" color={colors.state.danger}>
          {serverError}
        </Text>
      )}

      <Button
        variant="primary"
        size="md"
        fullWidth
        onPress={handleSubmit(onSubmit)}
        loading={addMutation.isPending}
        accessibilityLabel="Agregar participante sin cuenta"
      >
        Agregar
      </Button>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Sub-component: InviteForm
// ---------------------------------------------------------------------------

interface InviteFormProps {
  groupId: string;
  onSuccess: (status: InviteStatus) => void;
}

function InviteForm({ groupId, onSuccess }: InviteFormProps): React.JSX.Element {
  const inviteMutation = useInviteMember();

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<InviteMemberInput>({
    resolver: zodResolver(inviteMemberSchema),
    defaultValues: { email: '' },
  });

  const [inviteStatus, setInviteStatus] = useState<InviteStatus>(null);
  const [serverError, setServerError] = useState<string | null>(null);

  async function onSubmit(values: InviteMemberInput): Promise<void> {
    setServerError(null);
    setInviteStatus(null);
    try {
      const result = await inviteMutation.mutateAsync({ groupId, input: values });
      setInviteStatus(result.status);
      onSuccess(result.status);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'No se pudo enviar la invitación. Intentá nuevamente.';
      setServerError(msg);
    }
  }

  return (
    <View style={{ gap: spacing[4] }}>
      <Controller
        control={control}
        name="email"
        render={({ field: { onChange, onBlur, value } }) => (
          <Input
            label="Correo electrónico"
            placeholder="correo@ejemplo.com"
            value={value}
            onChangeText={onChange}
            onBlur={onBlur}
            autoCapitalize="none"
            keyboardType="email-address"
            returnKeyType="send"
            error={errors.email?.message}
            testID="invite-email-input"
          />
        )}
      />

      {/* Status messages */}
      {inviteStatus === 'already_member' && (
        <View
          style={{
            backgroundColor: `${colors.state.warn}1A`,
            borderRadius: radii.sm,
            padding: spacing[3],
          }}
          testID="status-already-member"
        >
          <Caption color={colors.amber[500]}>Esta persona ya está en el grupo.</Caption>
        </View>
      )}

      {inviteStatus === 'not_found' && (
        <View
          style={{
            backgroundColor: `${colors.state.info}1A`,
            borderRadius: radii.sm,
            padding: spacing[3],
            gap: spacing[1],
          }}
          testID="status-not-found"
        >
          <Caption color={colors.brand[300]}>
            No encontramos una cuenta con ese correo. Podés agregarla como miembro sin cuenta.
          </Caption>
        </View>
      )}

      {serverError != null && (
        <Text variant="bodySm" color={colors.state.danger}>
          {serverError}
        </Text>
      )}

      <Button
        variant="primary"
        size="md"
        fullWidth
        onPress={handleSubmit(onSubmit)}
        loading={inviteMutation.isPending}
        accessibilityLabel="Invitar por correo electrónico"
      >
        Invitar
      </Button>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function MemberSelectorSheet({
  visible,
  groupId,
  onClose,
}: MemberSelectorSheetProps): React.JSX.Element {
  const [segment, setSegment] = useState<SheetSegment>('placeholder');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Reset state each time the sheet becomes visible
  useEffect(() => {
    if (visible) {
      setSegment('placeholder');
      setSuccessMessage(null);
    }
  }, [visible]);

  function handlePlaceholderSuccess(): void {
    onClose();
  }

  function handleInviteSuccess(status: InviteStatus): void {
    if (status === 'invited') {
      setSuccessMessage('Invitación enviada.');
      // Close after a brief moment so user can see the confirmation
      setTimeout(() => {
        onClose();
      }, 1200);
    }
    // For other statuses, the InviteForm renders the inline message — keep sheet open
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
      testID="member-selector-sheet"
    >
      <View
        style={{
          flex: 1,
          justifyContent: 'flex-end',
          backgroundColor: 'rgba(0,0,0,0.6)',
        }}
      >
        <View
          style={{
            backgroundColor: colors.bg[1],
            borderTopLeftRadius: radii.lg,
            borderTopRightRadius: radii.lg,
            padding: spacing[5],
            paddingBottom: spacing[10],
            ...shadows.three,
          }}
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
            <H2>Agregar miembro</H2>
            <TouchableOpacity
              onPress={onClose}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Cerrar"
            >
              <Icon name="X" size={24} color={colors.fg[2]} strokeWidth={1.5} />
            </TouchableOpacity>
          </View>

          {/* Segmented control */}
          <SegmentedControl active={segment} onChange={setSegment} />

          {/* Success message (invited) */}
          {successMessage != null && (
            <View
              style={{
                backgroundColor: `${colors.state.success}1A`,
                borderRadius: radii.sm,
                padding: spacing[3],
                marginBottom: spacing[4],
              }}
              testID="status-invited"
            >
              <Caption color={colors.money.in}>{successMessage}</Caption>
            </View>
          )}

          {/* Segment content */}
          {segment === 'placeholder' ? (
            <PlaceholderForm groupId={groupId} onSuccess={handlePlaceholderSuccess} />
          ) : (
            <InviteForm groupId={groupId} onSuccess={handleInviteSuccess} />
          )}
        </View>
      </View>
    </Modal>
  );
}
