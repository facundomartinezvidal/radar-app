/**
 * Tests for Categorías screen (Perfil stack).
 *
 * Covers:
 *   - Only custom categories (user_id !== null) are rendered; system ones are excluded
 *   - Empty state renders when no custom categories exist
 *   - Pressing delete triggers Alert.alert with the confirm dialog
 */
import React from 'react';
import { Alert } from 'react-native';
import { render, screen, fireEvent } from '@testing-library/react-native';

import CategoriesScreen from '../categories';

jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));

jest.mock('react-native-safe-area-context', () => {
  const { View } = require('react-native');
  return {
    SafeAreaView: View,
    SafeAreaProvider: View,
    useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
  };
});

const mockDeleteMutateAsync = jest.fn().mockResolvedValue({ id: 'cat-custom-1' });

jest.mock('@/hooks/use-categories', () => ({
  useDeleteCategory: jest.fn(() => ({ mutateAsync: mockDeleteMutateAsync })),
  useCreateCategory: jest.fn(() => ({ mutateAsync: jest.fn(), isPending: false })),
  useUpdateCategory: jest.fn(() => ({ mutateAsync: jest.fn(), isPending: false })),
}));

jest.mock('@/hooks/use-expenses', () => ({
  useCategories: jest.fn(),
  useExpenses: jest.fn(() => ({ data: [], isLoading: false })),
  categoryKeys: { all: ['categories'] },
  expenseKeys: { all: ['expenses'] },
}));

const { useCategories } = require('@/hooks/use-expenses') as { useCategories: jest.Mock };

const SYSTEM_CAT = {
  id: 'cat-system-1',
  name: 'Comida',
  icon: 'UtensilsCrossed',
  color: '#0077B6',
  user_id: null,
  created_at: '2026-01-01T00:00:00Z',
};

const CUSTOM_CAT = {
  id: 'cat-custom-1',
  name: 'Mascota',
  icon: 'PawPrint',
  color: '#10B981',
  user_id: 'u1',
  created_at: '2026-06-01T00:00:00Z',
};

describe('CategoriesScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders only custom category names; system categories are excluded', () => {
    useCategories.mockReturnValue({
      data: [SYSTEM_CAT, CUSTOM_CAT],
      isLoading: false,
    });

    render(<CategoriesScreen />);

    expect(screen.getByText('Mascota')).toBeTruthy();
    expect(screen.queryByText('Comida')).toBeNull();
  });

  it('renders empty-state text when there are no custom categories', () => {
    useCategories.mockReturnValue({
      data: [SYSTEM_CAT],
      isLoading: false,
    });

    render(<CategoriesScreen />);

    expect(screen.getByText('No hay categorías.')).toBeTruthy();
  });

  it('renders empty-state text when data is empty', () => {
    useCategories.mockReturnValue({
      data: [],
      isLoading: false,
    });

    render(<CategoriesScreen />);

    expect(screen.getByText('No hay categorías.')).toBeTruthy();
  });

  it('pressing delete triggers Alert.alert with the confirm dialog', () => {
    useCategories.mockReturnValue({
      data: [CUSTOM_CAT],
      isLoading: false,
    });

    const alertSpy = jest.spyOn(Alert, 'alert');

    render(<CategoriesScreen />);

    const deleteButton = screen.getByTestId(`delete-category-${CUSTOM_CAT.id}`);
    fireEvent.press(deleteButton);

    expect(alertSpy).toHaveBeenCalledWith(
      'Eliminar categoría',
      '¿Confirmás que querés eliminar esta categoría?',
      expect.any(Array),
    );
  });
});
