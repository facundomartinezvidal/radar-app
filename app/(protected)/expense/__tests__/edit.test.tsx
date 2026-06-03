/**
 * Tests for the expense detail/edit/delete screen.
 */
import React from 'react';
import { Alert } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { router } from 'expo-router';
import * as repo from '@/lib/repositories/expenses';
import EditExpenseScreen from '../[id]';

jest.mock('@/lib/repositories/expenses');
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));
// react-native-svg is mocked globally in jest.setup.ts (includes Rect and all Lucide elements)
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
  useLocalSearchParams: () => ({ id: 'exp-1' }),
  Stack: { Screen: () => null },
}));

const mockedRepo = repo as jest.Mocked<typeof repo>;

const CATEGORIES = [
  {
    id: 'cat-1',
    slug: 'comida',
    name: 'Comida',
    icon: 'UtensilsCrossed',
    color: '#F59E0B',
    sort_order: 10,
    created_at: '2026-01-01',
  },
] satisfies repo.CategoryRow[];

const EXPENSE = {
  id: 'exp-1',
  user_id: 'u-1',
  amount: 1500,
  currency: 'ARS',
  category_id: 'cat-1',
  description: 'Pizza',
  occurred_at: '2026-05-17T20:00:00Z',
  created_at: '2026-05-17T20:00:00Z',
  updated_at: '2026-05-17T20:00:00Z',
  category: CATEGORIES[0]!,
  items: [],
} satisfies repo.ExpenseWithItems;

/** Expense fixture that includes saved line items. */
const EXPENSE_WITH_ITEMS: repo.ExpenseWithItems = {
  id: 'exp-2',
  user_id: 'u-1',
  amount: 3000,
  currency: 'ARS',
  category_id: 'cat-1',
  description: 'Supermercado',
  occurred_at: '2026-05-20T10:00:00Z',
  created_at: '2026-05-20T10:00:00Z',
  updated_at: '2026-05-20T10:00:00Z',
  category: CATEGORIES[0]!,
  items: [
    {
      id: 'item-1',
      expense_id: 'exp-2',
      name: 'Arroz',
      quantity: '2',
      unit_price: '500',
      line_total: '1000',
      position: 0,
      created_at: '2026-05-20T10:00:00Z',
    } as unknown as repo.ExpenseItemRow,
    {
      id: 'item-2',
      expense_id: 'exp-2',
      name: 'Fideos',
      quantity: '1',
      unit_price: '2000',
      line_total: '2000',
      position: 1,
      created_at: '2026-05-20T10:00:00Z',
    } as unknown as repo.ExpenseItemRow,
  ],
};

function renderScreen(): void {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <EditExpenseScreen />
    </QueryClientProvider>,
  );
}

describe('ExpenseDetailScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedRepo.listCategories.mockResolvedValue({ data: CATEGORIES, error: null });
    mockedRepo.getExpense.mockResolvedValue({ data: EXPENSE, error: null });
  });

  it('renders the screen heading', async () => {
    renderScreen();
    expect(screen.getByText('Editar gasto')).toBeTruthy();
  });

  it('hydrates the form with the existing expense data', async () => {
    renderScreen();
    await waitFor(() => {
      expect(screen.getByText('Comida')).toBeTruthy();
      expect(screen.getByDisplayValue('Pizza')).toBeTruthy();
    });
  });

  it('saves edits via updateExpense', async () => {
    mockedRepo.updateExpense.mockResolvedValueOnce({
      data: { ...EXPENSE, description: 'Empanadas' } as repo.ExpenseWithItems,
      error: null,
    });

    renderScreen();
    await waitFor(() => expect(screen.getByText('Comida')).toBeTruthy());

    fireEvent.changeText(screen.getByDisplayValue('Pizza'), 'Empanadas');

    await act(async () => {
      fireEvent.press(screen.getByLabelText('Guardar cambios'));
    });

    await waitFor(() => {
      expect(mockedRepo.updateExpense).toHaveBeenCalledWith(
        'exp-1',
        expect.objectContaining({ description: 'Empanadas' }),
      );
    });
    expect(router.back).toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // HU-18: expense with line items
  // -------------------------------------------------------------------------

  it('shows existing line-item names when expense has items', async () => {
    mockedRepo.getExpense.mockResolvedValue({ data: EXPENSE_WITH_ITEMS, error: null });

    renderScreen();

    // Items section starts expanded when items are pre-populated.
    await waitFor(() => {
      expect(screen.getByDisplayValue('Arroz')).toBeTruthy();
      expect(screen.getByDisplayValue('Fideos')).toBeTruthy();
    });
  });

  it('passes items to updateExpense on submit when expense has items', async () => {
    mockedRepo.getExpense.mockResolvedValue({ data: EXPENSE_WITH_ITEMS, error: null });
    mockedRepo.updateExpense.mockResolvedValueOnce({
      data: EXPENSE_WITH_ITEMS,
      error: null,
    });

    renderScreen();
    await waitFor(() => expect(screen.getByDisplayValue('Arroz')).toBeTruthy());

    await act(async () => {
      fireEvent.press(screen.getByLabelText('Guardar cambios'));
    });

    await waitFor(() => {
      expect(mockedRepo.updateExpense).toHaveBeenCalledWith(
        'exp-1',
        expect.objectContaining({
          items: expect.arrayContaining([
            expect.objectContaining({ name: 'Arroz', quantity: 2, line_total: 1000 }),
            expect.objectContaining({ name: 'Fideos', quantity: 1, line_total: 2000 }),
          ]),
        }),
      );
    });
  });

  it('confirms then calls deleteExpense', async () => {
    mockedRepo.deleteExpense.mockResolvedValueOnce({ data: { id: 'exp-1' }, error: null });

    // Auto-press the destructive button in the Alert
    jest.spyOn(Alert, 'alert').mockImplementation((_title, _msg, buttons) => {
      const destructive = buttons?.find((b) => b.style === 'destructive');
      destructive?.onPress?.();
    });

    renderScreen();
    await waitFor(() => expect(screen.getByText('Comida')).toBeTruthy());

    await act(async () => {
      fireEvent.press(screen.getAllByLabelText('Eliminar gasto')[0]!);
    });

    await waitFor(() => {
      expect(mockedRepo.deleteExpense).toHaveBeenCalledWith('exp-1');
    });
    expect(router.back).toHaveBeenCalled();
  });
});
