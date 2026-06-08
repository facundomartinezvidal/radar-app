/**
 * RADAR — GroupCard
 *
 * Pressable card that shows a group's icon, name, member count, and
 * a stacked member avatar row. Used in the groups list screen.
 */
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Caption, Card, H3, Icon } from '@/components/ui';
import type { IconName } from '@/components/ui/icon';
import type { GroupWithMembers } from '@/hooks/use-groups';
import { colors, radii, spacing } from '@/lib/theme';

import { MemberAvatarsRow } from './member-avatars-row';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GroupCardProps {
  group: GroupWithMembers;
  onPress: (id: string) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function GroupCard({ group, onPress }: GroupCardProps): React.JSX.Element {
  const memberCount = group.members.length;
  const memberLabel = memberCount === 1 ? '1 miembro' : `${memberCount} miembros`;

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
            <Caption color={colors.fg[3]}>{memberLabel}</Caption>
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
});
