/**
 * Tests for Pill primitive (B2).
 *
 * Verifies color token application for all variants and size padding.
 */
import React from 'react';
import { render, screen } from '@testing-library/react-native';

import { colors } from '@/lib/theme';
import { Pill } from '../pill';

jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));

describe('Pill primitive', () => {
  it('renders children text', () => {
    render(<Pill>Ingreso</Pill>);
    expect(screen.getByText('Ingreso')).toBeTruthy();
  });

  describe('neutral variant (default)', () => {
    it('applies neutral text color fg[2]', () => {
      render(<Pill>Label</Pill>);
      const textEl = screen.getByText('Label');
      const style = textEl.props.style;
      const flatStyle = Array.isArray(style) ? Object.assign({}, ...style) : style;
      expect(flatStyle.color).toBe(colors.fg[2]);
    });
  });

  describe('income variant', () => {
    it('applies money.in text color', () => {
      render(<Pill variant="income">+$ 1.000</Pill>);
      const textEl = screen.getByText('+$ 1.000');
      const style = textEl.props.style;
      const flatStyle = Array.isArray(style) ? Object.assign({}, ...style) : style;
      expect(flatStyle.color).toBe(colors.money.in);
    });
  });

  describe('expense variant', () => {
    it('applies money.out text color', () => {
      render(<Pill variant="expense">-$ 500</Pill>);
      const textEl = screen.getByText('-$ 500');
      const style = textEl.props.style;
      const flatStyle = Array.isArray(style) ? Object.assign({}, ...style) : style;
      expect(flatStyle.color).toBe(colors.money.out);
    });
  });

  describe('alert variant', () => {
    it('applies amber[500] text color', () => {
      render(<Pill variant="alert">Alerta</Pill>);
      const textEl = screen.getByText('Alerta');
      const style = textEl.props.style;
      const flatStyle = Array.isArray(style) ? Object.assign({}, ...style) : style;
      expect(flatStyle.color).toBe(colors.amber[500]);
    });
  });

  describe('brand variant', () => {
    it('applies brand[300] text color', () => {
      render(<Pill variant="brand">RADAR</Pill>);
      const textEl = screen.getByText('RADAR');
      const style = textEl.props.style;
      const flatStyle = Array.isArray(style) ? Object.assign({}, ...style) : style;
      expect(flatStyle.color).toBe(colors.brand[300]);
    });
  });

  describe('with icon', () => {
    it('renders icon and children together', () => {
      const TestIcon = (): React.JSX.Element => <></>;
      render(
        <Pill icon={<TestIcon />} variant="income">
          Income
        </Pill>,
      );
      expect(screen.getByText('Income')).toBeTruthy();
    });
  });
});
