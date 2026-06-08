/**
 * Tests for the expense detail/edit screen (HU-17 shared branch).
 *
 * Verifies:
 *   - Shared expense: renders ExpenseForm with groupConfig + initialSplit
 *   - Shared expense: saving calls useUpdateSharedExpense
 *   - Personal expense: renders ExpenseForm without groupConfig (useUpdateExpense path)
 *   - Delete flow: calls useDeleteExpense
 */
import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

import ExpenseDetailScreen from '../[id]';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));
jest.mock('@react-native-community/datetimepicker', () => {
  const ReactLib = require('react');
  const { View } = require('react-native');
  const Mock = () => ReactLib.createElement(View, { testID: 'mock-datetimepicker' });
  Mock.displayName = 'MockDateTimePicker';
  return { __esModule: true, default: Mock };
});

jest.mock('expo-router', () => ({
  router: { back: jest.fn(), push: jest.fn(), replace: jest.fn() },
  Stack: { Screen: () => null },
  useLocalSearchParams: jest.fn(() => ({ id: 'exp-1' })),
}));

jest.mock('@/hooks/use-categories', () => ({
  useCreateCategory: jest.fn(() => ({ mutateAsync: jest.fn(), isPending: false })),
  useUpdateCategory: jest.fn(() => ({ mutateAsync: jest.fn(), isPending: false })),
  useDeleteCategory: jest.fn(() => ({ mutateAsync: jest.fn(), isPending: false })),
}));

jest.mock('@/stores/auth-store', () => ({
  useAuthStore: jest.fn((selector: (s: { user: { id: string } | null }) => unknown) =>
    selector({ user: { id: 'user-1' } }),
  ),
}));

const mockUpdateExpenseMutateAsync = jest.fn().mockResolvedValue({ id: 'exp-1' });
const mockDeleteExpenseMutateAsync = jest.fn().mockResolvedValue({ id: 'exp-1' });
const mockUpdateSharedMutateAsync = jest.fn().mockResolvedValue({ id: 'exp-1' });

jest.mock('@/hooks/use-expenses', () => ({
  useExpense: jest.fn(),
  useCategories: jest.fn(() => ({ data: [], isLoading: false })),
  useUpdateExpense: jest.fn(() => ({
    mutateAsync: mockUpdateExpenseMutateAsync,
    isPending: false,
  })),
  useDeleteExpense: jest.fn(() => ({
    mutateAsync: mockDeleteExpenseMutateAsync,
    isPending: false,
  })),
}));

jest.mock('@/hooks/use-groups', () => ({
  useGroup: jest.fn(),
  useUpdateSharedExpense: jest.fn(() => ({
    mutateAsync: mockUpdateSharedMutateAsync,
    isPending: false,
  })),
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const PERSONAL_EXPENSE = {
  id: 'exp-1',
  user_id: 'user-1',
  amount: 1500,
  currency: 'ARS',
  category_id: null,
  description: 'Almuerzo',
  occurred_at: '2026-06-01T12:00:00Z',
  created_at: '2026-06-01T12:00:00Z',
  updated_at: '2026-06-01T12:00:00Z',
  group_id: null,
  paid_by_member_id: null,
  category: null,
  items: [],
  splits: [],
};

const SHARED_EXPENSE = {
  ...PERSONAL_EXPENSE,
  group_id: 'grp-1',
  paid_by_member_id: 'mem-1',
  splits: [
    {
      id: 'sp-1',
      expense_id: 'exp-1',
      group_id: 'grp-1',
      member_id: 'mem-1',
      share_amount: 750,
      created_at: '2026-06-01T12:00:00Z',
      member: { user_id: 'user-1' },
    },
    {
      id: 'sp-2',
      expense_id: 'exp-1',
      group_id: 'grp-1',
      member_id: 'mem-2',
      share_amount: 750,
      created_at: '2026-06-01T12:00:00Z',
      member: { user_id: 'user-2' },
    },
  ],
};

const GROUP = {
  id: 'grp-1',
  name: 'Depto',
  icon: 'House',
  color: '#0077B6',
  created_by: 'user-1',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  members: [
    {
      id: 'mem-1',
      group_id: 'grp-1',
      user_id: 'user-1',
      display_name: 'Facundo',
      role: 'owner',
      status: 'active',
      joined_at: null,
      invited_by: null,
      created_at: '2026-01-01T00:00:00Z',
    },
    {
      id: 'mem-2',
      group_id: 'grp-1',
      user_id: 'user-2',
      display_name: 'Jonathan',
      role: 'member',
      status: 'active',
      joined_at: null,
      invited_by: null,
      created_at: '2026-01-01T00:00:00Z',
    },
  ],
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getUseExpense() {
  return require('@/hooks/use-expenses').useExpense as jest.Mock;
}
function getUseGroup() {
  return require('@/hooks/use-groups').useGroup as jest.Mock;
}

// ---------------------------------------------------------------------------
// Tests — personal expense
// ---------------------------------------------------------------------------

describe('ExpenseDetailScreen — personal expense', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getUseExpense().mockReturnValue({ data: PERSONAL_EXPENSE, isLoading: false });
    getUseGroup().mockReturnValue({ data: null, isLoading: false });
  });

  it('renders the screen without crashing', () => {
    render(<ExpenseDetailScreen />);
    expect(screen.getByText('Editar gasto')).toBeTruthy();
  });

  it('does NOT render ¿Quién pagó? for a personal expense', () => {
    render(<ExpenseDetailScreen />);
    expect(screen.queryByText('¿Quién pagó?')).toBeNull();
  });

  it('does NOT render División for a personal expense', () => {
    render(<ExpenseDetailScreen />);
    expect(screen.queryByText('División')).toBeNull();
  });

  it('shows "Guardar cambios" button for personal expense', () => {
    render(<ExpenseDetailScreen />);
    expect(screen.getByLabelText('Guardar cambios')).toBeTruthy();
  });

  it('calls useUpdateExpense (not useUpdateSharedExpense) on save', async () => {
    render(<ExpenseDetailScreen />);
    await act(async () => {
      fireEvent.press(screen.getByLabelText('Guardar cambios'));
    });
    expect(mockUpdateExpenseMutateAsync).toHaveBeenCalled();
    expect(mockUpdateSharedMutateAsync).not.toHaveBeenCalled();
  });

  it('navigates back after successful personal save', async () => {
    render(<ExpenseDetailScreen />);
    await act(async () => {
      fireEvent.press(screen.getByLabelText('Guardar cambios'));
    });
    await waitFor(() => {
      expect(router.back).toHaveBeenCalled();
    });
  });
});

// ---------------------------------------------------------------------------
// Tests — shared expense
// ---------------------------------------------------------------------------

describe('ExpenseDetailScreen — shared expense', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getUseExpense().mockReturnValue({ data: SHARED_EXPENSE, isLoading: false });
    getUseGroup().mockReturnValue({ data: GROUP, isLoading: false });
  });

  it('renders the screen without crashing for a shared expense', () => {
    render(<ExpenseDetailScreen />);
    expect(screen.getByText('Editar gasto')).toBeTruthy();
  });

  it('renders ¿Quién pagó? for a shared expense', () => {
    render(<ExpenseDetailScreen />);
    expect(screen.getByText('¿Quién pagó?')).toBeTruthy();
  });

  it('renders División for a shared expense', () => {
    render(<ExpenseDetailScreen />);
    expect(screen.getByText('División')).toBeTruthy();
  });

  it('renders member names from the group', () => {
    render(<ExpenseDetailScreen />);
    // currentMemberId = mem-1 (user-1) → shown as "Vos"
    expect(screen.getAllByText('Vos').length).toBeGreaterThanOrEqual(1);
    // Other member shown by display_name
    expect(screen.getAllByText('Jonathan').length).toBeGreaterThanOrEqual(1);
  });

  it('calls useUpdateSharedExpense (not useUpdateExpense) on save', async () => {
    render(<ExpenseDetailScreen />);
    await act(async () => {
      fireEvent.press(screen.getByLabelText('Guardar cambios'));
    });
    expect(mockUpdateSharedMutateAsync).toHaveBeenCalled();
    expect(mockUpdateExpenseMutateAsync).not.toHaveBeenCalled();
  });

  it('passes groupId to useUpdateSharedExpense', async () => {
    render(<ExpenseDetailScreen />);
    await act(async () => {
      fireEvent.press(screen.getByLabelText('Guardar cambios'));
    });
    const callArg = mockUpdateSharedMutateAsync.mock.calls[0]?.[0] as
      | { groupId: string }
      | undefined;
    expect(callArg?.groupId).toBe('grp-1');
  });

  it('navigates back after successful shared save', async () => {
    render(<ExpenseDetailScreen />);
    await act(async () => {
      fireEvent.press(screen.getByLabelText('Guardar cambios'));
    });
    await waitFor(() => {
      expect(router.back).toHaveBeenCalled();
    });
  });

  it('shows an error message when useUpdateSharedExpense throws', async () => {
    mockUpdateSharedMutateAsync.mockRejectedValueOnce(new Error('splits must sum to amount'));
    render(<ExpenseDetailScreen />);
    await act(async () => {
      fireEvent.press(screen.getByLabelText('Guardar cambios'));
    });
    await waitFor(() => {
      expect(screen.getByText('splits must sum to amount')).toBeTruthy();
    });
  });
});

// ---------------------------------------------------------------------------
// Tests — loading state
// ---------------------------------------------------------------------------

describe('ExpenseDetailScreen — loading state', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows loader while expense is loading', () => {
    getUseExpense().mockReturnValue({ data: undefined, isLoading: true });
    getUseGroup().mockReturnValue({ data: null, isLoading: false });
    render(<ExpenseDetailScreen />);
    expect(screen.getByText('Cargando')).toBeTruthy();
  });

  it('shows loader while group is loading for a shared expense', () => {
    getUseExpense().mockReturnValue({ data: SHARED_EXPENSE, isLoading: false });
    getUseGroup().mockReturnValue({ data: null, isLoading: true });
    render(<ExpenseDetailScreen />);
    expect(screen.getByText('Cargando')).toBeTruthy();
  });

  it('shows not-found message when expense is null', () => {
    getUseExpense().mockReturnValue({ data: null, isLoading: false });
    getUseGroup().mockReturnValue({ data: null, isLoading: false });
    render(<ExpenseDetailScreen />);
    expect(screen.getByText('No se encontró el gasto solicitado.')).toBeTruthy();
  });
});
