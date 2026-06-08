/**
 * Tests for the Ingresos tab screen.
 *
 * Covers:
 *   - Renders without crashing
 *   - Shows the "Ingresos" title header
 *   - Shows the "Nuevo" button
 *   - Shows totals strip with ARS and USD labels
 *   - Shows "Ingresos recurrentes" section header
 *   - Renders income rows when data is present
 *   - Shows empty state when incomes list is empty
 *   - Shows recurrence row when recurrences are present
 *   - Shows CTA "Crear ingreso recurrente" when no recurrences
 *   - "Nuevo" button navigates to income/new
 */
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

import IncomesTab from '../incomes';
import type { IncomeWithCategory, IncomeRecurrenceWithCategory } from '@/lib/repositories/incomes';
import type { CurrencyTotal } from '@/lib/repositories/expenses';

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

// Mock the incomes hooks
const mockUseIncomes = jest.fn();
const mockUseIncomeTotals = jest.fn();
const mockUseRecurrences = jest.fn();

jest.mock('@/hooks/use-incomes', () => ({
  useIncomes: (...args: unknown[]) => mockUseIncomes(...args),
  useIncomeTotals: (...args: unknown[]) => mockUseIncomeTotals(...args),
  useRecurrences: (...args: unknown[]) => mockUseRecurrences(...args),
}));

// Mock useCategories for FilterBar
const mockUseCategories = jest.fn();

jest.mock('@/hooks/use-expenses', () => ({
  useCategories: (...args: unknown[]) => mockUseCategories(...args),
  personalAmount: jest.fn((expense: unknown) => {
    return (expense as { amount: number }).amount;
  }),
}));

// ---------------------------------------------------------------------------
// Fixtures — RFC-compliant UUIDs
// ---------------------------------------------------------------------------

const INC_UUID_1 = '550e8400-e29b-41d4-a716-446655440000';
const INC_UUID_2 = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
const REC_UUID_1 = 'b2ffcd11-1c2d-4bc0-bb8f-8bcbce503d44';
const CAT_UUID = 'c3ddde22-2d3e-5cd1-cc90-9cdcdf614e55';

const FIXTURE_INCOME_1: IncomeWithCategory = {
  id: INC_UUID_1,
  user_id: 'user-1',
  amount: 50000,
  currency: 'ARS',
  category_id: CAT_UUID,
  description: 'Sueldo de junio',
  occurred_at: '2026-06-01T10:00:00.000Z',
  occurred_date: '2026-06-01',
  created_at: '2026-06-01T10:00:00.000Z',
  updated_at: '2026-06-01T10:00:00.000Z',
  recurrence_id: null,
  source: 'manual',
  category: {
    id: CAT_UUID,
    slug: 'sueldo',
    name: 'Sueldo',
    icon: 'Briefcase',
    color: '#10B981',
    sort_order: 10,
    created_at: '2026-01-01',
    updated_at: '2026-01-01',
    user_id: 'user-1',
    kind: 'income',
  },
};

const FIXTURE_INCOME_2: IncomeWithCategory = {
  ...FIXTURE_INCOME_1,
  id: INC_UUID_2,
  description: 'Freelance proyecto',
  amount: 15000,
};

const FIXTURE_TOTALS: CurrencyTotal[] = [
  { currency: 'ARS', total: 65000, count: 2 },
  { currency: 'USD', total: 0, count: 0 },
];

const FIXTURE_RECURRENCE: IncomeRecurrenceWithCategory = {
  id: REC_UUID_1,
  user_id: 'user-1',
  amount: 50000,
  currency: 'ARS',
  category_id: CAT_UUID,
  description: 'Sueldo mensual',
  frequency: 'monthly',
  start_date: '2026-01-01',
  end_date: null,
  day_of_month: 1,
  next_run_on: '2026-07-01',
  status: 'active',
  last_materialized_at: null,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
  category: FIXTURE_INCOME_1.category,
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
      <IncomesTab />
    </QueryClientProvider>,
  );
  return { client };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('IncomesTab', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockUseIncomes.mockReturnValue({
      data: [FIXTURE_INCOME_1, FIXTURE_INCOME_2],
      isLoading: false,
      isRefetching: false,
      refetch: jest.fn(),
    });

    mockUseIncomeTotals.mockReturnValue({
      data: FIXTURE_TOTALS,
      isLoading: false,
      refetch: jest.fn(),
    });

    mockUseRecurrences.mockReturnValue({
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
    it('shows the "Ingresos" title', () => {
      renderWithClient();
      expect(screen.getByText('Ingresos')).toBeTruthy();
    });

    it('shows the "Nuevo" button', () => {
      renderWithClient();
      expect(screen.getByLabelText('Registrar ingreso')).toBeTruthy();
    });

    it('pressing "Nuevo" navigates to income/new', () => {
      renderWithClient();
      fireEvent.press(screen.getByLabelText('Registrar ingreso'));
      expect(router.push).toHaveBeenCalledWith('/(protected)/income/new');
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

    it('shows income count for ARS', () => {
      renderWithClient();
      expect(screen.getByText('2 ingresos')).toBeTruthy();
    });
  });

  describe('recurrences section', () => {
    it('shows the "Ingresos recurrentes" section label', () => {
      renderWithClient();
      // label variant renders as mixed-case text; textTransform:'uppercase' is a style only
      expect(screen.getByText('Ingresos recurrentes')).toBeTruthy();
    });

    it('renders a recurrence row when recurrences are present', () => {
      renderWithClient();
      expect(screen.getByText('Sueldo mensual')).toBeTruthy();
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
      fireEvent.press(screen.getByLabelText('Ingreso recurrente Sueldo mensual'));
      expect(router.push).toHaveBeenCalledWith(`/(protected)/income/recurrence/${REC_UUID_1}`);
    });

    it('shows "Crear ingreso recurrente" CTA when no recurrences are present', () => {
      mockUseRecurrences.mockReturnValue({ data: [], isLoading: false, refetch: jest.fn() });
      renderWithClient();
      expect(screen.getByLabelText('Crear ingreso recurrente')).toBeTruthy();
    });

    it('shows "Crear ingreso recurrente" CTA when recurrences data is null', () => {
      mockUseRecurrences.mockReturnValue({ data: null, isLoading: false, refetch: jest.fn() });
      renderWithClient();
      expect(screen.getByLabelText('Crear ingreso recurrente')).toBeTruthy();
    });

    it('"Agregar ingreso recurrente" navigates to recurrence/new', () => {
      renderWithClient();
      fireEvent.press(screen.getByLabelText('Agregar ingreso recurrente'));
      expect(router.push).toHaveBeenCalledWith('/(protected)/income/recurrence/new');
    });
  });

  describe('income list', () => {
    it('renders income rows for provided data', async () => {
      renderWithClient();
      await waitFor(() => {
        expect(screen.getByText('Sueldo de junio')).toBeTruthy();
        expect(screen.getByText('Freelance proyecto')).toBeTruthy();
      });
    });

    it('tapping an income row navigates to its detail screen', async () => {
      renderWithClient();
      await waitFor(() => expect(screen.getByText('Sueldo de junio')).toBeTruthy());
      fireEvent.press(screen.getByLabelText('Ingreso Sueldo de junio'));
      expect(router.push).toHaveBeenCalledWith(`/(protected)/income/${INC_UUID_1}`);
    });
  });

  describe('empty state', () => {
    it('shows empty state when there are no incomes and loading is false', () => {
      mockUseIncomes.mockReturnValue({
        data: [],
        isLoading: false,
        isRefetching: false,
        refetch: jest.fn(),
      });
      renderWithClient();
      expect(screen.getByText('Aún no se registraron ingresos.')).toBeTruthy();
    });

    it('does not show empty state when loading', () => {
      mockUseIncomes.mockReturnValue({
        data: undefined,
        isLoading: true,
        isRefetching: false,
        refetch: jest.fn(),
      });
      renderWithClient();
      expect(screen.queryByText('Aún no se registraron ingresos.')).toBeNull();
    });

    it('empty state has "Registrar ingreso" CTA', () => {
      mockUseIncomes.mockReturnValue({
        data: [],
        isLoading: false,
        isRefetching: false,
        refetch: jest.fn(),
      });
      renderWithClient();
      // There will be two "Registrar ingreso" accessibilityLabel buttons:
      // header + empty state
      const ctaButtons = screen.getAllByLabelText('Registrar ingreso');
      expect(ctaButtons.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('loading state', () => {
    it('shows a loader when incomes are loading', () => {
      mockUseIncomes.mockReturnValue({
        data: undefined,
        isLoading: true,
        isRefetching: false,
        refetch: jest.fn(),
      });
      renderWithClient();
      // FlatList renders ListHeaderComponent + ListEmptyComponent; Loader may appear twice
      const loaders = screen.getAllByLabelText('Cargando ingresos');
      expect(loaders.length).toBeGreaterThan(0);
    });
  });
});
