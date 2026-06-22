// Tokens mirrored from desing-system/colors_and_type.css.
// Compositions reference these — never hardcode hex/px in components.

export const colors = {
  // Brand (ocean blue)
  radar50: '#E6F3FA',
  radar100: '#C0E1F2',
  radar200: '#8ACCE9',
  radar300: '#4FB3DC', // accent / links
  radar400: '#1E99CC',
  radar500: '#0077B6', // primary
  radar600: '#005F94',
  radar700: '#004872',
  radar800: '#003352',
  radar900: '#001F35',

  // Semantics
  moneyIn: '#10B981', // income / "te deben"
  moneyIn2: '#34D399',
  moneyOut: '#EF4444', // expense / "debés"
  moneyOut2: '#F87171',
  amber: '#F59E0B', // alerts / USD

  // Dark-first neutrals
  bg0: '#0A0F1A', // app background
  bg1: '#0F1724', // card
  bg2: '#17202F', // raised card
  bg3: '#1F2A3D', // hover/pressed
  bg4: '#2B3A54', // outlined control

  fg1: '#F4F7FB', // high emphasis (titles, amounts)
  fg2: '#B8C3D4', // secondary
  fg3: '#7E8AA0', // tertiary / captions
  fg4: '#4B566B', // disabled / placeholder

  borderSubtle: 'rgba(255,255,255,0.06)',
  borderVisible: 'rgba(255,255,255,0.10)',
} as const;

export const type = {
  display: 96, // scaled up from 44 for 1080-wide vertical canvas
  h1: 64,
  h2: 48,
  h3: 36,
  body: 30,
  bodySm: 26,
  caption: 22,
  micro: 20,
  lhTight: 1.1,
  lhSnug: 1.25,
  lhBody: 1.5,
  // tabular + lining numerals — the numbers ARE the UI
  numeric: '"tnum" 1, "lnum" 1, "ss01" 1',
} as const;

// 4px base scale
export const space = {
  s1: 4,
  s2: 8,
  s3: 12,
  s4: 16,
  s5: 20,
  s6: 24,
  s7: 32,
  s8: 40,
  s9: 56,
  s10: 72,
} as const;

export const radii = {
  xs: 6,
  sm: 10,
  md: 14,
  lg: 20,
  xl: 28,
  pill: 999,
} as const;

export const shadow = {
  card: '0 1px 0 rgba(255,255,255,0.05) inset, 0 6px 20px rgba(0,0,0,0.35)',
  sheet: '0 1px 0 rgba(255,255,255,0.06) inset, 0 18px 40px rgba(0,0,0,0.55)',
  glowBrand: '0 0 0 1px rgba(0,119,182,0.5), 0 8px 28px rgba(0,119,182,0.35)',
} as const;

export const motion = {
  // cubic-bezier control points for Remotion's Easing.bezier(...)
  easeOut: [0.2, 0.8, 0.2, 1] as const,
  easeSpring: [0.34, 1.56, 0.64, 1] as const,
  dur1: 120,
  dur2: 200,
  dur3: 320,
} as const;

export const VIDEO = {
  width: 1080,
  height: 1920,
  fps: 30,
  durationInFrames: 600, // ~20s (intro text → app → outro logo)
} as const;

export const TAGLINE = 'RADAR. Sabé a dónde va tu plata.';
