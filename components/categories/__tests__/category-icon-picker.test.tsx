/**
 * Tests for CategoryIconPicker.
 *
 * Covers:
 *   - Renders a tile for each icon in CATEGORY_ICONS
 *   - Pressing a tile calls onChange with the icon name
 *   - Selected tile has accessibilityState.selected = true
 *   - Disabled state prevents onChange from firing
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';

import { CategoryIconPicker } from '../category-icon-picker';
import { CATEGORY_ICONS } from '@/lib/category-options';

const DEFAULT_COLOR = '#0077B6';

describe('CategoryIconPicker', () => {
  it('renders a tile for each icon in CATEGORY_ICONS', () => {
    render(
      <CategoryIconPicker value={CATEGORY_ICONS[0]} color={DEFAULT_COLOR} onChange={jest.fn()} />,
    );

    CATEGORY_ICONS.forEach((icon) => {
      const tile = screen.getByLabelText(`Ícono ${icon}`);
      expect(tile).toBeTruthy();
    });
  });

  it('pressing a tile calls onChange with the icon name', () => {
    const onChange = jest.fn();
    render(
      <CategoryIconPicker value={CATEGORY_ICONS[0]} color={DEFAULT_COLOR} onChange={onChange} />,
    );

    // Press the second icon tile
    const secondIcon = CATEGORY_ICONS[1];
    fireEvent.press(screen.getByLabelText(`Ícono ${secondIcon}`));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(secondIcon);
  });

  it('does not call onChange when disabled', () => {
    const onChange = jest.fn();
    render(
      <CategoryIconPicker
        value={CATEGORY_ICONS[0]}
        color={DEFAULT_COLOR}
        onChange={onChange}
        disabled
      />,
    );

    fireEvent.press(screen.getByLabelText(`Ícono ${CATEGORY_ICONS[1]}`));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('marks the selected icon with accessibilityState selected', () => {
    const selectedIcon = CATEGORY_ICONS[3];
    render(<CategoryIconPicker value={selectedIcon} color={DEFAULT_COLOR} onChange={jest.fn()} />);

    const selectedTile = screen.getByLabelText(`Ícono ${selectedIcon}`);
    expect(selectedTile).toHaveProp(
      'accessibilityState',
      expect.objectContaining({ selected: true }),
    );

    const notSelectedTile = screen.getByLabelText(`Ícono ${CATEGORY_ICONS[0]}`);
    expect(notSelectedTile).toHaveProp(
      'accessibilityState',
      expect.objectContaining({ selected: false }),
    );
  });
});
