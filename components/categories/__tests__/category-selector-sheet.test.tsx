/**
 * Tests for CategorySelectorSheet.
 *
 * Covers:
 *  - When visible, renders search box and tiles for given categories
 *  - Typing in the search box filters the list
 *  - Tapping a tile calls onSelect(id) and onClose
 *  - "Sin categoría" option calls onSelect(null) and onClose
 *  - Per-tile edit/delete controls are NOT present (moved to management screen)
 *  - "Nueva categoría" tile switches to create mode
 *  - Back affordance returns to the list from create mode
 *  - "Gestionar categorías" link calls onClose and navigates to the management screen
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { router } from 'expo-router';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { CategorySelectorSheet } from '../category-selector-sheet';
import type { CategoryRow } from '@/lib/repositories/expenses';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));

jest.mock('expo-router', () => ({
  router: {
    push: jest.fn(),
  },
}));

const mockCreateAsync = jest.fn();

jest.mock('@/hooks/use-categories', () => ({
  useCreateCategory: jest.fn(() => ({
    mutateAsync: mockCreateAsync,
    isPending: false,
  })),
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const SYSTEM_CATEGORY: CategoryRow = {
  id: 'cat-sys',
  slug: 'comida',
  name: 'Comida',
  icon: 'UtensilsCrossed',
  color: '#F59E0B',
  sort_order: 10,
  created_at: '2026-01-01',
  updated_at: '2026-01-01',
  user_id: null,
  kind: 'expense',
};

const CUSTOM_CATEGORY: CategoryRow = {
  id: 'cat-custom',
  slug: 'gym',
  name: 'Gimnasio',
  icon: 'Dumbbell',
  color: '#10B981',
  sort_order: 100,
  created_at: '2026-01-01',
  updated_at: '2026-01-01',
  user_id: 'user-1',
  kind: 'expense',
};

const CATEGORIES: CategoryRow[] = [SYSTEM_CATEGORY, CUSTOM_CATEGORY];

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
// Helper: default props
// ---------------------------------------------------------------------------

const defaultProps = {
  visible: true,
  categories: CATEGORIES,
  value: null,
  onClose: jest.fn(),
  onSelect: jest.fn(),
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CategorySelectorSheet', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // Visibility and rendering
  // -------------------------------------------------------------------------

  it('renders the header "Elegir categoría" when visible', () => {
    render(
      <Wrapper>
        <CategorySelectorSheet {...defaultProps} />
      </Wrapper>,
    );

    expect(screen.getByText('Elegir categoría')).toBeTruthy();
  });

  it('renders a search input when visible', () => {
    render(
      <Wrapper>
        <CategorySelectorSheet {...defaultProps} />
      </Wrapper>,
    );

    expect(screen.getByPlaceholderText('Buscar categoría')).toBeTruthy();
  });

  it('renders tiles for all provided categories', () => {
    render(
      <Wrapper>
        <CategorySelectorSheet {...defaultProps} />
      </Wrapper>,
    );

    expect(screen.getByLabelText('Categoría Comida')).toBeTruthy();
    expect(screen.getByLabelText('Categoría Gimnasio')).toBeTruthy();
  });

  it('renders the "Sin categoría" option', () => {
    render(
      <Wrapper>
        <CategorySelectorSheet {...defaultProps} />
      </Wrapper>,
    );

    expect(screen.getByLabelText('Sin categoría')).toBeTruthy();
  });

  it('does not render content when visible is false', () => {
    render(
      <Wrapper>
        <CategorySelectorSheet {...defaultProps} visible={false} />
      </Wrapper>,
    );

    expect(screen.queryByText('Elegir categoría')).toBeNull();
  });

  // -------------------------------------------------------------------------
  // Search filtering
  // -------------------------------------------------------------------------

  it('filters categories when typing in the search box', () => {
    render(
      <Wrapper>
        <CategorySelectorSheet {...defaultProps} />
      </Wrapper>,
    );

    fireEvent.changeText(screen.getByPlaceholderText('Buscar categoría'), 'comida');

    expect(screen.getByLabelText('Categoría Comida')).toBeTruthy();
    expect(screen.queryByLabelText('Categoría Gimnasio')).toBeNull();
  });

  it('performs accent-insensitive search', () => {
    render(
      <Wrapper>
        <CategorySelectorSheet {...defaultProps} />
      </Wrapper>,
    );

    fireEvent.changeText(screen.getByPlaceholderText('Buscar categoría'), 'gimnasio');

    expect(screen.getByLabelText('Categoría Gimnasio')).toBeTruthy();
    expect(screen.queryByLabelText('Categoría Comida')).toBeNull();
  });

  // -------------------------------------------------------------------------
  // Selection
  // -------------------------------------------------------------------------

  it('calls onSelect(id) when a category tile is tapped', () => {
    const onSelect = jest.fn();
    const onClose = jest.fn();

    render(
      <Wrapper>
        <CategorySelectorSheet {...defaultProps} onSelect={onSelect} onClose={onClose} />
      </Wrapper>,
    );

    fireEvent.press(screen.getByLabelText('Categoría Comida'));

    expect(onSelect).toHaveBeenCalledWith('cat-sys');
    expect(onClose).toHaveBeenCalled();
  });

  it('calls onSelect(null) and onClose when "Sin categoría" is tapped', () => {
    const onSelect = jest.fn();
    const onClose = jest.fn();

    render(
      <Wrapper>
        <CategorySelectorSheet {...defaultProps} onSelect={onSelect} onClose={onClose} />
      </Wrapper>,
    );

    fireEvent.press(screen.getByLabelText('Sin categoría'));

    expect(onSelect).toHaveBeenCalledWith(null);
    expect(onClose).toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // No per-tile edit/delete controls
  // -------------------------------------------------------------------------

  it('does NOT show per-tile edit controls for any category', () => {
    render(
      <Wrapper>
        <CategorySelectorSheet {...defaultProps} />
      </Wrapper>,
    );

    expect(screen.queryByLabelText('Editar Gimnasio')).toBeNull();
    expect(screen.queryByLabelText('Editar Comida')).toBeNull();
  });

  it('does NOT show per-tile delete controls for any category', () => {
    render(
      <Wrapper>
        <CategorySelectorSheet {...defaultProps} />
      </Wrapper>,
    );

    expect(screen.queryByLabelText('Eliminar Gimnasio')).toBeNull();
    expect(screen.queryByLabelText('Eliminar Comida')).toBeNull();
  });

  // -------------------------------------------------------------------------
  // Gestionar categorías link
  // -------------------------------------------------------------------------

  it('renders the "Gestionar categorías" link in list mode', () => {
    render(
      <Wrapper>
        <CategorySelectorSheet {...defaultProps} />
      </Wrapper>,
    );

    expect(screen.getByLabelText('Gestionar categorías')).toBeTruthy();
  });

  it('calls onClose and navigates to the management screen when "Gestionar categorías" is pressed', () => {
    const onClose = jest.fn();

    render(
      <Wrapper>
        <CategorySelectorSheet {...defaultProps} onClose={onClose} />
      </Wrapper>,
    );

    fireEvent.press(screen.getByLabelText('Gestionar categorías'));

    expect(onClose).toHaveBeenCalled();
    expect(router.push).toHaveBeenCalledWith('/(protected)/profile/categories');
  });

  // -------------------------------------------------------------------------
  // Create mode
  // -------------------------------------------------------------------------

  it('switches to create mode when "Nueva categoría" is tapped', () => {
    render(
      <Wrapper>
        <CategorySelectorSheet {...defaultProps} />
      </Wrapper>,
    );

    fireEvent.press(screen.getByLabelText('Nueva categoría'));

    expect(screen.getByText('Nueva categoría')).toBeTruthy();
    expect(screen.getByText('Crear categoría')).toBeTruthy();
  });

  it('returns to the list from create mode via the back button', () => {
    render(
      <Wrapper>
        <CategorySelectorSheet {...defaultProps} />
      </Wrapper>,
    );

    fireEvent.press(screen.getByLabelText('Nueva categoría'));
    fireEvent.press(screen.getByLabelText('Volver'));

    expect(screen.getByText('Elegir categoría')).toBeTruthy();
  });

  // -------------------------------------------------------------------------
  // Close
  // -------------------------------------------------------------------------

  it('calls onClose when the X button is pressed', () => {
    const onClose = jest.fn();

    render(
      <Wrapper>
        <CategorySelectorSheet {...defaultProps} onClose={onClose} />
      </Wrapper>,
    );

    fireEvent.press(screen.getByLabelText('Cerrar'));

    expect(onClose).toHaveBeenCalled();
  });
});
