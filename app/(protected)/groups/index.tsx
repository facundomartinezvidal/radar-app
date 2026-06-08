/**
 * RADAR — Grupos screen
 *
 * Lists all groups the user belongs to. Shows a GroupCard per group.
 * Primary CTA creates a new group.
 * Shows a pending-invites section at the top when the user has open invitations.
 */
import { router } from 'expo-router';
import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GroupCard } from '@/components/groups/group-card';
import { Body, Button, Caption, Card, H2, H3, Icon, Loader, Pill } from '@/components/ui';
import type { IconName } from '@/components/ui/icon';
import { useGroups, usePendingInvites, useRespondInvite } from '@/hooks/use-groups';
import { useSession } from '@/hooks/use-session';
import { colors, radii, spacing } from '@/lib/theme';

export default function GroupsScreen(): React.JSX.Element {
  const { data: groups, isLoading } = useGroups();
  const { user } = useSession();
  const { data: pendingInvites } = usePendingInvites();
  const respondMutation = useRespondInvite();
  const [respondingId, setRespondingId] = useState<string | null>(null);

  function handleRespond(memberId: string, accept: boolean): void {
    setRespondingId(memberId);
    void respondMutation
      .mutateAsync({ memberId, accept })
      .then(() => {
        setRespondingId(null);
        if (accept) {
          Alert.alert('Listo', 'Te uniste al grupo.');
        }
      })
      .catch(() => {
        setRespondingId(null);
        Alert.alert('Error', 'No se pudo responder la invitación. Intentá nuevamente.');
      });
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
        <H2 style={styles.headerTitle}>Grupos</H2>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Pending invites section */}
        {(pendingInvites ?? []).length > 0 && (
          <View testID="pending-invites-section">
            <H3 style={styles.sectionTitle}>Invitaciones</H3>
            <View style={styles.list}>
              {(pendingInvites ?? []).map((invite) => {
                const isResponding = respondingId === invite.id;
                return (
                  <Card
                    key={invite.id}
                    variant="base"
                    style={styles.inviteCard}
                    testID={`invite-card-${invite.id}`}
                  >
                    <View style={styles.inviteRow}>
                      {/* Group icon chip */}
                      {invite.group != null && (
                        <View
                          style={[
                            styles.inviteIconChip,
                            {
                              backgroundColor: `${invite.group.color}1A`,
                              borderColor: invite.group.color,
                            },
                          ]}
                        >
                          <Icon
                            name={invite.group.icon as IconName}
                            size={18}
                            color={invite.group.color}
                            strokeWidth={1.5}
                          />
                        </View>
                      )}

                      {/* Info */}
                      <View style={styles.inviteInfo}>
                        <Body numberOfLines={1} style={{ fontWeight: '600' }}>
                          {invite.group?.name ?? 'Grupo'}
                        </Body>
                        <Caption color={colors.fg[3]}>
                          {invite.group?.name ?? 'Grupo'} · te invitó
                        </Caption>
                      </View>

                      {/* Pending pill */}
                      <Pill variant="neutral" size="sm">
                        Pendiente
                      </Pill>
                    </View>

                    {/* Actions */}
                    <View style={styles.inviteActions}>
                      <View testID={`decline-invite-${invite.id}`}>
                        <Button
                          variant="secondary"
                          size="sm"
                          onPress={() => handleRespond(invite.id, false)}
                          loading={isResponding}
                          accessibilityLabel="Rechazar invitación"
                        >
                          Rechazar
                        </Button>
                      </View>
                      <View testID={`accept-invite-${invite.id}`}>
                        <Button
                          variant="primary"
                          size="sm"
                          onPress={() => handleRespond(invite.id, true)}
                          loading={isResponding}
                          accessibilityLabel="Aceptar invitación"
                        >
                          Aceptar
                        </Button>
                      </View>
                    </View>
                  </Card>
                );
              })}
            </View>
          </View>
        )}

        {/* Groups list */}
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
  sectionTitle: {
    marginBottom: spacing[3],
  },
  // Invite card
  inviteCard: {
    padding: spacing[4],
    gap: spacing[3],
  },
  inviteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  inviteIconChip: {
    width: 36,
    height: 36,
    borderRadius: radii.sm,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inviteInfo: {
    flex: 1,
    gap: spacing[1],
  },
  inviteActions: {
    flexDirection: 'row',
    gap: spacing[3],
    justifyContent: 'flex-end',
  },
});
