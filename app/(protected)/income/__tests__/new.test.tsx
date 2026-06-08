/**
 * Tests for the new-income screen — verifies categories are surfaced,
 * the happy-path mutation is wired, and error messages bubble up.
 *
 * Category selection goes through the CategorySelectorSheet:
 * 1. Press the "Elegir categoría" trigger to open the sheet.
 * 2. Press "Categoría <Name>" tile in the sheet to select.
 */
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { router } from 'expo-router';
import * as expensesRepo from '@/lib/repositories/expenses';
import * as incomesRepo from '@/lib/repositories/incomes';
import NewIncomeScreen from '../new';

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

// Use valid UUIDs — createIncomeSchema validates category_id with z.string().uuid()
// All-same-digit UUIDs fail zod v4's variant check — use real UUIDs.
const CAT_UUID_1 = '550e8400-e29b-41d4-a716-446655440000';
const CAT_UUID_2 = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';

const FIXTURE_CATEGORIES: expensesRepo.CategoryRow[] = [
  {
    id: CAT_UUID_1,
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
  {
    id: CAT_UUID_2,
    slug: 'freelance',
    name: 'Freelance',
    icon: 'Laptop',
    color: '#4FB3DC',
    sort_order: 20,
    created_at: '2026-01-01',
    updated_at: '2026-01-01',
    user_id: null,
    kind: 'income',
  },
];

const FIXTURE_INCOME: incomesRepo.IncomeWithCategory = {
  id: 'inc-1',
  user_id: 'u-1',
  amount: 50000,
  currency: 'ARS',
  category_id: CAT_UUID_1,
  description: 'Sueldo',
  occurred_at: '2026-06-01T10:00:00Z',
  occurred_date: null,
  created_at: '2026-06-01T10:00:00Z',
  updated_at: '2026-06-01T10:00:00Z',
  recurrence_id: null,
  source: 'manual',
  category: FIXTURE_CATEGORIES[0]!,
};

function renderWithProviders(): { client: QueryClient } {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <NewIncomeScreen />
    </QueryClientProvider>,
  );
  return { client };
}

// ---------------------------------------------------------------------------
// Helper: open the category sheet and select a category by name
// ---------------------------------------------------------------------------

async function openSheetAndSelect(categoryName: string): Promise<void> {
  await waitFor(() => expect(screen.getByLabelText('Elegir categoría')).toBeTruthy());
  fireEvent.press(screen.getByLabelText('Elegir categoría'));
  await waitFor(() => expect(screen.getByLabelText(`Categoría ${categoryName}`)).toBeTruthy());
  fireEvent.press(screen.getByLabelText(`Categoría ${categoryName}`));
}

describe('NewIncomeScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedExpensesRepo.listCategories.mockResolvedValue({
      data: FIXTURE_CATEGORIES,
      error: null,
    });
    mockedIncomesRepo.createIncome.mockResolvedValue({ data: FIXTURE_INCOME, error: null });
  });

  it('renders the screen title', () => {
    renderWithProviders();
    expect(screen.getByText('Nuevo ingreso')).toBeTruthy();
  });

  it('shows the category picker trigger once categories are loaded', async () => {
    renderWithProviders();
    await waitFor(() => expect(screen.getByLabelText('Elegir categoría')).toBeTruthy());
  });

  it('shows income categories in the sheet when the trigger is pressed', async () => {
    renderWithProviders();

    await waitFor(() => expect(screen.getByLabelText('Elegir categoría')).toBeTruthy());
    fireEvent.press(screen.getByLabelText('Elegir categoría'));

    await waitFor(() => {
      expect(screen.getByLabelText('Categoría Sueldo')).toBeTruthy();
      expect(screen.getByLabelText('Categoría Freelance')).toBeTruthy();
    });
  });

  it('submits create with parsed amount + selected currency', async () => {
    mockedIncomesRepo.createIncome.mockResolvedValueOnce({
      data: FIXTURE_INCOME,
      error: null,
    });

    renderWithProviders();

    // Wait for the form to be fully rendered
    await waitFor(() => expect(screen.getByLabelText('Registrar ingreso')).toBeTruthy());

    await act(async () => {
      fireEvent.changeText(screen.getByLabelText('Monto'), '50000');
    });

    await act(async () => {
      fireEvent.press(screen.getByLabelText('Registrar ingreso'));
    });

    await waitFor(() => {
      expect(mockedIncomesRepo.createIncome).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 50000,
          currency: 'ARS',
        }),
      );
    });
    expect(router.back).toHaveBeenCalled();
  });

  it('submits create with category when category is selected', async () => {
    mockedIncomesRepo.createIncome.mockResolvedValueOnce({
      data: FIXTURE_INCOME,
      error: null,
    });

    renderWithProviders();

    await waitFor(() => expect(screen.getByLabelText('Monto')).toBeTruthy());
    fireEvent.changeText(screen.getByLabelText('Monto'), '50000');

    // Pick category via sheet
    await openSheetAndSelect('Sueldo');

    await act(async () => {
      fireEvent.press(screen.getByLabelText('Registrar ingreso'));
    });

    await waitFor(() => {
      expect(mockedIncomesRepo.createIncome).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 50000,
          currency: 'ARS',
          category_id: CAT_UUID_1,
        }),
      );
    });
    expect(router.back).toHaveBeenCalled();
  });

  it('shows error message when create fails', async () => {
    mockedIncomesRepo.createIncome.mockResolvedValueOnce({
      data: null,
      error: new Error('No se pudo guardar el ingreso.'),
    });

    renderWithProviders();

    await waitFor(() => expect(screen.getByLabelText('Registrar ingreso')).toBeTruthy());

    await act(async () => {
      fireEvent.changeText(screen.getByLabelText('Monto'), '10000');
    });

    await act(async () => {
      fireEvent.press(screen.getByLabelText('Registrar ingreso'));
    });

    await waitFor(() => {
      expect(mockedIncomesRepo.createIncome).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(screen.getByText('No se pudo guardar el ingreso.')).toBeTruthy();
    });
  });
});
