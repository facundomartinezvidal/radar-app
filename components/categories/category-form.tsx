/**
 * RADAR — CategoryForm
 *
 * Reusable create/edit form for custom categories.
 * Drives react-hook-form + zod. Shows a live preview chip.
 */
import { zodResolver } from '@hookform/resolvers/zod';
import React from 'react';
import { Controller, useForm } from 'react-hook-form';
import { View } from 'react-native';

import { Body, BodySm, Button, Icon, Input, Text } from '@/components/ui';
import type { IconName } from '@/components/ui/icon';
import { CATEGORY_COLORS, CATEGORY_ICONS } from '@/lib/category-options';
import { createCategorySchema, type CreateCategoryInput } from '@/lib/schemas/category';
import { colors, radii, spacing } from '@/lib/theme';

import { CategoryColorPicker } from './category-color-picker';
import { CategoryIconPicker } from './category-icon-picker';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CategoryFormProps {
  initial?: { name: string; icon: IconName; color: string };
  /** Prefill name only (e.g. OCR suggestion) when no initial is provided. */
  defaultName?: string;
  onSubmit: (values: CreateCategoryInput) => void | Promise<void>;
  /** Button label. Defaults to 'Crear categoría'. */
  submitLabel?: string;
  isSubmitting?: boolean;
  /** Server-side error (e.g. duplicate name). Shown below the form. */
  errorMessage?: string | null;
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
  const label = name.trim().length > 0 ? name.trim() : 'Categoría';
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

export function CategoryForm({
  initial,
  defaultName,
  onSubmit,
  submitLabel = 'Crear categoría',
  isSubmitting = false,
  errorMessage = null,
}: CategoryFormProps): React.JSX.Element {
  const {
    control,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<CreateCategoryInput>({
    resolver: zodResolver(createCategorySchema),
    defaultValues: {
      name: initial?.name ?? defaultName ?? '',
      icon: (initial?.icon ?? CATEGORY_ICONS[0]) as (typeof CATEGORY_ICONS)[number],
      color: (initial?.color ?? CATEGORY_COLORS[0]) as (typeof CATEGORY_COLORS)[number],
    },
  });

  const watchedName = watch('name');
  const watchedIcon = watch('icon');
  const watchedColor = watch('color');

  const submit = handleSubmit(async (data) => {
    await onSubmit(data);
  });

  return (
    <View style={{ gap: spacing[4] }}>
      {/* Name */}
      <Controller
        control={control}
        name="name"
        render={({ field: { onChange, onBlur, value } }) => (
          <Input
            label="Nombre"
            placeholder="Nombre de la categoría"
            value={value}
            onChangeText={onChange}
            onBlur={onBlur}
            maxLength={40}
            editable={!isSubmitting}
            error={errors.name?.message}
          />
        )}
      />

      {/* Color */}
      <View style={{ gap: spacing[2] }}>
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
      <View style={{ gap: spacing[2] }}>
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
      <View style={{ gap: spacing[2] }}>
        <BodySm color={colors.fg[3]}>Vista previa</BodySm>
        <PreviewChip name={watchedName} icon={watchedIcon as IconName} color={watchedColor} />
      </View>

      {/* Server error */}
      {errorMessage != null && errorMessage.length > 0 && (
        <Body style={{ color: colors.money.out }}>{errorMessage}</Body>
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
