/**
 * PeriodFilterBar — preset chips + month selector for the Insights screen.
 *
 * Preset chips: "Este mes", "Mes pasado", "Últimos 3 meses", "Este año".
 * Month selector: < {period.label} > with prev/next chevrons.
 *
 * Active-preset state: tapping a preset chip sets `activePreset`; using the
 * chevron arrows clears it (the period is then an arbitrary month, not a preset).
 * The right chevron is visually disabled when the period is already the current
 * month (future months are clamped upstream by `shiftMonth`).
 */
import React, { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { Icon, Text } from '@/components/ui';
import { presetPeriod, shiftMonth } from '@/lib/insights/periods';
import type { Period, PeriodPresetId } from '@/lib/insights/types';
import { colors, radii, spacing, typography } from '@/lib/theme';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PeriodFilterBarProps {
  period: Period;
  onChange: (p: Period) => void;
}

// ---------------------------------------------------------------------------
// Preset config
// ---------------------------------------------------------------------------

interface PresetConfig {
  id: PeriodPresetId;
  label: string;
}

const PRESETS: PresetConfig[] = [
  { id: 'this-month', label: 'Este mes' },
  { id: 'last-month', label: 'Mes pasado' },
  { id: 'last-3-months', label: 'Últimos 3 meses' },
  { id: 'this-year', label: 'Este año' },
];

// ---------------------------------------------------------------------------
// Helper — check if a Period is the current calendar month
// ---------------------------------------------------------------------------

function isCurrentMonth(period: Period): boolean {
  const now = new Date();
  const fromDate = new Date(period.from);
  return fromDate.getFullYear() === now.getFullYear() && fromDate.getMonth() === now.getMonth();
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PeriodFilterBar({ period, onChange }: PeriodFilterBarProps): React.JSX.Element {
  const [activePreset, setActivePreset] = useState<PeriodPresetId | null>('this-month');

  function handlePresetPress(id: PeriodPresetId): void {
    setActivePreset(id);
    onChange(presetPeriod(id));
  }

  function handlePrev(): void {
    setActivePreset(null);
    onChange(shiftMonth(period, -1));
  }

  function handleNext(): void {
    if (isCurrentMonth(period)) return;
    setActivePreset(null);
    onChange(shiftMonth(period, +1));
  }

  const rightDisabled = isCurrentMonth(period);

  return (
    <View style={{ gap: spacing[3] }}>
      {/* Preset chips row */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: spacing[2], paddingVertical: spacing[1] }}
      >
        {PRESETS.map((preset) => {
          const active = activePreset === preset.id;
          return (
            <Pressable
              key={preset.id}
              onPress={() => handlePresetPress(preset.id)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={preset.label}
            >
              <View
                style={{
                  paddingVertical: spacing[1],
                  paddingHorizontal: spacing[3],
                  borderRadius: radii.pill,
                  borderWidth: active ? 2 : 1,
                  borderColor: active ? colors.brand[400] : colors.line[2],
                  backgroundColor: active ? `${colors.brand[500]}1A` : 'transparent',
                }}
              >
                <Text
                  variant="caption"
                  color={active ? colors.brand[300] : colors.fg[2]}
                  style={{ fontWeight: active ? '700' : '600' }}
                >
                  {preset.label}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Month selector row */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: spacing[2],
        }}
      >
        <Pressable
          onPress={handlePrev}
          accessibilityRole="button"
          accessibilityLabel="Mes anterior"
          hitSlop={8}
        >
          <Icon name="ChevronLeft" size={20} color={colors.fg[2]} strokeWidth={1.5} />
        </Pressable>

        <Text
          variant="bodySm"
          color={colors.fg[1]}
          style={{ fontFamily: typography.family.semibold }}
        >
          {period.label}
        </Text>

        <Pressable
          onPress={handleNext}
          disabled={rightDisabled}
          accessibilityRole="button"
          accessibilityLabel="Mes siguiente"
          accessibilityState={{ disabled: rightDisabled }}
          hitSlop={8}
        >
          <Icon
            name="ChevronRight"
            size={20}
            color={rightDisabled ? colors.fg[4] : colors.fg[2]}
            strokeWidth={1.5}
          />
        </Pressable>
      </View>
    </View>
  );
}
