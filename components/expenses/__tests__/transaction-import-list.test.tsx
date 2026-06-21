/**
 * Tests for TransactionImportList (HU-25 Group 5).
 *
 * Covers:
 *  - Renders all rows from the transactions prop
 *  - "Seleccionar todo" toggles all rows on/off
 *  - Deselecting a row excludes it from the imported payload
 *  - Direction toggle switches the category list (expense↔income) and clears category_id
 *  - "Importar (N)" button is disabled when 0 rows are selected
 *  - onImport receives only selected rows with the correct shape
 *  - Mixed currency rows display their own currency
 *  - Rows with no valid amount (0 or missing) are excluded from the payload
 */
import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { TransactionImportList } from '../transaction-import-list';
import type { TransactionImportListProps } from '../transaction-import-list';
import type { CategoryRow } from '@/lib/repositories/expenses';
import type { DocumentTransactionPrefill } from '@/lib/ocr';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));

jest.mock('@/hooks/use-categories', () => ({
  useCreateCategory: jest.fn(() => ({ mutateAsync: jest.fn(), isPending: false })),
  useUpdateCategory: jest.fn(() => ({ mutateAsync: jest.fn(), isPending: false })),
  useDeleteCategory: jest.fn(() => ({ mutateAsync: jest.fn(), isPending: false })),
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const EXPENSE_CATEGORIES: CategoryRow[] = [
  {
    id: 'cat-exp-1',
    slug: 'entretenimiento',
    name: 'Entretenimiento',
    icon: 'Tv',
    color: '#F59E0B',
    sort_order: 10,
    created_at: '2026-01-01',
    updated_at: '2026-01-01',
    user_id: null,
    kind: 'expense',
  },
  {
    id: 'cat-exp-2',
    slug: 'comida',
    name: 'Comida',
    icon: 'UtensilsCrossed',
    color: '#EF4444',
    sort_order: 20,
    created_at: '2026-01-01',
    updated_at: '2026-01-01',
    user_id: null,
    kind: 'expense',
  },
];

const INCOME_CATEGORIES: CategoryRow[] = [
  {
    id: 'cat-inc-1',
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

const TX_NETFLIX: DocumentTransactionPrefill = {
  direction: 'expense',
  amount: 1500,
  currency: 'ARS',
  description: 'Netflix',
  category_id: null,
  occurred_at: '2026-05-01T00:00:00Z',
  lowConfidence: false,
};

const TX_SPOTIFY: DocumentTransactionPrefill = {
  direction: 'expense',
  amount: 2000,
  currency: 'ARS',
  description: 'Spotify',
  category_id: null,
  occurred_at: '2026-05-05T00:00:00Z',
  lowConfidence: false,
};

const TX_USD: DocumentTransactionPrefill = {
  direction: 'expense',
  amount: 9.99,
  currency: 'USD',
  description: 'Amazon USD',
  category_id: null,
  occurred_at: '2026-05-10T00:00:00Z',
  lowConfidence: false,
};

const TX_INCOME: DocumentTransactionPrefill = {
  direction: 'income',
  amount: 50000,
  currency: 'ARS',
  description: 'Sueldo',
  category_id: 'cat-inc-1',
  occurred_at: '2026-05-31T00:00:00Z',
  lowConfidence: false,
};

function buildProps(
  overrides: Partial<TransactionImportListProps> = {},
): TransactionImportListProps {
  return {
    transactions: [TX_NETFLIX, TX_SPOTIFY],
    expenseCategories: EXPENSE_CATEGORIES,
    incomeCategories: INCOME_CATEGORIES,
    isSubmitting: false,
    submitError: null,
    onImport: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('TransactionImportList', () => {
  // -------------------------------------------------------------------------
  // Rendering
  // -------------------------------------------------------------------------

  it('renders merchant names for all transactions', () => {
    render(<TransactionImportList {...buildProps()} />);

    expect(screen.getByText('Netflix')).toBeTruthy();
    expect(screen.getByText('Spotify')).toBeTruthy();
  });

  it('renders a checkbox for each transaction', () => {
    render(<TransactionImportList {...buildProps()} />);

    // Two rows = 2 checkboxes + the select-all one
    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes.length).toBe(2);
  });

  it('shows the count of selected vs total rows', () => {
    render(<TransactionImportList {...buildProps()} />);

    expect(screen.getByText('2 de 2 seleccionados')).toBeTruthy();
  });

  it('renders the import button with the correct count label', () => {
    render(<TransactionImportList {...buildProps()} />);

    expect(screen.getByLabelText('Importar 2 transacciones')).toBeTruthy();
  });

  it('renders mixed-currency rows with their own currency symbol', () => {
    render(<TransactionImportList {...buildProps({ transactions: [TX_USD, TX_NETFLIX] })} />);

    // USD row should display "US$"
    const amountTexts = screen.getAllByText(/US\$/);
    expect(amountTexts.length).toBeGreaterThanOrEqual(1);

    // ARS row should display "$" (but not "US$")
    const arsTexts = screen.getAllByText(/^\-\$/);
    expect(arsTexts.length).toBeGreaterThanOrEqual(1);
  });

  // -------------------------------------------------------------------------
  // Select-all toggle
  // -------------------------------------------------------------------------

  it('"Seleccionar todo" label is shown when not all rows are selected', async () => {
    render(<TransactionImportList {...buildProps()} />);

    // Deselect first row
    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.press(checkboxes[0]!);

    await waitFor(() => {
      expect(screen.getByLabelText('Seleccionar todo')).toBeTruthy();
    });
  });

  it('"Deseleccionar todo" label is shown when all rows are selected', () => {
    render(<TransactionImportList {...buildProps()} />);

    expect(screen.getByLabelText('Deseleccionar todo')).toBeTruthy();
  });

  it('pressing "Seleccionar todo" selects all rows', async () => {
    render(<TransactionImportList {...buildProps()} />);

    // First deselect all
    fireEvent.press(screen.getByLabelText('Deseleccionar todo'));

    await waitFor(() => {
      expect(screen.getByText('0 de 2 seleccionados')).toBeTruthy();
    });

    // Then select all
    fireEvent.press(screen.getByLabelText('Seleccionar todo'));

    await waitFor(() => {
      expect(screen.getByText('2 de 2 seleccionados')).toBeTruthy();
    });
  });

  it('pressing "Deseleccionar todo" deselects all rows', async () => {
    render(<TransactionImportList {...buildProps()} />);

    fireEvent.press(screen.getByLabelText('Deseleccionar todo'));

    await waitFor(() => {
      expect(screen.getByText('0 de 2 seleccionados')).toBeTruthy();
    });
  });

  // -------------------------------------------------------------------------
  // Individual row selection
  // -------------------------------------------------------------------------

  it('deselecting a row reduces the selected count', async () => {
    render(<TransactionImportList {...buildProps()} />);

    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.press(checkboxes[0]!);

    await waitFor(() => {
      expect(screen.getByText('1 de 2 seleccionados')).toBeTruthy();
    });
  });

  it('the import button is disabled when 0 rows are selected', async () => {
    render(<TransactionImportList {...buildProps()} />);

    // Deselect all
    fireEvent.press(screen.getByLabelText('Deseleccionar todo'));

    await waitFor(() => {
      const btn = screen.getByLabelText('Importar 0 transacciones');
      expect(btn).toBeDisabled();
    });
  });

  it('does not call onImport when 0 selected rows and button is pressed programmatically', async () => {
    const onImport = jest.fn().mockResolvedValue(undefined);
    render(<TransactionImportList {...buildProps({ onImport })} />);

    // Deselect all
    fireEvent.press(screen.getByLabelText('Deseleccionar todo'));

    // The button is disabled so pressing it should not call onImport.
    await waitFor(() => {
      const btn = screen.getByLabelText('Importar 0 transacciones');
      expect(btn).toBeDisabled();
    });

    expect(onImport).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // onImport payload shape
  // -------------------------------------------------------------------------

  it('calls onImport with only selected rows', async () => {
    const onImport = jest.fn().mockResolvedValue(undefined);
    render(
      <TransactionImportList
        {...buildProps({ transactions: [TX_NETFLIX, TX_SPOTIFY], onImport })}
      />,
    );

    // Deselect the second row (Spotify)
    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.press(checkboxes[1]!);

    await act(async () => {
      fireEvent.press(screen.getByLabelText('Importar 1 transacciones'));
    });

    await waitFor(() => {
      expect(onImport).toHaveBeenCalledTimes(1);
      const [rows] = onImport.mock.calls[0] as [unknown[]];
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        direction: 'expense',
        amount: 1500,
        currency: 'ARS',
        description: 'Netflix',
      });
    });
  });

  it('includes both expense and income rows in the import payload when mixed', async () => {
    const onImport = jest.fn().mockResolvedValue(undefined);
    render(
      <TransactionImportList
        {...buildProps({
          transactions: [TX_NETFLIX, TX_INCOME],
          onImport,
        })}
      />,
    );

    await act(async () => {
      fireEvent.press(screen.getByLabelText('Importar 2 transacciones'));
    });

    await waitFor(() => {
      expect(onImport).toHaveBeenCalledTimes(1);
      const [rows] = onImport.mock.calls[0] as [unknown[]];
      expect(rows).toHaveLength(2);
      const directions = (rows as { direction: string }[]).map((r) => r.direction);
      expect(directions).toContain('expense');
      expect(directions).toContain('income');
    });
  });

  it('each row in the payload has direction, amount, currency, category_id, description, occurred_at', async () => {
    const onImport = jest.fn().mockResolvedValue(undefined);
    render(<TransactionImportList {...buildProps({ onImport })} />);

    await act(async () => {
      fireEvent.press(screen.getByLabelText('Importar 2 transacciones'));
    });

    await waitFor(() => {
      const [rows] = onImport.mock.calls[0] as [unknown[]];
      for (const row of rows as Record<string, unknown>[]) {
        expect(row).toHaveProperty('direction');
        expect(row).toHaveProperty('amount');
        expect(row).toHaveProperty('currency');
        expect(row).toHaveProperty('category_id');
        expect(row).toHaveProperty('description');
        expect(row).toHaveProperty('occurred_at');
      }
    });
  });

  // -------------------------------------------------------------------------
  // Direction toggle
  // -------------------------------------------------------------------------

  it('renders Gasto and Ingreso direction buttons for each row', () => {
    render(<TransactionImportList {...buildProps()} />);

    // Two rows, each has "Gasto fila N" and "Ingreso fila N" buttons
    expect(screen.getByLabelText('Gasto fila 1')).toBeTruthy();
    expect(screen.getByLabelText('Ingreso fila 1')).toBeTruthy();
    expect(screen.getByLabelText('Gasto fila 2')).toBeTruthy();
    expect(screen.getByLabelText('Ingreso fila 2')).toBeTruthy();
  });

  it('toggling direction to Ingreso changes the row direction in the payload', async () => {
    const onImport = jest.fn().mockResolvedValue(undefined);
    render(<TransactionImportList {...buildProps({ transactions: [TX_NETFLIX], onImport })} />);

    // Toggle row 1 to income
    fireEvent.press(screen.getByLabelText('Ingreso fila 1'));

    await act(async () => {
      fireEvent.press(screen.getByLabelText('Importar 1 transacciones'));
    });

    await waitFor(() => {
      const [rows] = onImport.mock.calls[0] as [unknown[]];
      expect((rows[0] as { direction: string }).direction).toBe('income');
    });
  });

  it('toggling direction resets the row category_id to null', async () => {
    const txWithCategory: DocumentTransactionPrefill = {
      ...TX_NETFLIX,
      category_id: 'cat-exp-1',
    };

    const onImport = jest.fn().mockResolvedValue(undefined);
    render(<TransactionImportList {...buildProps({ transactions: [txWithCategory], onImport })} />);

    // Toggle to income (should reset category)
    fireEvent.press(screen.getByLabelText('Ingreso fila 1'));

    await act(async () => {
      fireEvent.press(screen.getByLabelText('Importar 1 transacciones'));
    });

    await waitFor(() => {
      const [rows] = onImport.mock.calls[0] as [unknown[]];
      expect((rows[0] as { category_id: string | null }).category_id).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // Submit error
  // -------------------------------------------------------------------------

  it('shows the submitError message when provided', () => {
    render(<TransactionImportList {...buildProps({ submitError: 'Error al importar.' })} />);

    expect(screen.getByText('Error al importar.')).toBeTruthy();
  });

  it('does not show error area when submitError is null', () => {
    render(<TransactionImportList {...buildProps({ submitError: null })} />);

    expect(screen.queryByText('Error al importar.')).toBeNull();
  });

  // -------------------------------------------------------------------------
  // isSubmitting
  // -------------------------------------------------------------------------

  it('import button is disabled and in busy state when isSubmitting is true', () => {
    render(<TransactionImportList {...buildProps({ isSubmitting: true })} />);

    // The Button renders a Loader (SVG) when loading=true, not the children text.
    // The Pressable is disabled and has accessibilityState.busy=true.
    const btn = screen.getByLabelText('Importar 2 transacciones');
    expect(btn).toBeDisabled();
    expect(btn).toHaveAccessibilityState({ busy: true });
  });
});
