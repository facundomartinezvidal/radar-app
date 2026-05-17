/**
 * RADAR — Expenses list / history tab.
 *
 * Drives the FilterBar component, debounces search by 250 ms, and renders a
 * day-grouped FlatList. Totals header summarises ARS + USD spend for the
 * current filter window.
 */
import { router } from 'expo-router';
import React, { useDeferredValue, useMemo, useState } from 'react';
import { FlatList, RefreshControl, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ExpenseRow } from '@/components/expenses/expense-row';
import { FilterBar, type ExpenseFilters } from '@/components/expenses/filter-bar';
import { Body, Button, H1, H3, Icon, Text } from '@/components/ui';
import { formatMoney } from '@/lib/format/money';
import { useCategories, useExpenseTotals, useExpenses } from '@/hooks/use-expenses';
import type { ExpenseWithCategory } from '@/lib/repositories/expenses';
import type { ExpenseFilter } from '@/lib/schemas/expense';
import { colors, radii, spacing } from '@/lib/theme';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface DaySection {
  type: 'header' | 'row';
  /** Header: ISO date string `YYYY-MM-DD`. Row: original expense. */
  payload: string | ExpenseWithCategory;
  /** Stable RN key. */
  key: string;
}

function isoDay(ts: string): string {
  return ts.slice(0, 10);
}

function formatDayLabel(iso: string): string {
  const date = new Date(`${iso}T00:00:00`);
  const today = new Date();
  const todayIso = today.toISOString().slice(0, 10);
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const yesterdayIso = yesterday.toISOString().slice(0, 10);
  if (iso === todayIso) return 'Hoy';
  if (iso === yesterdayIso) return 'Ayer';
  try {
    return new Intl.DateTimeFormat('es-AR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    }).format(date);
  } catch {
    return iso;
  }
}

function groupByDay(rows: ExpenseWithCategory[]): DaySection[] {
  const out: DaySection[] = [];
  let currentDay: string | null = null;
  for (const row of rows) {
    const day = isoDay(row.occurred_at);
    if (day !== currentDay) {
      out.push({ type: 'header', payload: day, key: `h-${day}` });
      currentDay = day;
    }
    out.push({ type: 'row', payload: row, key: `r-${row.id}` });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function ExpensesTab(): React.JSX.Element {
  const [filters, setFilters] = useState<ExpenseFilters>({
    search: '',
    currencies: [],
    categoryIds: [],
  });
  // Defer search to avoid hammering the network on every keystroke.
  const deferredSearch = useDeferredValue(filters.search);

  const queryFilter: ExpenseFilter = useMemo(
    () => ({
      search: deferredSearch.trim() || undefined,
      currencies: filters.currencies.length ? filters.currencies : undefined,
      categoryIds: filters.categoryIds.length ? filters.categoryIds : undefined,
      limit: 100,
    }),
    [deferredSearch, filters.currencies, filters.categoryIds],
  );

  const categoriesQuery = useCategories();
  const expensesQuery = useExpenses(queryFilter);
  const totalsQuery = useExpenseTotals({});

  const sections = useMemo(() => groupByDay(expensesQuery.data ?? []), [expensesQuery.data]);

  const isEmpty = !expensesQuery.isLoading && (expensesQuery.data?.length ?? 0) === 0;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg[0] }} edges={['top']}>
      <FlatList
        data={sections}
        keyExtractor={(item) => item.key}
        contentContainerStyle={{
          paddingHorizontal: spacing[5],
          paddingBottom: spacing[10],
          gap: spacing[1],
        }}
        ListHeaderComponent={
          <View style={{ gap: spacing[5], paddingTop: spacing[4], paddingBottom: spacing[4] }}>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <H1>Gastos</H1>
              <Button
                variant="primary"
                size="sm"
                onPress={() => router.push('/(protected)/expense/new')}
                leftIcon={<Icon name="Plus" size={18} color={colors.fg.onBrand} />}
                accessibilityLabel="Registrar gasto"
              >
                Nuevo
              </Button>
            </View>

            {/* Totals strip */}
            <View
              style={{
                flexDirection: 'row',
                gap: spacing[3],
                padding: spacing[4],
                borderRadius: radii.lg,
                backgroundColor: colors.bg[1],
                borderWidth: 1,
                borderColor: colors.line[1],
              }}
            >
              {(['ARS', 'USD'] as const).map((c) => {
                const row = totalsQuery.data?.find((t) => t.currency === c);
                return (
                  <View key={c} style={{ flex: 1, gap: spacing[1] }}>
                    <Text variant="label">Total {c}</Text>
                    <Text
                      variant="h3"
                      color={colors.fg[1]}
                      style={{ fontVariant: ['tabular-nums'] }}
                    >
                      {formatMoney(row?.total ?? 0, c)}
                    </Text>
                    <Text variant="caption" color={colors.fg[3]}>
                      {row?.count ?? 0} {row?.count === 1 ? 'gasto' : 'gastos'}
                    </Text>
                  </View>
                );
              })}
            </View>

            <FilterBar
              categories={categoriesQuery.data ?? []}
              value={filters}
              onChange={setFilters}
            />
          </View>
        }
        renderItem={({ item }) => {
          if (item.type === 'header') {
            return (
              <View style={{ paddingTop: spacing[4], paddingBottom: spacing[2] }}>
                <Text variant="label">{formatDayLabel(item.payload as string)}</Text>
              </View>
            );
          }
          return (
            <ExpenseRow
              expense={item.payload as ExpenseWithCategory}
              onPress={(id) =>
                router.push(`/(protected)/expense/${id}` as Parameters<typeof router.push>[0])
              }
            />
          );
        }}
        ListEmptyComponent={
          isEmpty ? (
            <View style={{ alignItems: 'center', paddingVertical: spacing[8], gap: spacing[3] }}>
              <Icon name="Inbox" size={48} color={colors.fg[4]} />
              <H3 style={{ textAlign: 'center' }}>Sin gastos por acá</H3>
              <Body color={colors.fg[3]} style={{ textAlign: 'center' }}>
                Registrá tu primer gasto y empezá a mover el radar.
              </Body>
              <Button
                variant="primary"
                size="md"
                onPress={() => router.push('/(protected)/expense/new')}
                accessibilityLabel="Registrar gasto"
              >
                Registrar gasto
              </Button>
            </View>
          ) : null
        }
        refreshControl={
          <RefreshControl
            refreshing={expensesQuery.isRefetching}
            onRefresh={() => {
              void expensesQuery.refetch();
              void totalsQuery.refetch();
            }}
            tintColor={colors.brand[400]}
          />
        }
      />
    </SafeAreaView>
  );
}
