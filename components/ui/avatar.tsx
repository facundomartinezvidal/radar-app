/**
 * RADAR Design System — Avatar primitive
 *
 * Circular avatar that renders a remote image when available, or falls back
 * to initials on a deterministic hash-derived background. Shows '?' when no
 * name and no image are provided.
 */
import React, { useMemo } from 'react';
import { Image, Text, View } from 'react-native';

import { hashColor } from '@/lib/avatar/hash-color';
import { getInitials } from '@/lib/avatar/initials';
import { colors, typography } from '@/lib/theme';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AvatarProps {
  firstName?: string | null;
  lastName?: string | null;
  /** Diameter in pixels. Default 36. */
  size?: number;
  /** Optional remote image URL — overrides initials if provided. */
  imageUrl?: string | null;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function Avatar({
  firstName,
  lastName,
  size = 36,
  imageUrl,
}: AvatarProps): React.JSX.Element {
  const initials = useMemo(() => getInitials(firstName, lastName), [firstName, lastName]);
  const bgColor = useMemo(
    () => (initials.length > 0 ? hashColor(`${firstName ?? ''} ${lastName ?? ''}`) : colors.bg[2]),
    [firstName, lastName, initials],
  );

  const borderRadius = size / 2;
  const fontSize = Math.round(size * 0.4);

  const hasName =
    (firstName != null && firstName.trim().length > 0) ||
    (lastName != null && lastName.trim().length > 0);

  const accessibilityLabel = hasName
    ? `Avatar de ${[firstName, lastName].filter(Boolean).join(' ').trim()}`
    : 'Avatar';

  if (imageUrl != null && imageUrl.length > 0) {
    return (
      <Image
        source={{ uri: imageUrl }}
        style={{ width: size, height: size, borderRadius }}
        accessibilityRole="image"
        accessibilityLabel={accessibilityLabel}
        testID="avatar-image"
      />
    );
  }

  return (
    <View
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
      testID="avatar-circle"
      style={{
        width: size,
        height: size,
        borderRadius,
        backgroundColor: bgColor,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text
        style={{
          fontFamily: typography.family.semibold,
          fontSize,
          color: initials.length > 0 ? colors.fg.onBrand : colors.fg[2],
          includeFontPadding: false,
          textAlign: 'center',
        }}
      >
        {initials.length > 0 ? initials : '?'}
      </Text>
    </View>
  );
}
