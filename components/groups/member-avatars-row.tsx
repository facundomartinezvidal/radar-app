/**
 * RADAR — MemberAvatarsRow
 *
 * Renders a stacked row of overlapping Avatar circles for group members.
 * Shows up to `max` avatars (default 4). If there are more members, the
 * last slot shows a "+N" overflow indicator.
 */
import React from 'react';
import { View, Text } from 'react-native';

import { Avatar } from '@/components/ui';
import type { GroupMemberRow } from '@/hooks/use-groups';
import { colors, typography } from '@/lib/theme';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MemberAvatarsRowProps {
  members: GroupMemberRow[];
  /** Maximum number of avatar circles to show before "+N". Default 4. */
  max?: number;
  /** Diameter of each avatar circle in pixels. Default 32. */
  size?: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function splitDisplayName(displayName: string | null): {
  firstName: string | null;
  lastName: string | null;
} {
  if (displayName == null || displayName.trim().length === 0) {
    return { firstName: null, lastName: null };
  }
  const parts = displayName.trim().split(' ');
  return {
    firstName: parts[0] ?? null,
    lastName: parts.length > 1 ? (parts[parts.length - 1] ?? null) : null,
  };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function MemberAvatarsRow({
  members,
  max = 4,
  size = 32,
}: MemberAvatarsRowProps): React.JSX.Element {
  const overflow = members.length > max ? members.length - max + 1 : 0;
  const visible = overflow > 0 ? members.slice(0, max - 1) : members;
  const overlapOffset = Math.round(size * 0.35);
  const totalCount = members.length;

  return (
    <View
      style={{ flexDirection: 'row', alignItems: 'center' }}
      accessibilityLabel={`${totalCount} ${totalCount === 1 ? 'miembro' : 'miembros'}`}
    >
      {visible.map((member, index) => {
        const { firstName, lastName } = splitDisplayName(member.display_name);
        return (
          <View
            key={member.id}
            style={{
              marginLeft: index === 0 ? 0 : -overlapOffset,
              borderWidth: 2,
              borderColor: colors.bg[1],
              borderRadius: size / 2,
              zIndex: visible.length - index,
            }}
          >
            <Avatar firstName={firstName} lastName={lastName} size={size} />
          </View>
        );
      })}
      {overflow > 0 && (
        <View
          style={{
            marginLeft: -overlapOffset,
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: colors.bg[3],
            borderWidth: 2,
            borderColor: colors.bg[1],
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 0,
          }}
        >
          <Text
            style={{
              fontFamily: typography.family.semibold,
              fontSize: Math.round(size * 0.32),
              color: colors.fg[2],
              includeFontPadding: false,
            }}
          >
            {`+${overflow}`}
          </Text>
        </View>
      )}
    </View>
  );
}
