/**
 * Tests for CategoryPicker (extended with "+ Categoría" chip).
 *
 * Covers:
 *   - Renders all category chips
 *   - Pressing a chip calls onChange with the category id
 *   - "Agregar categoría" chip is present
 *   - Pressing "Agregar categoría" opens the create modal (CategoryForm visible)
 *   - Pressing a chip in disabled state does not call onChange
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { CategoryPicker } from '../category-picker';
import type { CategoryRow } from '@/lib/repositories/expenses';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));

jest.mock('@/hooks/use-categories', () => ({
  useCreateCategory: jest.fn(() => ({
    mutateAsync: jest.fn(),
    isPending: false,
  })),
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const CATEGORIES: CategoryRow[] = [
  {
    id: 'cat-1',
    slug: 'comida',
    name: 'Comida',
    icon: 'UtensilsCrossed',
    color: '#F59E0B',
    sort_order: 10,
    created_at: '2026-01-01',
    updated_at: '2026-01-01',
    user_id: null,
  },
  {
    id: 'cat-2',
    slug: 'transporte',
    name: 'Transporte',
    icon: 'Bus',
    color: '#0077B6',
    sort_order: 20,
    created_at: '2026-01-01',
    updated_at: '2026-01-01',
    user_id: null,
  },
];

// ---------------------------------------------------------------------------
// Wrapper
// ---------------------------------------------------------------------------

function Wrapper({ children }: { children: React.ReactNode }): React.JSX.Element {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CategoryPicker', () => {
  it('renders a chip for each category', () => {
    render(
      <Wrapper>
        <CategoryPicker categories={CATEGORIES} value={null} onChange={jest.fn()} />
      </Wrapper>,
    );

    expect(screen.getByLabelText('Categoría Comida')).toBeTruthy();
    expect(screen.getByLabelText('Categoría Transporte')).toBeTruthy();
  });

  it('renders the "+ Categoría" chip with accessibilityLabel "Agregar categoría"', () => {
    render(
      <Wrapper>
        <CategoryPicker categories={CATEGORIES} value={null} onChange={jest.fn()} />
      </Wrapper>,
    );

    expect(screen.getByLabelText('Agregar categoría')).toBeTruthy();
  });

  it('pressing a category chip calls onChange with that category id', () => {
    const onChange = jest.fn();
    render(
      <Wrapper>
        <CategoryPicker categories={CATEGORIES} value={null} onChange={onChange} />
      </Wrapper>,
    );

    fireEvent.press(screen.getByLabelText('Categoría Comida'));
    expect(onChange).toHaveBeenCalledWith('cat-1');
  });

  it('pressing the selected chip deselects (calls onChange with null)', () => {
    const onChange = jest.fn();
    render(
      <Wrapper>
        <CategoryPicker categories={CATEGORIES} value="cat-1" onChange={onChange} />
      </Wrapper>,
    );

    fireEvent.press(screen.getByLabelText('Categoría Comida'));
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it('pressing "+ Categoría" opens the modal (CategoryForm with "Crear categoría" button becomes visible)', () => {
    render(
      <Wrapper>
        <CategoryPicker categories={CATEGORIES} value={null} onChange={jest.fn()} />
      </Wrapper>,
    );

    fireEvent.press(screen.getByLabelText('Agregar categoría'));

    // CategoryForm renders in the modal with the default submit button label
    expect(screen.getByText('Crear categoría')).toBeTruthy();
  });

  it('does not call onChange when disabled', () => {
    const onChange = jest.fn();
    render(
      <Wrapper>
        <CategoryPicker categories={CATEGORIES} value={null} onChange={onChange} disabled />
      </Wrapper>,
    );

    fireEvent.press(screen.getByLabelText('Categoría Comida'));
    expect(onChange).not.toHaveBeenCalled();
  });
});
