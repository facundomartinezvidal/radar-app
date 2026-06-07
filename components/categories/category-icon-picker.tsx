/**
 * RADAR — CategoryIconPicker
 *
 * Renders CATEGORY_ICONS in a wrapped grid of square tiles.
 * Selected tile uses the current category color for border and background tint.
 */
import React from 'react';
import { Pressable, View } from 'react-native';

import { Icon } from '@/components/ui';
import type { IconName } from '@/components/ui/icon';
import { CATEGORY_ICONS } from '@/lib/category-options';
import { colors, radii, spacing } from '@/lib/theme';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CategoryIconPickerProps {
  value: IconName;
  color: string;
  onChange: (icon: IconName) => void;
  disabled?: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TILE_SIZE = 48;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CategoryIconPicker({
  value,
  color,
  onChange,
  disabled = false,
}: CategoryIconPickerProps): React.JSX.Element {
  return (
    <View
      style={{
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing[2],
      }}
    >
      {CATEGORY_ICONS.map((icon) => {
        const selected = icon === value;
        return (
          <Pressable
            key={icon}
            onPress={() => {
              if (!disabled) onChange(icon);
            }}
            disabled={disabled}
            accessibilityRole="radio"
            accessibilityLabel={`Ícono ${icon}`}
            accessibilityState={{ selected, disabled }}
            style={{ opacity: disabled ? 0.5 : 1 }}
          >
            <View
              style={{
                width: TILE_SIZE,
                height: TILE_SIZE,
                borderRadius: radii.md,
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: selected ? 2 : 1,
                borderColor: selected ? color : colors.line[2],
                backgroundColor: selected ? `${color}1A` : colors.bg[2],
              }}
            >
              <Icon
                name={icon}
                size={20}
                color={selected ? color : colors.fg[2]}
                strokeWidth={1.5}
              />
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}
