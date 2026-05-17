/**
 * Tests for Input primitive (B4).
 *
 * Verifies label, helper, error rendering and DS token color application.
 */
import React from 'react';
import { render, screen } from '@testing-library/react-native';

import { colors } from '@/lib/theme';
import { Input } from '../input';

jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));

describe('Input primitive', () => {
  describe('basic rendering', () => {
    it('renders a text input', () => {
      render(<Input testID="input" />);
      expect(screen.getByTestId('input')).toBeTruthy();
    });

    it('passes placeholder to TextInput', () => {
      render(<Input placeholder="0,00" testID="input" />);
      expect(screen.getByPlaceholderText('0,00')).toBeTruthy();
    });
  });

  describe('label', () => {
    it('renders label text when provided', () => {
      render(<Input label="Monto" />);
      expect(screen.getByText('Monto')).toBeTruthy();
    });

    it('does not render label when not provided', () => {
      render(<Input />);
      expect(screen.queryByText('Monto')).toBeNull();
    });
  });

  describe('helper text', () => {
    it('renders helper text when provided and no error', () => {
      render(<Input helper="Máximo $ 99.999" />);
      expect(screen.getByText('Máximo $ 99.999')).toBeTruthy();
    });

    it('does not render helper when error is present', () => {
      render(<Input helper="Ayuda" error="Campo requerido" />);
      expect(screen.queryByText('Ayuda')).toBeNull();
    });
  });

  describe('error state', () => {
    it('renders error text', () => {
      render(<Input error="Campo requerido" />);
      expect(screen.getByText('Campo requerido')).toBeTruthy();
    });

    it('applies money.out color to error text', () => {
      render(<Input error="Campo requerido" />);
      const errEl = screen.getByText('Campo requerido');
      const style = errEl.props.style;
      const flatStyle = Array.isArray(style) ? Object.assign({}, ...style) : style;
      expect(flatStyle.color).toBe(colors.money.out);
    });
  });

  describe('icon slots', () => {
    it('renders leftIcon when provided', () => {
      const LeftIcon = (): React.JSX.Element => <></>;
      render(<Input leftIcon={<LeftIcon />} testID="input" />);
      expect(screen.getByTestId('input')).toBeTruthy();
    });

    it('renders rightIcon when provided', () => {
      const RightIcon = (): React.JSX.Element => <></>;
      render(<Input rightIcon={<RightIcon />} testID="input" />);
      expect(screen.getByTestId('input')).toBeTruthy();
    });
  });

  describe('autoCorrect default', () => {
    it('has autoCorrect false by default', () => {
      render(<Input testID="input" />);
      const input = screen.getByTestId('input');
      expect(input.props.autoCorrect).toBe(false);
    });

    it('can override autoCorrect to true via prop', () => {
      render(<Input testID="input" autoCorrect />);
      const input = screen.getByTestId('input');
      expect(input.props.autoCorrect).toBe(true);
    });
  });
});
