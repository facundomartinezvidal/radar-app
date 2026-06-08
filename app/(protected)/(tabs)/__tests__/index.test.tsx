/**
 * Tests for Home screen (C4 rewrite).
 *
 * Covers:
 *   - Renders without crashing
 *   - Shows "Hola" greeting (with or without user session)
 *   - Shows "BALANCE DEL MES" label
 *   - Net balance computation (income − expense), sign colour via testID
 *   - Income + expense pills render with amounts
 *   - Avatar is pressable and navigates to profile
 *   - Groups badge dot shows when pending invites > 0
 *   - Groups badge dot is hidden when pending invites = 0
 *   - "Ingresos" quick action navigates to income/new
 *   - "Últimos ingresos" section renders income rows
 */
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, fireEvent } from '@testing-library/react-native';

import { router } from 'expo-router';
import HomeScreen from '../index';

// ---------------------------------------------------------------------------
// Mocks — expenses repo
// ---------------------------------------------------------------------------

jest.mock('@/lib/repositories/expenses', () => ({
  listExpenses: jest.fn().mockResolvedValue({ data: [], error: null }),
  listCategories: jest.fn().mockResolvedValue({ data: [], error: null }),
  getExpense: jest.fn().mockResolvedValue({ data: null, error: null }),
  createExpense: jest.fn(),
  updateExpense: jest.fn(),
  deleteExpense: jest.fn(),
  sumExpensesByCurrency: jest.fn().mockResolvedValue({ data: [], error: null }),
  personalAmount: jest.fn((e: { amount: number }) => e.amount),
}));

// ---------------------------------------------------------------------------
// Mocks — incomes repo
// ---------------------------------------------------------------------------

jest.mock('@/lib/repositories/incomes', () => ({
  listIncomes: jest.fn().mockResolvedValue({ data: [], error: null }),
  getIncome: jest.fn().mockResolvedValue({ data: null, error: null }),
  createIncome: jest.fn(),
  updateIncome: jest.fn(),
  deleteIncome: jest.fn(),
  sumIncomesByCurrency: jest.fn().mockResolvedValue({ data: [], error: null }),
  listRecurrences: jest.fn().mockResolvedValue({ data: [], error: null }),
}));

// ---------------------------------------------------------------------------
// Mocks — groups
// ---------------------------------------------------------------------------

const mockUsePendingInvites = jest.fn();

jest.mock('@/hooks/use-groups', () => ({
  useGroups: jest.fn(() => ({ data: [], isLoading: false })),
  usePendingInvites: (...args: unknown[]) => mockUsePendingInvites(...args),
}));

// ---------------------------------------------------------------------------
// Infrastructure mocks
// ---------------------------------------------------------------------------

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
// Helper imports
// ---------------------------------------------------------------------------

const { useSession } = require('@/hooks/use-session') as {
  useSession: jest.Mock;
};

const { sumExpensesByCurrency } = require('@/lib/repositories/expenses') as {
  sumExpensesByCurrency: jest.Mock;
};

const { sumIncomesByCurrency, listIncomes } = require('@/lib/repositories/incomes') as {
  sumIncomesByCurrency: jest.Mock;
  listIncomes: jest.Mock;
};

// ---------------------------------------------------------------------------
// Render helper
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('HomeScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useSession.mockReturnValue({ user: null, session: null, isLoading: false });
    mockUsePendingInvites.mockReturnValue({ data: [], isLoading: false });
    // Default: no expenses, no incomes
    sumExpensesByCurrency.mockResolvedValue({ data: [], error: null });
    sumIncomesByCurrency.mockResolvedValue({ data: [], error: null });
    listIncomes.mockResolvedValue({ data: [], error: null });
  });

  it('renders without crashing', () => {
    expect(() => renderWithClient()).not.toThrow();
  });

  // -------------------------------------------------------------------------
  // Greeting
  // -------------------------------------------------------------------------

  describe('greeting', () => {
    it('shows fallback "Hola" when no user session', () => {
      useSession.mockReturnValue({ user: null, session: null, isLoading: false });
      renderWithClient();
      expect(screen.getByText('Hola')).toBeTruthy();
    });

    it('shows personalised greeting when user has first_name in user_metadata', () => {
      useSession.mockReturnValue({
        user: {
          id: '00000000-0000-4000-a000-000000000001',
          email: 'facundo@example.com',
          user_metadata: { first_name: 'Facundo', last_name: 'Martinez' },
        },
        session: {},
        isLoading: false,
      });
      renderWithClient();
      expect(screen.getByText('Hola, Facundo')).toBeTruthy();
    });

    it('shows fallback "Hola" when user_metadata has no first_name', () => {
      useSession.mockReturnValue({
        user: {
          id: '00000000-0000-4000-a000-000000000001',
          email: 'facundo@example.com',
          user_metadata: {},
        },
        session: {},
        isLoading: false,
      });
      renderWithClient();
      expect(screen.getByText('Hola')).toBeTruthy();
    });
  });

  // -------------------------------------------------------------------------
  // Balance card hero
  // -------------------------------------------------------------------------

  it('shows "BALANCE DEL MES" section label', () => {
    renderWithClient();
    const labels = screen.getAllByText(/balance del mes/i);
    expect(labels.length).toBeGreaterThan(0);
  });

  it('shows net balance = 0 when no expenses and no incomes', () => {
    renderWithClient();
    // $ 0,00 should appear (net = 0)
    expect(screen.getByText('$ 0,00')).toBeTruthy();
  });

  it('renders income pill with ARS total', async () => {
    sumIncomesByCurrency.mockResolvedValue({
      data: [{ currency: 'ARS', total: 5000 }],
      error: null,
    });
    renderWithClient();
    // Pill text is rendered asynchronously after query resolves
    // Pill contains "Ingresos $ 5.000,00"
    const incomePill = await screen.findByText(/Ingresos \$ 5\.000,00/);
    expect(incomePill).toBeTruthy();
  });

  it('renders expense pill with ARS total', async () => {
    sumExpensesByCurrency.mockResolvedValue({
      data: [{ currency: 'ARS', total: 3000 }],
      error: null,
    });
    renderWithClient();
    const expensePill = await screen.findByText(/Gastos \$ 3\.000,00/);
    expect(expensePill).toBeTruthy();
  });

  it('computes positive net balance (incomes > expenses) and shows + prefix', async () => {
    sumIncomesByCurrency.mockResolvedValue({
      data: [{ currency: 'ARS', total: 10000 }],
      error: null,
    });
    sumExpensesByCurrency.mockResolvedValue({
      data: [{ currency: 'ARS', total: 3000 }],
      error: null,
    });
    renderWithClient();
    // Net = 10000 − 3000 = 7000 → "+$ 7.000,00"
    const balance = await screen.findByText('+$ 7.000,00');
    expect(balance).toBeTruthy();
  });

  it('computes negative net balance (expenses > incomes) and shows − prefix', async () => {
    sumIncomesByCurrency.mockResolvedValue({
      data: [{ currency: 'ARS', total: 1000 }],
      error: null,
    });
    sumExpensesByCurrency.mockResolvedValue({
      data: [{ currency: 'ARS', total: 4000 }],
      error: null,
    });
    renderWithClient();
    // Net = 1000 − 4000 = −3000 → "-$ 3.000,00"
    const balance = await screen.findByText('-$ 3.000,00');
    expect(balance).toBeTruthy();
  });

  it('shows USD net when USD incomes and expenses both exist', async () => {
    sumIncomesByCurrency.mockResolvedValue({
      data: [{ currency: 'USD', total: 200 }],
      error: null,
    });
    sumExpensesByCurrency.mockResolvedValue({
      data: [{ currency: 'USD', total: 50 }],
      error: null,
    });
    renderWithClient();
    // USD net = 200 − 50 = 150 → "+US$ 150,00"
    const usdBalance = await screen.findByText('+US$ 150,00');
    expect(usdBalance).toBeTruthy();
  });

  it('does not show USD net line when USD net is 0', () => {
    renderWithClient();
    // No USD data at all → net 0 → line hidden
    expect(screen.queryByText(/US\$/)).toBeNull();
  });

  // -------------------------------------------------------------------------
  // Quick actions
  // -------------------------------------------------------------------------

  it('does not show "Cerrar sesión" on home screen', () => {
    renderWithClient();
    expect(screen.queryByText('Cerrar sesión')).toBeNull();
  });

  it('renders "Ver categorías" quick action', () => {
    renderWithClient();
    expect(screen.getByLabelText('Ver categorías')).toBeTruthy();
  });

  it('pressing "Ver categorías" navigates to the categories management screen', () => {
    renderWithClient();
    fireEvent.press(screen.getByLabelText('Ver categorías'));
    expect(router.push).toHaveBeenCalledWith('/(protected)/profile/categories');
  });

  it('renders "Agregar ingreso" quick action', () => {
    renderWithClient();
    expect(screen.getByLabelText('Agregar ingreso')).toBeTruthy();
  });

  it('pressing "Agregar ingreso" navigates to income/new', () => {
    renderWithClient();
    fireEvent.press(screen.getByLabelText('Agregar ingreso'));
    expect(router.push).toHaveBeenCalledWith('/(protected)/income/new');
  });

  it('"Más opciones" is no longer present (replaced by Ingresos)', () => {
    renderWithClient();
    expect(screen.queryByLabelText('Más opciones')).toBeNull();
  });

  // -------------------------------------------------------------------------
  // Avatar
  // -------------------------------------------------------------------------

  it('avatar Pressable navigates to profile', () => {
    useSession.mockReturnValue({
      user: {
        id: '00000000-0000-4000-a000-000000000001',
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

  // -------------------------------------------------------------------------
  // Pending invites badge on "Grupos" quick action
  // -------------------------------------------------------------------------

  it('shows badge dot on "Grupos" quick action when there are pending invites', () => {
    mockUsePendingInvites.mockReturnValue({
      data: [{ id: '00000000-0000-4000-a000-000000000010' }],
      isLoading: false,
    });
    renderWithClient();
    expect(screen.getByTestId('groups-badge-dot')).toBeTruthy();
  });

  it('does not show badge dot when there are no pending invites', () => {
    mockUsePendingInvites.mockReturnValue({ data: [], isLoading: false });
    renderWithClient();
    expect(screen.queryByTestId('groups-badge-dot')).toBeNull();
  });

  it('does not show badge dot when pending invites data is null', () => {
    mockUsePendingInvites.mockReturnValue({ data: null, isLoading: false });
    renderWithClient();
    expect(screen.queryByTestId('groups-badge-dot')).toBeNull();
  });

  it('shows the badge count on the "Grupos" quick action', () => {
    mockUsePendingInvites.mockReturnValue({
      data: [
        { id: '00000000-0000-4000-a000-000000000010' },
        { id: '00000000-0000-4000-a000-000000000011' },
        { id: '00000000-0000-4000-a000-000000000012' },
      ],
      isLoading: false,
    });
    renderWithClient();
    expect(screen.getByText('3')).toBeTruthy();
  });

  // -------------------------------------------------------------------------
  // Últimos ingresos section
  // -------------------------------------------------------------------------

  it('renders "Últimos ingresos" section heading', () => {
    renderWithClient();
    expect(screen.getByText('Últimos ingresos')).toBeTruthy();
  });

  it('shows empty-state copy when no recent incomes', () => {
    listIncomes.mockResolvedValue({ data: [], error: null });
    renderWithClient();
    expect(screen.getByText('No hay ingresos registrados.')).toBeTruthy();
  });

  it('renders income rows when recent incomes are present', async () => {
    const mockIncome = {
      id: '00000000-0000-4000-a000-000000000020',
      user_id: '00000000-0000-4000-a000-000000000001',
      amount: '2500.00',
      currency: 'ARS',
      description: 'Sueldo',
      occurred_at: new Date().toISOString(),
      occurred_date: new Date().toISOString().slice(0, 10),
      category_id: null,
      source: 'manual',
      recurrence_id: null,
      notes: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      category: null,
    };
    listIncomes.mockResolvedValue({ data: [mockIncome], error: null });
    renderWithClient();
    // IncomeRow renders the accessibilityLabel "Ingreso Sueldo"
    const row = await screen.findByLabelText('Ingreso Sueldo');
    expect(row).toBeTruthy();
  });

  it('pressing an income row navigates to income detail', async () => {
    const incomeId = '00000000-0000-4000-a000-000000000020';
    const mockIncome = {
      id: incomeId,
      user_id: '00000000-0000-4000-a000-000000000001',
      amount: '2500.00',
      currency: 'ARS',
      description: 'Sueldo',
      occurred_at: new Date().toISOString(),
      occurred_date: new Date().toISOString().slice(0, 10),
      category_id: null,
      source: 'manual',
      recurrence_id: null,
      notes: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      category: null,
    };
    listIncomes.mockResolvedValue({ data: [mockIncome], error: null });
    renderWithClient();
    const row = await screen.findByLabelText('Ingreso Sueldo');
    fireEvent.press(row);
    expect(router.push).toHaveBeenCalledWith(`/(protected)/income/${incomeId}`);
  });
});
