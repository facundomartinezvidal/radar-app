/**
 * useChartWidth — returns the inner card content width in dp.
 *
 * Accounts for:
 *   - Screen horizontal padding: spacing[5] × 2  (section paddingHorizontal)
 *   - Card inner padding:        spacing[5] × 2  (Card padding={5})
 *
 * The minimum is clamped to 240 so very narrow screens always get a usable canvas.
 *
 * NOTE: In react-native-gifted-charts the `width` prop is the PLOTTING area only
 * (bars/line region) — it does NOT include the y-axis label column. Use
 * `usePlotWidth()` (or compute `plotWidth(available)`) to get the value to pass
 * as `width={…}`, and pair it with `yAxisLabelWidth={CHART_Y_AXIS_WIDTH}`.
 *
 * Width budget on a 390 dp screen:
 *   chartWidth = 390 - 40 - 40 = 310
 *   plotWidth  = 310 - 56 - 16 = 238
 *   rendered   = 56 + 238 + 8 (initialSpacing) = 302 ≤ 310  ✓
 */
import { useWindowDimensions } from 'react-native';

import { spacing } from '@/lib/theme';

const OUTER_PADDING = spacing[5] * 2; // section paddingHorizontal on both sides
const CARD_PADDING = spacing[5] * 2; // Card padding={5} on both sides
const MINIMUM_WIDTH = 240;

/** Width of the y-axis label column (passed as `yAxisLabelWidth` to every chart). */
export const CHART_Y_AXIS_WIDTH = 56;

/**
 * End buffer that accounts for initialSpacing + endSpacing + rounding safety.
 * Keeps the last bar/point from being clipped at the right edge.
 */
export const CHART_END_PAD = 16;

/** Returns the full card inner-content width (available horizontal space). */
export function useChartWidth(): number {
  const { width } = useWindowDimensions();
  return Math.max(width - OUTER_PADDING - CARD_PADDING, MINIMUM_WIDTH);
}

/**
 * Returns the plotting-area width to pass as `width={…}` to gifted-charts.
 *
 * plotWidth = chartWidth − CHART_Y_AXIS_WIDTH − CHART_END_PAD
 * Clamped to a minimum of 160 so the chart is always renderable.
 */
export function usePlotWidth(): number {
  const chartWidth = useChartWidth();
  return Math.max(chartWidth - CHART_Y_AXIS_WIDTH - CHART_END_PAD, 160);
}
