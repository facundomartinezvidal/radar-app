/**
 * Compact trigger + searchable bottom-sheet category selector.
 * Tapping the trigger opens CategorySelectorSheet, which handles
 * create/edit/delete of custom categories inline.
 */
import React, { useState } from 'react';
import { Pressable, View } from 'react-native';

import { Icon, Text } from '@/components/ui';
import { CategorySelectorSheet } from '@/components/categories/category-selector-sheet';
import type { CategoryRow } from '@/lib/repositories/expenses';
import type { IconName } from '@/components/ui/icon';
import { colors, radii, spacing } from '@/lib/theme';

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
  const [sheetVisible, setSheetVisible] = useState(false);

  const selectedCategory = value !== null ? (categories.find((c) => c.id === value) ?? null) : null;

  return (
    <>
      <Pressable
        onPress={() => {
          if (!disabled) setSheetVisible(true);
        }}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel="Elegir categoría"
        accessibilityState={{ disabled }}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          minHeight: 44,
          paddingVertical: spacing[3],
          paddingHorizontal: spacing[4],
          borderRadius: radii.md,
          borderWidth: 1,
          borderColor: colors.line[2],
          backgroundColor: pressed && !disabled ? colors.bg[3] : colors.bg[2],
          opacity: disabled ? 0.5 : 1,
        })}
      >
        {selectedCategory !== null ? (
          /* Selected category chip */
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[2], flex: 1 }}>
            <View
              style={{
                width: 28,
                height: 28,
                borderRadius: radii.pill,
                backgroundColor: `${selectedCategory.color}1A`,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icon
                name={selectedCategory.icon as IconName}
                size={16}
                color={selectedCategory.color}
                strokeWidth={1.5}
              />
            </View>
            <Text variant="bodySm" color={colors.fg[1]} style={{ fontWeight: '600' }}>
              {selectedCategory.name}
            </Text>
          </View>
        ) : (
          /* Placeholder */
          <Text variant="bodySm" color={colors.fg[3]} style={{ flex: 1 }}>
            Elegir categoría
          </Text>
        )}

        <Icon name="ChevronDown" size={18} color={colors.fg[3]} strokeWidth={1.5} />
      </Pressable>

      <CategorySelectorSheet
        visible={sheetVisible}
        categories={categories}
        value={value}
        onClose={() => setSheetVisible(false)}
        onSelect={(id) => {
          onChange(id);
          setSheetVisible(false);
        }}
      />
    </>
  );
}
