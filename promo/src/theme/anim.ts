import { Easing, interpolate } from 'remotion';
import { motion } from './tokens';

export const easeOut = Easing.bezier(...motion.easeOut);
export const easeSpring = Easing.bezier(...motion.easeSpring);

/** Fade + upward slide entrance. Returns style for the given local frame. */
export const enter = (
  frame: number,
  { delay = 0, duration = 12, distance = 40 }: { delay?: number; duration?: number; distance?: number } = {},
) => {
  const p = interpolate(frame, [delay, delay + duration], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: easeOut,
  });
  return {
    opacity: p,
    transform: `translateY(${(1 - p) * distance}px)`,
  };
};

/** Fade out near the end of a segment. */
export const exit = (frame: number, start: number, duration = 10) =>
  interpolate(frame, [start, start + duration], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: easeOut,
  });
