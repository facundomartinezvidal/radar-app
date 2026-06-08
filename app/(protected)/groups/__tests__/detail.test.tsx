/**
 * Tests for Group detail screen ([id].tsx).
 *
 * Covers:
 *   - Renders group name and member count
 *   - Renders expense list when expenses exist
 *   - Shows "No hay gastos registrados" when expenses list is empty
 *   - Pressing ··· opens options and confirming delete calls useDeleteGroup
 *   - Tab switch shows Saldos tab
 *   - Saldos tab: renders "Tu situación" + who-owes rows
 *   - Saldos tab: Saldar confirm → calls useCreateSettlement
 *   - Saldos tab: empty → "No hay saldos pendientes."
 *   - "Agregar miembro" button is rendered and opens the MemberSelectorSheet
 */
import React from 'react';
import { Alert } from 'react-native';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';

import GroupDetailScreen from '../[id]';
import type {
  GroupWithMembers,
  GroupExpense,
  GroupMemberRow,
  GroupBalance,
} from '@/hooks/use-groups';

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

// Session mock — user u1 is a member of the group
jest.mock('@/hooks/use-session', () => ({
  useSession: jest.fn(() => ({
    user: { id: 'u1' },
    session: {},
    isLoading: false,
    isAuthenticated: true,
  })),
}));

const mockUseGroup = jest.fn();
const mockUseGroupExpenses = jest.fn();
const mockUseGroupBalances = jest.fn();
const mockDeleteMutateAsync = jest.fn().mockResolvedValue({ id: 'g1' });
const mockSettleMutateAsync = jest.fn().mockResolvedValue({});

jest.mock('@/hooks/use-groups', () => ({
  useGroups: jest.fn(() => ({ data: [], isLoading: false })),
  useGroup: (...args: unknown[]) => mockUseGroup(...args),
  useGroupExpenses: (...args: unknown[]) => mockUseGroupExpenses(...args),
  useGroupBalances: (...args: unknown[]) => mockUseGroupBalances(...args),
  useCreateGroup: jest.fn(() => ({ mutateAsync: jest.fn(), isPending: false })),
  useDeleteGroup: jest.fn(() => ({
    mutateAsync: mockDeleteMutateAsync,
    isPending: false,
  })),
  useCreateSettlement: jest.fn(() => ({
    mutateAsync: mockSettleMutateAsync,
    isPending: false,
  })),
  // Required by MemberSelectorSheet (rendered inside GroupDetailScreen)
  useAddPlaceholder: jest.fn(() => ({ mutateAsync: jest.fn(), isPending: false })),
  useInviteMember: jest.fn(() => ({ mutateAsync: jest.fn(), isPending: false })),
  useCheckUserExists: jest.fn(() => ({ mutateAsync: jest.fn(), isPending: false })),
  // Required by MemberManageSheet
  useUpdateMember: jest.fn(() => ({ mutateAsync: jest.fn(), isPending: false })),
  useRemoveMember: jest.fn(() => ({ mutateAsync: jest.fn(), isPending: false })),
}));

function makeMember(id: string, displayName: string, userId: string | null = null): GroupMemberRow {
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

// m1 is the current user (u1), m2 is another member
const MOCK_GROUP: GroupWithMembers = {
  id: 'g1',
  name: 'Depto',
  icon: 'House',
  color: '#0077B6',
  created_by: 'u1',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  members: [makeMember('m1', 'Facundo Martinez', 'u1'), makeMember('m2', 'Jonathan Mayan')],
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

// m1 is owed 1500 ARS, m2 owes 1500 ARS
const MOCK_BALANCES: GroupBalance[] = [
  { member_id: 'm1', currency: 'ARS', net: 1500 },
  { member_id: 'm2', currency: 'ARS', net: -1500 },
];

describe('GroupDetailScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDeleteMutateAsync.mockResolvedValue({ id: 'g1' });
    mockSettleMutateAsync.mockResolvedValue({});
    mockUseGroupBalances.mockReturnValue({ data: [], isLoading: false });
  });

  // ---------------------------------------------------------------------------
  // Existing Gastos tab tests
  // ---------------------------------------------------------------------------

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

  // ---------------------------------------------------------------------------
  // Tab switcher
  // ---------------------------------------------------------------------------

  it('renders the Gastos and Saldos tabs', () => {
    mockUseGroup.mockReturnValue({ data: MOCK_GROUP, isLoading: false });
    mockUseGroupExpenses.mockReturnValue({ data: [], isLoading: false });

    render(<GroupDetailScreen />);
    expect(screen.getByLabelText('Gastos')).toBeTruthy();
    expect(screen.getByLabelText('Saldos')).toBeTruthy();
  });

  it('switching to Saldos tab shows the Saldos view', () => {
    mockUseGroup.mockReturnValue({ data: MOCK_GROUP, isLoading: false });
    mockUseGroupExpenses.mockReturnValue({ data: [], isLoading: false });
    mockUseGroupBalances.mockReturnValue({ data: [], isLoading: false });

    render(<GroupDetailScreen />);
    fireEvent.press(screen.getByLabelText('Saldos'));

    expect(screen.getByTestId('no-pending-balances')).toBeTruthy();
  });

  // ---------------------------------------------------------------------------
  // Saldos tab — empty state
  // ---------------------------------------------------------------------------

  it('shows "No hay saldos pendientes." when balances are empty', () => {
    mockUseGroup.mockReturnValue({ data: MOCK_GROUP, isLoading: false });
    mockUseGroupExpenses.mockReturnValue({ data: [], isLoading: false });
    mockUseGroupBalances.mockReturnValue({ data: [], isLoading: false });

    render(<GroupDetailScreen />);
    fireEvent.press(screen.getByLabelText('Saldos'));

    expect(screen.getByText('No hay saldos pendientes.')).toBeTruthy();
  });

  // ---------------------------------------------------------------------------
  // Saldos tab — with balances
  // ---------------------------------------------------------------------------

  it('renders "Tu situación" section with balances present', () => {
    mockUseGroup.mockReturnValue({ data: MOCK_GROUP, isLoading: false });
    mockUseGroupExpenses.mockReturnValue({ data: [], isLoading: false });
    mockUseGroupBalances.mockReturnValue({ data: MOCK_BALANCES, isLoading: false });

    render(<GroupDetailScreen />);
    fireEvent.press(screen.getByLabelText('Saldos'));

    expect(screen.getByText('Tu situación')).toBeTruthy();
  });

  it('renders "Quién le debe a quién" section with balance rows', () => {
    mockUseGroup.mockReturnValue({ data: MOCK_GROUP, isLoading: false });
    mockUseGroupExpenses.mockReturnValue({ data: [], isLoading: false });
    mockUseGroupBalances.mockReturnValue({ data: MOCK_BALANCES, isLoading: false });

    render(<GroupDetailScreen />);
    fireEvent.press(screen.getByLabelText('Saldos'));

    expect(screen.getByText('Quién le debe a quién')).toBeTruthy();
    // BalanceRow should be rendered
    expect(screen.getByTestId('balance-row')).toBeTruthy();
  });

  it('pressing Saldar shows confirmation alert and calls useCreateSettlement on confirm', async () => {
    mockUseGroup.mockReturnValue({ data: MOCK_GROUP, isLoading: false });
    mockUseGroupExpenses.mockReturnValue({ data: [], isLoading: false });
    mockUseGroupBalances.mockReturnValue({ data: MOCK_BALANCES, isLoading: false });

    jest.spyOn(Alert, 'alert').mockImplementation((_title, _msg, buttons) => {
      const confirmBtn = (buttons ?? []).find((b) => b.text === 'Confirmar');
      confirmBtn?.onPress?.();
    });

    render(<GroupDetailScreen />);
    fireEvent.press(screen.getByLabelText('Saldos'));

    // Press the Saldar button (first one)
    const saldarBtn = screen.getByLabelText('Saldar deuda');
    fireEvent.press(saldarBtn);

    await waitFor(() => {
      expect(mockSettleMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          group_id: 'g1',
          from_member_id: 'm2',
          to_member_id: 'm1',
          amount: 1500,
          currency: 'ARS',
        }),
      );
    });
  });

  // ---------------------------------------------------------------------------
  // Add member button
  // ---------------------------------------------------------------------------

  it('renders "Agregar miembro" button', () => {
    mockUseGroup.mockReturnValue({ data: MOCK_GROUP, isLoading: false });
    mockUseGroupExpenses.mockReturnValue({ data: [], isLoading: false });

    render(<GroupDetailScreen />);
    expect(screen.getByTestId('add-member-button')).toBeTruthy();
    expect(screen.getByLabelText('Agregar miembro')).toBeTruthy();
  });

  it('pressing "Agregar miembro" opens the MemberSelectorSheet', () => {
    mockUseGroup.mockReturnValue({ data: MOCK_GROUP, isLoading: false });
    mockUseGroupExpenses.mockReturnValue({ data: [], isLoading: false });

    render(<GroupDetailScreen />);
    fireEvent.press(screen.getByTestId('add-member-button'));

    // After pressing, the sheet's name input should appear
    expect(screen.getByPlaceholderText('Nombre del participante')).toBeTruthy();
  });

  // ---------------------------------------------------------------------------
  // Manage members button
  // ---------------------------------------------------------------------------

  it('renders "Gestionar miembros" button', () => {
    mockUseGroup.mockReturnValue({ data: MOCK_GROUP, isLoading: false });
    mockUseGroupExpenses.mockReturnValue({ data: [], isLoading: false });

    render(<GroupDetailScreen />);
    expect(screen.getByTestId('manage-members-button')).toBeTruthy();
    expect(screen.getByLabelText('Gestionar miembros')).toBeTruthy();
  });

  it('pressing "Gestionar miembros" opens the MemberManageSheet', () => {
    mockUseGroup.mockReturnValue({ data: MOCK_GROUP, isLoading: false });
    mockUseGroupExpenses.mockReturnValue({ data: [], isLoading: false });

    render(<GroupDetailScreen />);
    fireEvent.press(screen.getByTestId('manage-members-button'));

    // The sheet title should appear
    expect(screen.getByText('Miembros')).toBeTruthy();
  });
});
