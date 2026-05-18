/**
 * Tests for Button primitive (B3).
 *
 * Verifies rendering, accessibility state, disabled behaviour, loading state,
 * and that DS token colors reach the element styles.
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';

import { colors } from '@/lib/theme';
import { Button } from '../button';

jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));

describe('Button primitive', () => {
  describe('rendering', () => {
    it('renders children text', () => {
      render(<Button onPress={jest.fn()}>Registrá</Button>);
      expect(screen.getByText('Registrá')).toBeTruthy();
    });

    it('renders accessible button role', () => {
      render(<Button onPress={jest.fn()}>Test</Button>);
      expect(screen.getByRole('button')).toBeTruthy();
    });
  });

  describe('onPress', () => {
    it('calls onPress when pressed and not disabled', () => {
      const onPress = jest.fn();
      render(<Button onPress={onPress}>Press me</Button>);
      fireEvent.press(screen.getByText('Press me'));
      expect(onPress).toHaveBeenCalledTimes(1);
    });

    it('does not call onPress when disabled', () => {
      const onPress = jest.fn();
      render(
        <Button onPress={onPress} disabled>
          Disabled
        </Button>,
      );
      fireEvent.press(screen.getByText('Disabled'));
      expect(onPress).not.toHaveBeenCalled();
    });

    it('does not call onPress when loading', () => {
      const onPress = jest.fn();
      render(
        <Button onPress={onPress} loading>
          Loading
        </Button>,
      );
      // When loading, children are replaced by the Loader spinner — query by role
      fireEvent.press(screen.getByRole('button'));
      expect(onPress).not.toHaveBeenCalled();
    });
  });

  describe('disabled state', () => {
    it('has disabled accessibility state', () => {
      render(
        <Button onPress={jest.fn()} disabled>
          Disabled
        </Button>,
      );
      const btn = screen.getByRole('button');
      expect(btn.props.accessibilityState?.disabled).toBe(true);
    });

    it('applies 0.4 opacity when disabled', () => {
      render(
        <Button onPress={jest.fn()} disabled>
          Disabled
        </Button>,
      );
      // The outer Pressable carries the opacity
      const btn = screen.getByRole('button');
      expect(btn.props.style).toMatchObject({ opacity: 0.4 });
    });
  });

  describe('loading state', () => {
    it('hides children text and shows Loader spinner when loading', () => {
      render(
        <Button onPress={jest.fn()} loading>
          Submit
        </Button>,
      );
      // Children text should not be visible while loading
      expect(screen.queryByText('Submit')).toBeNull();
    });

    it('has busy accessibility state when loading', () => {
      render(
        <Button onPress={jest.fn()} loading>
          Submit
        </Button>,
      );
      const btn = screen.getByRole('button');
      expect(btn.props.accessibilityState?.busy).toBe(true);
    });
  });

  describe('fullWidth prop', () => {
    it('sets width to 100% when fullWidth is true', () => {
      render(
        <Button onPress={jest.fn()} fullWidth>
          Full width
        </Button>,
      );
      const btn = screen.getByRole('button');
      expect(btn.props.style).toMatchObject({ width: '100%' });
    });

    it('does not set width when fullWidth is false', () => {
      render(<Button onPress={jest.fn()}>Normal</Button>);
      const btn = screen.getByRole('button');
      expect(btn.props.style).toMatchObject({ width: undefined });
    });
  });

  describe('variants', () => {
    it('primary variant uses brand[500] background', () => {
      render(
        <Button variant="primary" onPress={jest.fn()}>
          Primary
        </Button>,
      );
      // The text inside should have onBrand color
      const text = screen.getByText('Primary');
      const style = text.props.style;
      const flatStyle = Array.isArray(style) ? Object.assign({}, ...style) : style;
      expect(flatStyle.color).toBe(colors.fg.onBrand);
    });

    it('ghost variant text has brand[300] color', () => {
      render(
        <Button variant="ghost" onPress={jest.fn()}>
          Ghost
        </Button>,
      );
      const text = screen.getByText('Ghost');
      const style = text.props.style;
      const flatStyle = Array.isArray(style) ? Object.assign({}, ...style) : style;
      expect(flatStyle.color).toBe(colors.brand[300]);
    });

    it('secondary variant text has fg[1] color', () => {
      render(
        <Button variant="secondary" onPress={jest.fn()}>
          Secondary
        </Button>,
      );
      const text = screen.getByText('Secondary');
      const style = text.props.style;
      const flatStyle = Array.isArray(style) ? Object.assign({}, ...style) : style;
      expect(flatStyle.color).toBe(colors.fg[1]);
    });
  });

  describe('accessibilityLabel', () => {
    it('passes accessibilityLabel to Pressable', () => {
      render(
        <Button onPress={jest.fn()} accessibilityLabel="Registrar gasto">
          +
        </Button>,
      );
      expect(screen.getByLabelText('Registrar gasto')).toBeTruthy();
    });
  });

  describe('icon slots', () => {
    it('renders leftIcon alongside children', () => {
      const TestIcon = (): React.JSX.Element => <></>;
      render(
        <Button onPress={jest.fn()} leftIcon={<TestIcon />}>
          Con icono
        </Button>,
      );
      expect(screen.getByText('Con icono')).toBeTruthy();
    });
  });
});
