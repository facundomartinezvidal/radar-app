/**
 * RADAR Design System — Card primitive (B2)
 *
 * Translates `.card` / `.card--raised` CSS classes to React Native.
 * The inner-highlight (inset border) is approximated via `borderTopWidth` trick.
 */
import React from 'react';
import { View, type ViewProps } from 'react-native';

import { colors, radii, shadows, spacing } from '@/lib/theme';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CardVariant = 'base' | 'raised';

export interface CardProps extends ViewProps {
  variant?: CardVariant;
  /** Key from the `spacing` token map. Default 6 = 24px. */
  padding?: keyof typeof spacing;
  children?: React.ReactNode;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function Card({
  variant = 'base',
  padding = 6,
  style,
  children,
  ...rest
}: CardProps): React.JSX.Element {
  const isRaised = variant === 'raised';

  return (
    <View
      style={[
        {
          backgroundColor: isRaised ? colors.bg[2] : colors.bg[1],
          borderRadius: radii.lg,
          borderWidth: 1,
          borderColor: isRaised ? colors.line[2] : colors.line[1],
          // Inner-highlight approximation (inset 0 1px 0 rgba(255,255,255,0.04..0.05))
          borderTopColor: 'rgba(255,255,255,0.04)',
          borderTopWidth: 1,
          padding: spacing[padding],
          ...shadows.two,
        },
        style,
      ]}
      {...rest}
    >
      {children}
    </View>
  );
}
