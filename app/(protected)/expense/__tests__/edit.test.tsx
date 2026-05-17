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
jest.mock('react-native-svg', () => {
  const ReactLib = require('react');
  const make = (name: string) => {
    const C = (props: object) => ReactLib.createElement(name, props);
    C.displayName = name;
    return C;
  };
  return {
    __esModule: true,
    default: make('Svg'),
    Svg: make('Svg'),
    Circle: make('Circle'),
    Path: make('Path'),
    Line: make('Line'),
    Defs: make('Defs'),
    Stop: make('Stop'),
    LinearGradient: make('LinearGradient'),
    G: make('G'),
    Text: make('SvgText'),
  };
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
} satisfies repo.ExpenseWithCategory;

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
      data: { ...EXPENSE, description: 'Empanadas' } as repo.ExpenseWithCategory,
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
      fireEvent.press(screen.getAllByLabelText('Borrar gasto')[0]!);
    });

    await waitFor(() => {
      expect(mockedRepo.deleteExpense).toHaveBeenCalledWith('exp-1');
    });
    expect(router.back).toHaveBeenCalled();
  });
});
