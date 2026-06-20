/**
 * RADAR Insights — MonthlyTrendChart (AC7.4)
 *
 * Line chart of total expense per month. Brand-colored line, smooth curve,
 * data-point dots. Optional area fill via expo-linear-gradient.
 *
 * Library: react-native-gifted-charts (v1.4.77) LineChart.
 * Design tokens: brand primary for line, bg tokens for surface.
 */
import React from 'react';
import { View } from 'react-native';
import { LineChart } from 'react-native-gifted-charts';

import { Text } from '@/components/ui/text';
import { formatMoney } from '@/lib/format/money';
import { colors, spacing, typography } from '@/lib/theme';
import type { ChartPoint, Currency } from '@/lib/insights/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MonthlyTrendChartProps {
  data: ChartPoint[];
  currency: Currency;
  testID?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CHART_HEIGHT = 220;

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/**
 * Extract a short month abbreviation from an ISO date string like "2026-04-01".
 */
function bucketToMonthLabel(bucket: string): string {
  const parts = bucket.slice(0, 10).split('-');
  if (parts.length < 2) return bucket;
  const monthIndex = parseInt(parts[1] ?? '1', 10) - 1;
  return MONTHS[monthIndex] ?? parts[1] ?? bucket;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function MonthlyTrendChart({
  data,
  currency,
  testID,
}: MonthlyTrendChartProps): React.JSX.Element | null {
  if (data.length === 0) {
    return null;
  }

  const lineData = data.map((point) => ({
    value: point.total,
    label: bucketToMonthLabel(point.bucket),
    dataPointText: '',
  }));

  const maxValue = Math.max(...data.map((d) => d.total), 1);

  return (
    <View testID={testID}>
      <LineChart
        data={lineData}
        height={CHART_HEIGHT}
        maxValue={maxValue * 1.2}
        color={colors.brand[500]}
        thickness={2}
        dataPointsColor={colors.brand[300]}
        dataPointsRadius={4}
        startFillColor={colors.brand[500]}
        endFillColor={colors.bg[1]}
        startOpacity={0.25}
        endOpacity={0.02}
        areaChart
        curved
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

      {/* Accessible summary */}
      <View
        testID={testID != null ? `${testID}-a11y-summary` : undefined}
        accessibilityLabel={`Tendencia mensual. Total gastos en el período: ${formatMoney(
          data.reduce((s, d) => s + d.total, 0),
          currency,
        )}.`}
        style={{ height: 0, overflow: 'hidden' }}
      />
    </View>
  );
}
