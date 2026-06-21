/**
 * RADAR Insights — PeriodBarChart (AC7.2 / HU-24)
 *
 * Expense totals bucketed by period (day / week / month).
 * Thin wrapper around react-native-gifted-charts BarChart.
 * Bars are colored money.out (expense red) from theme.
 *
 * Library: react-native-gifted-charts (v1.4.77)
 * Design tokens: colors from @/lib/theme.
 */
import React from 'react';
import { View } from 'react-native';
import { BarChart } from 'react-native-gifted-charts';

import { Text } from '@/components/ui/text';
import { useChartWidth } from '@/components/insights/chart-width';
import { formatMoney, formatMoneyCompact } from '@/lib/format/money';
import { colors, spacing, typography } from '@/lib/theme';
import type { ChartPoint, Currency } from '@/lib/insights/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PeriodBarChartProps {
  data: ChartPoint[];
  currency: Currency;
  testID?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CHART_HEIGHT = 200;
const BAR_BORDER_RADIUS = 6;
const Y_AXIS_LABEL_WIDTH = 56;

/**
 * Round a value up to a "nice" ceiling (1, 2, 2.5, 5 × 10^k) so gridlines
 * land on round numbers.
 *
 * Examples: 0 → 1, 80_402 → 100_000, 1_751_448 → 2_000_000, 620 → 1_000.
 */
export function niceCeil(value: number): number {
  if (value <= 0) return 1;
  const exp = Math.floor(Math.log10(value));
  const magnitude = Math.pow(10, exp);
  const normalised = value / magnitude;

  let niceFactor: number;
  if (normalised <= 1) {
    niceFactor = 1;
  } else if (normalised <= 2) {
    niceFactor = 2;
  } else if (normalised <= 2.5) {
    niceFactor = 2.5;
  } else if (normalised <= 5) {
    niceFactor = 5;
  } else {
    niceFactor = 10;
  }

  return niceFactor * magnitude;
}

/**
 * Format a bucket string compactly for use as an X-axis label.
 * Expects ISO date prefix like "2026-04-01" or "2026-04".
 * Returns "abr/01", "abr" or the raw string if unrecognised.
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
  const monthAbbr = MONTHS[monthIndex] ?? parts[1] ?? '';

  if (parts.length === 3 && parts[2]) {
    // day bucket: show day/month
    return `${parts[2]}/${monthAbbr}`;
  }
  // month or week bucket: show month abbreviation
  return monthAbbr;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PeriodBarChart({
  data,
  currency,
  testID,
}: PeriodBarChartProps): React.JSX.Element | null {
  const chartWidth = useChartWidth();

  if (data.length === 0) {
    return null;
  }

  const rawMax = Math.max(...data.map((d) => d.total), 0);
  const maxValue = niceCeil(rawMax);

  const barData = data.map((point) => ({
    value: point.total,
    label: formatBucketLabel(point.bucket),
    frontColor: colors.money.out,
    topLabelComponent: () => null,
  }));

  return (
    <View testID={testID}>
      <BarChart
        data={barData}
        height={CHART_HEIGHT}
        width={chartWidth}
        barBorderRadius={BAR_BORDER_RADIUS}
        frontColor={colors.money.out}
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
        maxValue={maxValue}
        noOfSections={4}
        backgroundColor={colors.bg[1]}
        hideRules={false}
        rulesColor={colors.line[1]}
        rulesType="solid"
        adjustToWidth
        isAnimated
      />

      {/* Currency label */}
      <View style={{ marginTop: spacing[2], alignItems: 'flex-end' }}>
        <Text variant="micro" style={{ color: colors.fg[4] }}>
          {currency}
        </Text>
      </View>

      {/* Accessible summary: max bar */}
      <View
        testID={testID != null ? `${testID}-a11y-summary` : undefined}
        accessibilityLabel={`Gráfico de barras. Total mayor: ${formatMoney(Math.max(...data.map((d) => d.total)), currency)}`}
        style={{ height: 0, overflow: 'hidden' }}
      />
    </View>
  );
}
