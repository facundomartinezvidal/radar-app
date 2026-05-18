/**
 * RADAR Design System — Avatar hash-color utility
 *
 * Deterministic color assignment for avatar circles.
 * Derived from DS color tokens. Avoids purple/pink per DS rules.
 */

import { colors } from '@/lib/theme';

/**
 * 8-hue avatar palette — derived from the DS color tokens.
 * Purple/pink are explicitly excluded per Design System rules.
 */
export const AVATAR_PALETTE: readonly string[] = [
  colors.brand[500], // #0077B6
  colors.brand[300], // #4FB3DC
  colors.brand[400], // #1E99CC
  colors.brand[600], // #005F94
  colors.money.in, //  #10B981
  colors.money.in2, // #34D399
  colors.amber[500], // #F59E0B
  colors.amber[400], // #FFB347
] as const;

/**
 * Returns a deterministic hex color from the avatar palette for a given name.
 *
 * - Empty string / null / undefined → first palette color
 * - Stable for the same input across renders (pure function, no randomness)
 *
 * Algorithm: sum of char codes modulo palette length (djb2-ish, simple and
 * collision-resistant enough for an 8-bucket palette).
 */
export function hashColor(name: string | null | undefined): string {
  const input = name ?? '';

  if (input.length === 0) {
    return AVATAR_PALETTE[0] as string;
  }

  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash += input.charCodeAt(i);
  }

  return AVATAR_PALETTE[hash % AVATAR_PALETTE.length] as string;
}
