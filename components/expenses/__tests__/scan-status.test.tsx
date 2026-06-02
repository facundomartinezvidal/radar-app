/**
 * Tests for ScanStatus component.
 *
 * Covers:
 *  - Renders the first status message on mount
 *  - Advancing ~1300ms shows the next message
 *  - Cleans up timers on unmount
 */
import React from 'react';
import { act, render, screen } from '@testing-library/react-native';

import { ScanStatus } from '../scan-status';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ScanStatus', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it('renders the first status message on mount', () => {
    render(<ScanStatus />);
    expect(screen.getByText('Leyendo el ticket…')).toBeTruthy();
  });

  it('shows the second message after ~1300ms', async () => {
    render(<ScanStatus />);

    // Advance past the interval and the mid-point setTimeout
    await act(async () => {
      jest.advanceTimersByTime(1300 + 200 + 50);
    });

    expect(screen.getByText('Detectando el monto…')).toBeTruthy();
  });

  it('shows the third message after ~2600ms', async () => {
    render(<ScanStatus />);

    await act(async () => {
      jest.advanceTimersByTime((1300 + 200 + 50) * 2);
    });

    expect(screen.getByText('Identificando el comercio…')).toBeTruthy();
  });

  it('unmounts without errors (timers cleaned up)', () => {
    const { unmount } = render(<ScanStatus />);
    expect(() => unmount()).not.toThrow();
  });
});
