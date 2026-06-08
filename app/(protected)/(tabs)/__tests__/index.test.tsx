/**
 * Tests for Home screen (C4 rewrite).
 *
 * Covers:
 *   - Renders without crashing
 *   - Shows "Hola" greeting (with or without user session)
 *   - Shows "ESTE MES" label
 *   - Avatar is pressable and navigates to profile
 */
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, fireEvent } from '@testing-library/react-native';

import { router } from 'expo-router';
import HomeScreen from '../index';

// Mock the expenses repo so home's TanStack Query hooks resolve without DB
jest.mock('@/lib/repositories/expenses', () => ({
  listExpenses: jest.fn().mockResolvedValue({ data: [], error: null }),
  listCategories: jest.fn().mockResolvedValue({ data: [], error: null }),
  getExpense: jest.fn().mockResolvedValue({ data: null, error: null }),
  createExpense: jest.fn(),
  updateExpense: jest.fn(),
  deleteExpense: jest.fn(),
  sumExpensesByCurrency: jest.fn().mockResolvedValue({ data: [], error: null }),
}));

jest.mock('@/hooks/use-groups', () => ({
  useGroups: jest.fn(() => ({ data: [], isLoading: false })),
}));

function renderWithClient(): { client: QueryClient } {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <HomeScreen />
    </QueryClientProvider>,
  );
  return { client };
}

jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));

jest.mock('react-native-safe-area-context', () => {
  const { View } = require('react-native');
  return {
    SafeAreaView: View,
    SafeAreaProvider: View,
    useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
  };
});

jest.mock('@/hooks/use-session', () => ({
  useSession: jest.fn().mockReturnValue({ user: null, session: null, isLoading: false }),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const { useSession } = require('@/hooks/use-session') as {
  useSession: jest.Mock;
};

describe('HomeScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useSession.mockReturnValue({ user: null, session: null, isLoading: false });
  });

  it('renders without crashing', () => {
    expect(() => renderWithClient()).not.toThrow();
  });

  describe('greeting', () => {
    it('shows fallback "Hola" when no user session', () => {
      useSession.mockReturnValue({ user: null, session: null, isLoading: false });
      renderWithClient();
      expect(screen.getByText('Hola')).toBeTruthy();
    });

    it('shows personalised greeting when user has first_name in user_metadata', () => {
      useSession.mockReturnValue({
        user: {
          id: '1',
          email: 'facundo@example.com',
          user_metadata: { first_name: 'Facundo', last_name: 'Martinez' },
        },
        session: {},
        isLoading: false,
      });
      renderWithClient();
      // Name is derived from user_metadata.first_name
      expect(screen.getByText('Hola, Facundo')).toBeTruthy();
    });

    it('shows fallback "Hola" when user_metadata has no first_name', () => {
      useSession.mockReturnValue({
        user: { id: '1', email: 'facundo@example.com', user_metadata: {} },
        session: {},
        isLoading: false,
      });
      renderWithClient();
      expect(screen.getByText('Hola')).toBeTruthy();
    });
  });

  it('shows "ESTE MES" section label', () => {
    renderWithClient();
    // Label primitive renders "Este mes" (uppercased via textTransform in CSS).
    // Use getAllByText since the text may appear in multiple RN nodes in the tree.
    const labels = screen.getAllByText(/este mes/i);
    expect(labels.length).toBeGreaterThan(0);
  });

  it('does not show "Cerrar sesión" on home screen', () => {
    renderWithClient();
    expect(screen.queryByText('Cerrar sesión')).toBeNull();
  });

  it('renders "Ver categorías" quick action and "Escanear" is gone', () => {
    renderWithClient();
    expect(screen.getByLabelText('Ver categorías')).toBeTruthy();
    expect(screen.queryByLabelText('Escanear comprobante')).toBeNull();
  });

  it('pressing "Ver categorías" navigates to the categories management screen', () => {
    renderWithClient();
    fireEvent.press(screen.getByLabelText('Ver categorías'));
    expect(router.push).toHaveBeenCalledWith('/(protected)/profile/categories');
  });

  it('avatar Pressable navigates to profile', () => {
    useSession.mockReturnValue({
      user: {
        id: '1',
        email: 'facundo@example.com',
        user_metadata: { first_name: 'Facundo', last_name: 'Martinez' },
      },
      session: {},
      isLoading: false,
    });
    renderWithClient();
    fireEvent.press(screen.getByLabelText('Abrir perfil'));
    expect(router.push).toHaveBeenCalledWith('/(protected)/profile');
  });
});
