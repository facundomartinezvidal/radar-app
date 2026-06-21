/**
 * useChartWidth — returns the inner chart canvas width in dp.
 *
 * Accounts for:
 *   - Screen horizontal padding: spacing[5] × 2  (section paddingHorizontal)
 *   - Card inner padding:        spacing[5] × 2  (Card padding={5})
 *
 * The minimum is clamped to 240 so very narrow screens always get a usable canvas.
 */
import { useWindowDimensions } from 'react-native';

import { spacing } from '@/lib/theme';

const OUTER_PADDING = spacing[5] * 2; // section paddingHorizontal on both sides
const CARD_PADDING = spacing[5] * 2; // Card padding={5} on both sides
const MINIMUM_WIDTH = 240;

export function useChartWidth(): number {
  const { width } = useWindowDimensions();
  return Math.max(width - OUTER_PADDING - CARD_PADDING, MINIMUM_WIDTH);
}
