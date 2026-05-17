/**
 * Tests for the new-expense screen — verifies categories are surfaced, the
 * happy-path mutation is wired, and error messages bubble up.
 */
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { router } from 'expo-router';
import * as repo from '@/lib/repositories/expenses';
import NewExpenseScreen from '../new';

jest.mock('@/lib/repositories/expenses');
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));
jest.mock('react-native-svg', () => {
  const React = require('react');
  const make = (name: string) => {
    const C = (props: object) => React.createElement(name, props);
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

const mockedRepo = repo as jest.Mocked<typeof repo>;

const FIXTURE_CATEGORIES = [
  {
    id: 'cat-1',
    slug: 'comida',
    name: 'Comida',
    icon: 'UtensilsCrossed',
    color: '#F59E0B',
    sort_order: 10,
    created_at: '2026-01-01',
  },
  {
    id: 'cat-2',
    slug: 'transporte',
    name: 'Transporte',
    icon: 'Bus',
    color: '#4FB3DC',
    sort_order: 30,
    created_at: '2026-01-01',
  },
] satisfies repo.CategoryRow[];

function renderWithProviders(): { client: QueryClient } {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <NewExpenseScreen />
    </QueryClientProvider>,
  );
  return { client };
}

describe('NewExpenseScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedRepo.listCategories.mockResolvedValue({ data: FIXTURE_CATEGORIES, error: null });
  });

  it('renders the screen title', async () => {
    renderWithProviders();
    expect(screen.getByText('Nuevo gasto')).toBeTruthy();
  });

  it('shows seeded categories once loaded', async () => {
    renderWithProviders();
    await waitFor(() => {
      expect(screen.getByText('Comida')).toBeTruthy();
      expect(screen.getByText('Transporte')).toBeTruthy();
    });
  });

  it('submits create with parsed amount + selected currency + category', async () => {
    mockedRepo.createExpense.mockResolvedValueOnce({
      data: { id: 'exp-1' } as repo.ExpenseWithCategory,
      error: null,
    });

    renderWithProviders();

    await waitFor(() => expect(screen.getByText('Comida')).toBeTruthy());

    // Amount
    const amount = screen.getByLabelText('Monto');
    fireEvent.changeText(amount, '12.500,50');

    // Pick category
    fireEvent.press(screen.getByLabelText('Categoría Comida'));

    // Submit
    const submit = screen.getByLabelText('Registrar gasto');
    await act(async () => {
      fireEvent.press(submit);
    });

    await waitFor(() => {
      expect(mockedRepo.createExpense).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 12500.5,
          currency: 'ARS',
          category_id: 'cat-1',
        }),
      );
    });
    expect(router.back).toHaveBeenCalled();
  });

  it('shows error message when create fails', async () => {
    mockedRepo.createExpense.mockResolvedValueOnce({
      data: null,
      error: new Error('No pudimos guardar el gasto.'),
    });

    renderWithProviders();
    await waitFor(() => expect(screen.getByText('Comida')).toBeTruthy());

    fireEvent.changeText(screen.getByLabelText('Monto'), '100');
    fireEvent.press(screen.getByLabelText('Categoría Comida'));
    await act(async () => {
      fireEvent.press(screen.getByLabelText('Registrar gasto'));
    });

    await waitFor(() => {
      expect(screen.getByText('No pudimos guardar el gasto.')).toBeTruthy();
    });
  });
});
