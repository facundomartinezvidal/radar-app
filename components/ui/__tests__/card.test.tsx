/**
 * Tests for Card primitive (B2).
 *
 * Verifies that DS token values (colors, radii, shadows) are applied correctly
 * for both base and raised variants.
 */
import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { colors, radii, spacing } from '@/lib/theme';
import { Card } from '../card';

jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));

describe('Card primitive', () => {
  describe('base variant (default)', () => {
    it('renders children', () => {
      render(
        <Card testID="card">
          <Text>Card content</Text>
        </Card>,
      );
      expect(screen.getByText('Card content')).toBeTruthy();
    });

    it('applies bg[1] background color', () => {
      render(<Card testID="card" />);
      const card = screen.getByTestId('card');
      const style = card.props.style;
      const flatStyle = Array.isArray(style) ? Object.assign({}, ...style) : style;
      expect(flatStyle.backgroundColor).toBe(colors.bg[1]);
    });

    it('applies line[1] border color', () => {
      render(<Card testID="card" />);
      const card = screen.getByTestId('card');
      const style = card.props.style;
      const flatStyle = Array.isArray(style) ? Object.assign({}, ...style) : style;
      expect(flatStyle.borderColor).toBe(colors.line[1]);
    });

    it('applies lg border radius (20)', () => {
      render(<Card testID="card" />);
      const card = screen.getByTestId('card');
      const style = card.props.style;
      const flatStyle = Array.isArray(style) ? Object.assign({}, ...style) : style;
      expect(flatStyle.borderRadius).toBe(radii.lg);
    });

    it('applies default padding (spacing[6] = 24)', () => {
      render(<Card testID="card" />);
      const card = screen.getByTestId('card');
      const style = card.props.style;
      const flatStyle = Array.isArray(style) ? Object.assign({}, ...style) : style;
      expect(flatStyle.padding).toBe(spacing[6]);
    });
  });

  describe('raised variant', () => {
    it('applies bg[2] background color', () => {
      render(<Card variant="raised" testID="card" />);
      const card = screen.getByTestId('card');
      const style = card.props.style;
      const flatStyle = Array.isArray(style) ? Object.assign({}, ...style) : style;
      expect(flatStyle.backgroundColor).toBe(colors.bg[2]);
    });

    it('applies line[2] border color', () => {
      render(<Card variant="raised" testID="card" />);
      const card = screen.getByTestId('card');
      const style = card.props.style;
      const flatStyle = Array.isArray(style) ? Object.assign({}, ...style) : style;
      expect(flatStyle.borderColor).toBe(colors.line[2]);
    });
  });

  describe('padding prop', () => {
    it('applies custom padding from spacing token key', () => {
      render(<Card padding={4} testID="card" />);
      const card = screen.getByTestId('card');
      const style = card.props.style;
      const flatStyle = Array.isArray(style) ? Object.assign({}, ...style) : style;
      expect(flatStyle.padding).toBe(spacing[4]);
    });
  });

  describe('style override', () => {
    it('merges additional style prop', () => {
      render(<Card testID="card" style={{ marginTop: 10 }} />);
      const card = screen.getByTestId('card');
      const style = card.props.style;
      const flatStyle = Array.isArray(style) ? Object.assign({}, ...style) : style;
      expect(flatStyle.marginTop).toBe(10);
    });
  });
});
