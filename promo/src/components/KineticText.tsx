import React from 'react';
import { useCurrentFrame } from 'remotion';
import { colors, type } from '../theme/tokens';
import { fontFamily } from '../theme/fonts';
import { enter } from '../theme/anim';

/** A line (or stack of lines) of kinetic text with staggered fade+slide entrances. */
export const KineticText: React.FC<{
  lines: React.ReactNode[];
  size?: number;
  weight?: number;
  color?: string;
  align?: 'left' | 'center';
  lineHeight?: number;
  stagger?: number;
  delay?: number;
  maxWidth?: number;
  style?: React.CSSProperties;
}> = ({
  lines,
  size = type.h1,
  weight = 700,
  color = colors.fg1,
  align = 'center',
  lineHeight = type.lhTight,
  stagger = 6,
  delay = 0,
  maxWidth = 920,
  style,
}) => {
  const frame = useCurrentFrame();
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: align === 'center' ? 'center' : 'flex-start',
        textAlign: align,
        maxWidth,
        gap: size * 0.12,
        ...style,
      }}
    >
      {lines.map((line, i) => (
        <span
          key={i}
          style={{
            fontFamily,
            fontWeight: weight,
            fontSize: size,
            lineHeight,
            color,
            letterSpacing: '-0.02em',
            ...enter(frame, { delay: delay + i * stagger }),
          }}
        >
          {line}
        </span>
      ))}
    </div>
  );
};
