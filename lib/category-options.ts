/**
 * Curated icon + color sets offered when a user creates a custom category.
 *
 * NOTE: `Home` is not exported by lucide-react-native v1.16.0 — the correct
 * equivalent is `House`. All other names are verified against the installed
 * lucide-react-native@1.16.0 export list.
 */
import type { IconName } from '@/components/ui/icon';

/** Curated Lucide icons offered when creating a custom category. */
export const CATEGORY_ICONS = [
  'UtensilsCrossed',
  'ShoppingCart',
  'Bus',
  'Car',
  'PartyPopper',
  'HeartPulse',
  'House',
  'Zap',
  'Plane',
  'Coffee',
  'Gift',
  'Dumbbell',
  'GraduationCap',
  'Shirt',
  'Smartphone',
  'PawPrint',
  'Baby',
  'Wrench',
  'Fuel',
  'Wine',
  'Film',
  'Music',
  'BookOpen',
  'CircleDashed',
] as const satisfies readonly IconName[];

/** Curated color palette (RADAR design-system tokens). */
export const CATEGORY_COLORS = [
  '#0077B6',
  '#4FB3DC',
  '#1E99CC',
  '#10B981',
  '#EF4444',
  '#F59E0B',
  '#A855F7',
  '#7E8AA0',
] as const;

export type CategoryIcon = (typeof CATEGORY_ICONS)[number];
export type CategoryColor = (typeof CATEGORY_COLORS)[number];
