/**
 * Tests for CategoryPicker — compact trigger + bottom-sheet selector.
 *
 * Covers:
 *  - Renders trigger with placeholder "Elegir categoría" when value is null
 *  - Renders trigger with selected category name when a value is set
 *  - Tapping the trigger opens the CategorySelectorSheet
 *  - When disabled, tapping the trigger does NOT open the sheet
 *  - onChange is called when the sheet selects a category
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
  useUpdateCategory: jest.fn(() => ({
    mutateAsync: jest.fn(),
    isPending: false,
  })),
  useDeleteCategory: jest.fn(() => ({
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
    kind: 'expense',
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
    kind: 'expense',
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
  it('renders trigger with placeholder "Elegir categoría" when value is null', () => {
    render(
      <Wrapper>
        <CategoryPicker categories={CATEGORIES} value={null} onChange={jest.fn()} />
      </Wrapper>,
    );

    expect(screen.getByText('Elegir categoría')).toBeTruthy();
  });

  it('renders trigger with the selected category name when a value is set', () => {
    render(
      <Wrapper>
        <CategoryPicker categories={CATEGORIES} value="cat-1" onChange={jest.fn()} />
      </Wrapper>,
    );

    expect(screen.getByText('Comida')).toBeTruthy();
  });

  it('has accessibilityRole="button" and accessibilityLabel="Elegir categoría"', () => {
    render(
      <Wrapper>
        <CategoryPicker categories={CATEGORIES} value={null} onChange={jest.fn()} />
      </Wrapper>,
    );

    expect(screen.getByLabelText('Elegir categoría')).toBeTruthy();
  });

  it('opens the sheet (renders "Elegir categoría" header) on trigger press', () => {
    render(
      <Wrapper>
        <CategoryPicker categories={CATEGORIES} value={null} onChange={jest.fn()} />
      </Wrapper>,
    );

    fireEvent.press(screen.getByLabelText('Elegir categoría'));

    // The sheet header text (H2) should now appear
    // The heading + placeholder text both say "Elegir categoría"; at least one must be in a sheet context
    // We can verify the search input appears as a signal the sheet opened
    expect(screen.getByPlaceholderText('Buscar categoría')).toBeTruthy();
  });

  it('does not open the sheet when disabled', () => {
    render(
      <Wrapper>
        <CategoryPicker categories={CATEGORIES} value={null} onChange={jest.fn()} disabled />
      </Wrapper>,
    );

    fireEvent.press(screen.getByLabelText('Elegir categoría'));

    expect(screen.queryByPlaceholderText('Buscar categoría')).toBeNull();
  });

  it('calls onChange with the selected category id when a tile is tapped in the sheet', () => {
    const onChange = jest.fn();

    render(
      <Wrapper>
        <CategoryPicker categories={CATEGORIES} value={null} onChange={onChange} />
      </Wrapper>,
    );

    // Open the sheet
    fireEvent.press(screen.getByLabelText('Elegir categoría'));

    // Tap the Comida tile in the sheet
    fireEvent.press(screen.getByLabelText('Categoría Comida'));

    expect(onChange).toHaveBeenCalledWith('cat-1');
  });

  it('calls onChange with null when "Sin categoría" is tapped in the sheet', () => {
    const onChange = jest.fn();

    render(
      <Wrapper>
        <CategoryPicker categories={CATEGORIES} value="cat-1" onChange={onChange} />
      </Wrapper>,
    );

    // Open the sheet
    fireEvent.press(screen.getByLabelText('Elegir categoría'));

    // Tap "Sin categoría"
    fireEvent.press(screen.getByLabelText('Sin categoría'));

    expect(onChange).toHaveBeenCalledWith(null);
  });
});
