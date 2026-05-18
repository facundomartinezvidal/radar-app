/**
 * RADAR Design System — Button primitive (B3)
 *
 * Press animation via react-native-reanimated (useSharedValue + withTiming).
 * No Material ripple — scale 0.97 over 120ms per DS spec.
 */
import React from 'react';
import { Pressable } from 'react-native';
import Animated, { useSharedValue, withTiming, useAnimatedStyle } from 'react-native-reanimated';

import { colors, motion, radii, spacing, typography } from '@/lib/theme';
import { Loader } from './loader';
import { Text } from './text';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'destructive';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  onPress: () => void | Promise<void>;
  children: React.ReactNode;
  accessibilityLabel?: string;
}

// ---------------------------------------------------------------------------
// Style maps
// ---------------------------------------------------------------------------

interface ButtonVariantStyle {
  backgroundColor: string;
  borderColor: string;
  borderWidth: number;
  textColor: string;
  pressedBackgroundColor: string;
}

const VARIANT_STYLES: Record<ButtonVariant, ButtonVariantStyle> = {
  primary: {
    backgroundColor: colors.brand[500],
    borderColor: 'transparent',
    borderWidth: 0,
    textColor: colors.fg.onBrand,
    pressedBackgroundColor: colors.brand[600],
  },
  secondary: {
    backgroundColor: colors.bg[2],
    borderColor: colors.line[2],
    borderWidth: 1,
    textColor: colors.fg[1],
    pressedBackgroundColor: colors.bg[3],
  },
  ghost: {
    backgroundColor: 'transparent',
    borderColor: 'transparent',
    borderWidth: 0,
    textColor: colors.brand[300],
    pressedBackgroundColor: 'rgba(0,119,182,0.08)',
  },
  destructive: {
    backgroundColor: colors.money.out,
    borderColor: 'transparent',
    borderWidth: 0,
    textColor: colors.fg.onBrand,
    pressedBackgroundColor: colors.money.out,
  },
};

interface ButtonSizeStyle {
  minHeight: number;
  paddingHorizontal: number;
  fontSize: number;
}

const SIZE_STYLES: Record<ButtonSize, ButtonSizeStyle> = {
  sm: { minHeight: 36, paddingHorizontal: spacing[3], fontSize: typography.size.bodySm },
  md: { minHeight: 44, paddingHorizontal: spacing[4], fontSize: typography.size.body },
  lg: { minHeight: 52, paddingHorizontal: spacing[5], fontSize: typography.size.body },
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  fullWidth = false,
  leftIcon,
  rightIcon,
  onPress,
  children,
  accessibilityLabel,
}: ButtonProps): React.JSX.Element {
  const variantStyle = VARIANT_STYLES[variant];
  const sizeStyle = SIZE_STYLES[size];

  // Press animation
  const scale = useSharedValue(1);
  const bgOpacity = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  function handlePressIn(): void {
    scale.value = withTiming(0.97, { duration: motion.dur[1] });
    bgOpacity.value = withTiming(0.85, { duration: motion.dur[1] });
  }

  function handlePressOut(): void {
    scale.value = withTiming(1, { duration: motion.dur[1] });
    bgOpacity.value = withTiming(1, { duration: motion.dur[1] });
  }

  const isDisabled = disabled || loading;

  return (
    <Pressable
      disabled={isDisabled}
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      style={{ width: fullWidth ? '100%' : undefined, opacity: isDisabled ? 0.4 : 1 }}
    >
      <Animated.View
        style={[
          animatedStyle,
          {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: spacing[2],
            minHeight: sizeStyle.minHeight,
            paddingHorizontal: sizeStyle.paddingHorizontal,
            backgroundColor: variantStyle.backgroundColor,
            borderRadius: radii.md,
            borderWidth: variantStyle.borderWidth,
            borderColor: variantStyle.borderColor,
            // Inner-highlight trick
            borderTopColor: 'rgba(255,255,255,0.08)',
            borderTopWidth: variantStyle.borderWidth > 0 ? variantStyle.borderWidth : 1,
          },
        ]}
      >
        {loading ? (
          <Loader size={sizeStyle.fontSize + 2} color={variantStyle.textColor} strokeWidth={2} />
        ) : (
          <>
            {leftIcon != null && leftIcon}
            <Text
              variant="body"
              color={variantStyle.textColor}
              style={{
                fontFamily: typography.family.semibold,
                fontSize: sizeStyle.fontSize,
                lineHeight: sizeStyle.fontSize * 1.5,
              }}
            >
              {children}
            </Text>
            {rightIcon != null && rightIcon}
          </>
        )}
      </Animated.View>
    </Pressable>
  );
}
