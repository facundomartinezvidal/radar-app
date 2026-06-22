import React from 'react';
import { useCurrentFrame, useVideoConfig } from 'remotion';
import { colors, type } from '../theme/tokens';
import { fontFamily } from '../theme/fonts';

/**
 * Animated RADAR mark: static rings + a rotating sweep (360° in 1.8s).
 * Pass `animated={false}` to render a static dark-mode mark (no rotating
 * wedge) — used for avatar instances inside the WhatsApp chrome.
 */
const Mark: React.FC<{ size: number; animated?: boolean }> = ({ size, animated = true }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const angle = animated ? (frame / (1.8 * fps)) * 360 : 0;

  return (
    <svg width={size} height={size} viewBox="0 0 96 96" fill="none">
      {/* Dark background circle for dark-mode static variant */}
      {!animated && (
        <circle cx="48" cy="48" r="48" fill={colors.bg0} />
      )}
      <circle cx="48" cy="48" r="44" stroke={colors.radar500} strokeWidth="2" opacity={animated ? 0.25 : 0.55} />
      <circle cx="48" cy="48" r="30" stroke={colors.radar500} strokeWidth="2" opacity={animated ? 0.45 : 0.75} />
      <circle cx="48" cy="48" r="16" stroke={colors.radar500} strokeWidth="2" opacity={animated ? 0.7 : 0.95} />
      {animated && (
        <g transform={`rotate(${angle} 48 48)`}>
          <path d="M48 48 L48 4 A44 44 0 0 1 87.1 70.1 Z" fill="url(#sweep)" opacity="0.85" />
          <circle cx="66" cy="32" r="4" fill={colors.radar300} />
          <circle cx="66" cy="32" r="9" fill={colors.radar300} opacity="0.22" />
        </g>
      )}
      <circle cx="48" cy="48" r="3" fill={colors.radar500} />
      {animated && (
        <defs>
          <linearGradient id="sweep" x1="48" y1="4" x2="88" y2="70" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor={colors.radar500} stopOpacity="0" />
            <stop offset="1" stopColor={colors.radar500} stopOpacity="0.55" />
          </linearGradient>
        </defs>
      )}
    </svg>
  );
};

export const LogoSweep: React.FC<{
  variant?: 'mark' | 'wordmark';
  size?: number;
  /** When false, renders a static dark-mode mark (no rotating sweep).
   *  Defaults to true. The outro wordmark always stays animated. */
  animated?: boolean;
}> = ({ variant = 'wordmark', size = 120, animated = true }) => {
  if (variant === 'mark') return <Mark size={size} animated={animated} />;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: size * 0.18 }}>
      <Mark size={size} animated={animated} />
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
