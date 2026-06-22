import React from 'react';
import { colors, size, lh, font, weights } from './tokens';

// Mirrors components/ui/text.tsx variants exactly.
export type Variant = 'display' | 'h1' | 'h2' | 'h3' | 'body' | 'bodySm' | 'caption' | 'micro' | 'label' | 'money';
export type Tone = 'in' | 'out' | 'neutral' | 'default';

const tnum: React.CSSProperties = { fontVariantNumeric: 'tabular-nums lining-nums', fontFeatureSettings: '"tnum" 1, "lnum" 1' };

const variantStyle = (v: Variant): React.CSSProperties => {
  switch (v) {
    case 'display':
      return { ...font(weights.bold), fontSize: size.display, lineHeight: `${size.display * lh.tight}px`, letterSpacing: -0.02 * size.display, ...tnum };
    case 'h1':
      return { ...font(weights.bold), fontSize: size.h1, lineHeight: `${size.h1 * lh.tight}px`, letterSpacing: -0.02 * size.h1 };
    case 'h2':
      return { ...font(weights.semibold), fontSize: size.h2, lineHeight: `${size.h2 * lh.snug}px`, letterSpacing: -0.01 * size.h2 };
    case 'h3':
      return { ...font(weights.semibold), fontSize: size.h3, lineHeight: `${size.h3 * lh.snug}px` };
    case 'body':
      return { ...font(weights.regular), fontSize: size.body, lineHeight: `${size.body * lh.body}px` };
    case 'bodySm':
      return { ...font(weights.regular), fontSize: size.bodySm, lineHeight: `${size.bodySm * lh.body}px` };
    case 'caption':
      return { ...font(weights.regular), fontSize: size.caption, lineHeight: `${size.caption * 1.35}px` };
    case 'micro':
      return { ...font(weights.regular), fontSize: size.micro, lineHeight: `${size.micro * 1.3}px` };
    case 'label':
      return { ...font(weights.semibold), fontSize: size.caption, lineHeight: `${size.caption * 1.35}px`, letterSpacing: 0.04 * size.caption, textTransform: 'uppercase' };
    case 'money':
      return { ...font(weights.semibold), fontSize: size.body, lineHeight: `${size.body * lh.body}px`, ...tnum };
  }
};

const resolveColor = (v: Variant, tone?: Tone, override?: string): string => {
  if (override) return override;
  if (v === 'money') {
    if (tone === 'in') return colors.money.in;
    if (tone === 'out') return colors.money.out;
    if (tone === 'neutral') return colors.fg[2];
    return colors.fg[1];
  }
  if (v === 'display' || v === 'h1' || v === 'h2' || v === 'h3') return colors.fg[1];
  if (v === 'body' || v === 'bodySm') return colors.fg[2];
  return colors.fg[3];
};

export const T: React.FC<{
  variant?: Variant;
  tone?: Tone;
  color?: string;
  children: React.ReactNode;
  style?: React.CSSProperties;
}> = ({ variant = 'body', tone, color, children, style }) => (
  <span style={{ display: 'block', color: resolveColor(variant, tone, color), ...variantStyle(variant), ...style }}>{children}</span>
);
