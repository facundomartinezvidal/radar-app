/**
 * Minimal smoke tests for ExpenseForm — verifies the Fecha (occurred_at) field
 * is rendered in both create and edit modes, and the OCR suggestion CTA.
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

jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));

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

// ---------------------------------------------------------------------------
// OCR suggestion CTA / recommendation card
// ---------------------------------------------------------------------------

describe('ExpenseForm — OCR suggestion CTA', () => {
  it('renders the suggestion CTA when prefill has suggestedCategoryName and no category is selected', () => {
    render(
      <ExpenseForm
        categories={CATEGORIES}
        prefill={{ suggestedCategoryName: 'Farmacia' }}
        onSubmit={jest.fn()}
      />,
    );

    expect(screen.getByText('Crear categoría "Farmacia"')).toBeTruthy();
  });

  it('does NOT render the suggestion CTA when prefill has a matched category_id', () => {
    render(
      <ExpenseForm
        categories={CATEGORIES}
        prefill={{ suggestedCategoryName: 'Farmacia', category_id: 'cat-1' }}
        onSubmit={jest.fn()}
      />,
    );

    expect(screen.queryByText('Crear categoría "Farmacia"')).toBeNull();
  });

  it('does NOT render the suggestion CTA when prefill has no suggestedCategoryName', () => {
    render(<ExpenseForm categories={CATEGORIES} prefill={{ amount: 500 }} onSubmit={jest.fn()} />);

    expect(screen.queryByText(/Crear categoría/)).toBeNull();
  });

  it('does NOT render the suggestion CTA when no prefill is provided', () => {
    render(<ExpenseForm categories={CATEGORIES} onSubmit={jest.fn()} />);

    expect(screen.queryByText(/Crear categoría/)).toBeNull();
  });

  it('has accessibilityLabel "Crear categoría sugerida" on the CTA button', () => {
    render(
      <ExpenseForm
        categories={CATEGORIES}
        prefill={{ suggestedCategoryName: 'Farmacia' }}
        onSubmit={jest.fn()}
      />,
    );

    expect(screen.getByLabelText('Crear categoría sugerida')).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// OCR recommendation card — heading + reason text
// ---------------------------------------------------------------------------

describe('ExpenseForm — recommendation card content', () => {
  it('shows the recommended category name in the card heading', () => {
    render(
      <ExpenseForm
        categories={CATEGORIES}
        prefill={{ suggestedCategoryName: 'Ropa', suggestedCategoryReason: 'Es indumentaria.' }}
        onSubmit={jest.fn()}
      />,
    );

    expect(screen.getByText('Categoría recomendada: Ropa')).toBeTruthy();
  });

  it('shows the reason text when suggestedCategoryReason is provided', () => {
    render(
      <ExpenseForm
        categories={CATEGORIES}
        prefill={{
          suggestedCategoryName: 'Ropa',
          suggestedCategoryReason:
            'El comercio es Zara, una tienda de indumentaria; conviene una categoría de ropa separada de tus otros gastos.',
        }}
        onSubmit={jest.fn()}
      />,
    );

    expect(
      screen.getByText(
        'El comercio es Zara, una tienda de indumentaria; conviene una categoría de ropa separada de tus otros gastos.',
      ),
    ).toBeTruthy();
  });

  it('shows the fallback text when suggestedCategoryReason is absent', () => {
    render(
      <ExpenseForm
        categories={CATEGORIES}
        prefill={{ suggestedCategoryName: 'Ropa' }}
        onSubmit={jest.fn()}
      />,
    );

    expect(screen.getByText('Este gasto no encaja en tus categorías actuales.')).toBeTruthy();
  });

  it('shows the fallback text when suggestedCategoryReason is null', () => {
    render(
      <ExpenseForm
        categories={CATEGORIES}
        prefill={{ suggestedCategoryName: 'Ropa', suggestedCategoryReason: null }}
        onSubmit={jest.fn()}
      />,
    );

    expect(screen.getByText('Este gasto no encaja en tus categorías actuales.')).toBeTruthy();
  });

  it('does NOT render the recommendation card when category_id is matched', () => {
    render(
      <ExpenseForm
        categories={CATEGORIES}
        prefill={{
          suggestedCategoryName: 'Ropa',
          suggestedCategoryReason: 'Es indumentaria.',
          category_id: 'cat-1',
        }}
        onSubmit={jest.fn()}
      />,
    );

    expect(screen.queryByText('Categoría recomendada: Ropa')).toBeNull();
    expect(screen.queryByText('Es indumentaria.')).toBeNull();
  });
});
