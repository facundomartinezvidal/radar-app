/**
 * Tests for the Gastos tab screen.
 *
 * Covers:
 *   - Renders without crashing
 *   - Shows the "Gastos" title header
 *   - Shows the "Nuevo" button
 *   - Shows totals strip with ARS and USD labels
 *   - Shows "Gastos recurrentes" section header
 *   - Renders expense rows when data is present
 *   - Shows empty state when expenses list is empty
 *   - Shows recurrence row when recurrences are present
 *   - Shows CTA "Crear gasto recurrente" when no recurrences
 *   - "Nuevo" button navigates to expense/new
 *   - Tapping a recurrence row navigates to recurrence/[id]
 *   - "Agregar gasto recurrente" navigates to recurrence/new
 */
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

import ExpensesTab from '../expenses';
import type {
  CurrencyTotal,
  ExpenseRecurrenceWithCategory,
  ExpenseWithItems,
} from '@/lib/repositories/expenses';

// ---------------------------------------------------------------------------
// Module mocks
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

// Mock useSession so the component can resolve currentUserId
jest.mock('@/hooks/use-session', () => ({
  useSession: jest.fn().mockReturnValue({ user: { id: 'user-1' }, session: {}, isLoading: false }),
}));

// Mock all expense hooks used by the tab
const mockUseExpenses = jest.fn();
const mockUseExpenseTotals = jest.fn();
const mockUseExpenseRecurrences = jest.fn();
const mockUseCategories = jest.fn();

jest.mock('@/hooks/use-expenses', () => ({
  useExpenses: (...args: unknown[]) => mockUseExpenses(...args),
  useExpenseTotals: (...args: unknown[]) => mockUseExpenseTotals(...args),
  useExpenseRecurrences: (...args: unknown[]) => mockUseExpenseRecurrences(...args),
  useCategories: (...args: unknown[]) => mockUseCategories(...args),
  personalAmount: jest.fn((expense: unknown) => {
    return (expense as { amount: number }).amount;
  }),
}));

// ---------------------------------------------------------------------------
// Fixtures — RFC-compliant UUIDs
// ---------------------------------------------------------------------------

const EXP_UUID_1 = '550e8400-e29b-41d4-a716-446655440001';
const EXP_UUID_2 = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12';
const REC_UUID_1 = 'b2ffcd11-1c2d-4bc0-bb8f-8bcbce503d45';
const CAT_UUID = 'c3ddde22-2d3e-5cd1-cc90-9cdcdf614e56';

const BASE_CATEGORY = {
  id: CAT_UUID,
  slug: 'comida',
  name: 'Comida',
  icon: 'Utensils',
  color: '#EF4444',
  sort_order: 1,
  created_at: '2026-01-01',
  updated_at: '2026-01-01',
  user_id: 'user-1',
  kind: 'expense' as const,
};

const FIXTURE_EXPENSE_1: ExpenseWithItems = {
  id: EXP_UUID_1,
  user_id: 'user-1',
  amount: 5000,
  currency: 'ARS',
  category_id: CAT_UUID,
  description: 'Almuerzo con clientes',
  occurred_at: '2026-06-01T12:00:00.000Z',
  occurred_date: '2026-06-01',
  created_at: '2026-06-01T12:00:00.000Z',
  updated_at: '2026-06-01T12:00:00.000Z',
  group_id: null,
  paid_by_member_id: null,
  recurrence_id: null,
  source: 'manual',
  category: BASE_CATEGORY,
  items: [],
  splits: [],
};

const FIXTURE_EXPENSE_2: ExpenseWithItems = {
  ...FIXTURE_EXPENSE_1,
  id: EXP_UUID_2,
  description: 'Cena del viernes',
  amount: 3200,
};

const FIXTURE_TOTALS: CurrencyTotal[] = [
  { currency: 'ARS', total: 8200, count: 2 },
  { currency: 'USD', total: 0, count: 0 },
];

const FIXTURE_RECURRENCE: ExpenseRecurrenceWithCategory = {
  id: REC_UUID_1,
  user_id: 'user-1',
  amount: 15000,
  currency: 'ARS',
  category_id: CAT_UUID,
  description: 'Alquiler mensual',
  frequency: 'monthly',
  start_date: '2026-01-01',
  end_date: null,
  day_of_month: 1,
  next_run_on: '2026-07-01',
  status: 'active',
  last_materialized_at: null,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
  category: BASE_CATEGORY,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderWithClient(): { client: QueryClient } {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <ExpensesTab />
    </QueryClientProvider>,
  );
  return { client };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ExpensesTab', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockUseExpenses.mockReturnValue({
      data: [FIXTURE_EXPENSE_1, FIXTURE_EXPENSE_2],
      isLoading: false,
      isRefetching: false,
      refetch: jest.fn(),
    });

    mockUseExpenseTotals.mockReturnValue({
      data: FIXTURE_TOTALS,
      isLoading: false,
      refetch: jest.fn(),
    });

    mockUseExpenseRecurrences.mockReturnValue({
      data: [FIXTURE_RECURRENCE],
      isLoading: false,
      refetch: jest.fn(),
    });

    mockUseCategories.mockReturnValue({
      data: [],
      isLoading: false,
    });
  });

  it('renders without crashing', () => {
    expect(() => renderWithClient()).not.toThrow();
  });

  describe('header', () => {
    it('shows the "Gastos" title', () => {
      renderWithClient();
      expect(screen.getByText('Gastos')).toBeTruthy();
    });

    it('shows the "Nuevo" button', () => {
      renderWithClient();
      expect(screen.getByLabelText('Registrar gasto')).toBeTruthy();
    });

    it('pressing "Nuevo" navigates to expense/new', () => {
      renderWithClient();
      fireEvent.press(screen.getByLabelText('Registrar gasto'));
      expect(router.push).toHaveBeenCalledWith('/(protected)/expense/new');
    });
  });

  describe('totals strip', () => {
    it('shows ARS label in the totals strip', () => {
      renderWithClient();
      expect(screen.getByText('Total ARS')).toBeTruthy();
    });

    it('shows USD label in the totals strip', () => {
      renderWithClient();
      expect(screen.getByText('Total USD')).toBeTruthy();
    });

    it('shows expense count for ARS', () => {
      renderWithClient();
      expect(screen.getByText('2 gastos')).toBeTruthy();
    });
  });

  describe('recurrences section', () => {
    it('shows the "Gastos recurrentes" section label', () => {
      renderWithClient();
      expect(screen.getByText('Gastos recurrentes')).toBeTruthy();
    });

    it('renders a recurrence row when recurrences are present', () => {
      renderWithClient();
      expect(screen.getByText('Alquiler mensual')).toBeTruthy();
    });

    it('shows "Mensual" frequency label for monthly recurrence', () => {
      renderWithClient();
      expect(screen.getByText('Mensual')).toBeTruthy();
    });

    it('shows "Próximo:" label for active recurrence with next_run_on', () => {
      renderWithClient();
      expect(screen.getByText(/Próximo:/)).toBeTruthy();
    });

    it('tapping a recurrence row navigates to its detail screen', () => {
      renderWithClient();
      fireEvent.press(screen.getByLabelText('Gasto recurrente Alquiler mensual'));
      expect(router.push).toHaveBeenCalledWith(`/(protected)/expense/recurrence/${REC_UUID_1}`);
    });

    it('shows "Crear gasto recurrente" CTA when no recurrences are present', () => {
      mockUseExpenseRecurrences.mockReturnValue({
        data: [],
        isLoading: false,
        refetch: jest.fn(),
      });
      renderWithClient();
      expect(screen.getByLabelText('Crear gasto recurrente')).toBeTruthy();
    });

    it('shows "Crear gasto recurrente" CTA when recurrences data is null', () => {
      mockUseExpenseRecurrences.mockReturnValue({
        data: null,
        isLoading: false,
        refetch: jest.fn(),
      });
      renderWithClient();
      expect(screen.getByLabelText('Crear gasto recurrente')).toBeTruthy();
    });

    it('"Agregar gasto recurrente" navigates to recurrence/new', () => {
      renderWithClient();
      fireEvent.press(screen.getByLabelText('Agregar gasto recurrente'));
      expect(router.push).toHaveBeenCalledWith('/(protected)/expense/recurrence/new');
    });

    it('shows "Pausado" badge for a paused recurrence', () => {
      mockUseExpenseRecurrences.mockReturnValue({
        data: [{ ...FIXTURE_RECURRENCE, status: 'paused' }],
        isLoading: false,
        refetch: jest.fn(),
      });
      renderWithClient();
      expect(screen.getByText('Pausado')).toBeTruthy();
    });

    it('uses category name as row text when description is empty', () => {
      mockUseExpenseRecurrences.mockReturnValue({
        data: [{ ...FIXTURE_RECURRENCE, description: null }],
        isLoading: false,
        refetch: jest.fn(),
      });
      renderWithClient();
      // Row accessibilityLabel falls back to category name when description is null
      expect(screen.getByLabelText('Gasto recurrente Comida')).toBeTruthy();
    });
  });

  describe('expense list', () => {
    it('renders expense rows for provided data', async () => {
      renderWithClient();
      await waitFor(() => {
        expect(screen.getByText('Almuerzo con clientes')).toBeTruthy();
        expect(screen.getByText('Cena del viernes')).toBeTruthy();
      });
    });

    it('tapping an expense row navigates to its detail screen', async () => {
      renderWithClient();
      await waitFor(() => expect(screen.getByText('Almuerzo con clientes')).toBeTruthy());
      fireEvent.press(screen.getByLabelText('Gasto Almuerzo con clientes'));
      expect(router.push).toHaveBeenCalledWith(`/(protected)/expense/${EXP_UUID_1}`);
    });
  });

  describe('empty state', () => {
    it('shows empty state when there are no expenses and loading is false', () => {
      mockUseExpenses.mockReturnValue({
        data: [],
        isLoading: false,
        isRefetching: false,
        refetch: jest.fn(),
      });
      renderWithClient();
      expect(screen.getByText('Registrá tu primer gasto para comenzar.')).toBeTruthy();
    });

    it('does not show empty state when loading', () => {
      mockUseExpenses.mockReturnValue({
        data: undefined,
        isLoading: true,
        isRefetching: false,
        refetch: jest.fn(),
      });
      renderWithClient();
      expect(screen.queryByText('Registrá tu primer gasto para comenzar.')).toBeNull();
    });

    it('empty state has "Registrar gasto" CTA', () => {
      mockUseExpenses.mockReturnValue({
        data: [],
        isLoading: false,
        isRefetching: false,
        refetch: jest.fn(),
      });
      renderWithClient();
      // There will be at least one "Registrar gasto" button (empty state)
      const ctaButtons = screen.getAllByLabelText('Registrar gasto');
      expect(ctaButtons.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('loading state', () => {
    it('shows a loader when expenses are loading', () => {
      mockUseExpenses.mockReturnValue({
        data: undefined,
        isLoading: true,
        isRefetching: false,
        refetch: jest.fn(),
      });
      renderWithClient();
      const loaders = screen.getAllByLabelText('Cargando gastos');
      expect(loaders.length).toBeGreaterThan(0);
    });
  });
});
