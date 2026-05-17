/**
 * FilterBar — search box + currency toggle + category multi-select chips.
 * Lifts state up to the parent screen.
 */
import React, { useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';

import { Icon, Text } from '@/components/ui';
import type { CategoryRow } from '@/lib/repositories/expenses';
import type { Currency } from '@/lib/schemas/expense';
import { colors, radii, spacing, typography } from '@/lib/theme';
import type { IconName } from '@/components/ui/icon';

export interface ExpenseFilters {
  search: string;
  currencies: Currency[];
  categoryIds: string[];
}

interface FilterBarProps {
  categories: CategoryRow[];
  value: ExpenseFilters;
  onChange: (next: ExpenseFilters) => void;
}

const CURRENCIES: Currency[] = ['ARS', 'USD'];

export function FilterBar({ categories, value, onChange }: FilterBarProps): React.JSX.Element {
  const [searchFocused, setSearchFocused] = useState(false);

  function toggleCurrency(c: Currency): void {
    const next = value.currencies.includes(c)
      ? value.currencies.filter((x) => x !== c)
      : [...value.currencies, c];
    onChange({ ...value, currencies: next });
  }

  function toggleCategory(id: string): void {
    const next = value.categoryIds.includes(id)
      ? value.categoryIds.filter((x) => x !== id)
      : [...value.categoryIds, id];
    onChange({ ...value, categoryIds: next });
  }

  return (
    <View style={{ gap: spacing[3] }}>
      {/* Search */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing[2],
          backgroundColor: colors.bg[2],
          borderRadius: radii.md,
          borderWidth: searchFocused ? 2 : 1,
          borderColor: searchFocused ? colors.brand[400] : colors.line[2],
          paddingHorizontal: spacing[3],
          paddingVertical: spacing[2],
          minHeight: 44,
        }}
      >
        <Icon name="Search" size={18} color={colors.fg[3]} />
        <TextInput
          value={value.search}
          onChangeText={(t) => onChange({ ...value, search: t })}
          onFocus={() => setSearchFocused(true)}
          onBlur={() => setSearchFocused(false)}
          placeholder="Buscar por descripción"
          placeholderTextColor={colors.fg[4]}
          autoCapitalize="none"
          accessibilityLabel="Buscar"
          style={{
            flex: 1,
            color: colors.fg[1],
            fontFamily: typography.family.regular,
            fontSize: typography.size.body,
            padding: 0,
          }}
        />
        {value.search.length > 0 && (
          <Pressable
            onPress={() => onChange({ ...value, search: '' })}
            accessibilityLabel="Limpiar búsqueda"
            hitSlop={8}
          >
            <Icon name="X" size={16} color={colors.fg[3]} />
          </Pressable>
        )}
      </View>

      {/* Currency chips */}
      <View style={{ flexDirection: 'row', gap: spacing[2] }}>
        {CURRENCIES.map((c) => {
          const active = value.currencies.includes(c);
          const color = c === 'USD' ? colors.money.in : colors.brand[400];
          return (
            <Pressable
              key={c}
              onPress={() => toggleCurrency(c)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: active }}
              accessibilityLabel={`Filtrar ${c}`}
            >
              <View
                style={{
                  paddingVertical: spacing[1],
                  paddingHorizontal: spacing[3],
                  borderRadius: radii.pill,
                  borderWidth: active ? 2 : 1,
                  borderColor: active ? color : colors.line[2],
                  backgroundColor: active ? `${color}1A` : 'transparent',
                }}
              >
                <Text
                  variant="caption"
                  color={active ? color : colors.fg[2]}
                  style={{ fontWeight: '700' }}
                >
                  {c}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>

      {/* Categories scroll */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: spacing[2], paddingVertical: spacing[1] }}
      >
        {categories.map((cat) => {
          const selected = value.categoryIds.includes(cat.id);
          return (
            <Pressable
              key={cat.id}
              onPress={() => toggleCategory(cat.id)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: selected }}
              accessibilityLabel={`Filtrar categoría ${cat.name}`}
            >
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing[2],
                  paddingVertical: spacing[1],
                  paddingHorizontal: spacing[3],
                  borderRadius: radii.pill,
                  borderWidth: selected ? 2 : 1,
                  borderColor: selected ? cat.color : colors.line[2],
                  backgroundColor: selected ? `${cat.color}1A` : colors.bg[2],
                }}
              >
                <Icon name={cat.icon as IconName} size={14} color={cat.color} />
                <Text
                  variant="caption"
                  color={selected ? colors.fg[1] : colors.fg[2]}
                  style={{ fontWeight: '600' }}
                >
                  {cat.name}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}
