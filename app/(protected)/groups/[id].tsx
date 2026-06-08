/**
 * RADAR — Group detail screen
 *
 * Shows group info, member avatars, and group expenses.
 * The ··· menu offers only "Eliminar" for now (edit deferred to a later atomic).
 */
import { router, useLocalSearchParams } from 'expo-router';
import React from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MemberAvatarsRow } from '@/components/groups/member-avatars-row';
import { ExpenseRow } from '@/components/expenses/expense-row';
import { Body, Button, Card, Caption, H2, H3, Icon, Loader } from '@/components/ui';
import type { IconName } from '@/components/ui/icon';
import { useDeleteGroup, useGroup, useGroupExpenses } from '@/hooks/use-groups';
import type { GroupExpense } from '@/hooks/use-groups';
import type { ExpenseWithCategory } from '@/lib/repositories/expenses';
import { colors, radii, spacing } from '@/lib/theme';

export default function GroupDetailScreen(): React.JSX.Element {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: group, isLoading: groupLoading } = useGroup(id);
  const { data: expenses, isLoading: expensesLoading } = useGroupExpenses(id);
  const deleteMutation = useDeleteGroup();

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
          <Caption color={colors.fg[3]} style={styles.sectionLabel}>
            {group.members.length === 1 ? '1 miembro' : `${group.members.length} miembros`}
          </Caption>
          <MemberAvatarsRow members={group.members} max={8} size={36} />
        </View>

        {/* Expenses section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <H3 style={styles.sectionTitle}>Gastos</H3>
            <Button
              variant="primary"
              size="sm"
              onPress={() =>
                router.push(
                  `/(protected)/groups/expense?groupId=${id}` as Parameters<typeof router.push>[0],
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
    paddingHorizontal: spacing[5],
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
  },
  sectionLabel: {
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  section: {
    gap: spacing[3],
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
  },
  expensesCard: {
    padding: 0,
    borderRadius: radii.md,
  },
});
