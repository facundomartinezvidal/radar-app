/**
 * Tests for ScanOverlay component.
 *
 * Covers:
 *  - Renders without crashing when given an imageUri
 *  - Exposes accessibilityLabel "Analizando ticket"
 *  - Renders the receipt image with the provided uri
 */
import React from 'react';
import { render, screen } from '@testing-library/react-native';

import { ScanOverlay } from '../scan-overlay';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));

jest.mock('expo-image', () => {
  const ReactLib = require('react');
  const { View } = require('react-native');
  const Image = (props: { accessibilityLabel?: string; testID?: string; [key: string]: unknown }) =>
    ReactLib.createElement(View, { testID: 'expo-image', ...props });
  Image.displayName = 'ExpoImage';
  return { Image };
});

jest.mock('expo-linear-gradient', () => {
  const ReactLib = require('react');
  const { View } = require('react-native');
  const LinearGradient = (props: Record<string, unknown>) =>
    ReactLib.createElement(View, { testID: 'linear-gradient', ...props });
  LinearGradient.displayName = 'LinearGradient';
  return { LinearGradient };
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ScanOverlay', () => {
  const IMAGE_URI = 'file://receipt.jpg';

  it('renders without crashing', () => {
    expect(() => render(<ScanOverlay imageUri={IMAGE_URI} />)).not.toThrow();
  });

  it('exposes accessibilityLabel "Analizando ticket"', () => {
    render(<ScanOverlay imageUri={IMAGE_URI} />);
    expect(screen.getByLabelText('Analizando ticket')).toBeTruthy();
  });

  it('renders the receipt image element', () => {
    render(<ScanOverlay imageUri={IMAGE_URI} />);
    expect(screen.getByTestId('expo-image')).toBeTruthy();
  });

  it('renders the gradient trail element', () => {
    render(<ScanOverlay imageUri={IMAGE_URI} />);
    expect(screen.getByTestId('linear-gradient')).toBeTruthy();
  });
});
