/**
 * Two-segment ARS / USD selector.
 */
import React from 'react';
import { Pressable, View } from 'react-native';

import { Text } from '@/components/ui';
import { colors, radii, spacing } from '@/lib/theme';
import type { Currency } from '@/lib/schemas/expense';

interface CurrencyToggleProps {
  value: Currency;
  onChange: (next: Currency) => void;
  disabled?: boolean;
}

const OPTIONS: { value: Currency; label: string; color: string }[] = [
  { value: 'ARS', label: 'ARS', color: colors.brand[400] },
  { value: 'USD', label: 'USD', color: colors.amber[500] },
];

export function CurrencyToggle({
  value,
  onChange,
  disabled = false,
}: CurrencyToggleProps): React.JSX.Element {
  return (
    <View
      accessibilityRole="radiogroup"
      style={{
        flexDirection: 'row',
        gap: spacing[2],
        padding: spacing[1],
        backgroundColor: colors.bg[2],
        borderRadius: radii.md,
        borderWidth: 1,
        borderColor: colors.line[2],
      }}
    >
      {OPTIONS.map((opt) => {
        const selected = opt.value === value;
        return (
          <Pressable
            key={opt.value}
            disabled={disabled}
            onPress={() => onChange(opt.value)}
            accessibilityRole="radio"
            accessibilityState={{ selected, disabled }}
            accessibilityLabel={`Moneda ${opt.label}`}
            style={{ flex: 1 }}
          >
            <View
              style={{
                alignItems: 'center',
                paddingVertical: spacing[2],
                borderRadius: radii.sm,
                backgroundColor: selected ? opt.color : 'transparent',
              }}
            >
              <Text
                variant="bodySm"
                color={selected ? colors.fg.onBrand : colors.fg[2]}
                style={{ fontWeight: '700' }}
              >
                {opt.label}
              </Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}
