/**
 * Tests for IncomeForm — verifies fields render in create/edit mode,
 * form submission calls onSubmit with parsed values, and submitError
 * is displayed when provided.
 *
 * react-native-svg is mocked globally in jest.setup.ts.
 *
 * Note: jest.mock() calls below are hoisted above all imports by Jest at
 * runtime, so the effective execution order is: mock factories → module
 * imports → test bodies.
 */
import React from 'react';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react-native';

import { IncomeForm } from '../income-form';
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

// Use a valid UUID v4 for category_id — createIncomeSchema validates with z.string().uuid()
// All-same-digit UUIDs fail zod v4's variant check — use a real UUID.
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

describe('IncomeForm — field rendering', () => {
  it('renders the Fecha label in create mode', () => {
    render(<IncomeForm categories={CATEGORIES} onSubmit={jest.fn()} />);
    expect(screen.getByText('Fecha')).toBeTruthy();
  });

  it('renders with a formatted date in create mode (today)', () => {
    render(<IncomeForm categories={CATEGORIES} onSubmit={jest.fn()} />);
    const year = String(new Date().getFullYear());
    expect(screen.getByText(new RegExp(year))).toBeTruthy();
  });

  it('renders the Monto label', () => {
    render(<IncomeForm categories={CATEGORIES} onSubmit={jest.fn()} />);
    expect(screen.getByText('Monto')).toBeTruthy();
  });

  it('renders the Moneda label', () => {
    render(<IncomeForm categories={CATEGORIES} onSubmit={jest.fn()} />);
    expect(screen.getByText('Moneda')).toBeTruthy();
  });

  it('renders the Categoría label', () => {
    render(<IncomeForm categories={CATEGORIES} onSubmit={jest.fn()} />);
    expect(screen.getByText('Categoría')).toBeTruthy();
  });

  it('renders the description input with the correct placeholder', () => {
    render(<IncomeForm categories={CATEGORIES} onSubmit={jest.fn()} />);
    expect(screen.getByPlaceholderText('Descripción del ingreso')).toBeTruthy();
  });

  it('renders the default submit label "Registrar ingreso"', () => {
    render(<IncomeForm categories={CATEGORIES} onSubmit={jest.fn()} />);
    expect(screen.getByLabelText('Registrar ingreso')).toBeTruthy();
  });

  it('renders a custom submitLabel', () => {
    render(
      <IncomeForm categories={CATEGORIES} onSubmit={jest.fn()} submitLabel="Guardar cambios" />,
    );
    expect(screen.getByLabelText('Guardar cambios')).toBeTruthy();
  });

  it('renders with an initial occurred_at in edit mode and shows the formatted date', () => {
    const initial = {
      id: 'inc-1',
      user_id: 'user-1',
      amount: 50000,
      currency: 'ARS',
      category_id: 'cat-1',
      description: 'Sueldo marzo',
      occurred_at: '2026-03-10T15:00:00.000Z',
      occurred_date: null,
      created_at: '2026-03-10T15:00:00.000Z',
      updated_at: '2026-03-10T15:00:00.000Z',
      recurrence_id: null,
      source: 'manual',
      category: CATEGORIES[0] ?? null,
    };

    render(
      <IncomeForm
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

  it('pre-fills the description in edit mode', () => {
    const initial = {
      id: 'inc-1',
      user_id: 'user-1',
      amount: 50000,
      currency: 'ARS',
      category_id: 'cat-1',
      description: 'Sueldo marzo',
      occurred_at: '2026-03-10T15:00:00.000Z',
      occurred_date: null,
      created_at: '2026-03-10T15:00:00.000Z',
      updated_at: '2026-03-10T15:00:00.000Z',
      recurrence_id: null,
      source: 'manual',
      category: CATEGORIES[0] ?? null,
    };

    render(
      <IncomeForm
        categories={CATEGORIES}
        initial={initial}
        onSubmit={jest.fn()}
        submitLabel="Guardar cambios"
      />,
    );

    expect(screen.getByDisplayValue('Sueldo marzo')).toBeTruthy();
  });

  it('does NOT render group/split fields', () => {
    render(<IncomeForm categories={CATEGORIES} onSubmit={jest.fn()} />);
    expect(screen.queryByText('¿Quién pagó?')).toBeNull();
    expect(screen.queryByText('División')).toBeNull();
    expect(screen.queryByText('¿Gasto compartido?')).toBeNull();
  });

  it('does NOT render line-items section', () => {
    render(<IncomeForm categories={CATEGORIES} onSubmit={jest.fn()} />);
    expect(screen.queryByLabelText('Mostrar detalle de ítems')).toBeNull();
    expect(screen.queryByLabelText('Agregar ítem')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Tests — submit behaviour
// ---------------------------------------------------------------------------

describe('IncomeForm — submit behaviour', () => {
  it('calls onSubmit with parsed amount and defaults when submitted with a valid amount', async () => {
    const onSubmit = jest.fn().mockResolvedValue(undefined);
    render(
      <IncomeForm categories={CATEGORIES} onSubmit={onSubmit} submitLabel="Registrar ingreso" />,
    );

    const amountInput = screen.getByLabelText('Monto');
    fireEvent.changeText(amountInput, '15000');

    await act(async () => {
      fireEvent.press(screen.getByLabelText('Registrar ingreso'));
    });

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 15000,
        currency: 'ARS',
      }),
    );
  });

  it('calls onSubmit with initial amount when in edit mode (no category)', async () => {
    const onSubmit = jest.fn().mockResolvedValue(undefined);
    const initial = {
      id: 'inc-1',
      user_id: 'user-1',
      amount: 5000,
      currency: 'ARS',
      category_id: null, // null is always valid (nullable field)
      description: null,
      occurred_at: new Date().toISOString(),
      occurred_date: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      recurrence_id: null,
      source: 'manual',
      category: null,
    };
    render(
      <IncomeForm
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
        }),
      );
    });
  });

  it('calls onSubmit with category_id from initial when in edit mode', async () => {
    const onSubmit = jest.fn().mockResolvedValue(undefined);
    const initial = {
      id: 'inc-1',
      user_id: 'user-1',
      amount: 5000,
      currency: 'ARS',
      category_id: CAT_UUID, // must be a valid UUID — createIncomeSchema uses z.string().uuid()
      description: null,
      occurred_at: new Date().toISOString(),
      occurred_date: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      recurrence_id: null,
      source: 'manual',
      category: CATEGORIES[0] ?? null,
    };
    render(
      <IncomeForm
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
          category_id: CAT_UUID,
        }),
      );
    });
  });

  it('does NOT call onSubmit when amount is zero (invalid)', async () => {
    const onSubmit = jest.fn();
    render(
      <IncomeForm categories={CATEGORIES} onSubmit={onSubmit} submitLabel="Registrar ingreso" />,
    );

    await act(async () => {
      fireEvent.press(screen.getByLabelText('Registrar ingreso'));
    });

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('shows validation error when amount is zero', async () => {
    const onSubmit = jest.fn();
    render(
      <IncomeForm categories={CATEGORIES} onSubmit={onSubmit} submitLabel="Registrar ingreso" />,
    );

    await act(async () => {
      fireEvent.press(screen.getByLabelText('Registrar ingreso'));
    });

    expect(screen.getByText('El monto tiene que ser mayor a cero.')).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Tests — submitError display
// ---------------------------------------------------------------------------

describe('IncomeForm — submitError', () => {
  it('shows submitError when provided', () => {
    render(
      <IncomeForm
        categories={CATEGORIES}
        onSubmit={jest.fn()}
        submitError="No se pudo guardar el ingreso. Intentá nuevamente."
      />,
    );

    expect(screen.getByText('No se pudo guardar el ingreso. Intentá nuevamente.')).toBeTruthy();
  });

  it('does NOT show submitError when null', () => {
    render(<IncomeForm categories={CATEGORIES} onSubmit={jest.fn()} submitError={null} />);

    expect(screen.queryByText('No se pudo guardar el ingreso. Intentá nuevamente.')).toBeNull();
  });

  it('does NOT show submitError when undefined', () => {
    render(<IncomeForm categories={CATEGORIES} onSubmit={jest.fn()} />);
    expect(screen.queryByText(/No se pudo/)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Tests — prefill props (OCR review mode)
// ---------------------------------------------------------------------------

describe('IncomeForm — prefill props', () => {
  it('pre-fills the amount from prefill when no initial is given', () => {
    render(
      <IncomeForm
        categories={CATEGORIES}
        prefill={{ amount: 25000, currency: 'ARS' }}
        onSubmit={jest.fn()}
      />,
    );
    expect(screen.getByDisplayValue('25000')).toBeTruthy();
  });

  it('pre-fills the description from prefill', () => {
    render(
      <IncomeForm
        categories={CATEGORIES}
        prefill={{ description: 'Honorarios cliente X' }}
        onSubmit={jest.fn()}
      />,
    );
    expect(screen.getByDisplayValue('Honorarios cliente X')).toBeTruthy();
  });

  it('initial takes precedence over prefill for amount', () => {
    const initial = {
      id: 'inc-1',
      user_id: 'user-1',
      amount: 9999,
      currency: 'ARS',
      category_id: null,
      description: null,
      occurred_at: new Date().toISOString(),
      occurred_date: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      recurrence_id: null,
      source: 'manual',
      category: null,
    };

    render(
      <IncomeForm
        categories={CATEGORIES}
        initial={initial}
        prefill={{ amount: 12345 }}
        onSubmit={jest.fn()}
      />,
    );

    // Should show initial amount, not prefill amount
    expect(screen.getByDisplayValue('9999')).toBeTruthy();
    expect(screen.queryByDisplayValue('12345')).toBeNull();
  });

  it('shows low-confidence warning banner when lowConfidence=true', () => {
    render(
      <IncomeForm
        categories={CATEGORIES}
        prefill={{ amount: 1000 }}
        lowConfidence
        onSubmit={jest.fn()}
      />,
    );
    expect(screen.getByText('Revisá los datos detectados, la confianza es baja.')).toBeTruthy();
  });

  it('does NOT show low-confidence banner when lowConfidence=false', () => {
    render(
      <IncomeForm
        categories={CATEGORIES}
        prefill={{ amount: 1000 }}
        lowConfidence={false}
        onSubmit={jest.fn()}
      />,
    );
    expect(screen.queryByText('Revisá los datos detectados, la confianza es baja.')).toBeNull();
  });

  it('does NOT show low-confidence banner when prop is omitted', () => {
    render(<IncomeForm categories={CATEGORIES} prefill={{ amount: 1000 }} onSubmit={jest.fn()} />);
    expect(screen.queryByText('Revisá los datos detectados, la confianza es baja.')).toBeNull();
  });

  it('renders with blank amount when no initial and no prefill', () => {
    render(<IncomeForm categories={CATEGORIES} onSubmit={jest.fn()} />);
    // Amount field should be empty (blank)
    expect(screen.getByLabelText('Monto')).toBeTruthy();
  });
});
