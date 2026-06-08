/**
 * Tests for the recurrence detail/edit/delete screen.
 */
import React from 'react';
import { Alert } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { router } from 'expo-router';
import * as expensesRepo from '@/lib/repositories/expenses';
import * as incomesRepo from '@/lib/repositories/incomes';
import * as supabaseModule from '@/lib/supabase';
import RecurrenceDetailScreen from '../[id]';

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
  useLocalSearchParams: () => ({ id: REC_UUID }),
  Stack: { Screen: () => null },
}));

// CategorySelectorSheet uses these hooks — mock them so we don't need a real
// Supabase session or query infrastructure for the sheet's internal mutations.
jest.mock('@/hooks/use-categories', () => ({
  useCreateCategory: jest.fn(() => ({ mutateAsync: jest.fn(), isPending: false })),
  useUpdateCategory: jest.fn(() => ({ mutateAsync: jest.fn(), isPending: false })),
  useDeleteCategory: jest.fn(() => ({ mutateAsync: jest.fn(), isPending: false })),
}));

// useUpdateRecurrence calls supabase internally — provide a stub.
jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: jest.fn(),
    },
  },
}));

const mockedExpensesRepo = expensesRepo as jest.Mocked<typeof expensesRepo>;
const mockedIncomesRepo = incomesRepo as jest.Mocked<typeof incomesRepo>;
const mockedSupabase = supabaseModule.supabase as jest.Mocked<typeof supabaseModule.supabase>;

// RFC-compliant UUIDs — 4th group must start with 8/9/a/b (zod v4 strict).
const CAT_UUID = '550e8400-e29b-41d4-a716-446655440000';
const USER_UUID = '550e8400-e29b-41d4-a716-446655440001';
const REC_UUID = '550e8400-e29b-41d4-a716-446655440002';

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

const RECURRENCE: incomesRepo.IncomeRecurrenceWithCategory = {
  id: REC_UUID,
  user_id: USER_UUID,
  amount: 80000,
  currency: 'ARS',
  category_id: CAT_UUID,
  description: 'Sueldo mensual',
  frequency: 'monthly',
  start_date: '2026-01-01',
  end_date: null,
  day_of_month: 1,
  next_run_on: '2026-07-01',
  status: 'active',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  last_materialized_at: null,
  category: CATEGORIES[0]!,
};

function renderScreen(): void {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <RecurrenceDetailScreen />
    </QueryClientProvider>,
  );
}

describe('RecurrenceDetailScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedExpensesRepo.listCategories.mockResolvedValue({ data: CATEGORIES, error: null });
    mockedIncomesRepo.listRecurrences.mockResolvedValue({ data: [RECURRENCE], error: null });
    mockedIncomesRepo.updateRecurrence.mockResolvedValue({ data: RECURRENCE, error: null });
    mockedIncomesRepo.pauseRecurrence.mockResolvedValue({
      data: { ...RECURRENCE, status: 'paused' },
      error: null,
    });
    mockedIncomesRepo.resumeRecurrence.mockResolvedValue({
      data: { ...RECURRENCE, status: 'active' },
      error: null,
    });
    mockedIncomesRepo.deleteRecurrence.mockResolvedValue({ data: { id: REC_UUID }, error: null });
    (
      mockedSupabase.auth.getUser as jest.MockedFunction<typeof mockedSupabase.auth.getUser>
    ).mockResolvedValue({
      data: { user: { id: USER_UUID } as never },
      error: null,
    });
  });

  it('renders the screen heading', () => {
    renderScreen();
    expect(screen.getByText('Editar ingreso recurrente')).toBeTruthy();
  });

  it('hydrates the form with the existing description', async () => {
    renderScreen();
    await waitFor(() => {
      expect(screen.getByDisplayValue('Sueldo mensual')).toBeTruthy();
    });
  });

  it('shows the status badge', async () => {
    renderScreen();
    await waitFor(() => {
      expect(screen.getByText('Activa')).toBeTruthy();
    });
  });

  it('shows the next run date', async () => {
    renderScreen();
    await waitFor(() => {
      // next_run_on = 2026-07-01 → es-AR format includes "julio"
      expect(screen.getByText(/próximo/i)).toBeTruthy();
    });
  });

  it('shows Pausar button when recurrence is active', async () => {
    renderScreen();
    await waitFor(() => {
      expect(screen.getByLabelText('Pausar')).toBeTruthy();
    });
  });

  it('calls pauseRecurrence when Pausar is pressed', async () => {
    renderScreen();
    await waitFor(() => expect(screen.getByLabelText('Pausar')).toBeTruthy());

    await act(async () => {
      fireEvent.press(screen.getByLabelText('Pausar'));
    });

    await waitFor(() => {
      expect(mockedIncomesRepo.pauseRecurrence).toHaveBeenCalledWith(REC_UUID);
    });
  });

  it('saves edits via updateRecurrence', async () => {
    mockedIncomesRepo.updateRecurrence.mockResolvedValueOnce({
      data: { ...RECURRENCE, description: 'Sueldo actualizado' },
      error: null,
    });

    renderScreen();
    await waitFor(() => expect(screen.getByDisplayValue('Sueldo mensual')).toBeTruthy());

    fireEvent.changeText(screen.getByDisplayValue('Sueldo mensual'), 'Sueldo actualizado');

    await act(async () => {
      fireEvent.press(screen.getByLabelText('Guardar cambios'));
    });

    await waitFor(() => {
      expect(mockedIncomesRepo.updateRecurrence).toHaveBeenCalledWith(
        REC_UUID,
        expect.objectContaining({ description: 'Sueldo actualizado' }),
        expect.any(String),
      );
    });
    expect(router.back).toHaveBeenCalled();
  });

  it('confirms then calls deleteRecurrence', async () => {
    jest.spyOn(Alert, 'alert').mockImplementation((_title, _msg, buttons) => {
      const destructive = buttons?.find((b) => b.style === 'destructive');
      destructive?.onPress?.();
    });

    renderScreen();
    await waitFor(() => expect(screen.getByDisplayValue('Sueldo mensual')).toBeTruthy());

    await act(async () => {
      fireEvent.press(screen.getAllByLabelText('Eliminar ingreso recurrente')[0]!);
    });

    await waitFor(() => {
      expect(mockedIncomesRepo.deleteRecurrence).toHaveBeenCalledWith(REC_UUID);
    });
    expect(router.back).toHaveBeenCalled();
  });

  it('shows the delete confirmation with the correct message', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});

    renderScreen();
    await waitFor(() => expect(screen.getByDisplayValue('Sueldo mensual')).toBeTruthy());

    fireEvent.press(screen.getAllByLabelText('Eliminar ingreso recurrente')[0]!);

    expect(alertSpy).toHaveBeenCalledWith(
      'Eliminar ingreso recurrente',
      '¿Confirmás que querés eliminar este ingreso recurrente? Los ingresos ya registrados se conservan.',
      expect.any(Array),
    );
  });

  it('shows error message when update fails', async () => {
    mockedIncomesRepo.updateRecurrence.mockResolvedValueOnce({
      data: null,
      error: new Error('No se pudo actualizar el ingreso recurrente.'),
    });

    renderScreen();
    await waitFor(() => expect(screen.getByDisplayValue('Sueldo mensual')).toBeTruthy());

    await act(async () => {
      fireEvent.press(screen.getByLabelText('Guardar cambios'));
    });

    await waitFor(() => {
      expect(screen.getByText('No se pudo actualizar el ingreso recurrente.')).toBeTruthy();
    });
  });
});
