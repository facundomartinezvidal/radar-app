/**
 * RADAR Design System — Text primitive (B1)
 *
 * Provides typed variants that map directly to DS typography tokens.
 * All variants read from `@/lib/theme` — no hardcoded values.
 */
import React from 'react';
import { Text as RNText, type TextProps as RNTextProps } from 'react-native';

import { colors, typography } from '@/lib/theme';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TextVariant =
  | 'display'
  | 'h1'
  | 'h2'
  | 'h3'
  | 'body'
  | 'bodySm'
  | 'caption'
  | 'micro'
  | 'label'
  | 'money';

export type TextTone = 'in' | 'out' | 'neutral' | 'default';

export interface TextProps extends RNTextProps {
  variant?: TextVariant;
  /** Only meaningful for 'money' and 'body' variants; others ignore it. */
  tone?: TextTone;
  /** Override the resolved color. */
  color?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resolveColor(variant: TextVariant, tone?: TextTone, override?: string): string {
  if (override) return override;

  if (variant === 'money') {
    switch (tone) {
      case 'in':
        return colors.money.in;
      case 'out':
        return colors.money.out;
      case 'neutral':
        return colors.fg[2];
      default:
        return colors.fg[1];
    }
  }

  switch (variant) {
    case 'display':
    case 'h1':
    case 'h2':
    case 'h3':
      return colors.fg[1];
    case 'body':
    case 'bodySm':
      return colors.fg[2];
    case 'caption':
    case 'micro':
    case 'label':
      return colors.fg[3];
    default:
      return colors.fg[2];
  }
}

// ---------------------------------------------------------------------------
// Variant style map
// ---------------------------------------------------------------------------

interface VariantStyle {
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  letterSpacing?: number;
  textTransform?: 'uppercase' | 'lowercase' | 'capitalize' | 'none';
  fontVariant?: ('tabular-nums' | 'small-caps' | 'oldstyle-nums')[];
}

const VARIANT_STYLES: Record<TextVariant, VariantStyle> = {
  display: {
    fontFamily: typography.family.bold,
    fontSize: typography.size.display,
    lineHeight: typography.size.display * typography.lh.tight,
    letterSpacing: typography.letterSpacingFor(typography.size.display, 'display'),
  },
  h1: {
    fontFamily: typography.family.bold,
    fontSize: typography.size.h1,
    lineHeight: typography.size.h1 * typography.lh.tight,
    letterSpacing: typography.letterSpacingFor(typography.size.display, 'display'),
  },
  h2: {
    fontFamily: typography.family.semibold,
    fontSize: typography.size.h2,
    lineHeight: typography.size.h2 * typography.lh.snug,
    letterSpacing: -0.01 * typography.size.h2,
  },
  h3: {
    fontFamily: typography.family.semibold,
    fontSize: typography.size.h3,
    lineHeight: typography.size.h3 * typography.lh.snug,
  },
  body: {
    fontFamily: typography.family.regular,
    fontSize: typography.size.body,
    lineHeight: typography.size.body * typography.lh.body,
  },
  bodySm: {
    fontFamily: typography.family.regular,
    fontSize: typography.size.bodySm,
    lineHeight: typography.size.bodySm * typography.lh.body,
  },
  caption: {
    fontFamily: typography.family.regular,
    fontSize: typography.size.caption,
    lineHeight: typography.size.caption * 1.35,
  },
  micro: {
    fontFamily: typography.family.regular,
    fontSize: typography.size.micro,
    lineHeight: typography.size.micro * 1.3,
  },
  label: {
    fontFamily: typography.family.semibold,
    fontSize: typography.size.caption,
    lineHeight: typography.size.caption * 1.35,
    letterSpacing: typography.letterSpacingFor(typography.size.caption, 'label'),
    textTransform: 'uppercase',
  },
  money: {
    fontFamily: typography.family.semibold,
    fontSize: typography.size.body,
    lineHeight: typography.size.body * typography.lh.body,
    fontVariant: ['tabular-nums'],
  },
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function Text({
  variant = 'body',
  tone,
  color,
  style,
  ...rest
}: TextProps): React.JSX.Element {
  const variantStyle = VARIANT_STYLES[variant];
  const resolvedColor = resolveColor(variant, tone, color);

  return <RNText style={[variantStyle, { color: resolvedColor }, style]} {...rest} />;
}

// ---------------------------------------------------------------------------
// Convenience aliases
// ---------------------------------------------------------------------------

export const Display = (props: Omit<TextProps, 'variant'>): React.JSX.Element => (
  <Text variant="display" {...props} />
);

export const H1 = (props: Omit<TextProps, 'variant'>): React.JSX.Element => (
  <Text variant="h1" {...props} />
);

export const H2 = (props: Omit<TextProps, 'variant'>): React.JSX.Element => (
  <Text variant="h2" {...props} />
);

export const H3 = (props: Omit<TextProps, 'variant'>): React.JSX.Element => (
  <Text variant="h3" {...props} />
);

export const Body = (props: Omit<TextProps, 'variant'>): React.JSX.Element => (
  <Text variant="body" {...props} />
);

export const BodySm = (props: Omit<TextProps, 'variant'>): React.JSX.Element => (
  <Text variant="bodySm" {...props} />
);

export const Caption = (props: Omit<TextProps, 'variant'>): React.JSX.Element => (
  <Text variant="caption" {...props} />
);

export const Micro = (props: Omit<TextProps, 'variant'>): React.JSX.Element => (
  <Text variant="micro" {...props} />
);

export const Label = (props: Omit<TextProps, 'variant'>): React.JSX.Element => (
  <Text variant="label" {...props} />
);

export const Money = (props: Omit<TextProps, 'variant'>): React.JSX.Element => (
  <Text variant="money" {...props} />
);
