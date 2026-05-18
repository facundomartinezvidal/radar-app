/**
 * Home screen — RADAR Dashboard (Phase C4)
 *
 * Replaces Expo demo content with the RADAR dashboard per design brief.
 * Content is Spanish rioplatense, voseo, sentence case.
 * All amounts are placeholder zeros — real data wiring is post-scaffold.
 */
import { router } from 'expo-router';
import React from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  Avatar,
  Body,
  BodySm,
  Button,
  Caption,
  Card,
  H2,
  H3,
  Icon,
  Label,
  Pill,
  Text,
} from '@/components/ui';
import { formatMoney } from '@/lib/format/money';
import { colors, motion, radii, spacing, typography } from '@/lib/theme';
import { useExpenseTotals, useExpenses } from '@/hooks/use-expenses';
import { useSession } from '@/hooks/use-session';
import type { IconName } from '@/components/ui/icon';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface QuickAction {
  label: string;
  iconName: 'Plus' | 'Users' | 'Camera' | 'MoreHorizontal';
  accessibilityLabel: string;
  onPress?: () => void;
}

interface ExpenseRow {
  id: string;
  iconName: IconName;
  /** Category color (hex). Drives icon + icon background tint. */
  categoryColor: string;
  name: string;
  meta: string;
  amount: string;
  tone: 'in' | 'out' | 'neutral';
}

// ---------------------------------------------------------------------------
// Data (hardcoded mock)
// ---------------------------------------------------------------------------

// QUICK_ACTIONS now built inside the component so we can wire `onPress` to the
// router. Static keeps the order + icons.
function buildQuickActions(): QuickAction[] {
  return [
    {
      label: 'Agregar',
      iconName: 'Plus',
      accessibilityLabel: 'Agregar gasto',
      onPress: () => router.push('/(protected)/expense/new'),
    },
    {
      label: 'Grupos',
      iconName: 'Users',
      accessibilityLabel: 'Ver grupos',
    },
    {
      label: 'Escanear',
      iconName: 'Camera',
      accessibilityLabel: 'Escanear comprobante',
    },
    {
      label: 'Más',
      iconName: 'MoreHorizontal',
      accessibilityLabel: 'Más opciones',
    },
  ];
}

function relativeTime(occurredAt: string): string {
  const now = Date.now();
  const then = new Date(occurredAt).getTime();
  const diffMin = Math.floor((now - then) / 60_000);
  if (diffMin < 60) return diffMin <= 1 ? 'recién' : `hace ${diffMin}m`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `hace ${diffHr}h`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay === 1) return 'ayer';
  if (diffDay < 7) return `hace ${diffDay} días`;
  try {
    return new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: 'short' }).format(
      new Date(occurredAt),
    );
  } catch {
    return occurredAt.slice(0, 10);
  }
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function QuickActionButton({ action }: { action: QuickAction }): React.JSX.Element {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  function handlePressIn(): void {
    scale.value = withTiming(0.95, { duration: motion.dur[1] });
  }

  function handlePressOut(): void {
    scale.value = withTiming(1, { duration: motion.dur[1] });
  }

  return (
    <Pressable
      onPress={action.onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      accessibilityRole="button"
      accessibilityLabel={action.accessibilityLabel}
    >
      <Animated.View style={[styles.quickActionInner, animatedStyle]}>
        <Icon name={action.iconName} size={24} color={colors.fg[1]} strokeWidth={1.5} />
        <Caption style={styles.quickActionLabel}>{action.label}</Caption>
      </Animated.View>
    </Pressable>
  );
}

function ExpenseRowItem({
  row,
  isLast,
  onPress,
}: {
  row: ExpenseRow;
  isLast: boolean;
  onPress?: (id: string) => void;
}): React.JSX.Element {
  // Use category color for icon + tinted background. `1F` ≈ 12% alpha.
  const iconBgColor = `${row.categoryColor}1F`;
  const iconColor = row.categoryColor;

  return (
    <Pressable
      onPress={() => onPress?.(row.id)}
      accessibilityRole="button"
      accessibilityLabel={`Editar ${row.name}`}
    >
      <View style={styles.expenseRow}>
        <View style={[styles.expenseIconCircle, { backgroundColor: iconBgColor }]}>
          <Icon name={row.iconName} size={18} color={iconColor} strokeWidth={1.5} />
        </View>
        <View style={styles.expenseDetails}>
          <Body style={styles.expenseName} numberOfLines={1}>
            {row.name}
          </Body>
          <Caption color={colors.fg[3]} numberOfLines={1}>
            {row.meta}
          </Caption>
        </View>
        <Text variant="money" tone={row.tone} style={styles.expenseAmount}>
          {row.amount}
        </Text>
      </View>
      {!isLast && <View style={styles.divider} />}
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

export default function HomeScreen(): React.JSX.Element {
  const { user } = useSession();
  const totalsQuery = useExpenseTotals({});
  const recentQuery = useExpenses({ limit: 4 });

  const arsTotal = totalsQuery.data?.find((t) => t.currency === 'ARS')?.total ?? 0;
  const usdTotal = totalsQuery.data?.find((t) => t.currency === 'USD')?.total ?? 0;

  const recentRows: ExpenseRow[] = (recentQuery.data ?? []).map((e) => ({
    id: e.id,
    iconName: (e.category?.icon as IconName | undefined) ?? 'CircleDashed',
    categoryColor: e.category?.color ?? colors.fg[3],
    name: e.description?.trim().length ? e.description : (e.category?.name ?? 'Gasto'),
    meta: `${e.category?.name ?? 'Sin categoría'} · ${relativeTime(e.occurred_at)}`,
    amount: formatMoney(Number(e.amount), e.currency as 'ARS' | 'USD'),
    tone: 'out',
  }));

  const quickActions = React.useMemo(() => buildQuickActions(), []);

  const md = user?.user_metadata ?? {};
  const firstName =
    typeof md.first_name === 'string' && md.first_name.trim().length > 0
      ? md.first_name.trim()
      : null;
  const lastName =
    typeof md.last_name === 'string' && md.last_name.trim().length > 0 ? md.last_name.trim() : null;
  const greeting = firstName ? `Hola, ${firstName}` : 'Hola';

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header row ── */}
        <View style={styles.header}>
          <H2 style={styles.greeting}>{greeting}</H2>
          <View style={styles.headerRight}>
            {/* Avatar — tap to open Perfil */}
            <Pressable
              onPress={() => router.push('/(protected)/profile')}
              accessibilityRole="button"
              accessibilityLabel="Abrir perfil"
            >
              <Avatar firstName={firstName} lastName={lastName} size={36} />
            </Pressable>
            {/* Notification bell */}
            <Icon name="Bell" size={24} color={colors.fg[2]} strokeWidth={1.5} />
          </View>
        </View>

        {/* ── Balance card hero ── */}
        <Card variant="raised" padding={6} style={styles.balanceCard}>
          <Label>Este mes</Label>
          <Text variant="display" style={styles.balanceAmount}>
            {formatMoney(arsTotal, 'ARS')}
          </Text>
          <Caption color={colors.fg[3]} style={styles.balanceUsd}>
            + {formatMoney(usdTotal, 'USD')}
          </Caption>
          <View style={styles.balancePills}>
            <Pill variant="expense">
              {recentQuery.data?.length ?? 0} {recentQuery.data?.length === 1 ? 'gasto' : 'gastos'}
            </Pill>
          </View>
        </Card>

        {/* ── Quick-access row ── */}
        <View style={styles.quickActions}>
          {quickActions.map((action) => (
            <QuickActionButton key={action.label} action={action} />
          ))}
        </View>

        {/* ── Mis grupos ── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <H3>Mis grupos</H3>
            <Button variant="ghost" size="sm" onPress={() => {}}>
              Ver todos
            </Button>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.groupsRow}
          >
            <Pill variant="income">Depto · Te deben $ 4.200</Pill>
            <Pill variant="expense">Bariloche · Debés $ 12.600</Pill>
            <Pill variant="neutral">Super · Al día</Pill>
          </ScrollView>
        </View>

        {/* ── Últimos gastos ── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <H3>Últimos gastos</H3>
            <Button
              variant="ghost"
              size="sm"
              onPress={() => router.push('/(protected)/(tabs)/expenses')}
            >
              Ver todos
            </Button>
          </View>
          <Card variant="base" padding={4} style={styles.recentCard}>
            {recentRows.length === 0 ? (
              <View style={{ paddingVertical: spacing[4], alignItems: 'center' }}>
                <Body color={colors.fg[3]} style={{ textAlign: 'center' }}>
                  Todavía no cargaste nada este mes.
                </Body>
              </View>
            ) : (
              recentRows.map((row, index) => (
                <ExpenseRowItem
                  key={row.id}
                  row={row}
                  isLast={index === recentRows.length - 1}
                  onPress={(id) =>
                    router.push(`/(protected)/expense/${id}` as Parameters<typeof router.push>[0])
                  }
                />
              ))
            )}
          </Card>
        </View>

        {/* ── Insight IA ── */}
        <View style={styles.section}>
          <Pressable
            style={styles.insightCard}
            accessibilityRole="button"
            accessibilityLabel="Ver insight de gastos"
          >
            <Icon name="Sparkles" size={20} color={colors.brand[300]} strokeWidth={1.5} />
            <BodySm style={styles.insightText}>
              Este mes gastaste 18% más en delivery que el mes pasado.
            </BodySm>
            <Icon name="ChevronRight" size={18} color={colors.fg[3]} strokeWidth={1.5} />
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const QUICK_ACTION_SIZE = 72;

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.bg[0],
  },
  scrollView: {
    flex: 1,
    backgroundColor: colors.bg[0],
  },
  scrollContent: {
    paddingBottom: spacing[8],
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[5],
    paddingTop: spacing[4],
    paddingBottom: spacing[3],
  },
  greeting: {
    flex: 1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  // Balance card
  balanceCard: {
    marginHorizontal: spacing[5],
    marginBottom: spacing[4],
  },
  recentCard: {
    marginHorizontal: spacing[5],
  },
  balanceAmount: {
    fontVariant: ['tabular-nums'] as const,
    marginTop: spacing[1],
  },
  balanceUsd: {
    marginTop: spacing[1],
  },
  balancePills: {
    flexDirection: 'row',
    gap: spacing[3],
    marginTop: spacing[3],
  },

  // Quick actions
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[5],
    marginBottom: spacing[5],
  },
  quickActionInner: {
    width: QUICK_ACTION_SIZE,
    height: QUICK_ACTION_SIZE,
    backgroundColor: colors.bg[1],
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.line[1],
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[1],
  },
  quickActionLabel: {
    fontSize: 11,
    color: colors.fg[2],
    textAlign: 'center',
  },

  // Sections
  section: {
    marginBottom: spacing[5],
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[5],
    marginBottom: spacing[3],
  },
  groupsRow: {
    flexDirection: 'row',
    gap: spacing[3],
    paddingHorizontal: spacing[5],
  },

  // Expense rows
  expenseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing[3],
    gap: spacing[3],
  },
  expenseIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  expenseDetails: {
    flex: 1,
  },
  expenseName: {
    fontFamily: typography.family.medium,
  },
  expenseAmount: {
    fontFamily: typography.family.semibold,
  },
  divider: {
    height: 1,
    backgroundColor: colors.line[1],
  },

  // Insight card
  insightCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    marginHorizontal: spacing[5],
    backgroundColor: 'rgba(0,119,182,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(0,119,182,0.20)',
    borderRadius: radii.md,
    padding: spacing[4],
  },
  insightText: {
    flex: 1,
    color: colors.fg[2],
  },

  // Platform-specific (unused currently but reserved)
  ...(Platform.OS === 'ios' ? {} : {}),
});
