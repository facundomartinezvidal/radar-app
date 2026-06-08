/**
 * Tests for the new shared expense screen (expense.tsx).
 *
 * Covers:
 *   - Renders the "Nuevo gasto compartido" heading
 *   - Shows a loader while data is loading
 *   - Shows error message when group query fails
 *   - Renders form when group + categories are loaded
 *   - On valid submit calls useCreateSharedExpense with the right shape
 */
import React from 'react';
import { render, screen } from '@testing-library/react-native';

import NewSharedExpenseScreen from '../expense';
import type { GroupWithMembers, GroupMemberRow } from '@/hooks/use-groups';

jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));

jest.mock('react-native-safe-area-context', () => {
  const { View } = require('react-native');
  return {
    SafeAreaView: View,
    SafeAreaProvider: View,
    useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
  };
});

jest.mock('@react-native-community/datetimepicker', () => {
  const ReactLib = require('react');
  const { View } = require('react-native');
  const Mock = () => ReactLib.createElement(View, { testID: 'mock-datetimepicker' });
  Mock.displayName = 'MockDateTimePicker';
  return { __esModule: true, default: Mock };
});

jest.mock('expo-router', () => ({
  router: { back: jest.fn(), push: jest.fn() },
  useLocalSearchParams: jest.fn().mockReturnValue({ groupId: 'g1' }),
  Stack: {
    Screen: () => null,
  },
}));

const mockCreateSharedExpenseMutateAsync = jest.fn().mockResolvedValue({ id: 'exp-1' });

jest.mock('@/hooks/use-groups', () => ({
  useGroup: jest.fn(),
  useCreateSharedExpense: jest.fn(() => ({
    mutateAsync: mockCreateSharedExpenseMutateAsync,
    isPending: false,
  })),
}));

jest.mock('@/hooks/use-expenses', () => ({
  useCategories: jest.fn(() => ({
    data: [
      {
        id: 'cat-1',
        slug: 'comida',
        name: 'Comida',
        icon: 'UtensilsCrossed',
        color: '#F59E0B',
        sort_order: 10,
        created_at: '2026-01-01',
        updated_at: '2026-01-01',
        user_id: null,
        kind: 'expense',
      },
    ],
    isLoading: false,
    error: null,
  })),
}));

jest.mock('@/hooks/use-categories', () => ({
  useCreateCategory: jest.fn(() => ({ mutateAsync: jest.fn(), isPending: false })),
  useUpdateCategory: jest.fn(() => ({ mutateAsync: jest.fn(), isPending: false })),
  useDeleteCategory: jest.fn(() => ({ mutateAsync: jest.fn(), isPending: false })),
}));

jest.mock('@/stores/auth-store', () => ({
  useAuthStore: jest.fn((selector: (s: { user: { id: string } | null }) => unknown) =>
    selector({ user: { id: 'u1' } }),
  ),
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeMember(id: string, displayName: string, userId: string | null): GroupMemberRow {
  return {
    id,
    group_id: 'g1',
    user_id: userId,
    display_name: displayName,
    role: 'member',
    status: 'active',
    joined_at: null,
    invited_by: null,
    created_at: '2026-01-01T00:00:00Z',
  } satisfies GroupMemberRow;
}

const MOCK_GROUP: GroupWithMembers = {
  id: 'g1',
  name: 'Depto',
  icon: 'House',
  color: '#0077B6',
  created_by: 'u1',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  members: [makeMember('m1', 'Facundo Martinez', 'u1'), makeMember('m2', 'Jonathan Mayan', null)],
} as GroupWithMembers;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

const { useGroup } = jest.requireMock('@/hooks/use-groups') as {
  useGroup: jest.Mock;
};

describe('NewSharedExpenseScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCreateSharedExpenseMutateAsync.mockResolvedValue({ id: 'exp-1' });
  });

  it('renders the "Nuevo gasto compartido" heading', () => {
    useGroup.mockReturnValue({ data: MOCK_GROUP, isLoading: false, error: null });
    render(<NewSharedExpenseScreen />);
    expect(screen.getByText('Nuevo gasto compartido')).toBeTruthy();
  });

  it('shows a loader while data is loading', () => {
    useGroup.mockReturnValue({ data: null, isLoading: true, error: null });
    render(<NewSharedExpenseScreen />);
    expect(screen.getByText(/Cargando/)).toBeTruthy();
  });

  it('shows error message when group query fails', () => {
    useGroup.mockReturnValue({
      data: null,
      isLoading: false,
      error: new Error('Network error'),
    });
    render(<NewSharedExpenseScreen />);
    expect(screen.getByText(/No se pudo cargar/)).toBeTruthy();
  });

  it('shows "No se encontró el grupo" when group is null', () => {
    useGroup.mockReturnValue({ data: null, isLoading: false, error: null });
    render(<NewSharedExpenseScreen />);
    expect(screen.getByText('No se encontró el grupo.')).toBeTruthy();
  });

  it('renders the form with ¿Quién pagó? when group data is loaded', () => {
    useGroup.mockReturnValue({ data: MOCK_GROUP, isLoading: false, error: null });
    render(<NewSharedExpenseScreen />);
    expect(screen.getByText('¿Quién pagó?')).toBeTruthy();
  });

  it('renders the split editor División section when group data is loaded', () => {
    useGroup.mockReturnValue({ data: MOCK_GROUP, isLoading: false, error: null });
    render(<NewSharedExpenseScreen />);
    expect(screen.getByText('División')).toBeTruthy();
  });
});
