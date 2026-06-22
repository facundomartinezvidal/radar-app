// Faithful 1:1 copy of the app's lib/theme.ts — used to render the in-device
// screens at real device resolution so proportions match the app exactly.
import { fontFamily as inter, monoFamily as mono } from '../theme/fonts';

export const colors = {
  brand: { 50: '#E6F3FA', 100: '#C0E1F2', 200: '#8ACCE9', 300: '#4FB3DC', 400: '#1E99CC', 500: '#0077B6', 600: '#005F94', 700: '#004872', 800: '#003352', 900: '#001F35' },
  amber: { 400: '#FFB347', 500: '#F59E0B', 600: '#D97706' },
  money: { in: '#10B981', in2: '#34D399', out: '#EF4444', out2: '#F87171', neutralBal: '#64748B' },
  state: { info: '#0077B6', warn: '#F59E0B', success: '#10B981', danger: '#EF4444' },
  bg: { 0: '#0A0F1A', 1: '#0F1724', 2: '#17202F', 3: '#1F2A3D', 4: '#2B3A54' },
  line: { 1: 'rgba(255,255,255,0.06)', 2: 'rgba(255,255,255,0.10)', 3: 'rgba(255,255,255,0.16)' },
  fg: { 1: '#F4F7FB', 2: '#B8C3D4', 3: '#7E8AA0', 4: '#4B566B', onBrand: '#FFFFFF' },
} as const;

export const radii = { xs: 6, sm: 10, md: 14, lg: 20, xl: 28, pill: 999 } as const;

export const spacing = { 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 7: 32, 8: 40, 9: 56, 10: 72 } as const;

// shadow-2 (standard card) as a CSS box-shadow for DOM.
export const shadowTwo = '0 1px 0 rgba(255,255,255,0.05) inset, 0 6px 20px rgba(0,0,0,0.35)';
export const shadowThree = '0 1px 0 rgba(255,255,255,0.06) inset, 0 18px 40px rgba(0,0,0,0.55)';

export const size = { display: 44, h1: 32, h2: 24, h3: 20, body: 16, bodySm: 14, caption: 12, micro: 11 } as const;
export const lh = { tight: 1.1, snug: 1.25, body: 1.5 } as const;

// Inter is loaded as one family with multiple weights; map app family keys to weights.
type Weight = 400 | 500 | 600 | 700 | 800;
export const font = (weight: Weight, monospace = false) => ({
  fontFamily: monospace ? mono : inter,
  fontWeight: weight as unknown as number,
});
export const weights = { regular: 400, medium: 500, semibold: 600, bold: 700, extrabold: 800 } as const;
