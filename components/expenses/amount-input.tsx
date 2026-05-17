/**
 * Big amount input — JetBrains Mono, tabular nums, accepts es-AR or plain
 * numeric input, emits a parsed number to the parent.
 */
import React from 'react';
import { TextInput, View } from 'react-native';

import { Text } from '@/components/ui';
import { parseAmount } from '@/lib/format/money';
import { colors, radii, spacing, typography } from '@/lib/theme';

interface AmountInputProps {
  value: string;
  onChange: (rawText: string, parsed: number) => void;
  currency: 'ARS' | 'USD';
  hasError?: boolean;
  disabled?: boolean;
}

export function AmountInput({
  value,
  onChange,
  currency,
  hasError = false,
  disabled = false,
}: AmountInputProps): React.JSX.Element {
  const prefix = currency === 'USD' ? 'US$' : '$';
  const borderColor = hasError ? colors.money.out : colors.line[2];
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing[3],
        backgroundColor: colors.bg[2],
        borderRadius: radii.md,
        borderWidth: hasError ? 2 : 1,
        borderColor,
        paddingHorizontal: spacing[4],
        paddingVertical: spacing[3],
        minHeight: 72,
      }}
    >
      <Text variant="h2" color={colors.fg[3]} style={{ fontFamily: typography.family.semibold }}>
        {prefix}
      </Text>
      <TextInput
        value={value}
        editable={!disabled}
        onChangeText={(t) => {
          // Allow only digits, dot, comma. Strip everything else.
          const cleaned = t.replace(/[^0-9.,]/g, '');
          onChange(cleaned, parseAmount(cleaned));
        }}
        placeholder="0,00"
        placeholderTextColor={colors.fg[4]}
        keyboardType="decimal-pad"
        inputMode="decimal"
        accessibilityLabel="Monto"
        style={{
          flex: 1,
          fontFamily: typography.family.monoMedium,
          fontSize: 32,
          fontVariant: ['tabular-nums'],
          color: colors.fg[1],
          padding: 0,
          textAlign: 'right',
        }}
      />
    </View>
  );
}
