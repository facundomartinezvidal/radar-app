/**
 * Tests for the receipt-review screen (HU-06).
 *
 * Covers:
 *  - Loading state shows "Analizando ticket…"
 *  - OCR success renders the form with prefilled amount
 *  - OCR error (timeout) shows manual notice + Reintentar button
 *  - OCR error (non-retryable) shows manual notice without Reintentar
 *  - Missing imageUri shows defensive manual notice
 *  - Successful save calls createExpense then router.replace
 *  - Submit error shows the error message
 */
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { router } from 'expo-router';
import type { OcrResult } from '@/lib/schemas/ocr';
import type { CategoryRow } from '@/lib/repositories/expenses';
import { OcrError } from '@/lib/ocr';
import * as repo from '@/lib/repositories/expenses';
import * as imageLib from '@/lib/image';

// ---------------------------------------------------------------------------
// Mocks (hoisted by Jest before imports)
// ---------------------------------------------------------------------------

jest.mock('@react-native-community/datetimepicker', () => {
  const ReactLib = require('react');
  const { View } = require('react-native');
  const Mock = () => ReactLib.createElement(View, { testID: 'mock-datetimepicker' });
  Mock.displayName = 'MockDateTimePicker';
  return { __esModule: true, default: Mock };
});

jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));

// expo-router: override useLocalSearchParams per test via the mutable ref below
const mockImageUri = { current: 'file://x.jpg' };

jest.mock('expo-router', () => ({
  Link: ({ children }: { children: React.ReactNode }) => children,
  Redirect: () => null,
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() },
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
  useLocalSearchParams: () => ({ imageUri: mockImageUri.current }),
  Stack: { Screen: () => null },
}));

// expo-image: render a plain View with testID
jest.mock('expo-image', () => {
  const ReactLib = require('react');
  const { View } = require('react-native');
  const Image = (props: { accessibilityLabel?: string; [key: string]: unknown }) =>
    ReactLib.createElement(View, { testID: 'receipt-thumbnail', ...props });
  Image.displayName = 'ExpoImage';
  return { Image };
});

// expo-linear-gradient: render a plain View
jest.mock('expo-linear-gradient', () => {
  const ReactLib = require('react');
  const { View } = require('react-native');
  const LinearGradient = (props: Record<string, unknown>) =>
    ReactLib.createElement(View, { testID: 'linear-gradient', ...props });
  LinearGradient.displayName = 'LinearGradient';
  return { LinearGradient };
});

// lib/image: compressForOcr resolves immediately
jest.mock('@/lib/image', () => ({
  compressForOcr: jest.fn().mockResolvedValue({
    base64: 'base64data',
    mimeType: 'image/jpeg',
  }),
}));

// use-extract-receipt: controlled per-test via mockExtract
const mockExtract = {
  mutate: jest.fn(),
  reset: jest.fn(),
  isPending: false,
  data: undefined as OcrResult | undefined,
  error: null as Error | null,
};

jest.mock('@/hooks/use-extract-receipt', () => ({
  useExtractReceipt: () => mockExtract,
}));

// lib/repositories/expenses: controlled via mockedRepo
jest.mock('@/lib/repositories/expenses');

const mockedRepo = repo as jest.Mocked<typeof repo>;

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

const OCR_RESULT_WITH_DATA: OcrResult = {
  amount: 1500,
  currency: 'ARS',
  merchant: "McDonald's",
  categoryHint: 'comida',
  occurredAt: '2026-05-31',
  suggestedNewCategory: null,
  confidence: 0.9,
  items: [],
};

const OCR_RESULT_EMPTY: OcrResult = {
  amount: null,
  currency: null,
  merchant: null,
  categoryHint: null,
  occurredAt: null,
  suggestedNewCategory: null,
  confidence: 0.3,
  items: [],
};

/** OCR result that returns line items alongside the standard fields. */
const OCR_RESULT_WITH_ITEMS: OcrResult = {
  amount: 2000,
  currency: 'ARS',
  merchant: 'Supermercado Norte',
  categoryHint: 'comida',
  occurredAt: '2026-05-31',
  suggestedNewCategory: null,
  confidence: 0.85,
  items: [
    { name: 'Leche entera', quantity: 2, unitPrice: 500, lineTotal: 1000 },
    { name: 'Pan lactal', quantity: 1, unitPrice: 1000, lineTotal: 1000 },
  ],
};

/**
 * OCR result with items but NO scalar fields (amount / currency / etc. all null).
 * Exercises the `hasOcrData` path that used to drop items before the fix.
 */
const OCR_RESULT_ITEMS_ONLY: OcrResult = {
  amount: null,
  currency: null,
  merchant: null,
  categoryHint: null,
  occurredAt: null,
  suggestedNewCategory: null,
  confidence: 0.6,
  items: [{ name: 'Producto', quantity: 1, unitPrice: 200, lineTotal: 200 }],
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderWithProviders(): { client: QueryClient } {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  // Lazy require so mocks are fully registered before the module resolves.
  const ReviewScreen = require('../review').default as React.ComponentType;
  render(
    <QueryClientProvider client={client}>
      <ReviewScreen />
    </QueryClientProvider>,
  );
  return { client };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ReviewScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockImageUri.current = 'file://x.jpg';

    // Reset extract mock to pending state
    mockExtract.mutate = jest.fn();
    mockExtract.reset = jest.fn();
    mockExtract.isPending = true;
    mockExtract.data = undefined;
    mockExtract.error = null;

    mockedRepo.listCategories.mockResolvedValue({ data: CATEGORIES, error: null });
  });

  // -------------------------------------------------------------------------
  // Loading state
  // -------------------------------------------------------------------------

  it('shows the scan overlay with label "Analizando ticket" while OCR is pending', async () => {
    renderWithProviders();

    await waitFor(() => {
      // ScanOverlay container carries the accessibilityLabel
      expect(screen.getByLabelText('Analizando ticket')).toBeTruthy();
    });
  });

  it('shows the first ScanStatus message while OCR is pending', async () => {
    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByText('Leyendo el ticket…')).toBeTruthy();
    });
  });

  it('renders the receipt thumbnail when imageUri is present', async () => {
    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByTestId('receipt-thumbnail')).toBeTruthy();
    });
  });

  // -------------------------------------------------------------------------
  // OCR success — prefilled form
  // -------------------------------------------------------------------------

  it('renders the form prefilled with detected amount after OCR success', async () => {
    // Simulate OCR completing successfully
    mockExtract.isPending = false;
    mockExtract.data = OCR_RESULT_WITH_DATA;
    mockExtract.error = null;

    renderWithProviders();

    await waitFor(() => {
      // The amount field should show the detected value ("1500")
      expect(screen.getByDisplayValue('1500')).toBeTruthy();
    });
  });

  it('shows the low-confidence notice when confidence < 0.5', async () => {
    mockExtract.isPending = false;
    mockExtract.data = {
      ...OCR_RESULT_WITH_DATA,
      confidence: 0.3,
    };
    mockExtract.error = null;

    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByText('Revisá los datos detectados antes de guardar.')).toBeTruthy();
    });
  });

  it('does NOT show the low-confidence notice when confidence >= 0.5', async () => {
    mockExtract.isPending = false;
    mockExtract.data = OCR_RESULT_WITH_DATA; // confidence 0.9
    mockExtract.error = null;

    renderWithProviders();

    await waitFor(() => {
      expect(screen.queryByText('Revisá los datos detectados antes de guardar.')).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // OCR error — retryable
  // -------------------------------------------------------------------------

  it('shows manual notice and Reintentar button on OCR_TIMEOUT error', async () => {
    mockExtract.isPending = false;
    mockExtract.data = undefined;
    mockExtract.error = new OcrError('OCR_TIMEOUT', 'timeout');

    renderWithProviders();

    await waitFor(() => {
      expect(
        screen.getByText('No se pudo analizar el ticket. Ingresá los datos manualmente.'),
      ).toBeTruthy();
      expect(screen.getByText('Reintentar')).toBeTruthy();
    });
  });

  it('shows manual notice and Reintentar button on NETWORK_ERROR', async () => {
    mockExtract.isPending = false;
    mockExtract.data = undefined;
    mockExtract.error = new OcrError('NETWORK_ERROR', 'network error');

    renderWithProviders();

    await waitFor(() => {
      expect(
        screen.getByText('No se pudo analizar el ticket. Ingresá los datos manualmente.'),
      ).toBeTruthy();
      expect(screen.getByText('Reintentar')).toBeTruthy();
    });
  });

  it('still renders the expense form after a retryable OCR error', async () => {
    mockExtract.isPending = false;
    mockExtract.data = undefined;
    mockExtract.error = new OcrError('OCR_TIMEOUT', 'timeout');

    renderWithProviders();

    await waitFor(() => {
      // The form submit button should be visible
      expect(screen.getByText('Registrar gasto')).toBeTruthy();
    });
  });

  // -------------------------------------------------------------------------
  // OCR error — non-retryable
  // -------------------------------------------------------------------------

  it('shows manual notice WITHOUT Reintentar for non-retryable error codes', async () => {
    mockExtract.isPending = false;
    mockExtract.data = undefined;
    mockExtract.error = new OcrError('PARSE_ERROR', 'parse error');

    renderWithProviders();

    await waitFor(() => {
      expect(
        screen.getByText('No se pudo analizar el ticket. Ingresá los datos manualmente.'),
      ).toBeTruthy();
      expect(screen.queryByText('Reintentar')).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // No OCR data (empty result)
  // -------------------------------------------------------------------------

  it('shows "No se detectaron datos" notice when OCR returns empty fields', async () => {
    mockExtract.isPending = false;
    mockExtract.data = OCR_RESULT_EMPTY;
    mockExtract.error = null;

    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByText('No se detectaron datos. Completá manualmente.')).toBeTruthy();
    });
  });

  // -------------------------------------------------------------------------
  // Missing imageUri — defensive fallback
  // -------------------------------------------------------------------------

  it('shows defensive manual notice when imageUri is missing', async () => {
    mockImageUri.current = undefined as unknown as string;
    mockExtract.isPending = false;

    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByText('No se detectaron datos. Completá manualmente.')).toBeTruthy();
    });
  });

  // -------------------------------------------------------------------------
  // Happy-path submit
  // -------------------------------------------------------------------------

  it('calls createExpense and then router.replace on successful save', async () => {
    mockExtract.isPending = false;
    mockExtract.data = OCR_RESULT_WITH_DATA;
    mockExtract.error = null;

    mockedRepo.createExpense.mockResolvedValueOnce({
      data: { id: 'exp-new', items: [] } as unknown as repo.ExpenseWithItems,
      error: null,
    });

    renderWithProviders();

    // Wait for the form to appear with prefilled amount
    await waitFor(() => {
      expect(screen.getByDisplayValue('1500')).toBeTruthy();
    });

    // category_id is already prefilled via OCR → mapOcrToPrefill → 'cat-1'.
    // Do NOT press the category chip — pressing it would deselect (toggle off).
    // Submit directly.
    await act(async () => {
      fireEvent.press(screen.getByLabelText('Registrar gasto'));
    });

    await waitFor(() => {
      expect(mockedRepo.createExpense).toHaveBeenCalledWith(
        expect.objectContaining({ amount: 1500, currency: 'ARS' }),
      );
    });

    expect(router.replace).toHaveBeenCalledWith('/(protected)/(tabs)');
  });

  // -------------------------------------------------------------------------
  // Submit error
  // -------------------------------------------------------------------------

  it('shows submit error message when createExpense fails', async () => {
    mockExtract.isPending = false;
    mockExtract.data = OCR_RESULT_WITH_DATA;
    mockExtract.error = null;

    mockedRepo.createExpense.mockResolvedValueOnce({
      data: null,
      error: new Error('No se pudo guardar el gasto.'),
    });

    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByDisplayValue('1500')).toBeTruthy();
    });

    // category_id is already prefilled via OCR → no need to select.
    await act(async () => {
      fireEvent.press(screen.getByLabelText('Registrar gasto'));
    });

    await waitFor(() => {
      expect(screen.getByText('No se pudo guardar el gasto.')).toBeTruthy();
    });
  });

  // -------------------------------------------------------------------------
  // HU-18: OCR result with line items — items must survive to the form
  // -------------------------------------------------------------------------

  it('renders item names when OCR detects line items', async () => {
    mockExtract.isPending = false;
    mockExtract.data = OCR_RESULT_WITH_ITEMS;
    mockExtract.error = null;

    renderWithProviders();

    // The detail section starts expanded when items are present.
    // Item names must be visible.
    await waitFor(() => {
      expect(screen.getByDisplayValue('Leche entera')).toBeTruthy();
      expect(screen.getByDisplayValue('Pan lactal')).toBeTruthy();
    });
  });

  it('passes items to createExpense when submitting an OCR-prefilled form', async () => {
    mockExtract.isPending = false;
    mockExtract.data = OCR_RESULT_WITH_ITEMS;
    mockExtract.error = null;

    mockedRepo.createExpense.mockResolvedValueOnce({
      data: { id: 'exp-items', items: [] } as unknown as repo.ExpenseWithItems,
      error: null,
    });

    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByDisplayValue('2000')).toBeTruthy();
    });

    await act(async () => {
      fireEvent.press(screen.getByLabelText('Registrar gasto'));
    });

    await waitFor(() => {
      expect(mockedRepo.createExpense).toHaveBeenCalledWith(
        expect.objectContaining({
          items: expect.arrayContaining([
            expect.objectContaining({ name: 'Leche entera', quantity: 2, line_total: 1000 }),
            expect.objectContaining({ name: 'Pan lactal', quantity: 1, line_total: 1000 }),
          ]),
        }),
      );
    });
  });

  it('shows prefilled form (not "no data" notice) when OCR returns only items and no scalar fields', async () => {
    mockExtract.isPending = false;
    mockExtract.data = OCR_RESULT_ITEMS_ONLY;
    mockExtract.error = null;

    renderWithProviders();

    // Wait for the item row to be visible — the items section expands automatically
    // when pre-populated. This also proves we didn't fall into the "no data" branch.
    await waitFor(() => {
      expect(screen.getByDisplayValue('Producto')).toBeTruthy();
    });

    // Confirm the "no data" notice is absent.
    expect(screen.queryByText('No se detectaron datos. Completá manualmente.')).toBeNull();
  });

  // -------------------------------------------------------------------------
  // Fix 2: compression failure → manual notice + Reintentar + form (not blank)
  // -------------------------------------------------------------------------

  it('shows manual notice + Reintentar + form when compressForOcr rejects', async () => {
    // Make compression fail for this test.
    (imageLib.compressForOcr as jest.Mock).mockRejectedValueOnce(new Error('compression failed'));

    // OCR mutation stays idle (never mutated because compression failed).
    mockExtract.isPending = false;
    mockExtract.data = undefined;
    mockExtract.error = null;

    renderWithProviders();

    await waitFor(() => {
      // The manual notice must be visible.
      expect(
        screen.getByText('No se pudo analizar el ticket. Ingresá los datos manualmente.'),
      ).toBeTruthy();
    });

    // Reintentar button must be visible (retryable path).
    expect(screen.getByText('Reintentar')).toBeTruthy();

    // The expense form must be present (not a blank screen).
    expect(screen.getByText('Registrar gasto')).toBeTruthy();
  });
});
