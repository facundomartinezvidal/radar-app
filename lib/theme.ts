/**
 * RADAR Design System — Token Library
 *
 * Single source of truth for all DS tokens in React Native.
 * Mirrors `desing-system/colors_and_type.css` exactly.
 *
 * Pure data — no React components.
 */
import type { ViewStyle } from 'react-native';

// ---------------------------------------------------------------------------
// COLORS
// ---------------------------------------------------------------------------

export const colors = {
  /** Brand: Ocean Blue */
  brand: {
    50: '#E6F3FA',
    100: '#C0E1F2',
    200: '#8ACCE9',
    300: '#4FB3DC',
    400: '#1E99CC',
    500: '#0077B6', // PRIMARY
    600: '#005F94',
    700: '#004872',
    800: '#003352',
    900: '#001F35',
  },
  /** Accent: Warm Amber — alerts + USD */
  amber: {
    400: '#FFB347',
    500: '#F59E0B',
    600: '#D97706',
  },
  /**
   * Semantic money colours.
   * in  = ingreso / te deben
   * out = gasto / debés
   */
  money: {
    in: '#10B981',
    in2: '#34D399',
    out: '#EF4444',
    out2: '#F87171',
    neutralBal: '#64748B',
  },
  /** State colours */
  state: {
    info: '#0077B6',
    warn: '#F59E0B',
    success: '#10B981',
    danger: '#EF4444',
  },
  /**
   * Backgrounds — layered from deepest to nearest surface (dark-first).
   * bg[0] = app base
   * bg[1] = card
   * bg[2] = raised card
   * bg[3] = hover / pressed
   * bg[4] = outlined control
   */
  bg: {
    0: '#0A0F1A',
    1: '#0F1724',
    2: '#17202F',
    3: '#1F2A3D',
    4: '#2B3A54',
  },
  /** Dividers / borders — transparent white tiers */
  line: {
    1: 'rgba(255,255,255,0.06)',
    2: 'rgba(255,255,255,0.10)',
    3: 'rgba(255,255,255,0.16)',
  },
  /**
   * Foreground (text / icon) emphasis levels.
   * fg[1] = high emphasis (titles, amounts)
   * fg[2] = secondary (subtitles, captions)
   * fg[3] = tertiary (helpers, labels)
   * fg[4] = disabled / placeholder
   */
  fg: {
    1: '#F4F7FB',
    2: '#B8C3D4',
    3: '#7E8AA0',
    4: '#4B566B',
    onBrand: '#FFFFFF',
  },
} as const;

export type ThemeColors = typeof colors;

// ---------------------------------------------------------------------------
// RADII
// ---------------------------------------------------------------------------

export const radii = {
  xs: 6,
  sm: 10,
  md: 14,
  lg: 20,
  xl: 28,
  pill: 999,
} as const;

// ---------------------------------------------------------------------------
// SPACING  (4 px base grid)
// ---------------------------------------------------------------------------

export const spacing = {
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  7: 32,
  8: 40,
  9: 56,
  10: 72,
} as const;

// ---------------------------------------------------------------------------
// SHADOWS
//
// RN does not accept CSS box-shadow strings.  Each tier is translated to a
// React Native ViewStyle subset:
//   shadowColor / shadowOffset / shadowOpacity / shadowRadius → iOS
//   elevation → Android
//
// CSS source:
//   --shadow-1: 0 1px 0 rgba(255,255,255,0.04) inset, 0 1px 2px rgba(0,0,0,0.4);
//   --shadow-2: 0 1px 0 rgba(255,255,255,0.05) inset, 0 6px 20px rgba(0,0,0,0.35);
//   --shadow-3: 0 1px 0 rgba(255,255,255,0.06) inset, 0 18px 40px rgba(0,0,0,0.55);
//
// The inset highlight can only be approximated with a borderTop trick in RN;
// it is noted in comments below but not included in the type so callers don't
// accidentally pass non-shadow keys to ViewStyle shadow props.
// ---------------------------------------------------------------------------

export const shadows: Record<'one' | 'two' | 'three', ViewStyle> = {
  /** --shadow-1 · subtle card lift */
  one: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.4,
    shadowRadius: 2,
    elevation: 2,
  },
  /** --shadow-2 · standard card / modal */
  two: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 8,
  },
  /** --shadow-3 · bottom-sheet / overlay */
  three: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.55,
    shadowRadius: 40,
    elevation: 16,
  },
};

// ---------------------------------------------------------------------------
// MOTION
//
// Cubic-bezier strings are for reference / Reanimated Easing.bezier().
// They cannot be used directly as RN style values.
// ---------------------------------------------------------------------------

export const motion = {
  /** Default ease-out — most transitions */
  easeOut: 'cubic-bezier(0.2,0.8,0.2,1)',
  /** Spring — micro-celebrations only */
  spring: 'cubic-bezier(0.34,1.56,0.64,1)',
  /** Durations in milliseconds */
  dur: {
    1: 120,
    2: 200,
    3: 320,
  },
} as const;

// ---------------------------------------------------------------------------
// TYPOGRAPHY
//
// Font family constants match the exact keys registered by expo-google-fonts.
// letterSpacing in RN is a unitless number (sp/dp), not em.
// Conversion formula: letterSpacingFor(fontSize) = em × fontSize
//
// Examples from CSS:
//   --tracking-display: -0.02em  → at 44px → -0.88
//   --tracking-label:    0.04em  → at 12px →  0.48
// ---------------------------------------------------------------------------

export const typography = {
  /** Base sans font — loaded via useFonts() in root layout */
  sans: 'Inter_400Regular',
  /** Monospace — amounts, inputs, CBU/CVU */
  mono: 'JetBrainsMono_400Regular',

  /** Named font size scale (px / dp) */
  size: {
    display: 44, // saldo hero
    h1: 32,
    h2: 24,
    h3: 20,
    body: 16,
    bodySm: 14,
    caption: 12,
    micro: 11,
  },

  /** Line-height multipliers (unitless) */
  lh: {
    tight: 1.1,
    snug: 1.25,
    body: 1.5,
  },

  /**
   * Letter-spacing helper.
   * Because RN uses absolute units, call letterSpacingFor() at usage site.
   *
   * @example
   *   letterSpacingFor(44, 'display') // → -0.88
   */
  letterSpacingFor: (fontSize: number, variant: 'display' | 'label'): number => {
    const emValues = { display: -0.02, label: 0.04 } as const;
    return emValues[variant] * fontSize;
  },

  /** Font weight string tokens */
  weight: {
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
    extrabold: '800' as const,
  },

  /**
   * Named font family keys for each weight/style.
   * Use these string values in TextStyle.fontFamily.
   */
  family: {
    regular: 'Inter_400Regular',
    medium: 'Inter_500Medium',
    semibold: 'Inter_600SemiBold',
    bold: 'Inter_700Bold',
    extrabold: 'Inter_800ExtraBold',
    monoRegular: 'JetBrainsMono_400Regular',
    monoMedium: 'JetBrainsMono_500Medium',
  },
} as const;
