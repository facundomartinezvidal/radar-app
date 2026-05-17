/**
 * RADAR Design System — Input primitive (B4)
 *
 * Wraps RN TextInput with label, error, helper text, and icon slots.
 * Focus state changes border to brand[400].
 */
import React, { useState } from 'react';
import { TextInput, type TextInputProps, View } from 'react-native';

import { colors, radii, spacing, typography } from '@/lib/theme';
import { Text } from './text';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  helper?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function Input({
  label,
  error,
  helper,
  leftIcon,
  rightIcon,
  style,
  onFocus,
  onBlur,
  ...rest
}: InputProps): React.JSX.Element {
  const [focused, setFocused] = useState(false);

  const hasError = error != null && error.length > 0;

  const borderColor = hasError ? colors.money.out : focused ? colors.brand[400] : colors.line[2];
  const borderWidth = focused || hasError ? 2 : 1;

  function handleFocus(e: Parameters<NonNullable<TextInputProps['onFocus']>>[0]): void {
    setFocused(true);
    onFocus?.(e);
  }

  function handleBlur(e: Parameters<NonNullable<TextInputProps['onBlur']>>[0]): void {
    setFocused(false);
    onBlur?.(e);
  }

  return (
    <View style={{ gap: spacing[1] }}>
      {label != null && label.length > 0 && (
        <Text variant="label" style={{ marginBottom: spacing[2] }}>
          {label}
        </Text>
      )}

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: colors.bg[2],
          borderRadius: radii.md,
          borderWidth,
          borderColor,
          minHeight: 48,
          paddingHorizontal: spacing[4],
          paddingVertical: spacing[3],
          gap: spacing[2],
        }}
      >
        {leftIcon != null && (
          <View style={{ width: 20, height: 20, alignItems: 'center', justifyContent: 'center' }}>
            {leftIcon}
          </View>
        )}

        <TextInput
          style={[
            {
              flex: 1,
              fontFamily: typography.family.regular,
              fontSize: typography.size.body,
              color: colors.fg[1],
              padding: 0, // remove default inner padding
            },
            style,
          ]}
          placeholderTextColor={colors.fg[4]}
          autoCorrect={false}
          onFocus={handleFocus}
          onBlur={handleBlur}
          {...rest}
        />

        {rightIcon != null && (
          <View style={{ width: 20, height: 20, alignItems: 'center', justifyContent: 'center' }}>
            {rightIcon}
          </View>
        )}
      </View>

      {hasError && (
        <Text variant="caption" color={colors.money.out}>
          {error}
        </Text>
      )}

      {!hasError && helper != null && helper.length > 0 && (
        <Text variant="caption" color={colors.fg[3]}>
          {helper}
        </Text>
      )}
    </View>
  );
}
