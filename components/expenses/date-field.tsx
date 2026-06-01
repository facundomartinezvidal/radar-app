/**
 * DateField — DS-styled date selector for expense forms.
 *
 * Renders a pressable row that opens @react-native-community/datetimepicker.
 * Platform handling:
 *   - Android: one-shot modal dialog; picker is mounted only while open
 *     (visibility toggled via state), automatically dismissed after selection.
 *   - iOS: inline spinner shown below the row when open; closed by tapping
 *     the row a second time or selecting a date.
 *
 * Props:
 *   value    — ISO datetime string (with offset) for the current selection.
 *   onChange — called with the updated ISO datetime string after selection.
 *   disabled — prevents opening the picker.
 *   label    — optional field label (defaults to "Fecha").
 */
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import React, { useState } from 'react';
import { Platform, Pressable, View } from 'react-native';

import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { colors, radii, spacing, typography } from '@/lib/theme';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DateFieldProps {
  value: string;
  onChange: (iso: string) => void;
  disabled?: boolean;
  label?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ES_AR_DATE = new Intl.DateTimeFormat('es-AR', {
  day: '2-digit',
  month: 'long',
  year: 'numeric',
});

function formatDate(iso: string): string {
  const d = new Date(iso);
  // Fallback to raw string if parsing fails (shouldn't happen in practice)
  return Number.isNaN(d.getTime()) ? iso : ES_AR_DATE.format(d);
}

const TODAY = new Date();

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DateField({
  value,
  onChange,
  disabled = false,
  label = 'Fecha',
}: DateFieldProps): React.JSX.Element {
  const [open, setOpen] = useState(false);

  const selectedDate = new Date(value);
  const displayText = formatDate(value);

  function handlePress(): void {
    if (!disabled) {
      setOpen((prev) => !prev);
    }
  }

  function handleChange(_event: DateTimePickerEvent, date?: Date): void {
    // On Android the picker is a one-shot dialog — always close after any
    // interaction (confirm or dismiss).
    if (Platform.OS === 'android') {
      setOpen(false);
    }

    if (date !== undefined) {
      // Guard: never allow future dates
      const clamped = date > TODAY ? TODAY : date;
      onChange(clamped.toISOString());
    }
  }

  return (
    <View style={{ gap: spacing[2] }}>
      {/* Label */}
      <Text variant="bodySm" color={colors.fg[3]}>
        {label}
      </Text>

      {/* Pressable row — styled like an input field */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${displayText}. Tocá para cambiar la fecha.`}
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={handlePress}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: colors.bg[2],
          borderRadius: radii.md,
          borderWidth: 1,
          borderColor: colors.line[2],
          minHeight: 48,
          paddingHorizontal: spacing[4],
          paddingVertical: spacing[3],
          opacity: disabled ? 0.5 : pressed ? 0.85 : 1,
        })}
      >
        <Text
          variant="body"
          color={disabled ? colors.fg[4] : colors.fg[1]}
          style={{ fontFamily: typography.family.regular }}
        >
          {displayText}
        </Text>
        <Icon
          name="Calendar"
          size={20}
          color={disabled ? colors.fg[4] : colors.fg[3]}
          strokeWidth={1.5}
        />
      </Pressable>

      {/* Picker — Android: modal dialog; iOS: inline spinner */}
      {open && (
        <DateTimePicker
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          value={selectedDate}
          maximumDate={TODAY}
          onChange={handleChange}
          locale="es-AR"
        />
      )}
    </View>
  );
}
