/**
 * Home screen — RADAR Dashboard (Phase C4)
 *
 * Replaces Expo demo content with the RADAR dashboard per design brief.
 * Content is Spanish rioplatense, voseo, sentence case.
 * All amounts are placeholder zeros — real data wiring is post-scaffold.
 */
import React from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
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
import { supabase } from '@/lib/supabase';
import { colors, motion, radii, spacing, typography } from '@/lib/theme';
import { useSession } from '@/hooks/use-session';
import { useAuthStore } from '@/stores';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface QuickAction {
  label: string;
  iconName: 'Plus' | 'Users' | 'Camera' | 'MoreHorizontal';
  accessibilityLabel: string;
}

interface ExpenseRow {
  iconName: 'UtensilsCrossed' | 'Bus' | 'Coffee' | 'Film';
  name: string;
  meta: string;
  amount: string;
  tone: 'in' | 'out' | 'neutral';
}

// ---------------------------------------------------------------------------
// Data (hardcoded mock)
// ---------------------------------------------------------------------------

const QUICK_ACTIONS: QuickAction[] = [
  { label: 'Agregar', iconName: 'Plus', accessibilityLabel: 'Agregar gasto' },
  { label: 'Grupos', iconName: 'Users', accessibilityLabel: 'Ver grupos' },
  { label: 'Escanear', iconName: 'Camera', accessibilityLabel: 'Escanear comprobante' },
  { label: 'Más', iconName: 'MoreHorizontal', accessibilityLabel: 'Más opciones' },
];

const EXPENSE_ROWS: ExpenseRow[] = [
  {
    iconName: 'UtensilsCrossed',
    name: 'Delivery',
    meta: 'Mercado Pago · hoy 20:14',
    amount: '$ 3.200',
    tone: 'out',
  },
  {
    iconName: 'Bus',
    name: 'SUBE',
    meta: 'Efectivo · hoy 09:30',
    amount: '$ 950',
    tone: 'out',
  },
  {
    iconName: 'Coffee',
    name: 'Café',
    meta: 'Tarjeta · ayer',
    amount: '$ 1.800',
    tone: 'out',
  },
  {
    iconName: 'Film',
    name: 'Netflix',
    meta: 'Wise · hace 3 días',
    amount: 'US$ 5,99',
    tone: 'out',
  },
];

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

function ExpenseRowItem({ row, isLast }: { row: ExpenseRow; isLast: boolean }): React.JSX.Element {
  const iconBgColor =
    row.tone === 'in'
      ? 'rgba(16,185,129,0.15)'
      : row.tone === 'out'
        ? 'rgba(239,68,68,0.10)'
        : 'rgba(255,255,255,0.06)';

  const iconColor =
    row.tone === 'in' ? colors.money.in : row.tone === 'out' ? colors.money.out : colors.fg[3];

  return (
    <View>
      <View style={styles.expenseRow}>
        {/* Category icon */}
        <View style={[styles.expenseIconCircle, { backgroundColor: iconBgColor }]}>
          <Icon name={row.iconName} size={18} color={iconColor} strokeWidth={1.5} />
        </View>

        {/* Name + meta */}
        <View style={styles.expenseDetails}>
          <Body style={styles.expenseName}>{row.name}</Body>
          <Caption color={colors.fg[3]}>{row.meta}</Caption>
        </View>

        {/* Amount */}
        <Text variant="money" tone={row.tone} style={styles.expenseAmount}>
          {row.amount}
        </Text>
      </View>
      {!isLast && <View style={styles.divider} />}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

export default function HomeScreen(): React.JSX.Element {
  const { user } = useSession();

  // Derive display name from email (before the @)
  const displayName = user?.email ? user.email.split('@')[0] : null;

  // Capitalise first letter
  const firstName = displayName ? displayName.charAt(0).toUpperCase() + displayName.slice(1) : null;

  const avatarLetter = firstName ? firstName.charAt(0).toUpperCase() : '?';

  const greeting = firstName ? `Hola, ${firstName}` : 'Hola';

  async function handleSignOut(): Promise<void> {
    await supabase.auth.signOut();
    useAuthStore.getState().reset();
  }

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
            {/* Avatar */}
            <View style={styles.avatar}>
              <Text variant="h3" color={colors.fg.onBrand} style={styles.avatarLetter}>
                {avatarLetter}
              </Text>
            </View>
            {/* Notification bell */}
            <Icon name="Bell" size={24} color={colors.fg[2]} strokeWidth={1.5} />
          </View>
        </View>

        {/* ── Balance card hero ── */}
        <Card variant="raised" padding={6} style={styles.balanceCard}>
          <Label>Este mes</Label>
          <Text variant="display" style={styles.balanceAmount}>
            $ 0,00
          </Text>
          <Caption color={colors.fg[3]} style={styles.balanceUsd}>
            ≈ USD 0
          </Caption>
          <View style={styles.balancePills}>
            <Pill variant="income">↑ $ 0,00</Pill>
            <Pill variant="expense">↓ $ 0,00</Pill>
          </View>
        </Card>

        {/* ── Quick-access row ── */}
        <View style={styles.quickActions}>
          {QUICK_ACTIONS.map((action) => (
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
            <Button variant="ghost" size="sm" onPress={() => {}}>
              Ver todos
            </Button>
          </View>
          <Card variant="base" padding={4}>
            {EXPENSE_ROWS.map((row, index) => (
              <ExpenseRowItem
                key={row.name + row.meta}
                row={row}
                isLast={index === EXPENSE_ROWS.length - 1}
              />
            ))}
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

        {/* ── Sign-out (temporal para testing) ── */}
        <View style={styles.signOutContainer}>
          <Button variant="ghost" size="md" onPress={handleSignOut}>
            Cerrar sesión
          </Button>
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
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.brand[500],
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: {
    lineHeight: 22,
  },

  // Balance card
  balanceCard: {
    marginHorizontal: spacing[5],
    marginBottom: spacing[4],
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

  // Sign-out
  signOutContainer: {
    alignItems: 'center',
    marginTop: spacing[8],
    marginBottom: spacing[8],
  },

  // Platform-specific (unused currently but reserved)
  ...(Platform.OS === 'ios' ? {} : {}),
});
