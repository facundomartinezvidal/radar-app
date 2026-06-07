/**
 * Horizontal scrollable category chips. Single-select.
 * Includes a trailing "+ Categoría" chip to create custom categories inline.
 */
import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, TouchableOpacity, View } from 'react-native';

import { H2, Icon, Text } from '@/components/ui';
import { CategoryForm } from '@/components/categories/category-form';
import { useCreateCategory } from '@/hooks/use-categories';
import type { CategoryRow } from '@/lib/repositories/expenses';
import { colors, radii, shadows, spacing } from '@/lib/theme';
import type { IconName } from '@/components/ui/icon';

interface CategoryPickerProps {
  categories: CategoryRow[];
  value: string | null;
  onChange: (id: string | null) => void;
  disabled?: boolean;
}

export function CategoryPicker({
  categories,
  value,
  onChange,
  disabled = false,
}: CategoryPickerProps): React.JSX.Element {
  const [modalVisible, setModalVisible] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const createMutation = useCreateCategory();

  async function handleCreate(
    values: Parameters<typeof createMutation.mutateAsync>[0],
  ): Promise<void> {
    setServerError(null);
    try {
      const created = await createMutation.mutateAsync(values);
      setModalVisible(false);
      onChange(created.id);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'No se pudo crear la categoría. Intentá nuevamente.';
      setServerError(message);
    }
  }

  return (
    <>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: spacing[2], paddingVertical: spacing[1] }}
      >
        {categories.map((cat) => {
          const selected = cat.id === value;
          return (
            <Pressable
              key={cat.id}
              disabled={disabled}
              onPress={() => onChange(selected ? null : cat.id)}
              accessibilityRole="radio"
              accessibilityState={{ selected, disabled }}
              accessibilityLabel={`Categoría ${cat.name}`}
            >
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing[2],
                  paddingVertical: spacing[2],
                  paddingHorizontal: spacing[3],
                  borderRadius: radii.pill,
                  borderWidth: selected ? 2 : 1,
                  borderColor: selected ? cat.color : colors.line[2],
                  backgroundColor: selected ? `${cat.color}1A` : colors.bg[2],
                  opacity: disabled ? 0.5 : 1,
                }}
              >
                <Icon name={cat.icon as IconName} size={16} color={cat.color} />
                <Text
                  variant="bodySm"
                  color={selected ? colors.fg[1] : colors.fg[2]}
                  style={{ fontWeight: '600' }}
                >
                  {cat.name}
                </Text>
              </View>
            </Pressable>
          );
        })}

        {/* Add category chip */}
        <Pressable
          disabled={disabled}
          onPress={() => {
            setServerError(null);
            setModalVisible(true);
          }}
          accessibilityRole="button"
          accessibilityLabel="Agregar categoría"
          accessibilityState={{ disabled }}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing[2],
              paddingVertical: spacing[2],
              paddingHorizontal: spacing[3],
              borderRadius: radii.pill,
              borderWidth: 1,
              borderColor: colors.line[2],
              backgroundColor: colors.bg[2],
              opacity: disabled ? 0.5 : 1,
            }}
          >
            <Icon name="Plus" size={16} color={colors.fg[2]} />
            <Text variant="bodySm" color={colors.fg[2]} style={{ fontWeight: '600' }}>
              Categoría
            </Text>
          </View>
        </Pressable>
      </ScrollView>

      {/* Inline create category modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setModalVisible(false)}
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
              paddingBottom: spacing[8],
              ...shadows.three,
            }}
          >
            {/* Modal header */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: spacing[5],
              }}
            >
              <H2>Nueva categoría</H2>
              <TouchableOpacity
                onPress={() => setModalVisible(false)}
                hitSlop={12}
                accessibilityRole="button"
                accessibilityLabel="Cerrar"
              >
                <Icon name="X" size={24} color={colors.fg[2]} strokeWidth={1.5} />
              </TouchableOpacity>
            </View>

            <CategoryForm
              onSubmit={handleCreate}
              isSubmitting={createMutation.isPending}
              errorMessage={serverError}
            />
          </View>
        </View>
      </Modal>
    </>
  );
}
