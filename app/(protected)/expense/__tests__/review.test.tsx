/**
 * Tests for the document review screen (HU-06 / HU-25).
 *
 * Covers:
 *  - Loading state shows scan overlay
 *  - Single expense transaction → ExpenseForm prefilled
 *  - Single income transaction (transfer received) → IncomeForm rendered
 *  - Direction toggle flips expense↔income form, preserving amount
 *  - Document type badge label correct for each documentType
 *  - >1 transactions → placeholder notice with count
 *  - 0 / unknown transactions → empty form + notice
 *  - pdf kind → reads file as base64 and calls extractDocument with pdfBase64
 *  - Truncated → "primeras 3 páginas" notice
 *  - Low confidence → warning banner in IncomeForm
 *  - Low confidence → existing ExpenseForm low-confidence banner
 *  - OCR error (retryable) shows manual notice + Reintentar button
 *  - OCR error (non-retryable) shows manual notice without Reintentar
 *  - Missing uri shows defensive manual notice
 *  - Successful expense save calls createExpense then router.replace
 *  - Submit error shows the error message
 *  - HU-17: share toggle wiring still works
 */
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { router } from 'expo-router';
import type { DocumentOcrResult } from '@/lib/schemas/document';
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
const mockParams = {
  current: { imageUri: 'file://x.jpg' } as Record<string, string | undefined>,
};

jest.mock('expo-router', () => ({
  Link: ({ children }: { children: React.ReactNode }) => children,
  Redirect: () => null,
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() },
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
  useLocalSearchParams: () => mockParams.current,
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

// expo-file-system/legacy: mock readAsStringAsync
const mockReadAsStringAsync = jest.fn().mockResolvedValue('pdfbase64data');
jest.mock('expo-file-system/legacy', () => ({
  readAsStringAsync: (...args: unknown[]) => mockReadAsStringAsync(...args),
  EncodingType: { Base64: 'base64', UTF8: 'utf8' },
}));

// lib/image: compressForOcr resolves immediately
jest.mock('@/lib/image', () => ({
  compressForOcr: jest.fn().mockResolvedValue({
    base64: 'base64data',
    mimeType: 'image/jpeg',
  }),
}));

// use-extract-document: controlled per-test via mockExtract
const mockExtract = {
  mutate: jest.fn(),
  reset: jest.fn(),
  isPending: false,
  data: undefined as DocumentOcrResult | undefined,
  error: null as Error | null,
};

jest.mock('@/hooks/use-extract-document', () => ({
  useExtractDocument: () => mockExtract,
}));

// lib/repositories/expenses: controlled via mockedRepo
jest.mock('@/lib/repositories/expenses');

const mockedRepo = repo as jest.Mocked<typeof repo>;

// use-groups: default to empty list (no share toggle shown)
const mockCreateSharedExpenseMutateAsync = jest.fn().mockResolvedValue({ id: 'shared-1' });

jest.mock('@/hooks/use-groups', () => ({
  useGroups: jest.fn(() => ({ data: [], isLoading: false, error: null })),
  useCreateSharedExpense: jest.fn(() => ({
    mutateAsync: mockCreateSharedExpenseMutateAsync,
    isPending: false,
  })),
}));

jest.mock('@/stores/auth-store', () => ({
  useAuthStore: jest.fn((selector: (s: { user: { id: string } | null }) => unknown) =>
    selector({ user: { id: 'u1' } }),
  ),
}));

// Mock useCreateIncome
const mockCreateIncomeMutateAsync = jest.fn().mockResolvedValue({ id: 'inc-new' });
jest.mock('@/hooks/use-incomes', () => ({
  useCreateIncome: jest.fn(() => ({
    mutateAsync: mockCreateIncomeMutateAsync,
    isPending: false,
  })),
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const EXPENSE_CATEGORIES: CategoryRow[] = [
  {
    id: 'cat-expense-1',
    slug: 'comida',
    name: 'Comida',
    icon: 'UtensilsCrossed',
    color: '#F59E0B',
    sort_order: 10,
    created_at: '2026-01-01',
    updated_at: '2026-01-01',
    user_id: null,
    kind: 'expense',
  },
];

const INCOME_CATEGORIES: CategoryRow[] = [
  {
    id: 'cat-income-1',
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

/** Single expense transaction — receipt */
const DOC_RESULT_EXPENSE: DocumentOcrResult = {
  documentType: 'receipt',
  confidence: 0.9,
  truncated: false,
  transactions: [
    {
      amount: 1500,
      currency: 'ARS',
      merchant: "McDonald's",
      categoryHint: 'comida',
      occurredAt: '2026-05-31',
      direction: 'expense',
      suggestedNewCategory: null,
      suggestedNewCategoryReason: null,
      items: [],
    },
  ],
};

/** Single income transaction — transfer received */
const DOC_RESULT_INCOME: DocumentOcrResult = {
  documentType: 'transfer',
  confidence: 0.85,
  truncated: false,
  transactions: [
    {
      amount: 50000,
      currency: 'ARS',
      merchant: 'Jonathan Mayan',
      categoryHint: null,
      occurredAt: '2026-06-01',
      direction: 'income',
      suggestedNewCategory: null,
      suggestedNewCategoryReason: null,
      items: [],
    },
  ],
};

/** Multiple transactions — card statement */
const DOC_RESULT_MULTI: DocumentOcrResult = {
  documentType: 'card_statement',
  confidence: 0.75,
  truncated: false,
  transactions: [
    {
      amount: 1500,
      currency: 'ARS',
      merchant: 'Netflix',
      categoryHint: null,
      occurredAt: '2026-05-01',
      direction: 'expense',
      suggestedNewCategory: null,
      suggestedNewCategoryReason: null,
      items: [],
    },
    {
      amount: 2000,
      currency: 'ARS',
      merchant: 'Spotify',
      categoryHint: null,
      occurredAt: '2026-05-05',
      direction: 'expense',
      suggestedNewCategory: null,
      suggestedNewCategoryReason: null,
      items: [],
    },
    {
      amount: 900,
      currency: 'ARS',
      merchant: 'Supermercado',
      categoryHint: null,
      occurredAt: '2026-05-10',
      direction: 'expense',
      suggestedNewCategory: null,
      suggestedNewCategoryReason: null,
      items: [],
    },
  ],
};

/** Empty result — unknown doc type, no transactions */
const DOC_RESULT_EMPTY: DocumentOcrResult = {
  documentType: 'unknown',
  confidence: 0.1,
  truncated: false,
  transactions: [],
};

/** Low confidence single expense transaction */
const DOC_RESULT_LOW_CONFIDENCE: DocumentOcrResult = {
  documentType: 'receipt',
  confidence: 0.3,
  truncated: false,
  transactions: [
    {
      amount: 1000,
      currency: 'ARS',
      merchant: 'Kiosco',
      categoryHint: null,
      occurredAt: '2026-06-01',
      direction: 'expense',
      suggestedNewCategory: null,
      suggestedNewCategoryReason: null,
      items: [],
    },
  ],
};

/** Truncated PDF result */
const DOC_RESULT_TRUNCATED: DocumentOcrResult = {
  documentType: 'card_statement',
  confidence: 0.7,
  truncated: true,
  transactions: [
    {
      amount: 500,
      currency: 'ARS',
      merchant: 'Amazon',
      categoryHint: null,
      occurredAt: '2026-05-01',
      direction: 'expense',
      suggestedNewCategory: null,
      suggestedNewCategoryReason: null,
      items: [],
    },
    {
      amount: 300,
      currency: 'ARS',
      merchant: 'Uber',
      categoryHint: null,
      occurredAt: '2026-05-02',
      direction: 'expense',
      suggestedNewCategory: null,
      suggestedNewCategoryReason: null,
      items: [],
    },
  ],
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
// Setup: mock useCategories to return expense + income categories by kind
// ---------------------------------------------------------------------------

function setupCategoriesMock(): void {
  mockedRepo.listCategories.mockImplementation(
    (kind?: string): ReturnType<typeof mockedRepo.listCategories> => {
      if (kind === 'income') {
        return Promise.resolve({ data: INCOME_CATEGORIES, error: null });
      }
      return Promise.resolve({ data: EXPENSE_CATEGORIES, error: null });
    },
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

const { useGroups } = jest.requireMock('@/hooks/use-groups') as {
  useGroups: jest.Mock;
};

describe('ReviewScreen — HU-25: document routing', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockParams.current = { imageUri: 'file://x.jpg' };

    // Reset extract mock
    mockExtract.mutate = jest.fn();
    mockExtract.reset = jest.fn();
    mockExtract.isPending = true;
    mockExtract.data = undefined;
    mockExtract.error = null;

    setupCategoriesMock();
    useGroups.mockReturnValue({ data: [], isLoading: false, error: null });
    mockCreateSharedExpenseMutateAsync.mockResolvedValue({ id: 'shared-1' });
    mockCreateIncomeMutateAsync.mockResolvedValue({ id: 'inc-new' });
    mockReadAsStringAsync.mockResolvedValue('pdfbase64data');
  });

  // -------------------------------------------------------------------------
  // Loading state
  // -------------------------------------------------------------------------

  it('shows the scan overlay with label "Analizando ticket" while OCR is pending', async () => {
    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByLabelText('Analizando ticket')).toBeTruthy();
    });
  });

  it('shows the first ScanStatus message while OCR is pending', async () => {
    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByText('Leyendo el ticket…')).toBeTruthy();
    });
  });

  it('renders the image thumbnail when imageUri is present and not loading', async () => {
    mockExtract.isPending = false;
    mockExtract.data = DOC_RESULT_EXPENSE;

    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByTestId('receipt-thumbnail')).toBeTruthy();
    });
  });

  // -------------------------------------------------------------------------
  // Single expense transaction → ExpenseForm
  // -------------------------------------------------------------------------

  it('renders ExpenseForm prefilled with amount when single expense transaction', async () => {
    mockExtract.isPending = false;
    mockExtract.data = DOC_RESULT_EXPENSE;

    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByDisplayValue('1500')).toBeTruthy();
    });
  });

  it('shows "Ticket" document type badge for receipt documentType', async () => {
    mockExtract.isPending = false;
    mockExtract.data = DOC_RESULT_EXPENSE;

    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByText('Ticket')).toBeTruthy();
    });
  });

  it('shows "Transferencia" badge for transfer documentType', async () => {
    mockExtract.isPending = false;
    mockExtract.data = DOC_RESULT_INCOME;

    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByText('Transferencia')).toBeTruthy();
    });
  });

  it('shows "Registrar gasto" submit button for expense direction', async () => {
    mockExtract.isPending = false;
    mockExtract.data = DOC_RESULT_EXPENSE;

    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByLabelText('Registrar gasto')).toBeTruthy();
    });
  });

  // -------------------------------------------------------------------------
  // Single income transaction → IncomeForm
  // -------------------------------------------------------------------------

  it('renders IncomeForm with income categories when single income transaction', async () => {
    mockExtract.isPending = false;
    mockExtract.data = DOC_RESULT_INCOME;

    renderWithProviders();

    await waitFor(() => {
      // IncomeForm renders "Registrar ingreso" button
      expect(screen.getByLabelText('Registrar ingreso')).toBeTruthy();
    });
  });

  it('renders IncomeForm with prefilled amount for income transaction', async () => {
    mockExtract.isPending = false;
    mockExtract.data = DOC_RESULT_INCOME;

    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByDisplayValue('50000')).toBeTruthy();
    });
  });

  // -------------------------------------------------------------------------
  // Direction toggle
  // -------------------------------------------------------------------------

  it('shows "Gasto" and "Ingreso" toggle buttons for single-transaction result', async () => {
    mockExtract.isPending = false;
    mockExtract.data = DOC_RESULT_EXPENSE;

    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByLabelText('Gasto')).toBeTruthy();
      expect(screen.getByLabelText('Ingreso')).toBeTruthy();
    });
  });

  it('toggles from ExpenseForm to IncomeForm when Ingreso is pressed, preserving amount', async () => {
    mockExtract.isPending = false;
    mockExtract.data = DOC_RESULT_EXPENSE;

    renderWithProviders();

    // Wait for expense form to appear with amount
    await waitFor(() => {
      expect(screen.getByLabelText('Registrar gasto')).toBeTruthy();
      expect(screen.getByDisplayValue('1500')).toBeTruthy();
    });

    // Press Ingreso toggle
    fireEvent.press(screen.getByLabelText('Ingreso'));

    await waitFor(() => {
      // IncomeForm should now be shown
      expect(screen.getByLabelText('Registrar ingreso')).toBeTruthy();
      // Amount should still be present
      expect(screen.getByDisplayValue('1500')).toBeTruthy();
    });
  });

  it('toggles from IncomeForm back to ExpenseForm when Gasto is pressed', async () => {
    mockExtract.isPending = false;
    mockExtract.data = DOC_RESULT_INCOME;

    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByLabelText('Registrar ingreso')).toBeTruthy();
    });

    // Press Gasto toggle
    fireEvent.press(screen.getByLabelText('Gasto'));

    await waitFor(() => {
      expect(screen.getByLabelText('Registrar gasto')).toBeTruthy();
    });
  });

  // -------------------------------------------------------------------------
  // Document type badge labels
  // -------------------------------------------------------------------------

  it('shows "Resumen" badge for card_statement documentType', async () => {
    // Use a single-transaction result of card_statement type
    const singleCardStatement: DocumentOcrResult = {
      ...DOC_RESULT_EXPENSE,
      documentType: 'card_statement',
    };
    mockExtract.isPending = false;
    mockExtract.data = singleCardStatement;

    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByText('Resumen')).toBeTruthy();
    });
  });

  it('shows "Captura" badge for screenshot documentType', async () => {
    const screenshot: DocumentOcrResult = {
      ...DOC_RESULT_EXPENSE,
      documentType: 'screenshot',
    };
    mockExtract.isPending = false;
    mockExtract.data = screenshot;

    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByText('Captura')).toBeTruthy();
    });
  });

  it('shows "Documento" badge for unknown documentType (single transaction)', async () => {
    const unknownSingle: DocumentOcrResult = {
      ...DOC_RESULT_EXPENSE,
      documentType: 'unknown',
    };
    mockExtract.isPending = false;
    mockExtract.data = unknownSingle;

    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByText('Documento')).toBeTruthy();
    });
  });

  // -------------------------------------------------------------------------
  // >1 transactions — card statement placeholder
  // -------------------------------------------------------------------------

  it('shows placeholder notice with transaction count for >1 transactions', async () => {
    mockExtract.isPending = false;
    mockExtract.data = DOC_RESULT_MULTI;

    renderWithProviders();

    await waitFor(() => {
      expect(
        screen.getByText(
          'Detectamos 3 movimientos en este resumen. Pronto vas a poder elegir cuáles importar.',
        ),
      ).toBeTruthy();
    });
  });

  it('does NOT show ExpenseForm for >1 transactions', async () => {
    mockExtract.isPending = false;
    mockExtract.data = DOC_RESULT_MULTI;

    renderWithProviders();

    await waitFor(() => {
      expect(screen.queryByLabelText('Registrar gasto')).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // 0 transactions / unknown — empty form + notice
  // -------------------------------------------------------------------------

  it('shows "No se detectaron datos" notice and ExpenseForm for 0 transactions', async () => {
    mockExtract.isPending = false;
    mockExtract.data = DOC_RESULT_EMPTY;

    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByText('No se detectaron datos. Completá manualmente.')).toBeTruthy();
      expect(screen.getByLabelText('Registrar gasto')).toBeTruthy();
    });
  });

  it('does NOT show direction toggle for 0 transactions', async () => {
    mockExtract.isPending = false;
    mockExtract.data = DOC_RESULT_EMPTY;

    renderWithProviders();

    await waitFor(() => {
      expect(screen.queryByLabelText('Gasto')).toBeNull();
      expect(screen.queryByLabelText('Ingreso')).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // PDF kind → reads file as base64
  // -------------------------------------------------------------------------

  it('calls readAsStringAsync (not compressForOcr) for pdf kind', async () => {
    mockParams.current = { uri: 'file://doc.pdf', kind: 'pdf', mimeType: 'application/pdf' };
    mockExtract.isPending = true;
    mockExtract.data = undefined;

    renderWithProviders();

    await waitFor(() => {
      expect(mockReadAsStringAsync).toHaveBeenCalledWith(
        'file://doc.pdf',
        expect.objectContaining({ encoding: 'base64' }),
      );
    });

    // compressForOcr should NOT have been called
    expect(imageLib.compressForOcr).not.toHaveBeenCalled();
  });

  it('calls extractMutation.mutate with pdfBase64 for pdf kind', async () => {
    mockParams.current = { uri: 'file://doc.pdf', kind: 'pdf', mimeType: 'application/pdf' };
    mockExtract.isPending = true;
    mockExtract.data = undefined;

    renderWithProviders();

    await waitFor(() => {
      expect(mockExtract.mutate).toHaveBeenCalledWith(
        expect.objectContaining({
          pdfBase64: 'pdfbase64data',
          mimeType: 'application/pdf',
        }),
      );
    });

    expect(mockExtract.mutate).not.toHaveBeenCalledWith(
      expect.objectContaining({ imageBase64: expect.anything() }),
    );
  });

  // -------------------------------------------------------------------------
  // Truncated → notice
  // -------------------------------------------------------------------------

  it('shows "primeras 3 páginas" notice when doc is truncated', async () => {
    mockExtract.isPending = false;
    mockExtract.data = DOC_RESULT_TRUNCATED;

    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByText('Procesamos las primeras 3 páginas del PDF.')).toBeTruthy();
    });
  });

  // -------------------------------------------------------------------------
  // Low confidence
  // -------------------------------------------------------------------------

  it('shows income low-confidence banner when confidence < 0.5 and direction=income', async () => {
    const lowConfIncome: DocumentOcrResult = {
      ...DOC_RESULT_LOW_CONFIDENCE,
      transactions: [
        {
          ...DOC_RESULT_LOW_CONFIDENCE.transactions[0]!,
          direction: 'income',
        },
      ],
    };
    mockExtract.isPending = false;
    mockExtract.data = lowConfIncome;

    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByText('Revisá los datos detectados, la confianza es baja.')).toBeTruthy();
    });
  });

  it('shows expense low-confidence banner when confidence < 0.5 and direction=expense', async () => {
    mockExtract.isPending = false;
    mockExtract.data = DOC_RESULT_LOW_CONFIDENCE;

    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByText('Revisá los datos detectados antes de guardar.')).toBeTruthy();
    });
  });

  it('does NOT show low-confidence banner when confidence >= 0.5', async () => {
    mockExtract.isPending = false;
    mockExtract.data = DOC_RESULT_EXPENSE; // confidence 0.9

    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByLabelText('Registrar gasto')).toBeTruthy();
    });

    expect(screen.queryByText('Revisá los datos detectados antes de guardar.')).toBeNull();
    expect(screen.queryByText('Revisá los datos detectados, la confianza es baja.')).toBeNull();
  });

  // -------------------------------------------------------------------------
  // OCR errors
  // -------------------------------------------------------------------------

  it('shows manual notice and Reintentar button on OCR_TIMEOUT error', async () => {
    mockExtract.isPending = false;
    mockExtract.data = undefined;
    mockExtract.error = new OcrError('OCR_TIMEOUT', 'timeout');

    renderWithProviders();

    await waitFor(() => {
      expect(
        screen.getByText('No se pudo analizar el documento. Ingresá los datos manualmente.'),
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
        screen.getByText('No se pudo analizar el documento. Ingresá los datos manualmente.'),
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
      expect(screen.getByLabelText('Registrar gasto')).toBeTruthy();
    });
  });

  it('shows manual notice WITHOUT Reintentar for non-retryable error codes', async () => {
    mockExtract.isPending = false;
    mockExtract.data = undefined;
    mockExtract.error = new OcrError('PARSE_ERROR', 'parse error');

    renderWithProviders();

    await waitFor(() => {
      expect(
        screen.getByText('No se pudo analizar el documento. Ingresá los datos manualmente.'),
      ).toBeTruthy();
      expect(screen.queryByText('Reintentar')).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // Missing uri — defensive fallback
  // -------------------------------------------------------------------------

  it('shows defensive manual notice when uri is missing', async () => {
    mockParams.current = {};
    mockExtract.isPending = false;

    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByText('No se detectaron datos. Completá manualmente.')).toBeTruthy();
    });
  });

  // -------------------------------------------------------------------------
  // Happy-path expense submit
  // -------------------------------------------------------------------------

  it('calls createExpense and then router.replace on successful expense save', async () => {
    mockExtract.isPending = false;
    mockExtract.data = DOC_RESULT_EXPENSE;

    mockedRepo.createExpense.mockResolvedValueOnce({
      data: { id: 'exp-new', items: [] } as unknown as repo.ExpenseWithItems,
      error: null,
    });

    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByDisplayValue('1500')).toBeTruthy();
    });

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
    mockExtract.data = DOC_RESULT_EXPENSE;

    mockedRepo.createExpense.mockResolvedValueOnce({
      data: null,
      error: new Error('No se pudo guardar el gasto.'),
    });

    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByDisplayValue('1500')).toBeTruthy();
    });

    await act(async () => {
      fireEvent.press(screen.getByLabelText('Registrar gasto'));
    });

    await waitFor(() => {
      expect(screen.getByText('No se pudo guardar el gasto.')).toBeTruthy();
    });
  });

  // -------------------------------------------------------------------------
  // Compression failure
  // -------------------------------------------------------------------------

  it('shows manual notice + Reintentar + form when compressForOcr rejects', async () => {
    (imageLib.compressForOcr as jest.Mock).mockRejectedValueOnce(new Error('compression failed'));

    // OCR mutation stays idle (never mutated because compression failed).
    mockExtract.isPending = false;
    mockExtract.data = undefined;
    mockExtract.error = null;

    renderWithProviders();

    await waitFor(() => {
      // The manual notice must be visible (hardcoded retryable error text in JSX).
      expect(
        screen.getByText('No se pudo analizar el documento. Ingresá los datos manualmente.'),
      ).toBeTruthy();
    });

    // Reintentar button must be visible (retryable path).
    expect(screen.getByText('Reintentar')).toBeTruthy();

    // The expense form must be present (not a blank screen).
    expect(screen.getByLabelText('Registrar gasto')).toBeTruthy();
  });

  // -------------------------------------------------------------------------
  // categoryNames forwarded
  // -------------------------------------------------------------------------

  it('calls extractMutation.mutate with categoryNames from loaded expense categories', async () => {
    mockExtract.isPending = true;

    renderWithProviders();

    await waitFor(() => {
      expect(mockExtract.mutate).toHaveBeenCalledWith(
        expect.objectContaining({
          categoryNames: expect.arrayContaining(['Comida']),
        }),
      );
    });
  });
});

// ---------------------------------------------------------------------------
// HU-17: share toggle wiring in ReviewScreen (preserved)
// ---------------------------------------------------------------------------

const REVIEW_GROUP_MEMBERS = [
  {
    id: 'rm1',
    group_id: 'rg1',
    user_id: 'u1',
    display_name: 'Facundo Martinez',
    role: 'member',
    status: 'active',
    joined_at: null,
    invited_by: null,
    created_at: '2026-01-01T00:00:00Z',
  },
  {
    id: 'rm2',
    group_id: 'rg1',
    user_id: null,
    display_name: 'Jonathan Mayan',
    role: 'member',
    status: 'active',
    joined_at: null,
    invited_by: null,
    created_at: '2026-01-01T00:00:00Z',
  },
];

const REVIEW_MOCK_GROUPS = [
  {
    id: 'rg1',
    name: 'Amigos',
    icon: 'Users',
    color: '#10B981',
    created_by: 'u1',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    members: REVIEW_GROUP_MEMBERS,
  },
];

describe('ReviewScreen — share toggle wiring (HU-17)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockParams.current = { imageUri: 'file://x.jpg' };

    mockExtract.mutate = jest.fn();
    mockExtract.reset = jest.fn();
    mockExtract.isPending = false;
    mockExtract.data = undefined;
    mockExtract.error = null;

    setupCategoriesMock();
    useGroups.mockReturnValue({ data: REVIEW_MOCK_GROUPS, isLoading: false, error: null });
    mockCreateSharedExpenseMutateAsync.mockResolvedValue({ id: 'shared-r1' });
    mockCreateIncomeMutateAsync.mockResolvedValue({ id: 'inc-new' });
    mockReadAsStringAsync.mockResolvedValue('pdfbase64data');
  });

  it('shows the share toggle on the OCR success expense form when the user has groups', async () => {
    mockExtract.isPending = false;
    mockExtract.data = DOC_RESULT_EXPENSE;

    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByLabelText('¿Gasto compartido?')).toBeTruthy();
    });
  });

  it('calls useCreateSharedExpense on shared submit from review screen', async () => {
    mockExtract.isPending = false;
    mockExtract.data = DOC_RESULT_EXPENSE;

    mockedRepo.createExpense.mockResolvedValue({
      data: { id: 'e1', items: [] } as unknown as repo.ExpenseWithItems,
      error: null,
    });

    renderWithProviders();

    await waitFor(() => expect(screen.getByDisplayValue('1500')).toBeTruthy());

    // Toggle shared ON
    fireEvent.press(screen.getByLabelText('¿Gasto compartido?'));

    // Open and select group
    fireEvent.press(screen.getByLabelText('Elegí un grupo'));
    await waitFor(() => expect(screen.getByLabelText('Grupo Amigos')).toBeTruthy());
    fireEvent.press(screen.getByLabelText('Grupo Amigos'));

    await act(async () => {
      fireEvent.press(screen.getByLabelText('Registrar gasto'));
    });

    await waitFor(() => {
      expect(mockCreateSharedExpenseMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 1500,
          group_id: 'rg1',
          paid_by_member_id: expect.any(String),
          splits: expect.arrayContaining([
            expect.objectContaining({ member_id: expect.any(String) }),
          ]),
        }),
      );
    });
  });
});
