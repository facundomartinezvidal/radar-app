/**
 * Tests for Home screen (C4 rewrite).
 *
 * Covers:
 *   - Renders without crashing
 *   - Shows "Hola" greeting (with or without user session)
 *   - Shows "ESTE MES" label
 *   - Shows "Cerrar sesión" button
 *   - Sign-out calls supabase.auth.signOut() and useAuthStore.getState().reset()
 */
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';

import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores';
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

jest.mock('@/stores', () => ({
  useAuthStore: {
    getState: jest.fn().mockReturnValue({ reset: jest.fn() }),
  },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// We need to re-require the mocked module to get a typed handle on the spy.
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

  it('shows "Cerrar sesión" button', () => {
    renderWithClient();
    expect(screen.getByText('Cerrar sesión')).toBeTruthy();
  });

  describe('sign-out', () => {
    it('calls supabase.auth.signOut() when "Cerrar sesión" is pressed', async () => {
      const signOutMock = supabase.auth.signOut as jest.Mock;
      signOutMock.mockResolvedValueOnce({ error: null });

      renderWithClient();
      fireEvent.press(screen.getByText('Cerrar sesión'));

      await waitFor(() => {
        expect(signOutMock).toHaveBeenCalledTimes(1);
      });
    });

    it('calls useAuthStore.getState().reset() after sign out', async () => {
      const resetMock = jest.fn();
      (useAuthStore.getState as jest.Mock).mockReturnValue({ reset: resetMock });
      (supabase.auth.signOut as jest.Mock).mockResolvedValueOnce({ error: null });

      renderWithClient();
      fireEvent.press(screen.getByText('Cerrar sesión'));

      await waitFor(() => {
        expect(resetMock).toHaveBeenCalledTimes(1);
      });
    });
  });
});
