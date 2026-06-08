/**
 * Tests for the income detail/edit/delete screen.
 */
import React from 'react';
import { Alert } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { router } from 'expo-router';
import * as expensesRepo from '@/lib/repositories/expenses';
import * as incomesRepo from '@/lib/repositories/incomes';
import IncomeDetailScreen from '../[id]';

jest.mock('@/lib/repositories/expenses');
jest.mock('@/lib/repositories/incomes');
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
  useLocalSearchParams: () => ({ id: 'inc-1' }),
  Stack: { Screen: () => null },
}));

// CategorySelectorSheet uses these hooks — mock them so we don't need a real
// Supabase session or query infrastructure for the sheet's internal mutations.
jest.mock('@/hooks/use-categories', () => ({
  useCreateCategory: jest.fn(() => ({ mutateAsync: jest.fn(), isPending: false })),
  useUpdateCategory: jest.fn(() => ({ mutateAsync: jest.fn(), isPending: false })),
  useDeleteCategory: jest.fn(() => ({ mutateAsync: jest.fn(), isPending: false })),
}));

const mockedExpensesRepo = expensesRepo as jest.Mocked<typeof expensesRepo>;
const mockedIncomesRepo = incomesRepo as jest.Mocked<typeof incomesRepo>;

// Use a valid UUID — createIncomeSchema validates category_id with z.string().uuid()
// All-same-digit UUIDs fail zod v4's variant check — use a real UUID.
const CAT_UUID = '550e8400-e29b-41d4-a716-446655440000';

const CATEGORIES: expensesRepo.CategoryRow[] = [
  {
    id: CAT_UUID,
    slug: 'sueldo',
    name: 'Sueldo',
    icon: 'Briefcase',
    color: '#10B981',
    sort_order: 10,
    created_at: '2026-01-01',
    updated_at: '2026-01-01',
    user_id: null,
    kind: 'income',
  },
];

const INCOME: incomesRepo.IncomeWithCategory = {
  id: 'inc-1',
  user_id: 'u-1',
  amount: 50000,
  currency: 'ARS',
  category_id: CAT_UUID,
  description: 'Sueldo junio',
  occurred_at: '2026-06-01T10:00:00Z',
  occurred_date: null,
  created_at: '2026-06-01T10:00:00Z',
  updated_at: '2026-06-01T10:00:00Z',
  recurrence_id: null,
  source: 'manual',
  category: CATEGORIES[0]!,
};

function renderScreen(): void {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <IncomeDetailScreen />
    </QueryClientProvider>,
  );
}

describe('IncomeDetailScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedExpensesRepo.listCategories.mockResolvedValue({ data: CATEGORIES, error: null });
    mockedIncomesRepo.getIncome.mockResolvedValue({ data: INCOME, error: null });
    mockedIncomesRepo.updateIncome.mockResolvedValue({ data: INCOME, error: null });
    mockedIncomesRepo.deleteIncome.mockResolvedValue({ data: { id: 'inc-1' }, error: null });
  });

  it('renders the screen heading', () => {
    renderScreen();
    expect(screen.getByText('Editar ingreso')).toBeTruthy();
  });

  it('hydrates the form with the existing income description', async () => {
    renderScreen();
    await waitFor(() => {
      expect(screen.getByDisplayValue('Sueldo junio')).toBeTruthy();
    });
  });

  it('hydrates the form with the existing category', async () => {
    renderScreen();
    await waitFor(() => {
      expect(screen.getByText('Sueldo')).toBeTruthy();
    });
  });

  it('saves edits via updateIncome', async () => {
    mockedIncomesRepo.updateIncome.mockResolvedValueOnce({
      data: { ...INCOME, description: 'Sueldo actualizado' },
      error: null,
    });

    renderScreen();
    await waitFor(() => expect(screen.getByDisplayValue('Sueldo junio')).toBeTruthy());

    fireEvent.changeText(screen.getByDisplayValue('Sueldo junio'), 'Sueldo actualizado');

    await act(async () => {
      fireEvent.press(screen.getByLabelText('Guardar cambios'));
    });

    await waitFor(() => {
      expect(mockedIncomesRepo.updateIncome).toHaveBeenCalledWith(
        'inc-1',
        expect.objectContaining({ description: 'Sueldo actualizado' }),
      );
    });
    expect(router.back).toHaveBeenCalled();
  });

  it('confirms then calls deleteIncome', async () => {
    jest.spyOn(Alert, 'alert').mockImplementation((_title, _msg, buttons) => {
      const destructive = buttons?.find((b) => b.style === 'destructive');
      destructive?.onPress?.();
    });

    renderScreen();
    await waitFor(() => expect(screen.getByText('Sueldo')).toBeTruthy());

    await act(async () => {
      fireEvent.press(screen.getAllByLabelText('Eliminar ingreso')[0]!);
    });

    await waitFor(() => {
      expect(mockedIncomesRepo.deleteIncome).toHaveBeenCalledWith('inc-1');
    });
    expect(router.back).toHaveBeenCalled();
  });

  it('shows the delete confirmation with the correct message', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});

    renderScreen();
    await waitFor(() => expect(screen.getByText('Sueldo')).toBeTruthy());

    fireEvent.press(screen.getAllByLabelText('Eliminar ingreso')[0]!);

    expect(alertSpy).toHaveBeenCalledWith(
      'Eliminar ingreso',
      '¿Confirmás que querés eliminar este ingreso?',
      expect.any(Array),
    );
  });

  it('shows error message when update fails', async () => {
    mockedIncomesRepo.updateIncome.mockResolvedValueOnce({
      data: null,
      error: new Error('No se pudo actualizar el ingreso.'),
    });

    renderScreen();
    await waitFor(() => expect(screen.getByDisplayValue('Sueldo junio')).toBeTruthy());

    await act(async () => {
      fireEvent.press(screen.getByLabelText('Guardar cambios'));
    });

    await waitFor(() => {
      expect(screen.getByText('No se pudo actualizar el ingreso.')).toBeTruthy();
    });
  });
});
