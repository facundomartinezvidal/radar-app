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
import { formatMoney } from '@/lib/format/money';
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
const BAR_WIDTH = 28;
const BAR_BORDER_RADIUS = 6;

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
  if (data.length === 0) {
    return null;
  }

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
        barWidth={BAR_WIDTH}
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
        noOfSections={4}
        backgroundColor={colors.bg[1]}
        hideRules={false}
        rulesColor={colors.line[1]}
        rulesType="solid"
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
