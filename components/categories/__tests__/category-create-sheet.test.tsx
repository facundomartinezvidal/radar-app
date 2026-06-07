/**
 * Tests for CategoryCreateSheet.
 *
 * Covers:
 *  - Renders CategoryForm with defaultName when visible
 *  - On valid submit calls onCreated with the created id and onClose
 *  - Server error is displayed when mutateAsync rejects
 *  - Sheet is not visible when visible=false
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';

import { CategoryCreateSheet } from '../category-create-sheet';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));

const mockMutateAsync = jest.fn();

jest.mock('@/hooks/use-categories', () => ({
  useCreateCategory: jest.fn(() => ({
    mutateAsync: mockMutateAsync,
    isPending: false,
  })),
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CategoryCreateSheet', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders CategoryForm with defaultName when visible', () => {
    render(
      <CategoryCreateSheet
        visible
        defaultName="Farmacia"
        onClose={jest.fn()}
        onCreated={jest.fn()}
      />,
    );

    // The name input should be pre-filled with the defaultName
    expect(screen.getByDisplayValue('Farmacia')).toBeTruthy();
  });

  it('renders the modal header "Nueva categoría"', () => {
    render(<CategoryCreateSheet visible onClose={jest.fn()} onCreated={jest.fn()} />);

    expect(screen.getByText('Nueva categoría')).toBeTruthy();
  });

  it('calls onCreated with the created id and onClose on successful submit', async () => {
    mockMutateAsync.mockResolvedValueOnce({ id: 'cat-new' });

    const onClose = jest.fn();
    const onCreated = jest.fn();

    render(
      <CategoryCreateSheet
        visible
        defaultName="Farmacia"
        onClose={onClose}
        onCreated={onCreated}
      />,
    );

    // Verify the default name is prefilled
    const input = screen.getByDisplayValue('Farmacia');
    expect(input).toBeTruthy();

    // Submit the form
    fireEvent.press(screen.getByText('Crear categoría'));

    await waitFor(() => {
      expect(onCreated).toHaveBeenCalledWith('cat-new');
    });
    expect(onClose).toHaveBeenCalled();
  });

  it('shows server error message when mutateAsync rejects', async () => {
    mockMutateAsync.mockRejectedValueOnce(new Error('Ya existe esa categoría.'));

    render(
      <CategoryCreateSheet
        visible
        defaultName="Farmacia"
        onClose={jest.fn()}
        onCreated={jest.fn()}
      />,
    );

    fireEvent.press(screen.getByText('Crear categoría'));

    await waitFor(() => {
      expect(screen.getByText('Ya existe esa categoría.')).toBeTruthy();
    });
  });

  it('shows the fallback server error message when mutateAsync rejects with a non-Error', async () => {
    mockMutateAsync.mockRejectedValueOnce('unexpected');

    render(
      <CategoryCreateSheet
        visible
        defaultName="Farmacia"
        onClose={jest.fn()}
        onCreated={jest.fn()}
      />,
    );

    fireEvent.press(screen.getByText('Crear categoría'));

    await waitFor(() => {
      expect(screen.getByText('No se pudo crear la categoría. Intentá nuevamente.')).toBeTruthy();
    });
  });

  it('does not render content when visible is false', () => {
    render(
      <CategoryCreateSheet
        visible={false}
        defaultName="Farmacia"
        onClose={jest.fn()}
        onCreated={jest.fn()}
      />,
    );

    // The form submit button should not be visible
    expect(screen.queryByText('Crear categoría')).toBeNull();
  });

  it('calls onClose when the X button is pressed', () => {
    const onClose = jest.fn();

    render(<CategoryCreateSheet visible onClose={onClose} onCreated={jest.fn()} />);

    fireEvent.press(screen.getByLabelText('Cerrar'));
    expect(onClose).toHaveBeenCalled();
  });
});
