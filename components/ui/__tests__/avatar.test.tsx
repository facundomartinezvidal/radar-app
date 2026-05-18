/**
 * Tests for Avatar primitive.
 */
import React from 'react';
import { render, screen } from '@testing-library/react-native';

import { colors } from '@/lib/theme';
import { Avatar } from '../avatar';

jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));

describe('Avatar primitive', () => {
  describe('initials fallback', () => {
    it('renders initials for firstName + lastName', () => {
      render(<Avatar firstName="Facundo" lastName="Martinez" />);
      expect(screen.getByText('FM')).toBeTruthy();
    });

    it('renders single initial when only firstName provided', () => {
      render(<Avatar firstName="Facundo" />);
      expect(screen.getByText('F')).toBeTruthy();
    });

    it('renders single initial when only lastName provided', () => {
      render(<Avatar lastName="Martinez" />);
      expect(screen.getByText('M')).toBeTruthy();
    });

    it('uses fg.onBrand text color for initials', () => {
      render(<Avatar firstName="Facundo" lastName="Martinez" />);
      const textEl = screen.getByText('FM');
      const style = textEl.props.style;
      const flatStyle = Array.isArray(style) ? Object.assign({}, ...style) : style;
      expect(flatStyle.color).toBe(colors.fg.onBrand);
    });
  });

  describe('fallback when no name and no imageUrl', () => {
    it('renders ? when no firstName, lastName, or imageUrl', () => {
      render(<Avatar />);
      expect(screen.getByText('?')).toBeTruthy();
    });

    it('renders ? when firstName and lastName are null', () => {
      render(<Avatar firstName={null} lastName={null} />);
      expect(screen.getByText('?')).toBeTruthy();
    });

    it('uses fg[2] text color for ? fallback', () => {
      render(<Avatar />);
      const textEl = screen.getByText('?');
      const style = textEl.props.style;
      const flatStyle = Array.isArray(style) ? Object.assign({}, ...style) : style;
      expect(flatStyle.color).toBe(colors.fg[2]);
    });

    it('uses bg[2] background color for ? fallback', () => {
      render(<Avatar />);
      const circle = screen.getByTestId('avatar-circle');
      const style = circle.props.style;
      const flatStyle = Array.isArray(style) ? Object.assign({}, ...style) : style;
      expect(flatStyle.backgroundColor).toBe(colors.bg[2]);
    });
  });

  describe('image variant', () => {
    it('renders an Image when imageUrl is provided', () => {
      const url = 'https://example.com/avatar.png';
      render(<Avatar firstName="Facundo" lastName="Martinez" imageUrl={url} />);
      const img = screen.getByTestId('avatar-image');
      expect(img.props.source).toEqual({ uri: url });
    });

    it('does not render initials text when imageUrl is provided', () => {
      render(
        <Avatar
          firstName="Facundo"
          lastName="Martinez"
          imageUrl="https://example.com/avatar.png"
        />,
      );
      expect(screen.queryByText('FM')).toBeNull();
    });
  });

  describe('accessibility', () => {
    it('has accessibilityRole image on initials variant', () => {
      render(<Avatar firstName="Facundo" lastName="Martinez" />);
      const el = screen.getByTestId('avatar-circle');
      expect(el.props.accessibilityRole).toBe('image');
    });

    it('accessibilityLabel includes first and last name', () => {
      render(<Avatar firstName="Facundo" lastName="Martinez" />);
      expect(screen.getByLabelText('Avatar de Facundo Martinez')).toBeTruthy();
    });

    it('accessibilityLabel is "Avatar" when no name provided', () => {
      render(<Avatar />);
      expect(screen.getByLabelText('Avatar')).toBeTruthy();
    });

    it('accessibilityLabel includes name even when imageUrl is provided', () => {
      render(
        <Avatar
          firstName="Facundo"
          lastName="Martinez"
          imageUrl="https://example.com/avatar.png"
        />,
      );
      expect(screen.getByLabelText('Avatar de Facundo Martinez')).toBeTruthy();
    });
  });

  describe('size prop', () => {
    it('defaults to size 36', () => {
      render(<Avatar firstName="F" />);
      const el = screen.getByTestId('avatar-circle');
      const style = el.props.style;
      const flatStyle = Array.isArray(style) ? Object.assign({}, ...style) : style;
      expect(flatStyle.width).toBe(36);
      expect(flatStyle.height).toBe(36);
    });

    it('applies custom size', () => {
      render(<Avatar firstName="F" size={48} />);
      const el = screen.getByTestId('avatar-circle');
      const style = el.props.style;
      const flatStyle = Array.isArray(style) ? Object.assign({}, ...style) : style;
      expect(flatStyle.width).toBe(48);
      expect(flatStyle.height).toBe(48);
    });

    it('sets borderRadius to half of size', () => {
      render(<Avatar firstName="F" size={60} />);
      const el = screen.getByTestId('avatar-circle');
      const style = el.props.style;
      const flatStyle = Array.isArray(style) ? Object.assign({}, ...style) : style;
      expect(flatStyle.borderRadius).toBe(30);
    });
  });
});
