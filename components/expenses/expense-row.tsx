/**
 * Single row in the expenses list.
 */
import React from 'react';
import { Pressable, View } from 'react-native';

import { Icon, Text } from '@/components/ui';
import { formatMoney } from '@/lib/format/money';
import type { ExpenseWithCategory } from '@/lib/repositories/expenses';
import { colors, radii, spacing, typography } from '@/lib/theme';
import type { IconName } from '@/components/ui/icon';

interface ExpenseRowProps {
  expense: ExpenseWithCategory;
  onPress?: (id: string) => void;
}

export function ExpenseRow({ expense, onPress }: ExpenseRowProps): React.JSX.Element {
  const cat = expense.category;
  const iconBg = cat ? `${cat.color}1F` : 'rgba(126,138,160,0.16)';
  const iconColor = cat?.color ?? colors.fg[2];
  const iconName: IconName = (cat?.icon as IconName | undefined) ?? 'CircleDashed';

  return (
    <Pressable
      onPress={() => onPress?.(expense.id)}
      accessibilityRole="button"
      accessibilityLabel={`Gasto ${expense.description ?? cat?.name ?? 'sin descripción'}`}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing[3],
          paddingVertical: spacing[3],
          paddingHorizontal: spacing[1],
          borderBottomWidth: 1,
          borderBottomColor: colors.line[1],
        }}
      >
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: radii.pill,
            backgroundColor: iconBg,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name={iconName} size={20} color={iconColor} />
        </View>
        <View style={{ flex: 1 }}>
          <Text variant="body" color={colors.fg[1]} numberOfLines={1}>
            {expense.description?.trim().length
              ? expense.description
              : (cat?.name ?? 'Sin descripción')}
          </Text>
          <Text variant="caption" color={colors.fg[3]}>
            {cat?.name ?? 'Sin categoría'}
          </Text>
        </View>
        <Text
          variant="money"
          tone="out"
          style={{
            fontFamily: typography.family.semibold,
            fontVariant: ['tabular-nums'],
          }}
        >
          {formatMoney(Number(expense.amount), expense.currency as 'ARS' | 'USD')}
        </Text>
      </View>
    </Pressable>
  );
}
