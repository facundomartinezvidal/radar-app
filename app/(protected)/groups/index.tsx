/**
 * RADAR — Grupos screen
 *
 * Lists all groups the user belongs to. Shows a GroupCard per group.
 * Primary CTA creates a new group.
 */
import { router } from 'expo-router';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GroupCard } from '@/components/groups/group-card';
import { Body, Button, H2, Icon, Loader } from '@/components/ui';
import { useGroups } from '@/hooks/use-groups';
import { useSession } from '@/hooks/use-session';
import { colors, spacing } from '@/lib/theme';

export default function GroupsScreen(): React.JSX.Element {
  const { data: groups, isLoading } = useGroups();
  const { user } = useSession();

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
        <H2 style={styles.headerTitle}>Grupos</H2>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {isLoading ? (
          <View style={styles.center}>
            <Loader size={24} color={colors.fg[3]} />
          </View>
        ) : (groups ?? []).length === 0 ? (
          <View style={styles.emptyState}>
            <Body color={colors.fg[3]}>No hay grupos.</Body>
          </View>
        ) : (
          <View style={styles.list}>
            {(groups ?? []).map((group) => (
              <GroupCard
                key={group.id}
                group={group}
                currentUserId={user?.id ?? null}
                onPress={(id) =>
                  router.push(`/(protected)/groups/${id}` as Parameters<typeof router.push>[0])
                }
              />
            ))}
          </View>
        )}

        {/* Create button */}
        <View style={styles.createButtonContainer}>
          <Button
            variant="primary"
            size="md"
            fullWidth
            onPress={() => router.push('/(protected)/groups/new')}
            accessibilityLabel="Crear grupo"
          >
            Crear grupo
          </Button>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

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
  headerTitle: {
    flex: 1,
    textAlign: 'center',
  },
  headerSpacer: {
    width: 24 + spacing[1] * 2,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing[5],
    paddingBottom: spacing[8],
    gap: spacing[3],
  },
  center: {
    alignItems: 'center',
    paddingVertical: spacing[7],
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing[7],
  },
  list: {
    gap: spacing[3],
  },
  createButtonContainer: {
    marginTop: spacing[2],
  },
});
