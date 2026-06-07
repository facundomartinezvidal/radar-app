/**
 * Horizontal scrollable category chips. Single-select.
 * Includes a trailing "+ Categoría" chip to create custom categories inline.
 */
import React, { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { Icon, Text } from '@/components/ui';
import { CategoryCreateSheet } from '@/components/categories/category-create-sheet';
import type { CategoryRow } from '@/lib/repositories/expenses';
import { colors, radii, spacing } from '@/lib/theme';
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
          onPress={() => setModalVisible(true)}
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

      <CategoryCreateSheet
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        onCreated={(id) => onChange(id)}
      />
    </>
  );
}
