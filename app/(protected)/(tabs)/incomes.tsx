/**
 * RADAR — Incomes list / history tab.
 *
 * Shows a compact "Ingresos recurrentes" section above the main day-grouped
 * list of income occurrences. Reuses FilterBar (income categories) and the
 * same groupByDay helper pattern as expenses.tsx.
 */
import { router } from 'expo-router';
import React, { useDeferredValue, useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { IncomeRow } from '@/components/incomes/income-row';
import { FilterBar, type ExpenseFilters } from '@/components/expenses/filter-bar';
import { Body, Button, H1, H3, Icon, Loader, Text } from '@/components/ui';
import { formatMoney } from '@/lib/format/money';
import {
  useIncomes,
  useIncomeTotals,
  useRecurrences,
  type IncomeWithCategory,
  type IncomeRecurrenceWithCategory,
} from '@/hooks/use-incomes';
import { useCategories } from '@/hooks/use-expenses';
import type { IncomeFilter } from '@/lib/schemas/income';
import { colors, radii, spacing, typography } from '@/lib/theme';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface DaySection {
  type: 'header' | 'row';
  /** Header: ISO date string `YYYY-MM-DD`. Row: original income. */
  payload: string | IncomeWithCategory;
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

function groupByDay(rows: IncomeWithCategory[]): DaySection[] {
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

const FREQUENCY_LABELS: Record<string, string> = {
  weekly: 'Semanal',
  biweekly: 'Quincenal',
  monthly: 'Mensual',
  yearly: 'Anual',
};

// ---------------------------------------------------------------------------
// Recurrences section
// ---------------------------------------------------------------------------

interface RecurrencesSectionProps {
  recurrences: IncomeRecurrenceWithCategory[];
}

function RecurrencesSection({ recurrences }: RecurrencesSectionProps): React.JSX.Element {
  const activeRecurrences = recurrences.filter(
    (r) => r.status === 'active' || r.status === 'paused',
  );

  return (
    <View
      style={{
        borderRadius: radii.lg,
        backgroundColor: colors.bg[1],
        borderWidth: 1,
        borderColor: colors.line[1],
        overflow: 'hidden',
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: spacing[4],
          paddingVertical: spacing[3],
          borderBottomWidth: activeRecurrences.length > 0 ? 1 : 0,
          borderBottomColor: colors.line[1],
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[2] }}>
          <Icon name="Repeat" size={16} color={colors.money.in} strokeWidth={1.5} />
          <Text variant="label">Ingresos recurrentes</Text>
        </View>
        <Pressable
          onPress={() =>
            router.push('/(protected)/income/recurrence/new' as Parameters<typeof router.push>[0])
          }
          accessibilityRole="button"
          accessibilityLabel="Agregar ingreso recurrente"
          hitSlop={8}
        >
          <Icon name="Plus" size={18} color={colors.brand[400]} />
        </Pressable>
      </View>

      {activeRecurrences.length === 0 ? (
        <Pressable
          onPress={() =>
            router.push('/(protected)/income/recurrence/new' as Parameters<typeof router.push>[0])
          }
          accessibilityRole="button"
          accessibilityLabel="Crear ingreso recurrente"
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing[2],
              paddingHorizontal: spacing[4],
              paddingVertical: spacing[3],
            }}
          >
            <Icon name="PlusCircle" size={16} color={colors.fg[3]} />
            <Text variant="bodySm" color={colors.fg[3]}>
              Crear ingreso recurrente
            </Text>
          </View>
        </Pressable>
      ) : (
        activeRecurrences.map((r) => (
          <Pressable
            key={r.id}
            onPress={() =>
              router.push(
                `/(protected)/income/recurrence/${r.id}` as Parameters<typeof router.push>[0],
              )
            }
            accessibilityRole="button"
            accessibilityLabel={`Ingreso recurrente ${r.description ?? r.category?.name ?? 'sin descripción'}`}
          >
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing[3],
                paddingHorizontal: spacing[4],
                paddingVertical: spacing[3],
                borderBottomWidth: 1,
                borderBottomColor: colors.line[1],
              }}
            >
              <View style={{ flex: 1 }}>
                <Text variant="bodySm" color={colors.fg[1]} numberOfLines={1}>
                  {r.description?.trim().length
                    ? r.description
                    : (r.category?.name ?? 'Sin descripción')}
                </Text>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: spacing[1],
                    marginTop: 1,
                  }}
                >
                  <Text variant="caption" color={colors.fg[3]}>
                    {FREQUENCY_LABELS[r.frequency] ?? r.frequency}
                  </Text>
                  {r.status === 'paused' && (
                    <>
                      <Text variant="caption" color={colors.fg[3]}>
                        ·
                      </Text>
                      <Text variant="caption" color={colors.amber[500]}>
                        Pausado
                      </Text>
                    </>
                  )}
                  {r.status === 'active' && r.next_run_on && (
                    <>
                      <Text variant="caption" color={colors.fg[3]}>
                        ·
                      </Text>
                      <Text variant="caption" color={colors.fg[3]}>
                        {`Próximo: ${r.next_run_on}`}
                      </Text>
                    </>
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
                {formatMoney(Number(r.amount), r.currency as 'ARS' | 'USD')}
              </Text>
              <Icon name="ChevronRight" size={16} color={colors.fg[4]} strokeWidth={1.5} />
            </View>
          </Pressable>
        ))
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function IncomesTab(): React.JSX.Element {
  const [filters, setFilters] = useState<ExpenseFilters>({
    search: '',
    currencies: [],
    categoryIds: [],
  });
  // Defer search to avoid hammering the network on every keystroke.
  const deferredSearch = useDeferredValue(filters.search);

  const queryFilter: IncomeFilter = useMemo(
    () => ({
      search: deferredSearch.trim() || undefined,
      currencies: filters.currencies.length ? filters.currencies : undefined,
      categoryIds: filters.categoryIds.length ? filters.categoryIds : undefined,
      limit: 100,
    }),
    [deferredSearch, filters.currencies, filters.categoryIds],
  );

  const categoriesQuery = useCategories('income');
  const incomesQuery = useIncomes(queryFilter);
  const totalsQuery = useIncomeTotals({});
  const recurrencesQuery = useRecurrences();

  const sections = useMemo(() => groupByDay(incomesQuery.data ?? []), [incomesQuery.data]);

  const isEmpty = !incomesQuery.isLoading && (incomesQuery.data?.length ?? 0) === 0;

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
            {/* Header */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <H1>Ingresos</H1>
              <Button
                variant="primary"
                size="sm"
                onPress={() =>
                  router.push('/(protected)/income/new' as Parameters<typeof router.push>[0])
                }
                leftIcon={<Icon name="Plus" size={18} color={colors.fg.onBrand} />}
                accessibilityLabel="Registrar ingreso"
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
                      color={colors.money.in}
                      style={{ fontVariant: ['tabular-nums'] }}
                    >
                      {formatMoney(row?.total ?? 0, c)}
                    </Text>
                    <Text variant="caption" color={colors.fg[3]}>
                      {row?.count ?? 0} {row?.count === 1 ? 'ingreso' : 'ingresos'}
                    </Text>
                  </View>
                );
              })}
            </View>

            {/* Recurrences section */}
            <RecurrencesSection recurrences={recurrencesQuery.data ?? []} />

            {/* Filter bar */}
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
          {
            const income = item.payload as IncomeWithCategory;
            return (
              <IncomeRow
                income={income}
                onPress={(id) =>
                  router.push(`/(protected)/income/${id}` as Parameters<typeof router.push>[0])
                }
              />
            );
          }
        }}
        ListEmptyComponent={
          incomesQuery.isLoading ? (
            <View style={{ alignItems: 'center', paddingVertical: spacing[8] }}>
              <Loader size={32} color={colors.fg[2]} strokeWidth={2} label="Cargando ingresos" />
            </View>
          ) : isEmpty ? (
            <View style={{ alignItems: 'center', paddingVertical: spacing[8], gap: spacing[3] }}>
              <Icon name="Inbox" size={48} color={colors.fg[4]} />
              <H3 style={{ textAlign: 'center' }}>No hay ingresos registrados</H3>
              <Body color={colors.fg[3]} style={{ textAlign: 'center' }}>
                Aún no se registraron ingresos.
              </Body>
              <Button
                variant="primary"
                size="md"
                onPress={() =>
                  router.push('/(protected)/income/new' as Parameters<typeof router.push>[0])
                }
                accessibilityLabel="Registrar ingreso"
              >
                Registrar ingreso
              </Button>
            </View>
          ) : null
        }
        refreshControl={
          <RefreshControl
            refreshing={incomesQuery.isRefetching}
            onRefresh={() => {
              void incomesQuery.refetch();
              void totalsQuery.refetch();
              void recurrencesQuery.refetch();
            }}
            tintColor={colors.brand[400]}
          />
        }
      />
    </SafeAreaView>
  );
}
