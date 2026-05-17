/**
 * Tests for Icon primitive (B4).
 *
 * Verifies that valid icon names render and that the DS default props
 * (size, strokeWidth, color) are applied correctly.
 */
import React from 'react';
import { render, screen } from '@testing-library/react-native';

import { colors } from '@/lib/theme';
import { Icon } from '../icon';

jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));

// Mock lucide-react-native so we can inspect props without rendering SVG
jest.mock('lucide-react-native', () => {
  const React = require('react');
  const MockIcon = React.forwardRef(({ testID, ...props }: any, _ref: any) =>
    React.createElement('View', { testID: testID ?? 'lucide-icon', ...props }),
  );
  MockIcon.displayName = 'MockIcon';
  return {
    // A representative subset of icon names
    Home: MockIcon,
    Search: MockIcon,
    User: MockIcon,
    Wallet: MockIcon,
    TrendingUp: MockIcon,
    Plus: MockIcon,
    ChevronRight: MockIcon,
    Bell: MockIcon,
    Settings: MockIcon,
    ArrowDownLeft: MockIcon,
  };
});

describe('Icon primitive', () => {
  it('renders without crashing for a valid icon name', () => {
    render(<Icon name="Home" />);
    expect(screen.getByTestId('lucide-icon')).toBeTruthy();
  });

  it('applies default size 20', () => {
    render(<Icon name="Home" />);
    const icon = screen.getByTestId('lucide-icon');
    expect(icon.props.size).toBe(20);
  });

  it('applies default strokeWidth 1.5', () => {
    render(<Icon name="Home" />);
    const icon = screen.getByTestId('lucide-icon');
    expect(icon.props.strokeWidth).toBe(1.5);
  });

  it('applies default color fg[2]', () => {
    render(<Icon name="Home" />);
    const icon = screen.getByTestId('lucide-icon');
    expect(icon.props.color).toBe(colors.fg[2]);
  });

  it('accepts custom size', () => {
    render(<Icon name="Home" size={24} />);
    const icon = screen.getByTestId('lucide-icon');
    expect(icon.props.size).toBe(24);
  });

  it('accepts custom color', () => {
    render(<Icon name="Home" color={colors.brand[300]} />);
    const icon = screen.getByTestId('lucide-icon');
    expect(icon.props.color).toBe(colors.brand[300]);
  });

  it('accepts custom strokeWidth', () => {
    render(<Icon name="Home" strokeWidth={2} />);
    const icon = screen.getByTestId('lucide-icon');
    expect(icon.props.strokeWidth).toBe(2);
  });

  it('returns null for non-component export names', () => {
    // 'LucideIcon' is a type export, not a component — Icon should handle gracefully
    // Since our mock only has the above icons, any unknown name triggers the guard
    // We cast as valid IconName for testing purposes
    const { toJSON } = render(<Icon name={'NotAnIcon' as 'Home'} />);
    expect(toJSON()).toBeNull();
  });
});
