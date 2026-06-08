/**
 * RADAR — GroupForm
 *
 * Reusable create form for groups. Mirrors CategoryForm patterns:
 * react-hook-form + zodResolver + live preview chip.
 *
 * Fields:
 *   - name (text input, maxLength 60)
 *   - color (CategoryColorPicker)
 *   - icon (CategoryIconPicker)
 *   - placeholders (list of participant name inputs, "sin cuenta", add/remove)
 *   - invites (list of email inputs, "con cuenta", add/remove)
 *
 * Note: react-hook-form useFieldArray requires object fields. We manage both
 * `placeholders` and `invites` lists via controlled local state, written into
 * the final payload on submit.
 */
import { zodResolver } from '@hookform/resolvers/zod';
import React, { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Pressable, StyleSheet, View } from 'react-native';
import { z } from 'zod';

import { CategoryColorPicker } from '@/components/categories/category-color-picker';
import { CategoryIconPicker } from '@/components/categories/category-icon-picker';
import { Body, BodySm, Button, Icon, Input, Text } from '@/components/ui';
import type { IconName } from '@/components/ui/icon';
import { useCheckUserExists } from '@/hooks/use-groups';
import { CATEGORY_COLORS, CATEGORY_ICONS } from '@/lib/category-options';
import type { CreateGroupInput } from '@/lib/schemas/group';
import { createGroupSchema } from '@/lib/schemas/group';
import { colors, radii, spacing } from '@/lib/theme';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type GroupFormValues = CreateGroupInput & { invites: string[] };

export interface GroupFormProps {
  initial?: {
    name: string;
    icon: IconName;
    color: string;
    placeholders: string[];
    invites?: string[];
  };
  onSubmit: (values: GroupFormValues) => void | Promise<void>;
  /** Button label. Defaults to 'Crear grupo'. */
  submitLabel?: string;
  isSubmitting?: boolean;
  /** Server-side error. Shown below the form. */
  submitError?: string | null;
}

// Inline email validator matching inviteMemberSchema
const emailRule = z.string().trim().email('Ingresá un correo válido.');

// ---------------------------------------------------------------------------
// Preview chip
// ---------------------------------------------------------------------------

interface PreviewChipProps {
  name: string;
  icon: IconName;
  color: string;
}

function PreviewChip({ name, icon, color }: PreviewChipProps): React.JSX.Element {
  const label = name.trim().length > 0 ? name.trim() : 'Grupo';
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        gap: spacing[2],
        paddingVertical: spacing[2],
        paddingHorizontal: spacing[3],
        borderRadius: radii.pill,
        borderWidth: 2,
        borderColor: color,
        backgroundColor: `${color}1A`,
      }}
    >
      <Icon name={icon} size={16} color={color} strokeWidth={1.5} />
      <Text variant="bodySm" color={colors.fg[1]} style={{ fontWeight: '600' }}>
        {label}
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function GroupForm({
  initial,
  onSubmit,
  submitLabel = 'Crear grupo',
  isSubmitting = false,
  submitError = null,
}: GroupFormProps): React.JSX.Element {
  const checkExists = useCheckUserExists();

  // Placeholders ("sin cuenta") managed as local state
  const [placeholders, setPlaceholders] = useState<string[]>(initial?.placeholders ?? []);
  // Invites ("con cuenta") managed as local state — email strings
  const [invites, setInvites] = useState<string[]>(initial?.invites ?? []);
  // Per-invite inline validation errors (format + existence)
  const [inviteErrors, setInviteErrors] = useState<Record<number, string>>({});
  // Per-invite existence state: null = unknown, true = found, false = not found
  const [inviteExists, setInviteExists] = useState<Record<number, boolean | null>>({});

  const {
    control,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<Omit<CreateGroupInput, 'placeholders'>>({
    resolver: zodResolver(createGroupSchema.omit({ placeholders: true })),
    defaultValues: {
      name: initial?.name ?? '',
      icon: (initial?.icon ?? CATEGORY_ICONS[0]) as (typeof CATEGORY_ICONS)[number],
      color: (initial?.color ?? CATEGORY_COLORS[0]) as (typeof CATEGORY_COLORS)[number],
    },
  });

  const watchedName = watch('name');
  const watchedIcon = watch('icon');
  const watchedColor = watch('color');

  // ---------------------------------------------------------------------------
  // Placeholder (sin cuenta) handlers
  // ---------------------------------------------------------------------------

  function addPlaceholder(): void {
    setPlaceholders((prev) => [...prev, '']);
  }

  function removePlaceholder(index: number): void {
    setPlaceholders((prev) => prev.filter((_, i) => i !== index));
  }

  function updatePlaceholder(index: number, value: string): void {
    setPlaceholders((prev) => prev.map((p, i) => (i === index ? value : p)));
  }

  // ---------------------------------------------------------------------------
  // Invite (con cuenta) handlers
  // ---------------------------------------------------------------------------

  function addInvite(): void {
    setInvites((prev) => [...prev, '']);
  }

  function removeInvite(index: number): void {
    setInvites((prev) => prev.filter((_, i) => i !== index));
    setInviteErrors((prev) => {
      const next: Record<number, string> = {};
      Object.entries(prev).forEach(([k, v]) => {
        const n = Number(k);
        if (n < index) next[n] = v;
        else if (n > index) next[n - 1] = v;
      });
      return next;
    });
    setInviteExists((prev) => {
      const next: Record<number, boolean | null> = {};
      Object.entries(prev).forEach(([k, v]) => {
        const n = Number(k);
        if (n < index) next[n] = v;
        else if (n > index) next[n - 1] = v;
      });
      return next;
    });
  }

  function updateInvite(index: number, value: string): void {
    setInvites((prev) => prev.map((p, i) => (i === index ? value : p)));
    // Clear format error and existence state as user types
    if (inviteErrors[index] != null) {
      setInviteErrors((prev) => {
        const next = { ...prev };
        delete next[index];
        return next;
      });
    }
    if (inviteExists[index] !== undefined) {
      setInviteExists((prev) => {
        const next = { ...prev };
        delete next[index];
        return next;
      });
    }
  }

  async function handleInviteBlur(index: number): Promise<void> {
    const email = invites[index]?.trim() ?? '';
    if (email.length === 0) return; // empty rows are dropped — skip check
    // Only check when format is valid
    const formatOk = emailRule.safeParse(email);
    if (!formatOk.success) return;
    // Clear previous existence state to show "Verificando…" is implicit via isPending
    setInviteExists((prev) => ({ ...prev, [index]: null }));
    try {
      const exists = await checkExists.mutateAsync(email);
      setInviteExists((prev) => ({ ...prev, [index]: exists }));
      if (!exists) {
        setInviteErrors((prev) => ({
          ...prev,
          [index]: 'No existe una cuenta con ese correo electrónico.',
        }));
      }
    } catch {
      // Network error — treat as unknown, don't block
      setInviteExists((prev) => {
        const next = { ...prev };
        delete next[index];
        return next;
      });
    }
  }

  function validateInvites(): boolean {
    const errs: Record<number, string> = { ...inviteErrors };
    invites.forEach((email, i) => {
      if (email.trim().length === 0) return; // empty rows are dropped — no error
      const result = emailRule.safeParse(email.trim());
      if (!result.success) {
        errs[i] = result.error.issues[0]?.message ?? 'Ingresá un correo válido.';
      } else if (inviteExists[i] === false) {
        errs[i] = 'No existe una cuenta con ese correo electrónico.';
      }
    });
    setInviteErrors(errs);
    return Object.keys(errs).length === 0;
  }

  // True while any invite row's existence check is in flight
  const hasCheckPending = checkExists.isPending;

  const submit = handleSubmit(async (data) => {
    if (!validateInvites()) return;
    if (hasCheckPending) return; // wait for in-flight check to finish
    const fullData: GroupFormValues = {
      ...data,
      placeholders: placeholders.filter((p) => p.trim().length > 0),
      invites: invites.map((e) => e.trim()).filter((e) => e.length > 0),
    };
    await onSubmit(fullData);
  });

  return (
    <View style={styles.container}>
      {/* Name */}
      <Controller
        control={control}
        name="name"
        render={({ field: { onChange, onBlur, value } }) => (
          <Input
            label="Nombre del grupo"
            placeholder="Nombre del grupo"
            value={value}
            onChangeText={onChange}
            onBlur={onBlur}
            maxLength={60}
            editable={!isSubmitting}
            error={errors.name?.message}
          />
        )}
      />

      {/* Color */}
      <View style={styles.fieldGroup}>
        <Text variant="label">Color</Text>
        <Controller
          control={control}
          name="color"
          render={({ field: { onChange, value } }) => (
            <CategoryColorPicker value={value} onChange={onChange} disabled={isSubmitting} />
          )}
        />
      </View>

      {/* Icon */}
      <View style={styles.fieldGroup}>
        <Text variant="label">Ícono</Text>
        <Controller
          control={control}
          name="icon"
          render={({ field: { onChange, value } }) => (
            <CategoryIconPicker
              value={value as IconName}
              color={watchedColor}
              onChange={onChange}
              disabled={isSubmitting}
            />
          )}
        />
      </View>

      {/* Live preview */}
      <View style={styles.fieldGroup}>
        <BodySm color={colors.fg[3]}>Vista previa</BodySm>
        <PreviewChip name={watchedName} icon={watchedIcon as IconName} color={watchedColor} />
      </View>

      {/* Participants — sin cuenta (placeholders) */}
      <View style={styles.fieldGroup}>
        <Text variant="label">Participantes (sin cuenta)</Text>
        {placeholders.map((value, index) => (
          <View key={index} style={styles.participantRow}>
            <View style={styles.participantInput}>
              <Input
                placeholder="Nombre del participante"
                value={value}
                onChangeText={(text) => updatePlaceholder(index, text)}
                maxLength={60}
                editable={!isSubmitting}
                testID={`placeholder-input-${index}`}
              />
            </View>
            <Pressable
              onPress={() => removePlaceholder(index)}
              disabled={isSubmitting}
              accessibilityRole="button"
              accessibilityLabel={`Eliminar participante ${index + 1}`}
              hitSlop={8}
              style={styles.removeButton}
              testID={`remove-placeholder-${index}`}
            >
              <Icon name="Trash2" size={20} color={colors.money.out} strokeWidth={1.5} />
            </Pressable>
          </View>
        ))}

        <Pressable
          onPress={addPlaceholder}
          disabled={isSubmitting}
          accessibilityRole="button"
          accessibilityLabel="Agregar participante"
          style={styles.addCta}
          testID="add-placeholder-button"
        >
          <Icon name="Plus" size={18} color={colors.brand[400]} strokeWidth={1.5} />
          <Text variant="bodySm" color={colors.brand[400]}>
            Agregar participante
          </Text>
        </Pressable>
      </View>

      {/* Participants — con cuenta (email invites) */}
      <View style={styles.fieldGroup}>
        <Text variant="label">Participantes (con cuenta)</Text>
        {invites.map((value, index) => (
          <View key={index} style={styles.participantRow}>
            <View style={styles.participantInput}>
              <Input
                placeholder="Correo electrónico"
                value={value}
                onChangeText={(text) => updateInvite(index, text)}
                onBlur={() => void handleInviteBlur(index)}
                keyboardType="email-address"
                autoCapitalize="none"
                editable={!isSubmitting}
                error={inviteErrors[index]}
                testID={`invite-input-${index}`}
              />
            </View>
            <Pressable
              onPress={() => removeInvite(index)}
              disabled={isSubmitting}
              accessibilityRole="button"
              accessibilityLabel={`Eliminar invitado ${index + 1}`}
              hitSlop={8}
              style={styles.removeButton}
              testID={`remove-invite-${index}`}
            >
              <Icon name="Trash2" size={20} color={colors.money.out} strokeWidth={1.5} />
            </Pressable>
          </View>
        ))}

        <Pressable
          onPress={addInvite}
          disabled={isSubmitting}
          accessibilityRole="button"
          accessibilityLabel="Agregar por correo"
          style={styles.addCta}
          testID="add-invite-button"
        >
          <Icon name="Plus" size={18} color={colors.brand[400]} strokeWidth={1.5} />
          <Text variant="bodySm" color={colors.brand[400]}>
            Agregar por correo
          </Text>
        </Pressable>
      </View>

      {/* Server error */}
      {submitError != null && submitError.length > 0 && (
        <Body style={{ color: colors.money.out }}>{submitError}</Body>
      )}

      {/* Submit */}
      <Button
        variant="primary"
        size="lg"
        fullWidth
        loading={isSubmitting}
        disabled={isSubmitting || hasCheckPending}
        onPress={submit}
        accessibilityLabel={submitLabel}
      >
        {submitLabel}
      </Button>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    gap: spacing[4],
  },
  fieldGroup: {
    gap: spacing[2],
  },
  participantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  participantInput: {
    flex: 1,
  },
  removeButton: {
    padding: spacing[2],
    minHeight: 44,
    minWidth: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    paddingVertical: spacing[3],
    minHeight: 44,
  },
});
