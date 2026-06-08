/**
 * RADAR — Group detail screen
 *
 * Shows group info, member avatars, and either the Gastos list (expenses)
 * or the Saldos view (balances + settlement) depending on the active tab.
 * The ··· menu offers only "Eliminar" for now (edit deferred to a later atomic).
 * An "Agregar miembro" button opens the MemberSelectorSheet.
 */
import { router, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BalanceRow } from '@/components/groups/balance-row';
import { MemberAvatarsRow } from '@/components/groups/member-avatars-row';
import { MemberSelectorSheet } from '@/components/groups/member-selector-sheet';
import { ExpenseRow } from '@/components/expenses/expense-row';
import { Body, Button, Card, Caption, H2, H3, Icon, Loader, Money, Pill } from '@/components/ui';
import type { IconName } from '@/components/ui/icon';
import {
  useDeleteGroup,
  useGroup,
  useGroupBalances,
  useGroupExpenses,
  useCreateSettlement,
} from '@/hooks/use-groups';
import type { GroupExpense, GroupMemberRow } from '@/hooks/use-groups';
import type { ExpenseWithCategory } from '@/lib/repositories/expenses';
import { balanceBadge, currentUserNet, pairwiseByCurrency } from '@/lib/group-balance';
import { formatMoney } from '@/lib/format/money';
import { colors, radii, spacing } from '@/lib/theme';
import { useSession } from '@/hooks/use-session';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ActiveTab = 'gastos' | 'saldos';

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function TabSwitcher({
  active,
  onChange,
}: {
  active: ActiveTab;
  onChange: (tab: ActiveTab) => void;
}): React.JSX.Element {
  return (
    <View style={tabStyles.container}>
      <Pressable
        onPress={() => onChange('gastos')}
        accessibilityRole="tab"
        accessibilityState={{ selected: active === 'gastos' }}
        accessibilityLabel="Gastos"
        style={tabStyles.tab}
      >
        <Body
          color={active === 'gastos' ? colors.brand[500] : colors.fg[3]}
          style={active === 'gastos' ? tabStyles.labelActive : undefined}
        >
          Gastos
        </Body>
        {active === 'gastos' && <View style={tabStyles.underline} />}
      </Pressable>

      <Pressable
        onPress={() => onChange('saldos')}
        accessibilityRole="tab"
        accessibilityState={{ selected: active === 'saldos' }}
        accessibilityLabel="Saldos"
        style={tabStyles.tab}
      >
        <Body
          color={active === 'saldos' ? colors.brand[500] : colors.fg[3]}
          style={active === 'saldos' ? tabStyles.labelActive : undefined}
        >
          Saldos
        </Body>
        {active === 'saldos' && <View style={tabStyles.underline} />}
      </Pressable>
    </View>
  );
}

const tabStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: colors.line[1],
  },
  tab: {
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[4],
    alignItems: 'center',
    position: 'relative',
  },
  labelActive: {
    fontWeight: '600',
  },
  underline: {
    position: 'absolute',
    bottom: -1,
    left: spacing[4],
    right: spacing[4],
    height: 2,
    borderRadius: 1,
    backgroundColor: colors.brand[500],
  },
});

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

export default function GroupDetailScreen(): React.JSX.Element {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useSession();
  const [activeTab, setActiveTab] = useState<ActiveTab>('gastos');
  const [settlingEdge, setSettlingEdge] = useState<string | null>(null);
  const [addMemberVisible, setAddMemberVisible] = useState(false);

  const { data: group, isLoading: groupLoading } = useGroup(id);
  const { data: expenses, isLoading: expensesLoading } = useGroupExpenses(id);
  const { data: balances, isLoading: balancesLoading } = useGroupBalances(id);
  const deleteMutation = useDeleteGroup();
  const settleMutation = useCreateSettlement();

  // Resolve current user's member row so we can compute "Tu situación"
  const currentMember: GroupMemberRow | undefined =
    user != null && group != null ? group.members.find((m) => m.user_id === user.id) : undefined;

  function handleDelete(): void {
    Alert.alert('Eliminar grupo', '¿Confirmás que querés eliminar este grupo?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: () => {
          if (id == null) return;
          void deleteMutation
            .mutateAsync(id)
            .then(() => {
              router.back();
            })
            .catch(() => {
              Alert.alert('Error', 'No se pudo eliminar el grupo. Intentá nuevamente.');
            });
        },
      },
    ]);
  }

  function handleMoreOptions(): void {
    Alert.alert('Opciones', undefined, [
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: handleDelete,
      },
      { text: 'Cancelar', style: 'cancel' },
    ]);
  }

  function handleSettle(
    fromMemberId: string,
    toMemberId: string,
    amount: number,
    currency: 'ARS' | 'USD',
  ): void {
    if (id == null) return;
    const edgeKey = `${fromMemberId}→${toMemberId}`;
    Alert.alert('Saldar deuda', '¿Confirmás que se saldó esta deuda?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Confirmar',
        onPress: () => {
          setSettlingEdge(edgeKey);
          void settleMutation
            .mutateAsync({
              group_id: id,
              from_member_id: fromMemberId,
              to_member_id: toMemberId,
              amount,
              currency,
            })
            .then(() => {
              setSettlingEdge(null);
              Alert.alert('Listo', 'Deuda saldada correctamente.');
            })
            .catch(() => {
              setSettlingEdge(null);
              Alert.alert('Error', 'No se pudo registrar la liquidación. Intentá nuevamente.');
            });
        },
      },
    ]);
  }

  if (groupLoading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <View style={styles.center}>
          <Loader size={24} color={colors.fg[3]} />
        </View>
      </SafeAreaView>
    );
  }

  if (group == null) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Volver"
            hitSlop={12}
            style={styles.backButton}
          >
            <Icon name="ChevronLeft" size={24} color={colors.fg[1]} strokeWidth={1.5} />
          </Pressable>
        </View>
        <View style={styles.center}>
          <Body color={colors.fg[3]}>No se encontró el grupo.</Body>
        </View>
      </SafeAreaView>
    );
  }

  // ---------------------------------------------------------------------------
  // Saldos tab content
  // ---------------------------------------------------------------------------

  const memberMap = new Map<string, GroupMemberRow>(group.members.map((m) => [m.id, m]));

  const userNets = currentUserNet(balances ?? [], currentMember?.id ?? null);
  const pairwise = pairwiseByCurrency(balances ?? []);

  // Flatten edges across currencies for display (currency-aware rows).
  // Cast currency to the supported union — the DB only stores ARS/USD.
  const allEdges = Object.entries(pairwise).flatMap(([currency, edges]) =>
    edges.map((edge) => ({ ...edge, currency: currency as 'ARS' | 'USD' })),
  );

  const hasPendingDebts = allEdges.length > 0;

  function renderSaldosTab(): React.JSX.Element {
    if (balancesLoading) {
      return (
        <View style={styles.center}>
          <Loader size={20} color={colors.fg[3]} />
        </View>
      );
    }

    if (!hasPendingDebts) {
      return (
        <View style={styles.emptyState} testID="no-pending-balances">
          <Body color={colors.fg[3]}>No hay saldos pendientes.</Body>
        </View>
      );
    }

    return (
      <View style={styles.saldosContent}>
        {/* Tu situación */}
        {currentMember !== undefined && Object.keys(userNets).length > 0 && (
          <View style={styles.section}>
            <H3 style={styles.sectionTitle}>Tu situación</H3>
            <Card variant="raised" padding={4} style={styles.situacionCard}>
              {Object.entries(userNets).map(([currency, net]) => {
                const badge = balanceBadge(net);
                const pillVariant =
                  badge.tone === 'in' ? 'income' : badge.tone === 'out' ? 'expense' : 'neutral';
                const amountLabel = formatMoney(Math.abs(net), currency as 'ARS' | 'USD');
                return (
                  <View key={currency} style={styles.situacionRow}>
                    <Pill variant={pillVariant}>{badge.label}</Pill>
                    <Money
                      tone={badge.tone === 'neutral' ? 'neutral' : badge.tone}
                      testID={`user-net-${currency}`}
                    >
                      {amountLabel}
                    </Money>
                    <Caption color={colors.fg[3]}>{currency}</Caption>
                  </View>
                );
              })}
            </Card>
          </View>
        )}

        {/* Quién le debe a quién */}
        <View style={styles.section}>
          <H3 style={styles.sectionTitle}>Quién le debe a quién</H3>
          <Card variant="base" style={styles.edgesCard}>
            {allEdges.map((edge, idx) => {
              const fromMember = memberMap.get(edge.from);
              const toMember = memberMap.get(edge.to);
              if (fromMember === undefined || toMember === undefined) return null;
              const edgeKey = `${edge.from}→${edge.to}`;
              const isSettling = settlingEdge === edgeKey;
              return (
                <View key={edgeKey}>
                  <BalanceRow
                    from={fromMember}
                    to={toMember}
                    amount={edge.amount}
                    currency={edge.currency}
                    settling={isSettling}
                    onSettle={() => handleSettle(edge.from, edge.to, edge.amount, edge.currency)}
                  />
                  {idx < allEdges.length - 1 && <View style={styles.divider} />}
                </View>
              );
            })}
          </Card>
        </View>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Volver"
          hitSlop={12}
          style={styles.backButton}
        >
          <Icon name="ChevronLeft" size={24} color={colors.fg[1]} strokeWidth={1.5} />
        </Pressable>

        {/* Centered group identity */}
        <View style={styles.headerCenter} accessibilityLabel={`Grupo ${group.name}`}>
          <View
            style={[
              styles.headerIconChip,
              {
                backgroundColor: `${group.color}1A`,
                borderColor: group.color,
              },
            ]}
          >
            <Icon name={group.icon as IconName} size={18} color={group.color} strokeWidth={1.5} />
          </View>
          <H2 style={styles.headerTitle} numberOfLines={1}>
            {group.name}
          </H2>
        </View>

        {/* More options */}
        <Pressable
          onPress={handleMoreOptions}
          accessibilityRole="button"
          accessibilityLabel="Más opciones"
          hitSlop={12}
          style={styles.moreButton}
          testID="more-options-button"
        >
          <Icon name="MoreHorizontal" size={24} color={colors.fg[2]} strokeWidth={1.5} />
        </Pressable>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Members */}
        <View style={styles.membersSection}>
          <View style={styles.membersHeader}>
            <Caption color={colors.fg[3]} style={styles.sectionLabel}>
              {group.members.length === 1 ? '1 miembro' : `${group.members.length} miembros`}
            </Caption>
            <Pressable
              onPress={() => setAddMemberVisible(true)}
              accessibilityRole="button"
              accessibilityLabel="Agregar miembro"
              hitSlop={8}
              style={styles.addMemberButton}
              testID="add-member-button"
            >
              <Icon name="UserPlus" size={18} color={colors.brand[400]} strokeWidth={1.5} />
              <Caption color={colors.brand[400]} style={{ fontWeight: '600' }}>
                Agregar miembro
              </Caption>
            </Pressable>
          </View>
          <MemberAvatarsRow members={group.members} max={8} size={36} />
        </View>

        {/* Tab switcher */}
        <TabSwitcher active={activeTab} onChange={setActiveTab} />

        {/* Add member sheet */}
        {id != null && (
          <MemberSelectorSheet
            visible={addMemberVisible}
            groupId={id}
            onClose={() => setAddMemberVisible(false)}
          />
        )}

        {/* Tab content */}
        {activeTab === 'gastos' ? (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <H3 style={styles.sectionTitle}>Gastos</H3>
              <Button
                variant="primary"
                size="sm"
                onPress={() =>
                  router.push(
                    `/(protected)/groups/expense?groupId=${id}` as Parameters<
                      typeof router.push
                    >[0],
                  )
                }
                accessibilityLabel="Registrar gasto compartido"
              >
                Registrar gasto
              </Button>
            </View>
            {expensesLoading ? (
              <View style={styles.center}>
                <Loader size={20} color={colors.fg[3]} />
              </View>
            ) : (expenses ?? []).length === 0 ? (
              <View style={styles.emptyState}>
                <Body color={colors.fg[3]}>No hay gastos registrados</Body>
              </View>
            ) : (
              <Card variant="base" style={styles.expensesCard}>
                {(expenses ?? []).map((expense: GroupExpense) => (
                  <ExpenseRow
                    key={expense.id}
                    expense={expense as ExpenseWithCategory}
                    onPress={(expenseId) =>
                      router.push(
                        `/(protected)/expense/${expenseId}` as Parameters<typeof router.push>[0],
                      )
                    }
                  />
                ))}
              </Card>
            )}
          </View>
        ) : (
          renderSaldosTab()
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
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[5],
    paddingTop: spacing[4],
    paddingBottom: spacing[3],
  },
  backButton: {
    padding: spacing[1],
  },
  headerCenter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
    marginHorizontal: spacing[2],
  },
  headerIconChip: {
    width: 32,
    height: 32,
    borderRadius: radii.sm,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flexShrink: 1,
  },
  moreButton: {
    padding: spacing[1],
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: spacing[8],
    gap: spacing[5],
  },
  center: {
    alignItems: 'center',
    paddingVertical: spacing[7],
  },
  membersSection: {
    gap: spacing[2],
    paddingTop: spacing[2],
    paddingHorizontal: spacing[5],
  },
  membersHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  addMemberButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
    paddingVertical: spacing[1],
  },
  sectionLabel: {
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  section: {
    gap: spacing[3],
    paddingHorizontal: spacing[5],
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {},
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing[5],
    paddingHorizontal: spacing[5],
  },
  expensesCard: {
    padding: 0,
    borderRadius: radii.md,
  },
  // Saldos tab
  saldosContent: {
    gap: spacing[5],
  },
  situacionCard: {
    gap: spacing[3],
  },
  situacionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    flexWrap: 'wrap',
  },
  edgesCard: {
    padding: spacing[4],
  },
  divider: {
    height: 1,
    backgroundColor: colors.line[1],
    marginVertical: spacing[1],
  },
});
