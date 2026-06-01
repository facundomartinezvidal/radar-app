/**
 * ScanOverlay — animated scanner viewfinder overlaid on the receipt thumbnail.
 *
 * Shows the receipt image with a dim scrim, L-shaped corner brackets, and a
 * sweep line that travels top→bottom in a loop (brand radar-sweep motif).
 * Respects reduce-motion: when enabled, the line is rendered static-centred.
 */
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useState } from 'react';
import { AccessibilityInfo, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { colors, radii } from '@/lib/theme';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const IMAGE_HEIGHT = 220;
const CORNER_LEG = 22;
const CORNER_THICKNESS = 2;
const SWEEP_LINE_HEIGHT = 3;
const SWEEP_TRAIL_HEIGHT = 48;
const SWEEP_DURATION_MS = 1800;

// Brand accent colour for corner brackets and sweep line
const BRACKET_COLOR = colors.brand[500];
const LINE_COLOR = colors.brand[400];

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ScanOverlayProps {
  imageUri: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ScanOverlay({ imageUri }: ScanOverlayProps): React.JSX.Element {
  const [reduceMotion, setReduceMotion] = useState(false);

  // Detect reduce-motion preference on mount
  useEffect(() => {
    let cancelled = false;
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (!cancelled) setReduceMotion(enabled);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // The sweep translates from y=0 (top of image) to y=IMAGE_HEIGHT (bottom).
  const sweepY = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) {
      // Static: centre the line
      sweepY.value = IMAGE_HEIGHT / 2;
      return;
    }

    sweepY.value = withRepeat(
      withTiming(IMAGE_HEIGHT, {
        duration: SWEEP_DURATION_MS,
        easing: Easing.inOut(Easing.ease),
      }),
      -1,
      true,
    );
  }, [reduceMotion, sweepY]);

  const sweepStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: sweepY.value }],
  }));

  return (
    <View style={styles.container} accessibilityLabel="Analizando ticket" accessibilityRole="image">
      {/* Receipt image */}
      <Image
        source={{ uri: imageUri }}
        style={styles.image}
        contentFit="cover"
        accessibilityLabel="Imagen del ticket"
      />

      {/* Dim scrim */}
      <View style={styles.scrim} />

      {/* Corner brackets — four L-shapes */}
      {/* Top-left */}
      <View style={[styles.corner, styles.cornerTL]}>
        <View style={[styles.cornerH, { backgroundColor: BRACKET_COLOR }]} />
        <View style={[styles.cornerV, { backgroundColor: BRACKET_COLOR }]} />
      </View>
      {/* Top-right */}
      <View style={[styles.corner, styles.cornerTR]}>
        <View style={[styles.cornerH, { backgroundColor: BRACKET_COLOR }]} />
        <View style={[styles.cornerV, { backgroundColor: BRACKET_COLOR }]} />
      </View>
      {/* Bottom-left */}
      <View style={[styles.corner, styles.cornerBL]}>
        <View style={[styles.cornerV, { backgroundColor: BRACKET_COLOR }]} />
        <View style={[styles.cornerH, { backgroundColor: BRACKET_COLOR }]} />
      </View>
      {/* Bottom-right */}
      <View style={[styles.corner, styles.cornerBR]}>
        <View style={[styles.cornerV, { backgroundColor: BRACKET_COLOR }]} />
        <View style={[styles.cornerH, { backgroundColor: BRACKET_COLOR }]} />
      </View>

      {/* Sweep line + gradient trail */}
      <Animated.View style={[styles.sweepWrapper, sweepStyle]}>
        {/* Gradient trail above the line */}
        <LinearGradient
          colors={['transparent', `${LINE_COLOR}55`]}
          style={styles.sweepTrail}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
        />
        {/* The actual scan line */}
        <View style={[styles.sweepLine, { backgroundColor: LINE_COLOR }]} />
      </Animated.View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const INSET = 12;

const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: IMAGE_HEIGHT,
    borderRadius: radii.lg,
    overflow: 'hidden',
    backgroundColor: colors.bg[2],
  },
  image: {
    ...StyleSheet.absoluteFillObject,
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(10,15,26,0.45)',
  },

  // Corner bracket base — absolutely positioned at each corner
  corner: {
    position: 'absolute',
    width: CORNER_LEG,
    height: CORNER_LEG,
  },
  cornerTL: {
    top: INSET,
    left: INSET,
  },
  cornerTR: {
    top: INSET,
    right: INSET,
  },
  cornerBL: {
    bottom: INSET,
    left: INSET,
  },
  cornerBR: {
    bottom: INSET,
    right: INSET,
  },

  // Horizontal stroke of the L (full width of corner box)
  cornerH: {
    position: 'absolute',
    width: CORNER_LEG,
    height: CORNER_THICKNESS,
    // top for TL/TR, bottom for BL/BR — set via corner containers
    top: 0,
  },
  // Vertical stroke of the L (full height of corner box)
  cornerV: {
    position: 'absolute',
    width: CORNER_THICKNESS,
    height: CORNER_LEG,
    left: 0,
    top: 0,
  },

  // Sweep
  sweepWrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    // The wrapper top tracks translateY; visual line sits at the bottom edge
    bottom: -(SWEEP_TRAIL_HEIGHT + SWEEP_LINE_HEIGHT),
  },
  sweepTrail: {
    height: SWEEP_TRAIL_HEIGHT,
    width: '100%',
  },
  sweepLine: {
    height: SWEEP_LINE_HEIGHT,
    width: '100%',
    opacity: 0.9,
  },
});
