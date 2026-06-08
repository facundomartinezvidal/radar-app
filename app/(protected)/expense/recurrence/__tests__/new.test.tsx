/**
 * Tests for the new-expense-recurrence screen — verifies categories are surfaced,
 * the happy-path mutation is wired, and error messages bubble up.
 */
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { router } from 'expo-router';
import * as expensesRepo from '@/lib/repositories/expenses';
import * as supabaseModule from '@/lib/supabase';
import NewExpenseRecurrenceScreen from '../new';

jest.mock('@/lib/repositories/expenses');
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));
jest.mock('@react-native-community/datetimepicker', () => {
  const ReactLib = require('react');
  const { View } = require('react-native');
  const Mock = () => ReactLib.createElement(View, { testID: 'mock-datetimepicker' });
  Mock.displayName = 'MockDateTimePicker';
  return { __esModule: true, default: Mock };
});

jest.mock('expo-router', () => ({
  Link: ({ children }: { children: React.ReactNode }) => children,
  Redirect: () => null,
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() },
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
  Stack: { Screen: () => null },
}));

// CategorySelectorSheet uses these hooks — mock them so we don't need a real
// Supabase session or query infrastructure for the sheet's internal mutations.
jest.mock('@/hooks/use-categories', () => ({
  useCreateCategory: jest.fn(() => ({ mutateAsync: jest.fn(), isPending: false })),
  useUpdateCategory: jest.fn(() => ({ mutateAsync: jest.fn(), isPending: false })),
  useDeleteCategory: jest.fn(() => ({ mutateAsync: jest.fn(), isPending: false })),
}));

// useCreateExpenseRecurrence calls supabase.auth.getUser() internally — provide a stub.
jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: jest.fn(),
    },
  },
}));

const mockedExpensesRepo = expensesRepo as jest.Mocked<typeof expensesRepo>;
const mockedSupabase = supabaseModule.supabase as jest.Mocked<typeof supabaseModule.supabase>;

// RFC-compliant UUIDs — 4th group must start with 8/9/a/b (zod v4 strict).
const CAT_UUID = '550e8400-e29b-41d4-a716-446655440000';
const USER_UUID = '550e8400-e29b-41d4-a716-446655440001';
const REC_UUID = '550e8400-e29b-41d4-a716-446655440002';

const FIXTURE_CATEGORIES: expensesRepo.CategoryRow[] = [
  {
    id: CAT_UUID,
    slug: 'alquiler',
    name: 'Alquiler',
    icon: 'Home',
    color: '#EF4444',
    sort_order: 10,
    created_at: '2026-01-01',
    updated_at: '2026-01-01',
    user_id: null,
    kind: 'expense',
  },
];

const FIXTURE_RECURRENCE: expensesRepo.ExpenseRecurrenceWithCategory = {
  id: REC_UUID,
  user_id: USER_UUID,
  amount: 35000,
  currency: 'ARS',
  category_id: CAT_UUID,
  description: 'Alquiler',
  frequency: 'monthly',
  start_date: '2026-01-01',
  end_date: null,
  day_of_month: 1,
  next_run_on: '2026-07-01',
  status: 'active',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  last_materialized_at: null,
  category: FIXTURE_CATEGORIES[0]!,
};

function renderWithProviders(): { client: QueryClient } {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <NewExpenseRecurrenceScreen />
    </QueryClientProvider>,
  );
  return { client };
}

describe('NewExpenseRecurrenceScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedExpensesRepo.listCategories.mockResolvedValue({
      data: FIXTURE_CATEGORIES,
      error: null,
    });
    mockedExpensesRepo.createExpenseRecurrence.mockResolvedValue({
      data: FIXTURE_RECURRENCE,
      error: null,
    });
    (
      mockedSupabase.auth.getUser as jest.MockedFunction<typeof mockedSupabase.auth.getUser>
    ).mockResolvedValue({
      data: { user: { id: USER_UUID } as never },
      error: null,
    });
  });

  it('renders the screen title', () => {
    renderWithProviders();
    expect(screen.getByText('Nuevo gasto recurrente')).toBeTruthy();
  });

  it('shows the category picker trigger once categories are loaded', async () => {
    renderWithProviders();
    await waitFor(() => expect(screen.getByLabelText('Elegir categoría')).toBeTruthy());
  });

  it('shows the frequency selector with all options', async () => {
    renderWithProviders();
    await waitFor(() => expect(screen.getByText('Mensual')).toBeTruthy());
    expect(screen.getByText('Semanal')).toBeTruthy();
    expect(screen.getByText('Quincenal')).toBeTruthy();
    expect(screen.getByText('Anual')).toBeTruthy();
  });

  it('shows the "Sin fecha de fin" toggle', async () => {
    renderWithProviders();
    await waitFor(() => expect(screen.getByLabelText('Sin fecha de fin')).toBeTruthy());
  });

  it('submits create with parsed amount', async () => {
    mockedExpensesRepo.createExpenseRecurrence.mockResolvedValueOnce({
      data: FIXTURE_RECURRENCE,
      error: null,
    });

    renderWithProviders();

    await waitFor(() => expect(screen.getByLabelText('Crear gasto recurrente')).toBeTruthy());

    await act(async () => {
      fireEvent.changeText(screen.getByLabelText('Monto'), '35000');
    });

    await act(async () => {
      fireEvent.press(screen.getByLabelText('Crear gasto recurrente'));
    });

    await waitFor(() => {
      expect(mockedExpensesRepo.createExpenseRecurrence).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 35000,
          currency: 'ARS',
        }),
        USER_UUID,
        expect.any(String),
      );
    });
    expect(router.back).toHaveBeenCalled();
  });

  it('shows error message when create fails', async () => {
    mockedExpensesRepo.createExpenseRecurrence.mockResolvedValueOnce({
      data: null,
      error: new Error('No se pudo crear la recurrencia.'),
    });

    renderWithProviders();

    await waitFor(() => expect(screen.getByLabelText('Crear gasto recurrente')).toBeTruthy());

    await act(async () => {
      fireEvent.changeText(screen.getByLabelText('Monto'), '10000');
    });

    await act(async () => {
      fireEvent.press(screen.getByLabelText('Crear gasto recurrente'));
    });

    await waitFor(() => {
      expect(mockedExpensesRepo.createExpenseRecurrence).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(screen.getByText('No se pudo crear la recurrencia.')).toBeTruthy();
    });
  });
});
