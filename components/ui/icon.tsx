/**
 * RADAR Design System — Icon primitive (B4)
 *
 * Thin wrapper around lucide-react-native that applies DS defaults:
 *   - size 20, strokeWidth 1.5, color fg[2]
 *
 * Only ForwardRefExoticComponent (LucideIcon) exports are usable as components.
 * The module also ships types/helpers; the runtime guard filters those out.
 *
 * NOTE: We cast the namespace import to a plain record to avoid the
 * `import/namespace` ESLint rule that disallows computed property access on
 * namespace imports. The type safety is preserved through `IconName` and the
 * `isLucideIcon` runtime guard.
 */
import React from 'react';
import type { LucideIcon } from 'lucide-react-native';
import * as LucideIconsNamespace from 'lucide-react-native';

import { colors } from '@/lib/theme';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * All named exports from lucide-react-native.
 * Not every key is a renderable component (some are type-only or helpers),
 * so we accept the full keyof union and guard at runtime.
 */
export type IconName = keyof typeof LucideIconsNamespace;

export interface IconProps {
  name: IconName;
  size?: number;
  color?: string;
  strokeWidth?: number;
}

// ---------------------------------------------------------------------------
// Icon lookup map — bypasses `import/namespace` computed access restriction
// ---------------------------------------------------------------------------

// Cast to a plain record so ESLint doesn't complain about computed access.
// TypeScript still enforces that `IconName` is a valid key.
const iconMap = LucideIconsNamespace as Record<string, unknown>;

// ---------------------------------------------------------------------------
// Runtime guard
// ---------------------------------------------------------------------------

function isLucideIcon(value: unknown): value is LucideIcon {
  return (
    typeof value === 'function' ||
    (typeof value === 'object' && value !== null && '$$typeof' in value)
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function Icon({
  name,
  size = 20,
  color = colors.fg[2],
  strokeWidth = 1.5,
}: IconProps): React.JSX.Element | null {
  const IconComponent = iconMap[name];

  if (!isLucideIcon(IconComponent)) {
    return null;
  }

  const LucideComponent = IconComponent as LucideIcon;

  return <LucideComponent size={size} color={color} strokeWidth={strokeWidth} />;
}
