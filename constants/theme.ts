/**
 * RADAR — Theme constants
 *
 * This file re-exports the canonical DS tokens from `lib/theme.ts`.
 *
 * The legacy `Colors` export below is kept for backward-compat with existing
 * consumers only.  It is DEPRECATED — do not use in new code.
 * Import directly from `@/lib/theme` instead.
 *
 * @deprecated Colors (light/dark object)
 */

// Re-export everything from the DS token library so existing imports that
// were doing  `import { Colors } from '@/constants/theme'`  still compile
// while new code can import the richer tokens from @/lib/theme.
export { colors, radii, spacing, shadows, motion, typography } from '@/lib/theme';
export type { ThemeColors } from '@/lib/theme';

import { Platform } from 'react-native';

import { colors } from '@/lib/theme';

/**
 * @deprecated Use `typography.family` from `@/lib/theme` directly.
 *
 * Legacy platform-selected font families kept for existing consumers.
 */
export const Fonts = Platform.select({
  ios: {
    sans: 'Inter_400Regular',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'JetBrainsMono_400Regular',
  },
  default: {
    sans: 'Inter_400Regular',
    serif: 'serif',
    rounded: 'Inter_400Regular',
    mono: 'JetBrainsMono_400Regular',
  },
  web: {
    sans: "Inter_400Regular, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "Inter_400Regular, 'SF Pro Rounded', sans-serif",
    mono: "JetBrainsMono_400Regular, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});

/**
 * @deprecated Use `colors` from `@/lib/theme` directly.
 *
 * Legacy light/dark color map kept so existing consumers don't break.
 * Mapped to the nearest DS token equivalents.
 */
export const Colors = {
  light: {
    /** @deprecated use colors.fg[1] */
    text: '#0A0F1A',
    /** @deprecated use colors.bg[0] */
    background: '#F7F9FC',
    /** @deprecated use colors.brand[500] */
    tint: colors.brand[500],
    /** @deprecated use colors.fg[3] */
    icon: colors.fg[3],
    /** @deprecated use colors.fg[3] */
    tabIconDefault: colors.fg[3],
    /** @deprecated use colors.brand[500] */
    tabIconSelected: colors.brand[500],
  },
  dark: {
    /** @deprecated use colors.fg[1] */
    text: colors.fg[1],
    /** @deprecated use colors.bg[0] */
    background: colors.bg[0],
    /** @deprecated use colors.fg[1] */
    tint: colors.fg[1],
    /** @deprecated use colors.fg[2] */
    icon: colors.fg[2],
    /** @deprecated use colors.fg[2] */
    tabIconDefault: colors.fg[2],
    /** @deprecated use colors.fg[1] */
    tabIconSelected: colors.fg[1],
  },
};
