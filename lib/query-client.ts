/**
 * Singleton QueryClient with React Native–specific defaults.
 *
 * Why these values?
 * - staleTime 30s: RN apps rarely need instant refetches — a short stale window
 *   avoids redundant network calls while still keeping data fresh enough.
 * - gcTime 5min: Keeps unused query data in memory long enough to survive tab
 *   switches and short background periods without re-fetching.
 * - retry 2: Network is less reliable on mobile; two retries strike a balance
 *   between resilience and latency.
 * - refetchOnWindowFocus false: There is no meaningful "window focus" concept on
 *   mobile, so this event would never fire and can be disabled to reduce noise.
 */

import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000, // 30 seconds
      gcTime: 5 * 60 * 1000, // 5 minutes
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
});
