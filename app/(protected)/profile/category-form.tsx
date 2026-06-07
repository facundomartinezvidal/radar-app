/**
 * RADAR — Category form screen (Perfil stack)
 *
 * Create mode: no `id` param → new category.
 * Edit mode:   `id` param → find existing category → pre-populate form.
 *
 * Pattern mirrors edit-name.tsx.
 */
import { router, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { H1, Icon } from '@/components/ui';
import type { IconName } from '@/components/ui/icon';
import { CategoryForm } from '@/components/categories/category-form';
import { useCreateCategory, useUpdateCategory } from '@/hooks/use-categories';
import { useCategories } from '@/hooks/use-expenses';
import type { CreateCategoryInput } from '@/lib/schemas/category';
import { colors, spacing } from '@/lib/theme';

export default function CategoryFormScreen(): React.JSX.Element {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const isEditMode = id != null && id.length > 0;

  const { data: allCategories } = useCategories();
  const createMutation = useCreateCategory();
  const updateMutation = useUpdateCategory();

  const [serverError, setServerError] = useState<string | null>(null);

  const existingCategory = isEditMode ? (allCategories ?? []).find((c) => c.id === id) : undefined;

  const initial =
    existingCategory != null
      ? {
          name: existingCategory.name,
          icon: existingCategory.icon as IconName,
          color: existingCategory.color,
        }
      : undefined;

  const title = isEditMode ? 'Editar categoría' : 'Nueva categoría';
  const submitLabel = isEditMode ? 'Guardar cambios' : 'Crear categoría';
  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  async function handleSubmit(values: CreateCategoryInput): Promise<void> {
    setServerError(null);
    try {
      if (isEditMode && id != null) {
        await updateMutation.mutateAsync({ id, patch: values });
      } else {
        await createMutation.mutateAsync(values);
      }
      router.back();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'No se pudo guardar la categoría. Intentá nuevamente.';
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
            <H1>{title}</H1>
          </View>

          {/* Form */}
          <CategoryForm
            initial={initial}
            onSubmit={handleSubmit}
            submitLabel={submitLabel}
            isSubmitting={isSubmitting}
            errorMessage={serverError}
          />

          {/* Bottom spacing */}
          <View style={{ height: spacing[8] }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
