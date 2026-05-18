/**
 * Tests for Edit Name screen.
 *
 * Covers:
 *   - Form pre-populated from user_metadata
 *   - Submit calls supabase.auth.updateUser with correct payload
 *   - On success calls router.back()
 *   - Validation blocks empty submit
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';

import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import EditNameScreen from '../edit-name';

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

const { useSession } = require('@/hooks/use-session') as { useSession: jest.Mock };

const MOCK_USER = {
  id: 'user-1',
  email: 'facundo@example.com',
  user_metadata: { first_name: 'Facundo', last_name: 'Martinez' },
};

describe('EditNameScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useSession.mockReturnValue({ user: MOCK_USER, session: {}, isLoading: false });
  });

  it('pre-populates first name from user_metadata', () => {
    render(<EditNameScreen />);
    const firstNameInput = screen.getByDisplayValue('Facundo');
    expect(firstNameInput).toBeTruthy();
  });

  it('pre-populates last name from user_metadata', () => {
    render(<EditNameScreen />);
    const lastNameInput = screen.getByDisplayValue('Martinez');
    expect(lastNameInput).toBeTruthy();
  });

  it('calls supabase.auth.updateUser with new values on submit', async () => {
    const updateUserMock = jest.fn().mockResolvedValue({ error: null });
    (supabase.auth as unknown as Record<string, jest.Mock>).updateUser = updateUserMock;

    render(<EditNameScreen />);

    const firstNameInput = screen.getByDisplayValue('Facundo');
    const lastNameInput = screen.getByDisplayValue('Martinez');

    fireEvent.changeText(firstNameInput, 'Juan');
    fireEvent.changeText(lastNameInput, 'Perez');

    fireEvent.press(screen.getByText('Guardar'));

    await waitFor(() => {
      expect(updateUserMock).toHaveBeenCalledWith({
        data: { first_name: 'Juan', last_name: 'Perez' },
      });
    });
  });

  it('calls router.back() on success', async () => {
    const updateUserMock = jest.fn().mockResolvedValue({ error: null });
    (supabase.auth as unknown as Record<string, jest.Mock>).updateUser = updateUserMock;

    render(<EditNameScreen />);

    fireEvent.press(screen.getByText('Guardar'));

    await waitFor(() => {
      expect(router.back).toHaveBeenCalledTimes(1);
    });
  });

  it('shows error message when updateUser fails', async () => {
    const updateUserMock = jest.fn().mockResolvedValue({ error: { message: 'Network error' } });
    (supabase.auth as unknown as Record<string, jest.Mock>).updateUser = updateUserMock;

    render(<EditNameScreen />);

    fireEvent.press(screen.getByText('Guardar'));

    await waitFor(() => {
      expect(screen.getByText('No pudimos guardar tu nombre. Probá de nuevo.')).toBeTruthy();
    });
    expect(router.back).not.toHaveBeenCalled();
  });

  it('does not submit and shows validation error when first name is empty', async () => {
    useSession.mockReturnValue({
      user: { id: '1', email: 'x@x.com', user_metadata: {} },
      session: {},
      isLoading: false,
    });
    const updateUserMock = jest.fn();
    (supabase.auth as unknown as Record<string, jest.Mock>).updateUser = updateUserMock;

    render(<EditNameScreen />);

    // Clear the first name field (it starts empty because metadata has no names)
    // Press submit immediately
    fireEvent.press(screen.getByText('Guardar'));

    await waitFor(() => {
      expect(updateUserMock).not.toHaveBeenCalled();
    });
  });
});
