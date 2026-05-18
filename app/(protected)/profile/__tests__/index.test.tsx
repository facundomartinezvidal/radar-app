/**
 * Tests for Profile screen.
 *
 * Covers:
 *   - Renders full name from user_metadata
 *   - Renders email
 *   - Pressing "Editar nombre" navigates to edit-name
 *   - Pressing "Cerrar sesión" calls supabase.auth.signOut() and useAuthStore.reset()
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';

import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores';
import ProfileScreen from '../index';

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
  useSession: jest.fn(),
}));

jest.mock('@/stores', () => ({
  useAuthStore: {
    getState: jest.fn().mockReturnValue({ reset: jest.fn() }),
  },
}));

const { useSession } = require('@/hooks/use-session') as { useSession: jest.Mock };

const MOCK_USER = {
  id: 'user-1',
  email: 'facundo@example.com',
  user_metadata: { first_name: 'Facundo', last_name: 'Martinez' },
};

describe('ProfileScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useSession.mockReturnValue({ user: MOCK_USER, session: {}, isLoading: false });
  });

  it('renders full name from user_metadata', () => {
    render(<ProfileScreen />);
    expect(screen.getByText('Facundo Martinez')).toBeTruthy();
  });

  it('renders email', () => {
    render(<ProfileScreen />);
    expect(screen.getByText('facundo@example.com')).toBeTruthy();
  });

  it('pressing "Editar nombre" navigates to edit-name', () => {
    render(<ProfileScreen />);
    fireEvent.press(screen.getByTestId('edit-name-row'));
    expect(router.push).toHaveBeenCalledWith('/(protected)/profile/edit-name');
  });

  it('pressing "Cerrar sesión" calls supabase.auth.signOut()', async () => {
    const signOutMock = supabase.auth.signOut as jest.Mock;
    signOutMock.mockResolvedValueOnce({ error: null });

    render(<ProfileScreen />);
    fireEvent.press(screen.getByTestId('sign-out-row'));

    await waitFor(() => {
      expect(signOutMock).toHaveBeenCalledTimes(1);
    });
  });

  it('pressing "Cerrar sesión" calls useAuthStore.getState().reset()', async () => {
    const resetMock = jest.fn();
    (useAuthStore.getState as jest.Mock).mockReturnValue({ reset: resetMock });
    (supabase.auth.signOut as jest.Mock).mockResolvedValueOnce({ error: null });

    render(<ProfileScreen />);
    fireEvent.press(screen.getByTestId('sign-out-row'));

    await waitFor(() => {
      expect(resetMock).toHaveBeenCalledTimes(1);
    });
  });

  it('shows fallback name when user_metadata has no names', () => {
    useSession.mockReturnValue({
      user: { id: '1', email: 'test@example.com', user_metadata: {} },
      session: {},
      isLoading: false,
    });
    render(<ProfileScreen />);
    expect(screen.getByText('Sin nombre')).toBeTruthy();
  });
});
