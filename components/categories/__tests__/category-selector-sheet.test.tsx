/**
 * Tests for CategorySelectorSheet.
 *
 * Covers:
 *  - When visible, renders search box and tiles for given categories
 *  - Typing in the search box filters the list
 *  - Tapping a tile calls onSelect(id) and onClose
 *  - "Sin categoría" option calls onSelect(null) and onClose
 *  - Custom category (user_id != null) shows edit + delete controls
 *  - System category (user_id === null) does NOT show edit/delete
 *  - Pressing delete triggers Alert.alert with the correct message
 *  - "Nueva categoría" tile switches to create mode
 *  - Back affordance returns to the list from create/edit modes
 */
import React from 'react';
import { Alert } from 'react-native';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { CategorySelectorSheet } from '../category-selector-sheet';
import type { CategoryRow } from '@/lib/repositories/expenses';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));

const mockCreateAsync = jest.fn();
const mockUpdateAsync = jest.fn();
const mockDeleteAsync = jest.fn();

jest.mock('@/hooks/use-categories', () => ({
  useCreateCategory: jest.fn(() => ({
    mutateAsync: mockCreateAsync,
    isPending: false,
  })),
  useUpdateCategory: jest.fn(() => ({
    mutateAsync: mockUpdateAsync,
    isPending: false,
  })),
  useDeleteCategory: jest.fn(() => ({
    mutateAsync: mockDeleteAsync,
    isPending: false,
  })),
}));

jest.spyOn(Alert, 'alert');

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
  // Custom vs system categories — edit/delete controls
  // -------------------------------------------------------------------------

  it('shows edit and delete controls for a custom category (user_id != null)', () => {
    render(
      <Wrapper>
        <CategorySelectorSheet {...defaultProps} />
      </Wrapper>,
    );

    expect(screen.getByLabelText('Editar Gimnasio')).toBeTruthy();
    expect(screen.getByLabelText('Eliminar Gimnasio')).toBeTruthy();
  });

  it('does NOT show edit/delete controls for a system category (user_id === null)', () => {
    render(
      <Wrapper>
        <CategorySelectorSheet {...defaultProps} />
      </Wrapper>,
    );

    expect(screen.queryByLabelText('Editar Comida')).toBeNull();
    expect(screen.queryByLabelText('Eliminar Comida')).toBeNull();
  });

  // -------------------------------------------------------------------------
  // Delete flow
  // -------------------------------------------------------------------------

  it('triggers Alert.alert with the destructive confirm message on delete press', () => {
    render(
      <Wrapper>
        <CategorySelectorSheet {...defaultProps} />
      </Wrapper>,
    );

    fireEvent.press(screen.getByLabelText('Eliminar Gimnasio'));

    expect(Alert.alert).toHaveBeenCalledWith(
      'Eliminar categoría',
      '¿Confirmás que querés eliminar esta categoría?',
      expect.any(Array),
    );
  });

  it('calls mutateAsync(id) and onSelect(null) when the selected category is deleted', async () => {
    mockDeleteAsync.mockResolvedValueOnce({ id: 'cat-custom' });

    const onSelect = jest.fn();

    render(
      <Wrapper>
        <CategorySelectorSheet {...defaultProps} value="cat-custom" onSelect={onSelect} />
      </Wrapper>,
    );

    fireEvent.press(screen.getByLabelText('Eliminar Gimnasio'));

    // Simulate pressing the destructive button in the Alert
    const alertCall = (Alert.alert as jest.Mock).mock.calls[0];
    const buttons = alertCall[2] as { text: string; onPress?: () => void }[];
    const destructiveBtn = buttons.find((b) => b.text === 'Eliminar');
    await destructiveBtn?.onPress?.();

    await waitFor(() => {
      expect(mockDeleteAsync).toHaveBeenCalledWith('cat-custom');
      expect(onSelect).toHaveBeenCalledWith(null);
    });
  });

  it('shows an error alert when delete mutateAsync rejects', async () => {
    mockDeleteAsync.mockRejectedValueOnce(new Error('DB error'));

    render(
      <Wrapper>
        <CategorySelectorSheet {...defaultProps} />
      </Wrapper>,
    );

    fireEvent.press(screen.getByLabelText('Eliminar Gimnasio'));

    const alertCall = (Alert.alert as jest.Mock).mock.calls[0];
    const buttons = alertCall[2] as { text: string; onPress?: () => void }[];
    const destructiveBtn = buttons.find((b) => b.text === 'Eliminar');
    await destructiveBtn?.onPress?.();

    await waitFor(() => {
      const calls = (Alert.alert as jest.Mock).mock.calls;
      const errorCall = calls.find((c: [string, string]) => c[0] === 'Error');
      expect(errorCall).toBeTruthy();
      expect(errorCall[1]).toBe('No se pudo eliminar la categoría. Intentá nuevamente.');
    });
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
  // Edit mode
  // -------------------------------------------------------------------------

  it('switches to edit mode when the edit button is tapped for a custom category', () => {
    render(
      <Wrapper>
        <CategorySelectorSheet {...defaultProps} />
      </Wrapper>,
    );

    fireEvent.press(screen.getByLabelText('Editar Gimnasio'));

    expect(screen.getByText('Editar categoría')).toBeTruthy();
    expect(screen.getByText('Guardar cambios')).toBeTruthy();
  });

  it('returns to the list from edit mode via the back button', () => {
    render(
      <Wrapper>
        <CategorySelectorSheet {...defaultProps} />
      </Wrapper>,
    );

    fireEvent.press(screen.getByLabelText('Editar Gimnasio'));
    fireEvent.press(screen.getByLabelText('Volver'));

    expect(screen.getByText('Elegir categoría')).toBeTruthy();
  });

  it('calls updateMutation.mutateAsync on successful edit submit', async () => {
    mockUpdateAsync.mockResolvedValueOnce({
      id: 'cat-custom',
      name: 'Gimnasio',
      icon: 'Dumbbell',
      color: '#10B981',
    });

    render(
      <Wrapper>
        <CategorySelectorSheet {...defaultProps} />
      </Wrapper>,
    );

    fireEvent.press(screen.getByLabelText('Editar Gimnasio'));

    // The form is pre-filled; just submit
    fireEvent.press(screen.getByText('Guardar cambios'));

    await waitFor(() => {
      expect(mockUpdateAsync).toHaveBeenCalledWith({
        id: 'cat-custom',
        patch: expect.objectContaining({ name: 'Gimnasio' }),
      });
    });
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
