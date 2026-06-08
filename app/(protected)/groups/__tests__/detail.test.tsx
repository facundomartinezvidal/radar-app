/**
 * Tests for Group detail screen ([id].tsx).
 *
 * Covers:
 *   - Renders group name and member count
 *   - Renders expense list when expenses exist
 *   - Shows "No hay gastos registrados" when expenses list is empty
 *   - Pressing ··· opens options and confirming delete calls useDeleteGroup
 */
import React from 'react';
import { Alert } from 'react-native';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';

import GroupDetailScreen from '../[id]';
import type { GroupWithMembers, GroupExpense, GroupMemberRow } from '@/hooks/use-groups';

jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));

jest.mock('react-native-safe-area-context', () => {
  const { View } = require('react-native');
  return {
    SafeAreaView: View,
    SafeAreaProvider: View,
    useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
  };
});

jest.mock('expo-router', () => ({
  router: {
    back: jest.fn(),
    push: jest.fn(),
    replace: jest.fn(),
  },
  useLocalSearchParams: jest.fn().mockReturnValue({ id: 'g1' }),
}));

const mockUseGroup = jest.fn();
const mockUseGroupExpenses = jest.fn();
const mockDeleteMutateAsync = jest.fn().mockResolvedValue({ id: 'g1' });

jest.mock('@/hooks/use-groups', () => ({
  useGroups: jest.fn(() => ({ data: [], isLoading: false })),
  useGroup: (...args: unknown[]) => mockUseGroup(...args),
  useGroupExpenses: (...args: unknown[]) => mockUseGroupExpenses(...args),
  useCreateGroup: jest.fn(() => ({ mutateAsync: jest.fn(), isPending: false })),
  useDeleteGroup: jest.fn(() => ({
    mutateAsync: mockDeleteMutateAsync,
    isPending: false,
  })),
}));

function makeMember(id: string, displayName: string): GroupMemberRow {
  return {
    id,
    group_id: 'g1',
    user_id: null,
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
  members: [makeMember('m1', 'Facundo Martinez'), makeMember('m2', 'Jonathan Mayan')],
} as GroupWithMembers;

const MOCK_EXPENSE: GroupExpense = {
  id: 'exp-1',
  user_id: 'u1',
  group_id: 'g1',
  amount: '4200',
  currency: 'ARS',
  description: 'Pizza del viernes',
  occurred_at: '2026-06-01T00:00:00Z',
  created_at: '2026-06-01T00:00:00Z',
  updated_at: '2026-06-01T00:00:00Z',
  category_id: null,
  category: null,
  items: [],
  splits: [],
} as unknown as GroupExpense;

describe('GroupDetailScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDeleteMutateAsync.mockResolvedValue({ id: 'g1' });
  });

  it('renders group name', () => {
    mockUseGroup.mockReturnValue({ data: MOCK_GROUP, isLoading: false });
    mockUseGroupExpenses.mockReturnValue({ data: [], isLoading: false });

    render(<GroupDetailScreen />);
    expect(screen.getByText('Depto')).toBeTruthy();
  });

  it('renders member count label', () => {
    mockUseGroup.mockReturnValue({ data: MOCK_GROUP, isLoading: false });
    mockUseGroupExpenses.mockReturnValue({ data: [], isLoading: false });

    render(<GroupDetailScreen />);
    expect(screen.getByText('2 miembros')).toBeTruthy();
  });

  it('shows "No hay gastos registrados" when expenses list is empty', () => {
    mockUseGroup.mockReturnValue({ data: MOCK_GROUP, isLoading: false });
    mockUseGroupExpenses.mockReturnValue({ data: [], isLoading: false });

    render(<GroupDetailScreen />);
    expect(screen.getByText('No hay gastos registrados')).toBeTruthy();
  });

  it('renders expense description when expenses exist', () => {
    mockUseGroup.mockReturnValue({ data: MOCK_GROUP, isLoading: false });
    mockUseGroupExpenses.mockReturnValue({ data: [MOCK_EXPENSE], isLoading: false });

    render(<GroupDetailScreen />);
    expect(screen.getByText('Pizza del viernes')).toBeTruthy();
  });

  it('pressing ··· button opens an Alert with Eliminar option', () => {
    mockUseGroup.mockReturnValue({ data: MOCK_GROUP, isLoading: false });
    mockUseGroupExpenses.mockReturnValue({ data: [], isLoading: false });

    const alertSpy = jest.spyOn(Alert, 'alert');
    render(<GroupDetailScreen />);

    fireEvent.press(screen.getByTestId('more-options-button'));

    expect(alertSpy).toHaveBeenCalledWith(
      'Opciones',
      undefined,
      expect.arrayContaining([
        expect.objectContaining({ text: 'Eliminar', style: 'destructive' }),
        expect.objectContaining({ text: 'Cancelar', style: 'cancel' }),
      ]),
    );
  });

  it('confirming delete calls useDeleteGroup with the group id', async () => {
    mockUseGroup.mockReturnValue({ data: MOCK_GROUP, isLoading: false });
    mockUseGroupExpenses.mockReturnValue({ data: [], isLoading: false });

    jest.spyOn(Alert, 'alert').mockImplementation((_title, _msg, buttons) => {
      // Invoke the destructive (Eliminar) button handler
      const destroyBtn = (buttons ?? []).find((b) => b.style === 'destructive');
      destroyBtn?.onPress?.();
    });

    render(<GroupDetailScreen />);
    fireEvent.press(screen.getByTestId('more-options-button'));

    await waitFor(() => {
      expect(mockDeleteMutateAsync).toHaveBeenCalledWith('g1');
    });
  });
});
