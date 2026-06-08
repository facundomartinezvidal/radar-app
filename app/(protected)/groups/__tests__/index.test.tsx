/**
 * Tests for Grupos index screen.
 *
 * Covers:
 *   - Empty state "No hay grupos." when no groups exist
 *   - Renders GroupCard for each group when data is available
 *   - "Crear grupo" button navigates to the new group screen
 *   - Pressing a GroupCard navigates to the group detail screen
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { router } from 'expo-router';

import GroupsScreen from '../index';
import type { GroupWithMembers } from '@/hooks/use-groups';

jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));

jest.mock('react-native-safe-area-context', () => {
  const { View } = require('react-native');
  return {
    SafeAreaView: View,
    SafeAreaProvider: View,
    useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
  };
});

const mockUseGroups = jest.fn();

jest.mock('@/hooks/use-groups', () => ({
  useGroups: (...args: unknown[]) => mockUseGroups(...args),
  useGroup: jest.fn(() => ({ data: null, isLoading: false })),
  useGroupExpenses: jest.fn(() => ({ data: [], isLoading: false })),
  useGroupBalances: jest.fn(() => ({ data: [], isLoading: false })),
  useCreateGroup: jest.fn(() => ({ mutateAsync: jest.fn(), isPending: false })),
  useDeleteGroup: jest.fn(() => ({ mutateAsync: jest.fn(), isPending: false })),
}));

jest.mock('@/hooks/use-session', () => ({
  useSession: jest.fn(() => ({
    user: { id: 'u1' },
    session: {},
    isLoading: false,
    isAuthenticated: true,
  })),
}));

const MOCK_GROUP: GroupWithMembers = {
  id: 'g1',
  name: 'Depto',
  icon: 'House',
  color: '#0077B6',
  created_by: 'u1',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  members: [
    {
      id: 'm1',
      group_id: 'g1',
      user_id: null,
      display_name: 'Facundo Martinez',
      role: 'owner',
      status: 'active',
      joined_at: null,
      invited_by: null,
      created_at: '2026-01-01T00:00:00Z',
    },
  ],
};

describe('GroupsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders "No hay grupos." when there are no groups', () => {
    mockUseGroups.mockReturnValue({ data: [], isLoading: false });
    render(<GroupsScreen />);
    expect(screen.getByText('No hay grupos.')).toBeTruthy();
  });

  it('renders "No hay grupos." when data is null', () => {
    mockUseGroups.mockReturnValue({ data: null, isLoading: false });
    render(<GroupsScreen />);
    expect(screen.getByText('No hay grupos.')).toBeTruthy();
  });

  it('renders a GroupCard for each group', () => {
    mockUseGroups.mockReturnValue({
      data: [MOCK_GROUP, { ...MOCK_GROUP, id: 'g2', name: 'Bariloche' }],
      isLoading: false,
    });
    render(<GroupsScreen />);
    expect(screen.getByText('Depto')).toBeTruthy();
    expect(screen.getByText('Bariloche')).toBeTruthy();
  });

  it('"Crear grupo" button navigates to new group screen', () => {
    mockUseGroups.mockReturnValue({ data: [], isLoading: false });
    render(<GroupsScreen />);
    fireEvent.press(screen.getByLabelText('Crear grupo'));
    expect(router.push).toHaveBeenCalledWith('/(protected)/groups/new');
  });

  it('pressing a GroupCard navigates to the group detail', () => {
    mockUseGroups.mockReturnValue({ data: [MOCK_GROUP], isLoading: false });
    render(<GroupsScreen />);
    fireEvent.press(screen.getByTestId('group-card-g1'));
    expect(router.push).toHaveBeenCalledWith('/(protected)/groups/g1');
  });
});
