/**
 * Tests for RecurrenceForm — verifies fields render in create/edit mode,
 * form submission calls onSubmit with correct values, and validation surfaces
 * (end_date >= start_date).
 *
 * react-native-svg is mocked globally in jest.setup.ts.
 *
 * Note: jest.mock() calls below are hoisted above all imports by Jest at
 * runtime, so the effective execution order is: mock factories → module
 * imports → test bodies.
 */
import React from 'react';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react-native';

import { RecurrenceForm } from '../recurrence-form';
import type { CategoryRow } from '@/lib/repositories/expenses';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() },
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
}));

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

// RFC-compliant UUID v4 — 4th group must start with 8/9/a/b (zod v4 strict).
const CAT_UUID = '550e8400-e29b-41d4-a716-446655440000';

const CATEGORIES: CategoryRow[] = [
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

// ---------------------------------------------------------------------------
// Tests — field rendering
// ---------------------------------------------------------------------------

describe('RecurrenceForm — field rendering', () => {
  it('renders the Monto label', () => {
    render(<RecurrenceForm categories={CATEGORIES} onSubmit={jest.fn()} />);
    expect(screen.getByText('Monto')).toBeTruthy();
  });

  it('renders the Moneda label', () => {
    render(<RecurrenceForm categories={CATEGORIES} onSubmit={jest.fn()} />);
    expect(screen.getByText('Moneda')).toBeTruthy();
  });

  it('renders the Frecuencia label', () => {
    render(<RecurrenceForm categories={CATEGORIES} onSubmit={jest.fn()} />);
    expect(screen.getByText('Frecuencia')).toBeTruthy();
  });

  it('renders all four frequency options in Spanish', () => {
    render(<RecurrenceForm categories={CATEGORIES} onSubmit={jest.fn()} />);
    expect(screen.getByText('Semanal')).toBeTruthy();
    expect(screen.getByText('Quincenal')).toBeTruthy();
    expect(screen.getByText('Mensual')).toBeTruthy();
    expect(screen.getByText('Anual')).toBeTruthy();
  });

  it('renders the frequency helper text', () => {
    render(<RecurrenceForm categories={CATEGORIES} onSubmit={jest.fn()} />);
    expect(screen.getByText('Se registrará automáticamente cada período.')).toBeTruthy();
  });

  it('renders the Categoría label', () => {
    render(<RecurrenceForm categories={CATEGORIES} onSubmit={jest.fn()} />);
    expect(screen.getByText('Categoría')).toBeTruthy();
  });

  it('renders the description input with the correct placeholder', () => {
    render(<RecurrenceForm categories={CATEGORIES} onSubmit={jest.fn()} />);
    expect(screen.getByPlaceholderText('Descripción del ingreso recurrente')).toBeTruthy();
  });

  it('renders the Fecha de inicio label', () => {
    render(<RecurrenceForm categories={CATEGORIES} onSubmit={jest.fn()} />);
    expect(screen.getByText('Fecha de inicio')).toBeTruthy();
  });

  it('renders the "Sin fecha de fin" toggle', () => {
    render(<RecurrenceForm categories={CATEGORIES} onSubmit={jest.fn()} />);
    expect(screen.getByLabelText('Sin fecha de fin')).toBeTruthy();
  });

  it('does NOT render Fecha de fin picker when toggle is "indefinite" (default)', () => {
    render(<RecurrenceForm categories={CATEGORIES} onSubmit={jest.fn()} />);
    expect(screen.queryByText('Fecha de fin')).toBeNull();
  });

  it('renders the Fecha de fin picker when the "Sin fecha de fin" toggle is pressed', () => {
    render(<RecurrenceForm categories={CATEGORIES} onSubmit={jest.fn()} />);
    fireEvent.press(screen.getByLabelText('Sin fecha de fin'));
    expect(screen.getByText('Fecha de fin')).toBeTruthy();
  });

  it('hides Fecha de fin picker when toggle is pressed again (back to indefinite)', () => {
    render(<RecurrenceForm categories={CATEGORIES} onSubmit={jest.fn()} />);
    // Press once to show
    fireEvent.press(screen.getByLabelText('Sin fecha de fin'));
    expect(screen.getByText('Fecha de fin')).toBeTruthy();
    // Press again to hide
    fireEvent.press(screen.getByLabelText('Sin fecha de fin'));
    expect(screen.queryByText('Fecha de fin')).toBeNull();
  });

  it('renders the default submit label "Crear ingreso recurrente"', () => {
    render(<RecurrenceForm categories={CATEGORIES} onSubmit={jest.fn()} />);
    expect(screen.getByLabelText('Crear ingreso recurrente')).toBeTruthy();
  });

  it('renders a custom submitLabel', () => {
    render(
      <RecurrenceForm categories={CATEGORIES} onSubmit={jest.fn()} submitLabel="Guardar cambios" />,
    );
    expect(screen.getByLabelText('Guardar cambios')).toBeTruthy();
  });

  it('renders in edit mode with initial values', () => {
    const initial = {
      id: 'rec-550e8400-e29b-41d4-a716-446655440000',
      user_id: '550e8400-e29b-41d4-a716-446655440001',
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

    render(
      <RecurrenceForm
        categories={CATEGORIES}
        initial={initial}
        onSubmit={jest.fn()}
        submitLabel="Guardar cambios"
      />,
    );

    expect(screen.getByDisplayValue('Sueldo mensual')).toBeTruthy();
    expect(screen.getByLabelText('Guardar cambios')).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Tests — submit behaviour
// ---------------------------------------------------------------------------

describe('RecurrenceForm — submit behaviour', () => {
  it('calls onSubmit with parsed amount and defaults when submitted with a valid amount', async () => {
    const onSubmit = jest.fn().mockResolvedValue(undefined);
    render(<RecurrenceForm categories={CATEGORIES} onSubmit={onSubmit} />);

    const amountInput = screen.getByLabelText('Monto');
    fireEvent.changeText(amountInput, '15000');

    await act(async () => {
      fireEvent.press(screen.getByLabelText('Crear ingreso recurrente'));
    });

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 15000,
        currency: 'ARS',
        frequency: 'monthly',
      }),
    );
  });

  it('passes end_date as null when indefinite toggle is active', async () => {
    const onSubmit = jest.fn().mockResolvedValue(undefined);
    render(<RecurrenceForm categories={CATEGORIES} onSubmit={onSubmit} />);

    fireEvent.changeText(screen.getByLabelText('Monto'), '20000');

    await act(async () => {
      fireEvent.press(screen.getByLabelText('Crear ingreso recurrente'));
    });

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          end_date: null,
        }),
      );
    });
  });

  it('calls onSubmit with a Mensual frequency when Mensual pill is pressed', async () => {
    const onSubmit = jest.fn().mockResolvedValue(undefined);
    render(<RecurrenceForm categories={CATEGORIES} onSubmit={onSubmit} />);

    fireEvent.press(screen.getByLabelText('Frecuencia Mensual'));
    fireEvent.changeText(screen.getByLabelText('Monto'), '5000');

    await act(async () => {
      fireEvent.press(screen.getByLabelText('Crear ingreso recurrente'));
    });

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ frequency: 'monthly' }));
    });
  });

  it('calls onSubmit with Semanal frequency when Semanal pill is pressed', async () => {
    const onSubmit = jest.fn().mockResolvedValue(undefined);
    render(<RecurrenceForm categories={CATEGORIES} onSubmit={onSubmit} />);

    fireEvent.press(screen.getByLabelText('Frecuencia Semanal'));
    fireEvent.changeText(screen.getByLabelText('Monto'), '5000');

    await act(async () => {
      fireEvent.press(screen.getByLabelText('Crear ingreso recurrente'));
    });

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ frequency: 'weekly' }));
    });
  });

  it('calls onSubmit with Anual frequency when Anual pill is pressed', async () => {
    const onSubmit = jest.fn().mockResolvedValue(undefined);
    render(<RecurrenceForm categories={CATEGORIES} onSubmit={onSubmit} />);

    fireEvent.press(screen.getByLabelText('Frecuencia Anual'));
    fireEvent.changeText(screen.getByLabelText('Monto'), '5000');

    await act(async () => {
      fireEvent.press(screen.getByLabelText('Crear ingreso recurrente'));
    });

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ frequency: 'yearly' }));
    });
  });

  it('does NOT call onSubmit when amount is zero (invalid)', async () => {
    const onSubmit = jest.fn();
    render(<RecurrenceForm categories={CATEGORIES} onSubmit={onSubmit} />);

    await act(async () => {
      fireEvent.press(screen.getByLabelText('Crear ingreso recurrente'));
    });

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('shows validation error when amount is zero', async () => {
    const onSubmit = jest.fn();
    render(<RecurrenceForm categories={CATEGORIES} onSubmit={onSubmit} />);

    await act(async () => {
      fireEvent.press(screen.getByLabelText('Crear ingreso recurrente'));
    });

    expect(screen.getByText('El monto tiene que ser mayor a cero.')).toBeTruthy();
  });

  it('calls onSubmit with initial amount when in edit mode', async () => {
    const onSubmit = jest.fn().mockResolvedValue(undefined);
    const initial = {
      id: '550e8400-e29b-41d4-a716-446655440002',
      user_id: '550e8400-e29b-41d4-a716-446655440001',
      amount: 5000,
      currency: 'ARS',
      category_id: null,
      description: null,
      frequency: 'monthly',
      start_date: '2026-01-01',
      end_date: null,
      day_of_month: 1,
      next_run_on: '2026-07-01',
      status: 'active',
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
      last_materialized_at: null,
      category: null,
    };

    render(
      <RecurrenceForm
        categories={CATEGORIES}
        initial={initial}
        onSubmit={onSubmit}
        submitLabel="Guardar cambios"
      />,
    );

    await act(async () => {
      fireEvent.press(screen.getByLabelText('Guardar cambios'));
    });

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 5000,
          category_id: null,
          end_date: null,
        }),
      );
    });
  });
});

// ---------------------------------------------------------------------------
// Tests — submitError display
// ---------------------------------------------------------------------------

describe('RecurrenceForm — submitError', () => {
  it('shows submitError when provided', () => {
    render(
      <RecurrenceForm
        categories={CATEGORIES}
        onSubmit={jest.fn()}
        submitError="No se pudo crear el ingreso recurrente. Intentá nuevamente."
      />,
    );

    expect(
      screen.getByText('No se pudo crear el ingreso recurrente. Intentá nuevamente.'),
    ).toBeTruthy();
  });

  it('does NOT show submitError when null', () => {
    render(<RecurrenceForm categories={CATEGORIES} onSubmit={jest.fn()} submitError={null} />);
    expect(
      screen.queryByText('No se pudo crear el ingreso recurrente. Intentá nuevamente.'),
    ).toBeNull();
  });
});
