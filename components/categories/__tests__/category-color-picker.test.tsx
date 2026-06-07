/**
 * Tests for CategoryColorPicker.
 *
 * Covers:
 *   - Renders a swatch for each color in CATEGORY_COLORS
 *   - Pressing a swatch calls onChange with the correct color value
 *   - Selected swatch has accessibilityState.selected = true
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';

import { CategoryColorPicker } from '../category-color-picker';
import { CATEGORY_COLORS } from '@/lib/category-options';

describe('CategoryColorPicker', () => {
  it('renders a swatch for each color in CATEGORY_COLORS', () => {
    render(<CategoryColorPicker value={CATEGORY_COLORS[0]} onChange={jest.fn()} />);

    CATEGORY_COLORS.forEach((_, index) => {
      const swatch = screen.getByLabelText(`Color ${index + 1}`);
      expect(swatch).toBeTruthy();
    });
  });

  it('pressing a swatch calls onChange with the color value', () => {
    const onChange = jest.fn();
    render(<CategoryColorPicker value={CATEGORY_COLORS[0]} onChange={onChange} />);

    // Press the second color swatch
    const secondSwatch = screen.getByLabelText('Color 2');
    fireEvent.press(secondSwatch);

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(CATEGORY_COLORS[1]);
  });

  it('pressing the already-selected swatch still calls onChange', () => {
    const onChange = jest.fn();
    render(<CategoryColorPicker value={CATEGORY_COLORS[0]} onChange={onChange} />);

    fireEvent.press(screen.getByLabelText('Color 1'));
    expect(onChange).toHaveBeenCalledWith(CATEGORY_COLORS[0]);
  });

  it('does not call onChange when disabled', () => {
    const onChange = jest.fn();
    render(<CategoryColorPicker value={CATEGORY_COLORS[0]} onChange={onChange} disabled />);

    fireEvent.press(screen.getByLabelText('Color 2'));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('marks the selected color with accessibilityState selected', () => {
    render(<CategoryColorPicker value={CATEGORY_COLORS[2]} onChange={jest.fn()} />);

    const selectedSwatch = screen.getByLabelText('Color 3');
    expect(selectedSwatch).toHaveProp(
      'accessibilityState',
      expect.objectContaining({ selected: true }),
    );

    const notSelectedSwatch = screen.getByLabelText('Color 1');
    expect(notSelectedSwatch).toHaveProp(
      'accessibilityState',
      expect.objectContaining({ selected: false }),
    );
  });
});
