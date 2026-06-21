/**
 * Insights screen — RADAR (AC9)
 *
 * Orchestrates all analytics components:
 *   - PeriodFilterBar  — period preset chips + month nav
 *   - CurrencyToggle   — ARS / USD selector
 *   - Totals summary   — net, ingresos, gastos for active period + currency
 *   - CategoryDonut    — expense share by category
 *   - PeriodBarChart   — expense bars over time
 *   - IncomeVsExpenseChart — grouped bar comparison
 *   - MonthlyTrendChart — line trend over months
 *   - AiInsightsCard   — AI / heuristic recommendations
 *   - InsightsEmptyState — shown when no movements in the period
 *
 * All data logic lives in hooks/use-insights.ts.
 * This component is purely presentational: wire state → hooks → UI.
 */
import { router } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AiInsightsCard } from '@/components/insights/ai-insights-card';
import { CategoryDonut } from '@/components/insights/category-donut';
import { IncomeVsExpenseChart } from '@/components/insights/income-vs-expense-chart';
import { InsightsEmptyState } from '@/components/insights/insights-empty-state';
import { MonthlyTrendChart } from '@/components/insights/monthly-trend-chart';
import { PeriodBarChart } from '@/components/insights/period-bar-chart';
import { PeriodFilterBar } from '@/components/insights/period-filter-bar';
import { Card, H2, H3, Label, Loader, Pill, Text } from '@/components/ui';
import { CurrencyToggle } from '@/components/expenses/currency-toggle';
import { formatMoney } from '@/lib/format/money';
import { presetPeriod } from '@/lib/insights/periods';
import type { Currency, GenerateInsightsInput, Period } from '@/lib/insights/types';
import {
  useAiInsights,
  useExpenseByCategory,
  useExpenseByPeriod,
  useIncomeByPeriod,
  useTrend,
} from '@/hooks/use-insights';
import { colors, spacing, typography } from '@/lib/theme';

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function InsightsScreen(): React.JSX.Element {
  // ── Filter state ──────────────────────────────────────────────────────────
  const [period, setPeriod] = useState<Period>(() => presetPeriod('this-month'));
  const [currency, setCurrency] = useState<Currency>('ARS');

  // ── Data hooks ───────────────────────────────────────────────────────────
  const byCategoryQuery = useExpenseByCategory(currency, period);
  const expenseBarsQuery = useExpenseByPeriod(currency, period);
  const incomeBarsQuery = useIncomeByPeriod(currency, period);
  const trendQuery = useTrend(currency, period);

  // ── Loading state — any core query still loading ─────────────────────────
  const coreLoading =
    byCategoryQuery.isLoading ||
    expenseBarsQuery.isLoading ||
    incomeBarsQuery.isLoading ||
    trendQuery.isLoading;

  // ── Derived totals ────────────────────────────────────────────────────────
  const expensesTotal = useMemo(
    () => (expenseBarsQuery.data ?? []).reduce((sum, p) => sum + p.total, 0),
    [expenseBarsQuery.data],
  );

  const incomesTotal = useMemo(
    () => (incomeBarsQuery.data ?? []).reduce((sum, p) => sum + p.total, 0),
    [incomeBarsQuery.data],
  );

  const net = incomesTotal - expensesTotal;

  // ── GenerateInsightsInput — null until core data is ready ─────────────────
  const aiInput = useMemo<GenerateInsightsInput | null>(() => {
    if (coreLoading) return null;
    if (expensesTotal === 0 && incomesTotal === 0) return null;

    const byCategory = (byCategoryQuery.data ?? []).map((slice) => ({
      name: slice.name,
      total: slice.total,
      pct: expensesTotal > 0 ? (slice.total / expensesTotal) * 100 : 0,
    }));

    const trend = (trendQuery.data ?? []).map((point) => ({
      bucket: point.bucket,
      expenses: point.expenses,
      incomes: point.incomes,
    }));

    return {
      currency,
      period: { label: period.label, from: period.from, to: period.to },
      totals: { expenses: expensesTotal, incomes: incomesTotal, net },
      byCategory,
      trend,
    };
  }, [
    coreLoading,
    currency,
    period,
    expensesTotal,
    incomesTotal,
    net,
    byCategoryQuery.data,
    trendQuery.data,
  ]);

  const aiQuery = useAiInsights(currency, period, aiInput);

  // ── Empty state ──────────────────────────────────────────────────────────
  const isEmpty = !coreLoading && expensesTotal === 0 && incomesTotal === 0;

  // ── Trend data as ChartPoint[] for MonthlyTrendChart ─────────────────────
  const trendAsChartPoints = useMemo(
    () => (trendQuery.data ?? []).map((p) => ({ bucket: p.bucket, total: p.expenses })),
    [trendQuery.data],
  );

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <H2>Insights</H2>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Filters (always visible) ────────────────────────────────── */}
        <View style={styles.filtersBlock} testID="filters-block">
          <PeriodFilterBar period={period} onChange={setPeriod} />
          <CurrencyToggle value={currency} onChange={setCurrency} />
        </View>

        {/* ── Loading state ───────────────────────────────────────────── */}
        {coreLoading && (
          <View style={styles.loaderWrap} testID="screen-loader">
            <Loader size={24} color={colors.fg[3]} label="Cargando..." />
          </View>
        )}

        {/* ── Empty state ─────────────────────────────────────────────── */}
        {isEmpty && (
          <InsightsEmptyState onAddExpense={() => router.push('/(protected)/expense/new')} />
        )}

        {/* ── Content (only when data exists and not loading) ─────────── */}
        {!coreLoading && !isEmpty && (
          <>
            {/* ── Totals summary ──────────────────────────────────────── */}
            <Card variant="raised" padding={5} style={styles.totalsCard} testID="totals-summary">
              <Label>Balance del período</Label>
              <Text
                variant="display"
                style={[styles.netAmount, { color: net >= 0 ? colors.money.in : colors.money.out }]}
              >
                {formatMoney(net, currency, { showPlus: net > 0 })}
              </Text>
              <View style={styles.totalsPills}>
                <Pill variant="income">{`Ingresos ${formatMoney(incomesTotal, currency)}`}</Pill>
                <Pill variant="expense">{`Gastos ${formatMoney(expensesTotal, currency)}`}</Pill>
              </View>
            </Card>

            {/* ── Gastos por categoría ────────────────────────────────── */}
            {(byCategoryQuery.data ?? []).length > 0 && (
              <View style={styles.section}>
                <H3 style={styles.sectionTitle}>Gastos por categoría</H3>
                <Card variant="base" padding={5} testID="category-donut-card">
                  <CategoryDonut
                    data={byCategoryQuery.data ?? []}
                    currency={currency}
                    testID="category-donut"
                  />
                </Card>
              </View>
            )}

            {/* ── Gastos por período ──────────────────────────────────── */}
            {(expenseBarsQuery.data ?? []).length > 0 && (
              <View style={styles.section}>
                <H3 style={styles.sectionTitle}>Gastos por período</H3>
                <Card variant="base" padding={5} testID="expense-bars-card">
                  <PeriodBarChart
                    data={expenseBarsQuery.data ?? []}
                    currency={currency}
                    testID="expense-bar-chart"
                  />
                </Card>
              </View>
            )}

            {/* ── Ingresos vs gastos ──────────────────────────────────── */}
            {(trendQuery.data ?? []).length > 0 && (
              <View style={styles.section}>
                <H3 style={styles.sectionTitle}>Ingresos vs gastos</H3>
                <Card variant="base" padding={5} testID="income-vs-expense-card">
                  <IncomeVsExpenseChart
                    data={trendQuery.data ?? []}
                    currency={currency}
                    testID="income-vs-expense-chart"
                  />
                </Card>
              </View>
            )}

            {/* ── Tendencia ───────────────────────────────────────────── */}
            {trendAsChartPoints.length > 0 && (
              <View style={styles.section}>
                <H3 style={styles.sectionTitle}>Tendencia</H3>
                <Card variant="base" padding={5} testID="trend-card">
                  <MonthlyTrendChart
                    data={trendAsChartPoints}
                    currency={currency}
                    testID="monthly-trend-chart"
                  />
                </Card>
              </View>
            )}

            {/* ── AI / heuristic recommendations ──────────────────────── */}
            <View style={styles.section} testID="ai-card-section">
              <AiInsightsCard insights={aiQuery.data ?? []} loading={aiQuery.isLoading} />
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.bg[0],
  },
  header: {
    paddingHorizontal: spacing[5],
    paddingTop: spacing[4],
    paddingBottom: spacing[2],
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: spacing[10],
  },

  // Filters
  filtersBlock: {
    paddingHorizontal: spacing[5],
    paddingBottom: spacing[3],
    gap: spacing[3],
  },

  // Loading
  loaderWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing[10],
  },

  // Totals summary
  totalsCard: {
    marginHorizontal: spacing[5],
    marginBottom: spacing[5],
  },
  netAmount: {
    fontVariant: ['tabular-nums'] as const,
    marginTop: spacing[1],
    marginBottom: spacing[3],
  },
  totalsPills: {
    flexDirection: 'row',
    gap: spacing[3],
    flexWrap: 'wrap',
  },

  // Sections
  section: {
    marginBottom: spacing[5],
    paddingHorizontal: spacing[5],
  },
  sectionTitle: {
    marginBottom: spacing[3],
    fontFamily: typography.family.semibold,
  },
});
