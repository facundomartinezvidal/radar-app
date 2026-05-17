/**
 * RADAR Design System — Pill primitive (B2)
 *
 * Semantic badge/tag component used for transaction types, categories, etc.
 */
import React from 'react';
import { View } from 'react-native';

import { colors, radii } from '@/lib/theme';
import { Text } from './text';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PillVariant = 'neutral' | 'income' | 'expense' | 'alert' | 'brand';
export type PillSize = 'sm' | 'md';

export interface PillProps {
  variant?: PillVariant;
  size?: PillSize;
  icon?: React.ReactNode;
  children: React.ReactNode;
}

// ---------------------------------------------------------------------------
// Color map
// ---------------------------------------------------------------------------

interface PillColors {
  background: string;
  border: string;
  text: string;
}

const PILL_COLORS: Record<PillVariant, PillColors> = {
  neutral: {
    background: 'rgba(255,255,255,0.06)',
    border: colors.line[2],
    text: colors.fg[2],
  },
  income: {
    background: 'rgba(16,185,129,0.12)',
    border: 'rgba(16,185,129,0.3)',
    text: colors.money.in,
  },
  expense: {
    background: 'rgba(239,68,68,0.12)',
    border: 'rgba(239,68,68,0.3)',
    text: colors.money.out,
  },
  alert: {
    background: 'rgba(245,158,11,0.12)',
    border: 'rgba(245,158,11,0.3)',
    text: colors.amber[500],
  },
  brand: {
    background: 'rgba(0,119,182,0.12)',
    border: 'rgba(0,119,182,0.3)',
    text: colors.brand[300],
  },
};

// ---------------------------------------------------------------------------
// Size map
// ---------------------------------------------------------------------------

interface PillPadding {
  paddingVertical: number;
  paddingHorizontal: number;
}

const PILL_PADDING: Record<PillSize, PillPadding> = {
  sm: { paddingVertical: 4, paddingHorizontal: 10 },
  md: { paddingVertical: 6, paddingHorizontal: 12 },
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function Pill({
  variant = 'neutral',
  size = 'md',
  icon,
  children,
}: PillProps): React.JSX.Element {
  const pillColors = PILL_COLORS[variant];
  const pillPadding = PILL_PADDING[size];

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        alignSelf: 'flex-start',
        borderRadius: radii.pill,
        borderWidth: 1,
        borderColor: pillColors.border,
        backgroundColor: pillColors.background,
        paddingVertical: pillPadding.paddingVertical,
        paddingHorizontal: pillPadding.paddingHorizontal,
      }}
    >
      {icon != null && icon}
      <Text variant="caption" color={pillColors.text} style={{ fontWeight: '600' }}>
        {children}
      </Text>
    </View>
  );
}
