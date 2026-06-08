/**
 * Tests for Grupos index screen.
 *
 * Covers:
 *   - Empty state "No hay grupos." when no groups exist
 *   - Renders GroupCard for each group when data is available
 *   - "Crear grupo" button navigates to the new group screen
 *   - Pressing a GroupCard navigates to the group detail screen
 *   - Pending invites section renders when invites exist
 *   - "Aceptar" calls useRespondInvite with accept:true
 *   - "Rechazar" calls useRespondInvite with accept:false
 *   - No invites section when there are no pending invites
 */
import React from 'react';
import { Alert } from 'react-native';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

import GroupsScreen from '../index';
import type { GroupWithMembers, GroupMemberRow, GroupRow } from '@/hooks/use-groups';

jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));

jest.mock('react-native-safe-area-context', () => {
  const { View } = require('react-native');
  return {
    SafeAreaView: View,
    SafeAreaProvider: View,
    useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
  };
});

// ---------------------------------------------------------------------------
// Hook mocks
// ---------------------------------------------------------------------------

const mockUseGroups = jest.fn();
const mockUsePendingInvites = jest.fn();
const mockRespondMutateAsync = jest.fn();

jest.mock('@/hooks/use-groups', () => ({
  useGroups: (...args: unknown[]) => mockUseGroups(...args),
  useGroup: jest.fn(() => ({ data: null, isLoading: false })),
  useGroupExpenses: jest.fn(() => ({ data: [], isLoading: false })),
  useGroupBalances: jest.fn(() => ({ data: [], isLoading: false })),
  useCreateGroup: jest.fn(() => ({ mutateAsync: jest.fn(), isPending: false })),
  useDeleteGroup: jest.fn(() => ({ mutateAsync: jest.fn(), isPending: false })),
  usePendingInvites: (...args: unknown[]) => mockUsePendingInvites(...args),
  useRespondInvite: jest.fn(() => ({
    mutateAsync: mockRespondMutateAsync,
    isPending: false,
  })),
}));

jest.mock('@/hooks/use-session', () => ({
  useSession: jest.fn(() => ({
    user: { id: 'u1' },
    session: {},
    isLoading: false,
    isAuthenticated: true,
  })),
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

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

const MOCK_GROUP_ROW: GroupRow = {
  id: 'g2',
  name: 'Bariloche',
  icon: 'Mountain',
  color: '#10B981',
  created_by: 'u2',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

const MOCK_INVITE: GroupMemberRow & { group: GroupRow | null } = {
  id: 'inv1',
  group_id: 'g2',
  user_id: 'u1',
  display_name: 'Facundo Martinez',
  role: 'member',
  status: 'pending',
  joined_at: null,
  invited_by: 'u2',
  created_at: '2026-01-01T00:00:00Z',
  group: MOCK_GROUP_ROW,
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GroupsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUsePendingInvites.mockReturnValue({ data: [], isLoading: false });
    mockRespondMutateAsync.mockResolvedValue({
      id: 'inv1',
      group_id: 'g2',
      status: 'active',
    });
  });

  // -------------------------------------------------------------------------
  // Existing tests (groups list)
  // -------------------------------------------------------------------------

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

  // -------------------------------------------------------------------------
  // Pending invites section
  // -------------------------------------------------------------------------

  it('renders "Invitaciones" section when pending invites exist', () => {
    mockUseGroups.mockReturnValue({ data: [], isLoading: false });
    mockUsePendingInvites.mockReturnValue({ data: [MOCK_INVITE], isLoading: false });

    render(<GroupsScreen />);
    expect(screen.getByTestId('pending-invites-section')).toBeTruthy();
    expect(screen.getByText('Invitaciones')).toBeTruthy();
  });

  it('renders the invite card with group name', () => {
    mockUseGroups.mockReturnValue({ data: [], isLoading: false });
    mockUsePendingInvites.mockReturnValue({ data: [MOCK_INVITE], isLoading: false });

    render(<GroupsScreen />);
    expect(screen.getByTestId(`invite-card-${MOCK_INVITE.id}`)).toBeTruthy();
    // Group name appears in the info block and caption
    expect(screen.getAllByText('Bariloche').length).toBeGreaterThan(0);
  });

  it('"Aceptar" calls useRespondInvite with accept:true', async () => {
    mockUseGroups.mockReturnValue({ data: [], isLoading: false });
    mockUsePendingInvites.mockReturnValue({ data: [MOCK_INVITE], isLoading: false });
    jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());

    render(<GroupsScreen />);
    fireEvent.press(screen.getByLabelText('Aceptar invitación'));

    await waitFor(() => {
      expect(mockRespondMutateAsync).toHaveBeenCalledWith({
        memberId: MOCK_INVITE.id,
        accept: true,
      });
    });
  });

  it('"Rechazar" calls useRespondInvite with accept:false', async () => {
    mockUseGroups.mockReturnValue({ data: [], isLoading: false });
    mockUsePendingInvites.mockReturnValue({ data: [MOCK_INVITE], isLoading: false });

    render(<GroupsScreen />);
    fireEvent.press(screen.getByLabelText('Rechazar invitación'));

    await waitFor(() => {
      expect(mockRespondMutateAsync).toHaveBeenCalledWith({
        memberId: MOCK_INVITE.id,
        accept: false,
      });
    });
  });

  it('does not render invites section when there are no pending invites', () => {
    mockUseGroups.mockReturnValue({ data: [], isLoading: false });
    mockUsePendingInvites.mockReturnValue({ data: [], isLoading: false });

    render(<GroupsScreen />);
    expect(screen.queryByTestId('pending-invites-section')).toBeNull();
    expect(screen.queryByText('Invitaciones')).toBeNull();
  });

  it('does not render invites section when pending invites data is null', () => {
    mockUseGroups.mockReturnValue({ data: [], isLoading: false });
    mockUsePendingInvites.mockReturnValue({ data: null, isLoading: false });

    render(<GroupsScreen />);
    expect(screen.queryByTestId('pending-invites-section')).toBeNull();
  });
});
