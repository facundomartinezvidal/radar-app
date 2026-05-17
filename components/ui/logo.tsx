/**
 * RADAR Logo components — SVG-as-component for crisp scaling.
 *
 * Two exports:
 *   LogoMark     — the radar-sweep icon alone (default 40×40)
 *   LogoWordmark — the icon + "RADAR" text side-by-side (default height 32)
 *
 * Both are translated from `desing-system/assets/logo-mark.svg` and
 * `desing-system/assets/logo-wordmark.svg` using react-native-svg.
 *
 * Color prop follows currentColor pattern: pass `color` to tint the brand
 * elements. The sweep gradient always uses the brand primary.
 */
import React from 'react';
import {
  Circle,
  Defs,
  G,
  LinearGradient,
  Path,
  Stop,
  Svg,
  Text as SvgText,
} from 'react-native-svg';

import { colors } from '@/lib/theme';

// ---------------------------------------------------------------------------
// LogoMark
// SVG source viewBox="0 0 96 96"
// ---------------------------------------------------------------------------

interface LogoMarkProps {
  /** Overall size of the square icon (width = height). Default 40. */
  size?: number;
  /** Brand colour for rings, dot, and sweep. Default colors.brand[500]. */
  color?: string;
}

/**
 * Radar sweep icon — rings + sweep sector + blip dot.
 * Scales uniformly via the `size` prop.
 */
export function LogoMark({
  size = 40,
  color = colors.brand[500],
}: LogoMarkProps): React.JSX.Element {
  return (
    <Svg width={size} height={size} viewBox="0 0 96 96" fill="none">
      <Defs>
        <LinearGradient
          id="sweepMark"
          x1="48"
          y1="4"
          x2="88"
          y2="70"
          gradientUnits="userSpaceOnUse"
        >
          <Stop offset="0" stopColor={color} stopOpacity={0} />
          <Stop offset="1" stopColor={color} stopOpacity={0.55} />
        </LinearGradient>
      </Defs>

      {/* Concentric rings */}
      <Circle cx={48} cy={48} r={44} stroke={color} strokeWidth={2} opacity={0.25} />
      <Circle cx={48} cy={48} r={30} stroke={color} strokeWidth={2} opacity={0.45} />
      <Circle cx={48} cy={48} r={16} stroke={color} strokeWidth={2} opacity={0.7} />

      {/* Radar sweep sector */}
      <Path d="M48 48 L48 4 A44 44 0 0 1 87.1 70.1 Z" fill="url(#sweepMark)" opacity={0.85} />

      {/* Blip — target contact */}
      <Circle cx={66} cy={32} r={9} fill={colors.brand[300]} opacity={0.22} />
      <Circle cx={66} cy={32} r={4} fill={colors.brand[300]} />

      {/* Centre dot */}
      <Circle cx={48} cy={48} r={3} fill={color} />
    </Svg>
  );
}

// ---------------------------------------------------------------------------
// LogoWordmark
// SVG source viewBox="0 0 320 96"
// ---------------------------------------------------------------------------

interface LogoWordmarkProps {
  /**
   * Height of the rendered component.  Width is calculated proportionally
   * from the source viewBox (320:96 ≈ 3.33:1).
   * Default 32.
   */
  height?: number;
  /** Colour for the icon mark. Default colors.brand[500]. */
  color?: string;
  /** Colour for the "RADAR" wordmark text. Default colors.fg[1]. */
  textColor?: string;
}

/**
 * Full-lockup logo: radar-sweep icon + "RADAR" wordmark.
 * Scales uniformly via the `height` prop.
 */
export function LogoWordmark({
  height = 32,
  color = colors.brand[500],
  textColor = colors.fg[1],
}: LogoWordmarkProps): React.JSX.Element {
  // viewBox is 320×96; maintain aspect ratio from height
  const width = (320 / 96) * height;

  return (
    <Svg width={width} height={height} viewBox="0 0 320 96" fill="none">
      <Defs>
        <LinearGradient
          id="sweepWord"
          x1="48"
          y1="4"
          x2="88"
          y2="70"
          gradientUnits="userSpaceOnUse"
        >
          <Stop offset="0" stopColor={color} stopOpacity={0} />
          <Stop offset="1" stopColor={color} stopOpacity={0.55} />
        </LinearGradient>
      </Defs>

      {/* Icon mark — same geometry as LogoMark but within the wordmark viewBox */}
      <G transform="translate(4 0)">
        {/* Concentric rings */}
        <Circle cx={48} cy={48} r={44} stroke={color} strokeWidth={2} opacity={0.25} />
        <Circle cx={48} cy={48} r={30} stroke={color} strokeWidth={2} opacity={0.45} />
        <Circle cx={48} cy={48} r={16} stroke={color} strokeWidth={2} opacity={0.7} />

        {/* Radar sweep sector */}
        <Path d="M48 48 L48 4 A44 44 0 0 1 87.1 70.1 Z" fill="url(#sweepWord)" opacity={0.85} />

        {/* Blip */}
        <Circle cx={66} cy={32} r={9} fill={colors.brand[300]} opacity={0.22} />
        <Circle cx={66} cy={32} r={4} fill={colors.brand[300]} />

        {/* Centre dot */}
        <Circle cx={48} cy={48} r={3} fill={color} />
      </G>

      {/*
       * "RADAR" wordmark text.
       * Source SVG: x="108" y="62" font-size="40" font-weight="800" letter-spacing="-1"
       * Inter_800ExtraBold is loaded at runtime; react-native-svg's SvgText will
       * use the system font on older Android if the font isn't loaded, but the
       * proportions are correct.
       */}
      <SvgText
        x={108}
        y={62}
        fontFamily="Inter_800ExtraBold"
        fontWeight="800"
        fontSize={40}
        letterSpacing={-1}
        fill={textColor}
      >
        RADAR
      </SvgText>
    </Svg>
  );
}
