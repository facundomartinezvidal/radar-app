import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';

import type { CategoryRow } from '@/lib/repositories/expenses';
import { FilterBar, type ExpenseFilters } from '../filter-bar';

jest.mock('react-native-svg', () => {
  const ReactLib = require('react');
  const make = (name: string) => {
    const C = (props: object) => ReactLib.createElement(name, props);
    C.displayName = name;
    return C;
  };
  return {
    __esModule: true,
    default: make('Svg'),
    Svg: make('Svg'),
    Circle: make('Circle'),
    Path: make('Path'),
    Line: make('Line'),
    Defs: make('Defs'),
    Stop: make('Stop'),
    LinearGradient: make('LinearGradient'),
    G: make('G'),
    Text: make('SvgText'),
  };
});

const CATEGORIES: CategoryRow[] = [
  {
    id: 'cat-1',
    slug: 'comida',
    name: 'Comida',
    icon: 'UtensilsCrossed',
    color: '#F59E0B',
    sort_order: 10,
    created_at: '2026-01-01',
  },
];

function setup(initial: Partial<ExpenseFilters> = {}) {
  const onChange = jest.fn();
  const value: ExpenseFilters = {
    search: '',
    currencies: [],
    categoryIds: [],
    ...initial,
  };
  const Wrapper = ({ next }: { next: ExpenseFilters }) => (
    <FilterBar categories={CATEGORIES} value={next} onChange={onChange} />
  );
  const utils = render(<Wrapper next={value} />);
  return { onChange, utils };
}

describe('FilterBar', () => {
  it('emits search text on type', () => {
    const { onChange } = setup();
    fireEvent.changeText(screen.getByLabelText('Buscar'), 'pizza');
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ search: 'pizza' }));
  });

  it('toggles a currency on tap', () => {
    const { onChange } = setup();
    fireEvent.press(screen.getByLabelText('Filtrar ARS'));
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ currencies: ['ARS'] }));
  });

  it('removes an already-selected currency', () => {
    const { onChange } = setup({ currencies: ['ARS'] });
    fireEvent.press(screen.getByLabelText('Filtrar ARS'));
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ currencies: [] }));
  });

  it('toggles a category', () => {
    const { onChange } = setup();
    fireEvent.press(screen.getByLabelText('Filtrar categoría Comida'));
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ categoryIds: ['cat-1'] }));
  });

  it('clears search via the X button', () => {
    const { onChange } = setup({ search: 'something' });
    fireEvent.press(screen.getByLabelText('Limpiar búsqueda'));
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ search: '' }));
  });
});
