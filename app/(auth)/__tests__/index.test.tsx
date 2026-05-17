/**
 * Tests for Splash / Onboarding screen (C1).
 *
 * Verifies:
 * - Renders without crashing
 * - Tagline copy present ("Sabé a dónde va tu plata.")
 * - Both CTAs rendered: "Empezar" and "Ya tengo cuenta"
 * - Pressing "Empezar" navigates to sign-up
 * - Pressing "Ya tengo cuenta" navigates to sign-in
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';

import { router } from 'expo-router';
import SplashScreen from '../index';

jest.mock('react-native-safe-area-context', () => {
  const { View } = require('react-native');
  return {
    SafeAreaView: View,
    SafeAreaProvider: View,
    useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
  };
});

jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));

// Mock react-native-svg — enumerate every element lucide-react-native may
// reference internally (`NativeSvg__namespace[Tag]` lookup, via `path`, `line`,
// `circle`, `rect`, `polyline`, `polygon`, `ellipse`).
// Listed explicitly so `_interopNamespaceDefault` (which iterates Object.keys)
// can copy them through.
jest.mock('react-native-svg', () => {
  const React = require('react');
  const make = (name: string) => {
    const C = (props: object) => React.createElement(name, props);
    C.displayName = name;
    return C;
  };
  const MockSvg = make('Svg');
  return {
    __esModule: true,
    default: MockSvg,
    Svg: MockSvg,
    Circle: make('Circle'),
    Path: make('Path'),
    Line: make('Line'),
    Polyline: make('Polyline'),
    Polygon: make('Polygon'),
    Rect: make('Rect'),
    Ellipse: make('Ellipse'),
    Defs: make('Defs'),
    Stop: make('Stop'),
    LinearGradient: make('LinearGradient'),
    RadialGradient: make('RadialGradient'),
    G: make('G'),
    Text: make('SvgText'),
    Mask: make('Mask'),
    ClipPath: make('ClipPath'),
    Use: make('Use'),
    Symbol: make('Symbol'),
    TextPath: make('TextPath'),
    TSpan: make('TSpan'),
    Pattern: make('Pattern'),
    Image: make('SvgImage'),
    ForeignObject: make('ForeignObject'),
  };
});

describe('Splash screen', () => {
  it('renders without crashing', () => {
    expect(() => render(<SplashScreen />)).not.toThrow();
  });

  it('shows tagline copy', () => {
    render(<SplashScreen />);
    expect(screen.getByText('Sabé a dónde va tu plata.')).toBeTruthy();
  });

  it('shows "Empezar" CTA', () => {
    render(<SplashScreen />);
    expect(screen.getByText('Empezar')).toBeTruthy();
  });

  it('shows "Ya tengo cuenta" CTA', () => {
    render(<SplashScreen />);
    expect(screen.getByText('Ya tengo cuenta')).toBeTruthy();
  });

  it('navigates to sign-up when "Empezar" is pressed', () => {
    render(<SplashScreen />);
    fireEvent.press(screen.getByLabelText('Empezar'));
    expect(router.push).toHaveBeenCalledWith('/(auth)/sign-up');
  });

  it('navigates to sign-in when "Ya tengo cuenta" is pressed', () => {
    render(<SplashScreen />);
    fireEvent.press(screen.getByLabelText('Ya tengo cuenta'));
    expect(router.push).toHaveBeenCalledWith('/(auth)/sign-in');
  });
});
