import React from 'react';
import { useCurrentFrame, useVideoConfig } from 'remotion';
import { colors, type } from '../theme/tokens';
import { fontFamily } from '../theme/fonts';

/** Animated RADAR mark: static rings + a rotating sweep (360° in 1.8s). */
const Mark: React.FC<{ size: number }> = ({ size }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const angle = (frame / (1.8 * fps)) * 360; // 1.8s per revolution, linear

  return (
    <svg width={size} height={size} viewBox="0 0 96 96" fill="none">
      <circle cx="48" cy="48" r="44" stroke={colors.radar500} strokeWidth="2" opacity="0.25" />
      <circle cx="48" cy="48" r="30" stroke={colors.radar500} strokeWidth="2" opacity="0.45" />
      <circle cx="48" cy="48" r="16" stroke={colors.radar500} strokeWidth="2" opacity="0.7" />
      <g transform={`rotate(${angle} 48 48)`}>
        <path d="M48 48 L48 4 A44 44 0 0 1 87.1 70.1 Z" fill="url(#sweep)" opacity="0.85" />
        <circle cx="66" cy="32" r="4" fill={colors.radar300} />
        <circle cx="66" cy="32" r="9" fill={colors.radar300} opacity="0.22" />
      </g>
      <circle cx="48" cy="48" r="3" fill={colors.radar500} />
      <defs>
        <linearGradient id="sweep" x1="48" y1="4" x2="88" y2="70" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor={colors.radar500} stopOpacity="0" />
          <stop offset="1" stopColor={colors.radar500} stopOpacity="0.55" />
        </linearGradient>
      </defs>
    </svg>
  );
};

export const LogoSweep: React.FC<{
  variant?: 'mark' | 'wordmark';
  size?: number;
}> = ({ variant = 'wordmark', size = 120 }) => {
  if (variant === 'mark') return <Mark size={size} />;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: size * 0.18 }}>
      <Mark size={size} />
      <span
        style={{
          fontFamily,
          fontWeight: 800,
          fontSize: size * 0.66,
          letterSpacing: '-0.03em',
          color: colors.fg1,
        }}
      >
        RADAR
      </span>
    </div>
  );
};

export const Tagline: React.FC<{ size?: number; style?: React.CSSProperties }> = ({ size = type.body, style }) => (
  <span style={{ fontFamily, fontWeight: 500, fontSize: size, color: colors.fg2, letterSpacing: '-0.01em', ...style }}>
    Sabé a dónde va tu plata.
  </span>
);
