/**
 * Minimal smoke tests for ExpenseForm — verifies the Fecha (occurred_at) field
 * is rendered in both create and edit modes.
 *
 * react-native-svg is mocked globally in jest.setup.ts.
 *
 * Note: jest.mock() calls below are hoisted above all imports by Jest at
 * runtime, so the effective execution order is: mock factories → module
 * imports → test bodies.
 */
import React from 'react';
import { render, screen } from '@testing-library/react-native';

import { ExpenseForm } from '../expense-form';
import type { CategoryRow } from '@/lib/repositories/expenses';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock('@react-native-community/datetimepicker', () => {
  const ReactLib = require('react');
  const { View } = require('react-native');
  const Mock = () => ReactLib.createElement(View, { testID: 'mock-datetimepicker' });
  Mock.displayName = 'MockDateTimePicker';
  return { __esModule: true, default: Mock };
});

jest.mock('@/hooks/use-categories', () => ({
  useCreateCategory: jest.fn(() => ({ mutateAsync: jest.fn(), isPending: false })),
  useUpdateCategory: jest.fn(() => ({ mutateAsync: jest.fn(), isPending: false })),
  useDeleteCategory: jest.fn(() => ({ mutateAsync: jest.fn(), isPending: false })),
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const CATEGORIES: CategoryRow[] = [
  {
    id: 'cat-1',
    slug: 'comida',
    name: 'Comida',
    icon: 'UtensilsCrossed',
    color: '#F59E0B',
    sort_order: 10,
    created_at: '2026-01-01',
    updated_at: '2026-01-01',
    user_id: null,
  },
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ExpenseForm', () => {
  it('renders the Fecha label in create mode', () => {
    render(<ExpenseForm categories={CATEGORIES} onSubmit={jest.fn()} />);
    expect(screen.getByText('Fecha')).toBeTruthy();
  });

  it('renders with a formatted date in create mode (today)', () => {
    render(<ExpenseForm categories={CATEGORIES} onSubmit={jest.fn()} />);
    // Should show the current year (today's date is the default occurred_at)
    const year = String(new Date().getFullYear());
    expect(screen.getByText(new RegExp(year))).toBeTruthy();
  });

  it('renders with an initial occurred_at in edit mode and shows the formatted date', () => {
    const initial = {
      id: 'exp-1',
      user_id: 'user-1',
      amount: 1500,
      currency: 'ARS',
      category_id: 'cat-1',
      description: 'Almuerzo',
      // March 10, 2026
      occurred_at: '2026-03-10T15:00:00.000Z',
      created_at: '2026-03-10T15:00:00.000Z',
      updated_at: '2026-03-10T15:00:00.000Z',
      category: CATEGORIES[0] ?? null,
    } satisfies Parameters<typeof ExpenseForm>[0]['initial'] & object;

    render(
      <ExpenseForm
        categories={CATEGORIES}
        initial={initial}
        onSubmit={jest.fn()}
        submitLabel="Guardar cambios"
      />,
    );

    expect(screen.getByText('Fecha')).toBeTruthy();
    // "marzo" is the es-AR long month name for March
    expect(screen.getByText(/marzo/i)).toBeTruthy();
  });
});
