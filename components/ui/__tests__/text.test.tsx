/**
 * Tests for Text primitive (B1).
 *
 * Verifies that DS token values reach the RN Text style and that
 * color resolution logic is correct for all variants and tones.
 */
import React from 'react';
import { render, screen } from '@testing-library/react-native';

import { colors, typography } from '@/lib/theme';
import { Text, Display, H1, H2, H3, Body, BodySm, Caption, Micro, Label, Money } from '../text';

jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));

describe('Text primitive', () => {
  describe('default variant (body)', () => {
    it('renders children', () => {
      render(<Text>Hello</Text>);
      expect(screen.getByText('Hello')).toBeTruthy();
    });

    it('applies body font size from token', () => {
      render(<Text testID="t">Body</Text>);
      const el = screen.getByTestId('t');
      const style = el.props.style;
      const flatStyle = Array.isArray(style) ? Object.assign({}, ...style) : style;
      expect(flatStyle.fontSize).toBe(typography.size.body);
    });

    it('applies fg[2] color for body', () => {
      render(<Text testID="t">Body</Text>);
      const el = screen.getByTestId('t');
      const style = el.props.style;
      const flatStyle = Array.isArray(style) ? Object.assign({}, ...style) : style;
      expect(flatStyle.color).toBe(colors.fg[2]);
    });
  });

  describe('display variant', () => {
    it('applies display font size', () => {
      render(
        <Text variant="display" testID="t">
          Saldo
        </Text>,
      );
      const el = screen.getByTestId('t');
      const style = el.props.style;
      const flatStyle = Array.isArray(style) ? Object.assign({}, ...style) : style;
      expect(flatStyle.fontSize).toBe(typography.size.display);
    });

    it('applies fg[1] color for display', () => {
      render(
        <Text variant="display" testID="t">
          Saldo
        </Text>,
      );
      const el = screen.getByTestId('t');
      const style = el.props.style;
      const flatStyle = Array.isArray(style) ? Object.assign({}, ...style) : style;
      expect(flatStyle.color).toBe(colors.fg[1]);
    });

    it('applies bold font family', () => {
      render(
        <Text variant="display" testID="t">
          Saldo
        </Text>,
      );
      const el = screen.getByTestId('t');
      const style = el.props.style;
      const flatStyle = Array.isArray(style) ? Object.assign({}, ...style) : style;
      expect(flatStyle.fontFamily).toBe(typography.family.bold);
    });
  });

  describe('label variant', () => {
    it('applies uppercase text transform', () => {
      render(
        <Text variant="label" testID="t">
          Categoría
        </Text>,
      );
      const el = screen.getByTestId('t');
      const style = el.props.style;
      const flatStyle = Array.isArray(style) ? Object.assign({}, ...style) : style;
      expect(flatStyle.textTransform).toBe('uppercase');
    });

    it('applies positive letterSpacing from token helper', () => {
      render(
        <Text variant="label" testID="t">
          Label
        </Text>,
      );
      const el = screen.getByTestId('t');
      const style = el.props.style;
      const flatStyle = Array.isArray(style) ? Object.assign({}, ...style) : style;
      expect(flatStyle.letterSpacing).toBeGreaterThan(0);
    });
  });

  describe('money variant', () => {
    it('applies tabular-nums font variant', () => {
      render(
        <Text variant="money" testID="t">
          $ 12.500
        </Text>,
      );
      const el = screen.getByTestId('t');
      const style = el.props.style;
      const flatStyle = Array.isArray(style) ? Object.assign({}, ...style) : style;
      expect(flatStyle.fontVariant).toContain('tabular-nums');
    });

    it('applies money.in color for tone=in', () => {
      render(
        <Text variant="money" tone="in" testID="t">
          +$ 5.000
        </Text>,
      );
      const el = screen.getByTestId('t');
      const style = el.props.style;
      const flatStyle = Array.isArray(style) ? Object.assign({}, ...style) : style;
      expect(flatStyle.color).toBe(colors.money.in);
    });

    it('applies money.out color for tone=out', () => {
      render(
        <Text variant="money" tone="out" testID="t">
          -$ 5.000
        </Text>,
      );
      const el = screen.getByTestId('t');
      const style = el.props.style;
      const flatStyle = Array.isArray(style) ? Object.assign({}, ...style) : style;
      expect(flatStyle.color).toBe(colors.money.out);
    });

    it('applies fg[2] color for tone=neutral', () => {
      render(
        <Text variant="money" tone="neutral" testID="t">
          $ 0
        </Text>,
      );
      const el = screen.getByTestId('t');
      const style = el.props.style;
      const flatStyle = Array.isArray(style) ? Object.assign({}, ...style) : style;
      expect(flatStyle.color).toBe(colors.fg[2]);
    });

    it('applies fg[1] color for tone=default', () => {
      render(
        <Text variant="money" tone="default" testID="t">
          $ 0
        </Text>,
      );
      const el = screen.getByTestId('t');
      const style = el.props.style;
      const flatStyle = Array.isArray(style) ? Object.assign({}, ...style) : style;
      expect(flatStyle.color).toBe(colors.fg[1]);
    });
  });

  describe('color override prop', () => {
    it('overrides resolved color when color prop is provided', () => {
      render(
        <Text color="#ff0000" testID="t">
          Custom
        </Text>,
      );
      const el = screen.getByTestId('t');
      const style = el.props.style;
      const flatStyle = Array.isArray(style) ? Object.assign({}, ...style) : style;
      expect(flatStyle.color).toBe('#ff0000');
    });
  });

  describe('convenience aliases', () => {
    it('Display renders with display font size', () => {
      render(<Display testID="t">Hero</Display>);
      const el = screen.getByTestId('t');
      const style = el.props.style;
      const flatStyle = Array.isArray(style) ? Object.assign({}, ...style) : style;
      expect(flatStyle.fontSize).toBe(typography.size.display);
    });

    it('H1 renders with h1 font size', () => {
      render(<H1 testID="t">Heading</H1>);
      const el = screen.getByTestId('t');
      const style = el.props.style;
      const flatStyle = Array.isArray(style) ? Object.assign({}, ...style) : style;
      expect(flatStyle.fontSize).toBe(typography.size.h1);
    });

    it('H2 renders with h2 font size', () => {
      render(<H2 testID="t">Heading</H2>);
      const el = screen.getByTestId('t');
      const style = el.props.style;
      const flatStyle = Array.isArray(style) ? Object.assign({}, ...style) : style;
      expect(flatStyle.fontSize).toBe(typography.size.h2);
    });

    it('H3 renders with h3 font size', () => {
      render(<H3 testID="t">Heading</H3>);
      const el = screen.getByTestId('t');
      const style = el.props.style;
      const flatStyle = Array.isArray(style) ? Object.assign({}, ...style) : style;
      expect(flatStyle.fontSize).toBe(typography.size.h3);
    });

    it('Body renders with body color fg[2]', () => {
      render(<Body testID="t">Text</Body>);
      const el = screen.getByTestId('t');
      const style = el.props.style;
      const flatStyle = Array.isArray(style) ? Object.assign({}, ...style) : style;
      expect(flatStyle.color).toBe(colors.fg[2]);
    });

    it('BodySm renders with bodySm font size', () => {
      render(<BodySm testID="t">Small</BodySm>);
      const el = screen.getByTestId('t');
      const style = el.props.style;
      const flatStyle = Array.isArray(style) ? Object.assign({}, ...style) : style;
      expect(flatStyle.fontSize).toBe(typography.size.bodySm);
    });

    it('Caption renders with caption size and fg[3] color', () => {
      render(<Caption testID="t">Cap</Caption>);
      const el = screen.getByTestId('t');
      const style = el.props.style;
      const flatStyle = Array.isArray(style) ? Object.assign({}, ...style) : style;
      expect(flatStyle.fontSize).toBe(typography.size.caption);
      expect(flatStyle.color).toBe(colors.fg[3]);
    });

    it('Micro renders with micro size', () => {
      render(<Micro testID="t">Tiny</Micro>);
      const el = screen.getByTestId('t');
      const style = el.props.style;
      const flatStyle = Array.isArray(style) ? Object.assign({}, ...style) : style;
      expect(flatStyle.fontSize).toBe(typography.size.micro);
    });

    it('Label renders with uppercase transform', () => {
      render(<Label testID="t">Label</Label>);
      const el = screen.getByTestId('t');
      const style = el.props.style;
      const flatStyle = Array.isArray(style) ? Object.assign({}, ...style) : style;
      expect(flatStyle.textTransform).toBe('uppercase');
    });

    it('Money renders with tabular-nums', () => {
      render(<Money testID="t">$ 100</Money>);
      const el = screen.getByTestId('t');
      const style = el.props.style;
      const flatStyle = Array.isArray(style) ? Object.assign({}, ...style) : style;
      expect(flatStyle.fontVariant).toContain('tabular-nums');
    });
  });
});
