/**
 * RADAR — GroupCard
 *
 * Pressable card that shows a group's icon, name, member count, and
 * a stacked member avatar row. Used in the groups list screen.
 *
 * Balance badge: resolves the current user's member row from the group,
 * calls useGroupBalances internally (one hook call per card instance —
 * acceptable because each GroupCard is a separate component instance),
 * and renders a compact Pill badge (Te deben / Debés / Al día).
 */
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Caption, Card, H3, Icon, Pill } from '@/components/ui';
import type { IconName } from '@/components/ui/icon';
import { useGroupBalances } from '@/hooks/use-groups';
import type { GroupWithMembers } from '@/hooks/use-groups';
import { balanceBadge, currentUserNet } from '@/lib/group-balance';
import { formatMoney } from '@/lib/format/money';
import { colors, radii, spacing } from '@/lib/theme';

import { MemberAvatarsRow } from './member-avatars-row';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GroupCardProps {
  group: GroupWithMembers;
  onPress: (id: string) => void;
  /** Current authenticated user's Supabase user id. Used to resolve member row. */
  currentUserId?: string | null;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function GroupCard({ group, onPress, currentUserId }: GroupCardProps): React.JSX.Element {
  const memberCount = group.members.length;
  const memberLabel = memberCount === 1 ? '1 miembro' : `${memberCount} miembros`;

  const { data: balances } = useGroupBalances(group.id);

  // Resolve current user's member row
  const currentMember =
    currentUserId != null ? group.members.find((m) => m.user_id === currentUserId) : undefined;

  const userNets = currentUserNet(balances ?? [], currentMember?.id ?? null);

  // Pick ARS net first, then the first available currency
  const netEntry =
    userNets['ARS'] !== undefined
      ? { currency: 'ARS', net: userNets['ARS'] }
      : Object.entries(userNets)[0] !== undefined
        ? { currency: Object.entries(userNets)[0]![0], net: Object.entries(userNets)[0]![1] }
        : undefined;

  const badge = netEntry !== undefined ? balanceBadge(netEntry.net) : undefined;
  const badgeAmountLabel =
    netEntry !== undefined
      ? formatMoney(Math.abs(netEntry.net), netEntry.currency as 'ARS' | 'USD')
      : undefined;

  const pillVariant =
    badge === undefined
      ? undefined
      : badge.tone === 'in'
        ? 'income'
        : badge.tone === 'out'
          ? 'expense'
          : 'neutral';

  return (
    <Pressable
      onPress={() => onPress(group.id)}
      accessibilityRole="button"
      accessibilityLabel={`Grupo ${group.name}`}
      testID={`group-card-${group.id}`}
    >
      <Card variant="base" style={styles.card}>
        <View style={styles.row}>
          {/* Icon chip */}
          <View
            style={[
              styles.iconChip,
              {
                backgroundColor: `${group.color}1A`,
                borderColor: group.color,
              },
            ]}
          >
            <Icon name={group.icon as IconName} size={22} color={group.color} strokeWidth={1.5} />
          </View>

          {/* Text info */}
          <View style={styles.textBlock}>
            <H3 numberOfLines={1}>{group.name}</H3>
            <View style={styles.metaRow}>
              <Caption color={colors.fg[3]}>{memberLabel}</Caption>
              {badge !== undefined &&
                pillVariant !== undefined &&
                badgeAmountLabel !== undefined && (
                  <Pill variant={pillVariant} size="sm">
                    {`${badge.label} ${badgeAmountLabel}`}
                  </Pill>
                )}
            </View>
          </View>

          {/* Member avatars */}
          <MemberAvatarsRow members={group.members} max={4} size={28} />
        </View>
      </Card>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  card: {
    padding: spacing[4],
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  iconChip: {
    width: 44,
    height: 44,
    borderRadius: radii.md,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textBlock: {
    flex: 1,
    gap: spacing[1],
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    flexWrap: 'wrap',
  },
});
