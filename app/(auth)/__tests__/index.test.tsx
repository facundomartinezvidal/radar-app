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

jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));
jest.mock('react-native-svg', () => {
  const React = require('react');
  const MockSvg = (props: object) => React.createElement('Svg', props);
  const MockCircle = (props: object) => React.createElement('Circle', props);
  const MockPath = (props: object) => React.createElement('Path', props);
  const MockDefs = (props: object) => React.createElement('Defs', props);
  const MockStop = (props: object) => React.createElement('Stop', props);
  const MockLinearGradient = (props: object) => React.createElement('LinearGradient', props);
  const MockG = (props: object) => React.createElement('G', props);
  const MockText = (props: object) => React.createElement('SvgText', props);
  return {
    __esModule: true,
    default: MockSvg,
    Svg: MockSvg,
    Circle: MockCircle,
    Path: MockPath,
    Defs: MockDefs,
    Stop: MockStop,
    LinearGradient: MockLinearGradient,
    G: MockG,
    Text: MockText,
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
