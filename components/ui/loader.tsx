/**
 * RADAR Design System — Loader primitive
 *
 * Continuous-spin Lucide `Loader2` glyph. Use anywhere a pending state needs
 * a visual indicator: button loading slot, screen-level data fetches,
 * pre-mutation submit states, query refetch indicators.
 *
 * Spins at 900 ms / revolution, linear easing, infinite repeat. Animation
 * starts on mount and stops on unmount (Reanimated cancels the loop when
 * `useSharedValue` deallocates).
 */
import React, { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { colors } from '@/lib/theme';
import { Icon } from './icon';
import { Text } from './text';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LoaderProps {
  /** Diameter of the spinning glyph. Default 20. */
  size?: number;
  /** Stroke colour. Defaults to fg[2] (secondary text). */
  color?: string;
  /** Lucide stroke width. Default 1.75 — slightly chunkier than the base 1.5
   * because thin strokes flicker at small spinner sizes. */
  strokeWidth?: number;
  /** Optional caption rendered to the right of the spinner. */
  label?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function Loader({
  size = 20,
  color = colors.fg[2],
  strokeWidth = 1.75,
  label,
}: LoaderProps): React.JSX.Element {
  const rotation = useSharedValue(0);

  useEffect(() => {
    rotation.value = withRepeat(
      withTiming(360, { duration: 900, easing: Easing.linear }),
      -1,
      false,
    );
  }, [rotation]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  const spinner = (
    <Animated.View
      style={animatedStyle}
      accessibilityRole="image"
      accessibilityLabel={label ?? 'Cargando'}
    >
      <Icon name="Loader2" size={size} color={color} strokeWidth={strokeWidth} />
    </Animated.View>
  );

  if (label == null) {
    return spinner;
  }

  return (
    <View
      accessibilityRole="text"
      accessibilityLabel={label}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
    >
      {spinner}
      <Text variant="body" color={color}>
        {label}
      </Text>
    </View>
  );
}
