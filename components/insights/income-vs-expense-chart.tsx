/**
 * RADAR Insights — IncomeVsExpenseChart (AC7.3)
 *
 * Side-by-side grouped bar chart comparing income (green) vs expense (red)
 * per time bucket. Built with react-native-gifted-charts grouped BarChart.
 *
 * Library: react-native-gifted-charts (v1.4.77)
 * Design tokens: colors.money.in (income) + colors.money.out (expense).
 */
import React from 'react';
import { View } from 'react-native';
import { BarChart } from 'react-native-gifted-charts';

import { Text } from '@/components/ui/text';
import { useChartWidth } from '@/components/insights/chart-width';
import { formatMoney, formatMoneyCompact } from '@/lib/format/money';
import { niceCeil } from '@/components/insights/period-bar-chart';
import { colors, spacing, typography } from '@/lib/theme';
import type { Currency } from '@/lib/insights/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface IncomeVsExpenseDataPoint {
  bucket: string;
  expenses: number;
  incomes: number;
}

export interface IncomeVsExpenseChartProps {
  data: IncomeVsExpenseDataPoint[];
  currency: Currency;
  testID?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CHART_HEIGHT = 200;
const BAR_WIDTH = 16;
const BAR_BORDER_RADIUS = 4;
const BAR_SPACING = 2;
const GROUP_SPACING = 16;
const Y_AXIS_LABEL_WIDTH = 56;

/**
 * Format a bucket string to a short month label.
 */
function formatBucketLabel(bucket: string): string {
  const parts = bucket.slice(0, 10).split('-');
  if (parts.length < 2) return bucket;

  const monthIndex = parseInt(parts[1] ?? '1', 10) - 1;
  const MONTHS = [
    'ene',
    'feb',
    'mar',
    'abr',
    'may',
    'jun',
    'jul',
    'ago',
    'sep',
    'oct',
    'nov',
    'dic',
  ];
  return MONTHS[monthIndex] ?? parts[1] ?? bucket;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function IncomeVsExpenseChart({
  data,
  currency,
  testID,
}: IncomeVsExpenseChartProps): React.JSX.Element | null {
  const chartWidth = useChartWidth();

  if (data.length === 0) {
    return null;
  }

  // gifted-charts grouped bars: interleave income + expense bars per bucket.
  // Each "group" is two bars. The label is shown on the first bar of the pair.
  const barData = data.flatMap((point, idx) => [
    {
      value: point.incomes,
      label: idx === 0 || idx % 1 === 0 ? formatBucketLabel(point.bucket) : '',
      frontColor: colors.money.in,
      spacing: BAR_SPACING,
    },
    {
      value: point.expenses,
      label: '',
      frontColor: colors.money.out,
      spacing: GROUP_SPACING,
    },
  ]);

  const rawMax = Math.max(...data.flatMap((d) => [d.incomes, d.expenses]), 0);
  const maxValue = niceCeil(rawMax);

  return (
    <View testID={testID}>
      <BarChart
        data={barData}
        height={CHART_HEIGHT}
        width={chartWidth}
        barWidth={BAR_WIDTH}
        barBorderRadius={BAR_BORDER_RADIUS}
        maxValue={maxValue}
        xAxisColor={colors.line[2]}
        yAxisColor={colors.line[2]}
        xAxisLabelTextStyle={{
          color: colors.fg[3],
          fontSize: typography.size.micro,
          fontFamily: typography.family.regular,
        }}
        yAxisTextStyle={{
          color: colors.fg[3],
          fontSize: typography.size.micro,
          fontFamily: typography.family.regular,
        }}
        yAxisLabelWidth={Y_AXIS_LABEL_WIDTH}
        formatYLabel={(v) => formatMoneyCompact(Number(v), currency)}
        noOfSections={4}
        backgroundColor={colors.bg[1]}
        rulesColor={colors.line[1]}
        rulesType="solid"
        adjustToWidth
        isAnimated
      />

      {/* Legend */}
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'center',
          gap: spacing[5],
          marginTop: spacing[3],
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[2] }}>
          <View
            style={{
              width: 10,
              height: 10,
              borderRadius: 3,
              backgroundColor: colors.money.in,
            }}
          />
          <Text variant="caption" style={{ color: colors.fg[2] }}>
            Ingresos
          </Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[2] }}>
          <View
            style={{
              width: 10,
              height: 10,
              borderRadius: 3,
              backgroundColor: colors.money.out,
            }}
          />
          <Text variant="caption" style={{ color: colors.fg[2] }}>
            Gastos
          </Text>
        </View>
      </View>

      {/* Accessible summary */}
      <View
        testID={testID != null ? `${testID}-a11y-summary` : undefined}
        accessibilityLabel={`Comparación ingresos vs gastos. Total ingresos: ${formatMoney(
          data.reduce((s, d) => s + d.incomes, 0),
          currency,
        )}. Total gastos: ${formatMoney(
          data.reduce((s, d) => s + d.expenses, 0),
          currency,
        )}.`}
        style={{ height: 0, overflow: 'hidden' }}
      />
    </View>
  );
}
