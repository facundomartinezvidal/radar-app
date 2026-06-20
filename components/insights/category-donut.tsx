/**
 * RADAR Insights — CategoryDonut (AC7.1)
 *
 * Presentational donut chart showing expense totals grouped by category.
 * Data is pre-shaped by the hook layer — no fetching here.
 *
 * Library: react-native-gifted-charts (v1.4.77) PieChart in donut mode.
 * Design tokens: colors from @/lib/theme, amounts via formatMoney.
 */
import React from 'react';
import { View } from 'react-native';
import { PieChart } from 'react-native-gifted-charts';

import { Text } from '@/components/ui/text';
import { formatMoney } from '@/lib/format/money';
import { colors, spacing, typography } from '@/lib/theme';
import type { CategorySlice, Currency } from '@/lib/insights/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CategoryDonutProps {
  data: CategorySlice[];
  currency: Currency;
  testID?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const FALLBACK_COLOR = '#888888';
const DONUT_RADIUS = 80;
const DONUT_INNER_RADIUS = 54;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CategoryDonut({
  data,
  currency,
  testID,
}: CategoryDonutProps): React.JSX.Element | null {
  if (data.length === 0) {
    return null;
  }

  const total = data.reduce((sum, slice) => sum + slice.total, 0);

  const pieData = data.map((slice) => ({
    value: slice.total,
    color: slice.color || FALLBACK_COLOR,
    text: slice.name,
  }));

  return (
    <View testID={testID}>
      {/* Donut chart */}
      <View style={{ alignItems: 'center', justifyContent: 'center' }}>
        <PieChart
          data={pieData}
          donut
          radius={DONUT_RADIUS}
          innerRadius={DONUT_INNER_RADIUS}
          innerCircleColor={colors.bg[1]}
          centerLabelComponent={() => (
            <View style={{ alignItems: 'center', justifyContent: 'center' }}>
              <Text
                variant="bodySm"
                style={{
                  color: colors.fg[1],
                  fontVariant: ['tabular-nums'],
                  textAlign: 'center',
                  fontSize: 11,
                }}
                numberOfLines={2}
              >
                {formatMoney(total, currency)}
              </Text>
              <Text variant="micro" style={{ color: colors.fg[3], textAlign: 'center' }}>
                gastado
              </Text>
            </View>
          )}
        />
      </View>

      {/* Legend */}
      <View
        style={{
          marginTop: spacing[4],
          gap: spacing[2],
        }}
      >
        {data.map((slice) => {
          const pct = total > 0 ? ((slice.total / total) * 100).toFixed(1) : '0.0';
          return (
            <View
              key={slice.categoryId ?? 'uncategorized'}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingVertical: spacing[1],
              }}
            >
              {/* Color dot + name */}
              <View
                style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: spacing[2] }}
              >
                <View
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 5,
                    backgroundColor: slice.color || FALLBACK_COLOR,
                  }}
                />
                <Text variant="bodySm" style={{ color: colors.fg[2], flex: 1 }} numberOfLines={1}>
                  {slice.name}
                </Text>
              </View>

              {/* Percentage + amount */}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[3] }}>
                <Text
                  variant="caption"
                  style={{ color: colors.fg[3], minWidth: 40, textAlign: 'right' }}
                >
                  {pct}%
                </Text>
                <Text
                  variant="bodySm"
                  style={{
                    color: colors.fg[1],
                    fontFamily: typography.family.semibold,
                    fontVariant: ['tabular-nums'],
                    minWidth: 90,
                    textAlign: 'right',
                  }}
                >
                  {formatMoney(slice.total, currency)}
                </Text>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}
