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
 *   - placeholders (list of participant name inputs with add/remove)
 *
 * Note: react-hook-form useFieldArray requires object fields. We manage the
 * `placeholders: string[]` list via a controlled local state that is written
 * into the form with setValue before submit so Zod can validate the full shape.
 */
import { zodResolver } from '@hookform/resolvers/zod';
import React, { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Pressable, StyleSheet, View } from 'react-native';

import { CategoryColorPicker } from '@/components/categories/category-color-picker';
import { CategoryIconPicker } from '@/components/categories/category-icon-picker';
import { Body, BodySm, Button, Icon, Input, Text } from '@/components/ui';
import type { IconName } from '@/components/ui/icon';
import { CATEGORY_COLORS, CATEGORY_ICONS } from '@/lib/category-options';
import type { CreateGroupInput } from '@/lib/schemas/group';
import { createGroupSchema } from '@/lib/schemas/group';
import { colors, radii, spacing } from '@/lib/theme';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GroupFormProps {
  initial?: { name: string; icon: IconName; color: string; placeholders: string[] };
  onSubmit: (values: CreateGroupInput) => void | Promise<void>;
  /** Button label. Defaults to 'Crear grupo'. */
  submitLabel?: string;
  isSubmitting?: boolean;
  /** Server-side error. Shown below the form. */
  submitError?: string | null;
}

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
  // Placeholders are managed as local state so we can support add/remove
  // without needing useFieldArray (which requires object-typed fields).
  const [placeholders, setPlaceholders] = useState<string[]>(initial?.placeholders ?? []);

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

  function addPlaceholder(): void {
    setPlaceholders((prev) => [...prev, '']);
  }

  function removePlaceholder(index: number): void {
    setPlaceholders((prev) => prev.filter((_, i) => i !== index));
  }

  function updatePlaceholder(index: number, value: string): void {
    setPlaceholders((prev) => prev.map((p, i) => (i === index ? value : p)));
  }

  const submit = handleSubmit(async (data) => {
    const fullData: CreateGroupInput = {
      ...data,
      placeholders: placeholders.filter((p) => p.trim().length > 0),
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

      {/* Participants (placeholders) */}
      <View style={styles.fieldGroup}>
        <Text variant="label">Participantes (sin cuenta)</Text>
        {placeholders.map((value, index) => (
          <View key={index} style={styles.placeholderRow}>
            <View style={styles.placeholderInput}>
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
          style={styles.addPlaceholder}
          testID="add-placeholder-button"
        >
          <Icon name="Plus" size={18} color={colors.brand[400]} strokeWidth={1.5} />
          <Text variant="bodySm" color={colors.brand[400]}>
            Agregar participante
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
        disabled={isSubmitting}
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
  placeholderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing[2],
  },
  placeholderInput: {
    flex: 1,
  },
  removeButton: {
    padding: spacing[2],
    minHeight: 44,
    minWidth: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing[7], // align with input (accounts for label height)
  },
  addPlaceholder: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    paddingVertical: spacing[3],
    minHeight: 44,
  },
});
