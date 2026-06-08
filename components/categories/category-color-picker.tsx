/**
 * RADAR — CategoryColorPicker
 *
 * Renders CATEGORY_COLORS as a wrapped row of circular swatches.
 * The selected swatch shows a ring + a centered checkmark.
 */
import React from 'react';
import { Pressable, View } from 'react-native';

import { Icon } from '@/components/ui';
import { CATEGORY_COLORS } from '@/lib/category-options';
import { colors, spacing } from '@/lib/theme';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CategoryColorPickerProps {
  value: string;
  onChange: (color: string) => void;
  disabled?: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SWATCH_SIZE = 36;
/** Minimum tap area — padded to reach ≥44px */
const SWATCH_PADDING = 4;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CategoryColorPicker({
  value,
  onChange,
  disabled = false,
}: CategoryColorPickerProps): React.JSX.Element {
  return (
    <View
      style={{
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing[2],
      }}
    >
      {CATEGORY_COLORS.map((color, index) => {
        const selected = color === value;
        return (
          <Pressable
            key={color}
            onPress={() => {
              if (!disabled) onChange(color);
            }}
            disabled={disabled}
            hitSlop={SWATCH_PADDING}
            accessibilityRole="radio"
            accessibilityLabel={`Color ${index + 1}`}
            accessibilityState={{ selected, disabled }}
            style={{ padding: SWATCH_PADDING, opacity: disabled ? 0.5 : 1 }}
          >
            <View
              style={{
                width: SWATCH_SIZE,
                height: SWATCH_SIZE,
                borderRadius: 999,
                backgroundColor: color,
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: selected ? 2 : 0,
                borderColor: selected ? colors.fg[1] : 'transparent',
              }}
            >
              {selected && (
                <Icon name="Check" size={16} color={colors.fg.onBrand} strokeWidth={2.5} />
              )}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}
