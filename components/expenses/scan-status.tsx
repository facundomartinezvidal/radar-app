/**
 * ScanStatus — cycles through staged status messages with a crossfade animation
 * while the OCR engine analyses the receipt.
 *
 * Advances every ~1300ms, looping through the message list indefinitely.
 * Respects reduce-motion: when enabled, text swaps instantly (no fade).
 */
import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { Body } from '@/components/ui';
import { colors, motion } from '@/lib/theme';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MESSAGES = [
  'Leyendo el ticket…',
  'Detectando el monto…',
  'Identificando el comercio…',
  'Casi listo…',
] as const;

const ADVANCE_INTERVAL_MS = 1300;
const FADE_DURATION_MS = motion.dur[2]; // 200ms

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ScanStatus(): React.JSX.Element {
  const [index, setIndex] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);
  const opacity = useSharedValue(1);
  // Ref to avoid stale closure in interval callback
  const indexRef = useRef(0);

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

  // Advance message index on interval
  useEffect(() => {
    const id = setInterval(() => {
      const next = (indexRef.current + 1) % MESSAGES.length;
      indexRef.current = next;

      if (reduceMotion) {
        // Instant swap — no animation
        setIndex(next);
        return;
      }

      // Fade out → update text → fade in
      opacity.value = withSequence(
        withTiming(0, { duration: FADE_DURATION_MS }),
        withTiming(1, { duration: FADE_DURATION_MS }),
      );

      // Swap text at the midpoint of the fade (after fade-out completes)
      setTimeout(() => {
        setIndex(next);
      }, FADE_DURATION_MS);
    }, ADVANCE_INTERVAL_MS);

    return () => {
      clearInterval(id);
    };
  }, [reduceMotion, opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <View style={styles.container}>
      <Animated.View style={reduceMotion ? undefined : animatedStyle}>
        <Body style={styles.text} color={colors.fg[2]}>
          {MESSAGES[index]}
        </Body>
      </Animated.View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  text: {
    textAlign: 'center',
  },
});
