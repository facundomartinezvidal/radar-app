/**
 * Single row in the incomes list.
 *
 * Renders the category icon, description/category name, and formatted amount
 * in green (income colour). When the income was materialized by a recurrence
 * rule (`source === 'recurrence'`) a small "Recurrente" badge is shown on the
 * subtitle line.
 */
import React from 'react';
import { Pressable, View } from 'react-native';

import { Icon, Text } from '@/components/ui';
import { formatMoney } from '@/lib/format/money';
import type { IncomeWithCategory } from '@/lib/repositories/incomes';
import { colors, radii, spacing, typography } from '@/lib/theme';
import type { IconName } from '@/components/ui/icon';

interface IncomeRowProps {
  income: IncomeWithCategory;
  onPress?: (id: string) => void;
}

export function IncomeRow({ income, onPress }: IncomeRowProps): React.JSX.Element {
  const cat = income.category;
  const iconBg = cat ? `${cat.color}1F` : 'rgba(126,138,160,0.16)';
  const iconColor = cat?.color ?? colors.fg[2];
  const iconName: IconName = (cat?.icon as IconName | undefined) ?? 'CircleDashed';
  const isRecurrent = income.source === 'recurrence';

  return (
    <Pressable
      onPress={() => onPress?.(income.id)}
      accessibilityRole="button"
      accessibilityLabel={`Ingreso ${income.description ?? cat?.name ?? 'sin descripción'}`}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing[3],
          paddingVertical: spacing[3],
          paddingHorizontal: spacing[4],
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
            {income.description?.trim().length
              ? income.description
              : (cat?.name ?? 'Sin descripción')}
          </Text>
          <View
            style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[1], marginTop: 1 }}
          >
            <Text variant="caption" color={colors.fg[3]}>
              {cat?.name ?? 'Sin categoría'}
            </Text>
            {isRecurrent && (
              <View
                style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}
                testID="recurrent-indicator"
              >
                <Text variant="caption" color={colors.fg[3]}>
                  ·
                </Text>
                <Icon name="Repeat" size={12} color={colors.money.in} strokeWidth={1.5} />
                <Text variant="caption" color={colors.money.in}>
                  Recurrente
                </Text>
              </View>
            )}
          </View>
        </View>
        <Text
          variant="money"
          tone="in"
          style={{
            fontFamily: typography.family.semibold,
            fontVariant: ['tabular-nums'],
          }}
        >
          {`+${formatMoney(Number(income.amount), income.currency as 'ARS' | 'USD')}`}
        </Text>
      </View>
    </Pressable>
  );
}
