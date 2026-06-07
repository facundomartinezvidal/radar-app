/**
 * Tests for ExpenseItemsField + ExpenseForm items integration.
 *
 * We test through ExpenseForm (renders ExpenseItemsField internally) to
 * exercise the real useFieldArray wiring without re-instantiating forms.
 *
 * Mocks:
 *  - @react-native-community/datetimepicker  (same as expense-form.test.tsx)
 *  - react-native-svg                         (global in jest.setup.ts)
 *  - @/lib/supabase                           (global in jest.setup.ts)
 */
import React from 'react';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react-native';

import { ExpenseForm } from '../expense-form';
import type { CategoryRow } from '@/lib/repositories/expenses';
import type { ExpenseItemInput } from '@/lib/schemas/expense';

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

const SAMPLE_ITEM_INPUT: ExpenseItemInput = {
  name: 'Medialunas',
  quantity: 4,
  unit_price: 250,
  line_total: 1000,
};

// Minimal ExpenseWithItems that satisfies the edit mode prop
function makeInitialWithItems(items: ExpenseItemInput[]) {
  return {
    id: 'exp-1',
    user_id: 'user-1',
    amount: items.reduce((s, i) => s + i.line_total, 0) || 1000,
    currency: 'ARS',
    category_id: 'cat-1',
    description: 'Test',
    occurred_at: '2026-06-01T12:00:00.000Z',
    created_at: '2026-06-01T12:00:00.000Z',
    updated_at: '2026-06-01T12:00:00.000Z',
    category: CATEGORIES[0] ?? null,
    items: items.map((item, idx) => ({
      id: item.id ?? `item-${idx}`,
      expense_id: 'exp-1',
      user_id: 'user-1',
      name: item.name,
      quantity: item.quantity,
      unit_price: item.unit_price,
      line_total: item.line_total,
      position: idx,
      created_at: '2026-06-01T12:00:00.000Z',
      updated_at: '2026-06-01T12:00:00.000Z',
    })),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ExpenseItemsField (via ExpenseForm)', () => {
  describe('initial render', () => {
    it('renders "Detalle" section collapsed by default when no items', () => {
      render(<ExpenseForm categories={CATEGORIES} onSubmit={jest.fn()} />);

      // Label is always rendered (it is the header)
      expect(screen.getByText('Detalle')).toBeTruthy();

      // No item input rows should be visible (collapsed)
      expect(screen.queryByPlaceholderText('Nombre del ítem')).toBeNull();
    });

    it('renders expanded with prefill items', () => {
      render(
        <ExpenseForm
          categories={CATEGORIES}
          prefill={{ items: [SAMPLE_ITEM_INPUT], amount: 1000 }}
          onSubmit={jest.fn()}
        />,
      );

      // Header shows item count
      expect(screen.getByText('Detalle · 1')).toBeTruthy();

      // Item name input visible
      expect(screen.getByDisplayValue('Medialunas')).toBeTruthy();
    });

    it('renders expanded in edit mode when initial has items', () => {
      const initial = makeInitialWithItems([SAMPLE_ITEM_INPUT]);
      render(<ExpenseForm categories={CATEGORIES} initial={initial} onSubmit={jest.fn()} />);

      expect(screen.getByText('Detalle · 1')).toBeTruthy();
      expect(screen.getByDisplayValue('Medialunas')).toBeTruthy();
    });
  });

  describe('collapsible toggle', () => {
    it('expands when header is pressed in collapsed state', async () => {
      render(<ExpenseForm categories={CATEGORIES} onSubmit={jest.fn()} />);

      // Collapsed initially
      expect(screen.queryByPlaceholderText('Nombre del ítem')).toBeNull();

      // Tap header to expand
      const header = screen.getByRole('button', { name: /Mostrar detalle de ítems/i });
      fireEvent.press(header);

      // "Agregar ítem" button should now be visible
      expect(screen.getByRole('button', { name: 'Agregar ítem' })).toBeTruthy();
    });

    it('collapses when header pressed twice', async () => {
      render(
        <ExpenseForm
          categories={CATEGORIES}
          prefill={{ items: [SAMPLE_ITEM_INPUT] }}
          onSubmit={jest.fn()}
        />,
      );

      // Starts expanded
      expect(screen.getByDisplayValue('Medialunas')).toBeTruthy();

      // Collapse
      const header = screen.getByRole('button', { name: /Ocultar detalle de ítems/i });
      fireEvent.press(header);

      expect(screen.queryByDisplayValue('Medialunas')).toBeNull();
    });
  });

  describe('"Agregar ítem" button', () => {
    function expandSection() {
      const header = screen.getByRole('button', { name: /Mostrar detalle de ítems/i });
      fireEvent.press(header);
    }

    it('appends an editable row', async () => {
      render(<ExpenseForm categories={CATEGORIES} onSubmit={jest.fn()} />);
      expandSection();

      const addBtn = screen.getByRole('button', { name: 'Agregar ítem' });
      fireEvent.press(addBtn);

      expect(screen.getAllByPlaceholderText('Nombre del ítem').length).toBe(1);
    });

    it('appends multiple rows', async () => {
      render(<ExpenseForm categories={CATEGORIES} onSubmit={jest.fn()} />);
      expandSection();

      const addBtn = screen.getByRole('button', { name: 'Agregar ítem' });
      fireEvent.press(addBtn);
      fireEvent.press(addBtn);

      expect(screen.getAllByPlaceholderText('Nombre del ítem').length).toBe(2);
    });
  });

  describe('removing a row', () => {
    it('deletes the row when remove button is pressed', async () => {
      render(
        <ExpenseForm
          categories={CATEGORIES}
          prefill={{ items: [SAMPLE_ITEM_INPUT] }}
          onSubmit={jest.fn()}
        />,
      );

      expect(screen.getByDisplayValue('Medialunas')).toBeTruthy();

      const removeBtn = screen.getByRole('button', { name: 'Quitar ítem' });
      fireEvent.press(removeBtn);

      expect(screen.queryByDisplayValue('Medialunas')).toBeNull();
    });

    it('removes the correct row when multiple exist', async () => {
      const items: ExpenseItemInput[] = [
        { name: 'Café', quantity: 1, unit_price: 500, line_total: 500 },
        { name: 'Medialunas', quantity: 4, unit_price: 250, line_total: 1000 },
      ];
      render(
        <ExpenseForm
          categories={CATEGORIES}
          prefill={{ items, amount: 1500 }}
          onSubmit={jest.fn()}
        />,
      );

      // Remove the first item (Café)
      const removeBtns = screen.getAllByRole('button', { name: 'Quitar ítem' });
      fireEvent.press(removeBtns[0]);

      expect(screen.queryByDisplayValue('Café')).toBeNull();
      expect(screen.getByDisplayValue('Medialunas')).toBeTruthy();
    });
  });

  describe('recompute line_total', () => {
    it('recomputes line_total when quantity is changed with unit_price set', async () => {
      render(
        <ExpenseForm
          categories={CATEGORIES}
          prefill={{ items: [{ name: 'Café', quantity: 2, unit_price: 300, line_total: 600 }] }}
          onSubmit={jest.fn()}
        />,
      );

      // Change quantity from 2 to 3; unit_price is 300 → line_total should become 900
      const qtyInput = screen.getByLabelText('Cantidad del ítem 1');
      fireEvent.changeText(qtyInput, '3');

      await waitFor(() => {
        const totalInput = screen.getByLabelText('Total del ítem 1');
        expect(totalInput.props.value).toBe('900');
      });
    });

    it('recomputes line_total when unit_price is changed with quantity set', async () => {
      render(
        <ExpenseForm
          categories={CATEGORIES}
          prefill={{ items: [{ name: 'Café', quantity: 2, unit_price: 300, line_total: 600 }] }}
          onSubmit={jest.fn()}
        />,
      );

      const priceInput = screen.getByLabelText('Precio unitario del ítem 1');
      fireEvent.changeText(priceInput, '400');

      await waitFor(() => {
        const totalInput = screen.getByLabelText('Total del ítem 1');
        expect(totalInput.props.value).toBe('800');
      });
    });
  });

  describe('sum mismatch warning', () => {
    it('shows mismatch warning when sum of items differs from amount by > 0.5', async () => {
      // Items sum = 500, form amount = 1500 → diff = 1000 > 0.5
      render(
        <ExpenseForm
          categories={CATEGORIES}
          prefill={{
            amount: 1500,
            items: [{ name: 'Café', quantity: 1, unit_price: 500, line_total: 500 }],
          }}
          onSubmit={jest.fn()}
        />,
      );

      await waitFor(() => {
        expect(screen.getByText(/no coincide con el total/i)).toBeTruthy();
      });
    });

    it('hides mismatch warning when sum matches amount within tolerance', async () => {
      // Items sum = 1500, form amount = 1500 → diff = 0
      render(
        <ExpenseForm
          categories={CATEGORIES}
          prefill={{
            amount: 1500,
            items: [{ name: 'Café', quantity: 1, unit_price: 1500, line_total: 1500 }],
          }}
          onSubmit={jest.fn()}
        />,
      );

      await waitFor(() => {
        expect(screen.queryByText(/no coincide con el total/i)).toBeNull();
      });
    });

    it('hides mismatch warning when there are no items', async () => {
      render(<ExpenseForm categories={CATEGORIES} onSubmit={jest.fn()} />);

      expect(screen.queryByText(/no coincide con el total/i)).toBeNull();
    });
  });

  describe('prefill items row count', () => {
    it('renders the correct number of rows from prefill', () => {
      const items: ExpenseItemInput[] = [
        { name: 'Café', quantity: 1, unit_price: 500, line_total: 500 },
        { name: 'Medialunas', quantity: 4, unit_price: 250, line_total: 1000 },
        { name: 'Jugo', quantity: 1, unit_price: 400, line_total: 400 },
      ];
      render(
        <ExpenseForm
          categories={CATEGORIES}
          prefill={{ items, amount: 1900 }}
          onSubmit={jest.fn()}
        />,
      );

      // Header shows count
      expect(screen.getByText('Detalle · 3')).toBeTruthy();

      // Three name inputs
      expect(screen.getAllByPlaceholderText('Nombre del ítem').length).toBe(3);
    });
  });

  describe('Controller-based input stability (focus fix)', () => {
    it('updates name field value through Controller onChange without remount', async () => {
      const onSubmit = jest.fn();
      render(
        <ExpenseForm
          categories={CATEGORIES}
          prefill={{ items: [{ name: 'Café', quantity: 1, unit_price: 500, line_total: 500 }] }}
          onSubmit={onSubmit}
          submitLabel="Registrar gasto"
        />,
      );

      const nameInput = screen.getByLabelText('Nombre del ítem 1');

      // Simulate typing keystroke-by-keystroke — value should accumulate, no remount
      fireEvent.changeText(nameInput, 'C');
      fireEvent.changeText(nameInput, 'Ca');
      fireEvent.changeText(nameInput, 'Café nuevo');

      // Input should hold the latest value (not reset after each keystroke)
      expect(nameInput.props.value).toBe('Café nuevo');
    });

    it('does not show validation error mid-typing (only after blur/submit)', async () => {
      render(
        <ExpenseForm
          categories={CATEGORIES}
          prefill={{ items: [{ name: 'Café', quantity: 1, unit_price: 500, line_total: 500 }] }}
          onSubmit={jest.fn()}
        />,
      );

      const nameInput = screen.getByLabelText('Nombre del ítem 1');

      // Clear the name (make it invalid) by typing empty — but no blur yet
      fireEvent.changeText(nameInput, '');

      // Error should NOT appear mid-typing (validation deferred to blur/submit)
      // We check that no 'name' error text appears in the visible output
      expect(screen.queryByText(/nombre/i)).toBeNull();
    });

    it('still recomputes line_total through Controller when quantity changes', async () => {
      render(
        <ExpenseForm
          categories={CATEGORIES}
          prefill={{ items: [{ name: 'Café', quantity: 2, unit_price: 300, line_total: 600 }] }}
          onSubmit={jest.fn()}
        />,
      );

      const qtyInput = screen.getByLabelText('Cantidad del ítem 1');
      fireEvent.changeText(qtyInput, '5');

      await waitFor(() => {
        const totalInput = screen.getByLabelText('Total del ítem 1');
        expect(totalInput.props.value).toBe('1500');
      });

      // Quantity input should still hold the entered value — re-query after waitFor
      // to get a fresh reference (RNTL refs can go stale after async re-renders).
      expect(screen.getByLabelText('Cantidad del ítem 1').props.value).toBe('5');
    });

    it('includes updated name in submit payload after Controller typing', async () => {
      const onSubmit = jest.fn();
      render(
        <ExpenseForm
          categories={CATEGORIES}
          prefill={{
            amount: 500,
            currency: 'ARS',
            items: [{ name: 'Café', quantity: 1, unit_price: 500, line_total: 500 }],
          }}
          onSubmit={onSubmit}
          submitLabel="Registrar gasto"
        />,
      );

      const nameInput = screen.getByLabelText('Nombre del ítem 1');
      fireEvent.changeText(nameInput, 'Medialunas');

      const submitBtn = screen.getByRole('button', { name: 'Registrar gasto' });
      await act(async () => {
        fireEvent.press(submitBtn);
      });

      await waitFor(() => {
        expect(onSubmit).toHaveBeenCalled();
      });

      const payload = onSubmit.mock.calls[0][0] as { items?: ExpenseItemInput[] };
      expect(payload.items?.[0]?.name).toBe('Medialunas');
    });
  });

  describe('submit payload', () => {
    it('includes items array when submitting with a valid item', async () => {
      const onSubmit = jest.fn();
      render(
        <ExpenseForm
          categories={CATEGORIES}
          prefill={{
            amount: 500,
            currency: 'ARS',
            items: [{ name: 'Café', quantity: 1, unit_price: 500, line_total: 500 }],
          }}
          onSubmit={onSubmit}
          submitLabel="Registrar gasto"
        />,
      );

      const submitBtn = screen.getByRole('button', { name: 'Registrar gasto' });
      await act(async () => {
        fireEvent.press(submitBtn);
      });

      await waitFor(() => {
        expect(onSubmit).toHaveBeenCalled();
      });

      const payload = onSubmit.mock.calls[0][0] as {
        items?: ExpenseItemInput[];
        amount: number;
      };
      expect(payload.items).toBeDefined();
      expect(Array.isArray(payload.items)).toBe(true);
      expect(payload.items?.length).toBe(1);
      expect(payload.items?.[0]?.name).toBe('Café');
    });

    it('includes empty items array when no items are added', async () => {
      const onSubmit = jest.fn();
      render(
        <ExpenseForm
          categories={CATEGORIES}
          prefill={{ amount: 500, currency: 'ARS' }}
          onSubmit={onSubmit}
          submitLabel="Registrar gasto"
        />,
      );

      const submitBtn = screen.getByRole('button', { name: 'Registrar gasto' });
      await act(async () => {
        fireEvent.press(submitBtn);
      });

      await waitFor(() => {
        expect(onSubmit).toHaveBeenCalled();
      });

      const payload = onSubmit.mock.calls[0][0] as { items?: ExpenseItemInput[] };
      expect(Array.isArray(payload.items)).toBe(true);
      expect(payload.items?.length).toBe(0);
    });
  });
});
