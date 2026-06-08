/**
 * Tests for the new-expense screen — verifies categories are surfaced, the
 * happy-path mutation is wired, and error messages bubble up.
 *
 * Category selection now goes through the CategorySelectorSheet:
 * 1. Press the "Elegir categoría" trigger to open the sheet.
 * 2. Press "Categoría <Name>" tile in the sheet to select.
 */
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { router } from 'expo-router';
import * as repo from '@/lib/repositories/expenses';
import NewExpenseScreen from '../new';

jest.mock('@/lib/repositories/expenses');
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));
// react-native-svg is mocked globally in jest.setup.ts (includes Rect and all Lucide elements)
jest.mock('@react-native-community/datetimepicker', () => {
  const ReactLib = require('react');
  const { View } = require('react-native');
  const Mock = () => ReactLib.createElement(View, { testID: 'mock-datetimepicker' });
  Mock.displayName = 'MockDateTimePicker';
  return { __esModule: true, default: Mock };
});

// CategorySelectorSheet uses these hooks — mock them so we don't need a real
// Supabase session or query infrastructure for the sheet's internal mutations.
jest.mock('@/hooks/use-categories', () => ({
  useCreateCategory: jest.fn(() => ({ mutateAsync: jest.fn(), isPending: false })),
  useUpdateCategory: jest.fn(() => ({ mutateAsync: jest.fn(), isPending: false })),
  useDeleteCategory: jest.fn(() => ({ mutateAsync: jest.fn(), isPending: false })),
}));

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
    updated_at: '2026-01-01',
    user_id: null,
  },
  {
    id: 'cat-2',
    slug: 'transporte',
    name: 'Transporte',
    icon: 'Bus',
    color: '#4FB3DC',
    sort_order: 30,
    created_at: '2026-01-01',
    updated_at: '2026-01-01',
    user_id: null,
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

// ---------------------------------------------------------------------------
// Helper: open the category sheet and select a category by name
// ---------------------------------------------------------------------------

async function openSheetAndSelect(categoryName: string): Promise<void> {
  // Wait for the trigger to be rendered (categories must be loaded)
  await waitFor(() => expect(screen.getByLabelText('Elegir categoría')).toBeTruthy());

  // Open the sheet
  fireEvent.press(screen.getByLabelText('Elegir categoría'));

  // Tap the tile in the sheet
  await waitFor(() => expect(screen.getByLabelText(`Categoría ${categoryName}`)).toBeTruthy());
  fireEvent.press(screen.getByLabelText(`Categoría ${categoryName}`));
}

const { useGroups } = jest.requireMock('@/hooks/use-groups') as {
  useGroups: jest.Mock;
};

describe('NewExpenseScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedRepo.listCategories.mockResolvedValue({ data: FIXTURE_CATEGORIES, error: null });
    // Default: no groups (toggle is hidden)
    useGroups.mockReturnValue({ data: [], isLoading: false, error: null });
    mockCreateSharedExpenseMutateAsync.mockResolvedValue({ id: 'shared-1' });
  });

  it('renders the screen title', async () => {
    renderWithProviders();
    expect(screen.getByText('Nuevo gasto')).toBeTruthy();
  });

  it('shows the category picker trigger once categories are loaded', async () => {
    renderWithProviders();
    // Wait for the form to render (categories loaded)
    await waitFor(() => expect(screen.getByLabelText('Elegir categoría')).toBeTruthy());
  });

  it('shows seeded categories in the sheet when the trigger is pressed', async () => {
    renderWithProviders();

    await waitFor(() => expect(screen.getByLabelText('Elegir categoría')).toBeTruthy());
    fireEvent.press(screen.getByLabelText('Elegir categoría'));

    await waitFor(() => {
      expect(screen.getByLabelText('Categoría Comida')).toBeTruthy();
      expect(screen.getByLabelText('Categoría Transporte')).toBeTruthy();
    });
  });

  it('submits create with parsed amount + selected currency + category', async () => {
    mockedRepo.createExpense.mockResolvedValueOnce({
      data: { id: 'exp-1', items: [] } as unknown as repo.ExpenseWithItems,
      error: null,
    });

    renderWithProviders();

    // Amount
    await waitFor(() => expect(screen.getByLabelText('Monto')).toBeTruthy());
    const amount = screen.getByLabelText('Monto');
    fireEvent.changeText(amount, '12.500,50');

    // Pick category via sheet
    await openSheetAndSelect('Comida');

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

  // -------------------------------------------------------------------------
  // HU-18: manual item entry
  // -------------------------------------------------------------------------

  it('passes items to createExpense when user adds an item manually', async () => {
    mockedRepo.createExpense.mockResolvedValueOnce({
      data: { id: 'exp-new', items: [] } as unknown as repo.ExpenseWithItems,
      error: null,
    });

    renderWithProviders();

    // Amount
    await waitFor(() => expect(screen.getByLabelText('Monto')).toBeTruthy());
    fireEvent.changeText(screen.getByLabelText('Monto'), '500');

    // Pick category via sheet
    await openSheetAndSelect('Comida');

    // Open the items section then add one item
    fireEvent.press(screen.getByLabelText('Mostrar detalle de ítems'));
    fireEvent.press(screen.getByLabelText('Agregar ítem'));

    // Fill the item name (first item = index 0)
    fireEvent.changeText(screen.getByLabelText('Nombre del ítem 1'), 'Medialunas');

    // Fill line_total
    fireEvent.changeText(screen.getByLabelText('Total del ítem 1'), '500');

    await act(async () => {
      fireEvent.press(screen.getByLabelText('Registrar gasto'));
    });

    await waitFor(() => {
      expect(mockedRepo.createExpense).toHaveBeenCalledWith(
        expect.objectContaining({
          items: expect.arrayContaining([
            expect.objectContaining({ name: 'Medialunas', line_total: 500 }),
          ]),
        }),
      );
    });
  });

  it('shows error message when create fails', async () => {
    mockedRepo.createExpense.mockResolvedValueOnce({
      data: null,
      error: new Error('No se pudo guardar el gasto.'),
    });

    renderWithProviders();

    await waitFor(() => expect(screen.getByLabelText('Monto')).toBeTruthy());
    fireEvent.changeText(screen.getByLabelText('Monto'), '100');

    // Pick category via sheet
    await openSheetAndSelect('Comida');

    await act(async () => {
      fireEvent.press(screen.getByLabelText('Registrar gasto'));
    });

    await waitFor(() => {
      expect(screen.getByText('No se pudo guardar el gasto.')).toBeTruthy();
    });
  });
});

// ---------------------------------------------------------------------------
// HU-17: share toggle wiring in NewExpenseScreen
// ---------------------------------------------------------------------------

const MOCK_GROUP_MEMBERS = [
  {
    id: 'm1',
    group_id: 'g1',
    user_id: 'u1',
    display_name: 'Facundo Martinez',
    role: 'member',
    status: 'active',
    joined_at: null,
    invited_by: null,
    created_at: '2026-01-01T00:00:00Z',
  },
  {
    id: 'm2',
    group_id: 'g1',
    user_id: null,
    display_name: 'Jonathan Mayan',
    role: 'member',
    status: 'active',
    joined_at: null,
    invited_by: null,
    created_at: '2026-01-01T00:00:00Z',
  },
];

const MOCK_GROUPS = [
  {
    id: 'g1',
    name: 'Depto',
    icon: 'House',
    color: '#0077B6',
    created_by: 'u1',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    members: MOCK_GROUP_MEMBERS,
  },
];

describe('NewExpenseScreen — share toggle wiring (HU-17)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedRepo.listCategories.mockResolvedValue({ data: FIXTURE_CATEGORIES, error: null });
    useGroups.mockReturnValue({ data: MOCK_GROUPS, isLoading: false, error: null });
    mockCreateSharedExpenseMutateAsync.mockResolvedValue({ id: 'shared-1' });
  });

  it('shows the ¿Gasto compartido? toggle when the user has groups', async () => {
    renderWithProviders();

    await waitFor(() => expect(screen.getByLabelText('Elegir categoría')).toBeTruthy());
    expect(screen.getByLabelText('¿Gasto compartido?')).toBeTruthy();
  });

  it('calls useCreateSharedExpense when shared submit is triggered', async () => {
    renderWithProviders();

    await waitFor(() => expect(screen.getByLabelText('Monto')).toBeTruthy());
    fireEvent.changeText(screen.getByLabelText('Monto'), '500');

    // Pick category
    await openSheetAndSelect('Comida');

    // Toggle shared ON
    fireEvent.press(screen.getByLabelText('¿Gasto compartido?'));

    // Select a group
    fireEvent.press(screen.getByLabelText('Elegí un grupo'));
    await waitFor(() => expect(screen.getByLabelText('Grupo Depto')).toBeTruthy());
    fireEvent.press(screen.getByLabelText('Grupo Depto'));

    await act(async () => {
      fireEvent.press(screen.getByLabelText('Registrar gasto'));
    });

    await waitFor(() => {
      expect(mockCreateSharedExpenseMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 500,
          group_id: 'g1',
          paid_by_member_id: expect.any(String),
          splits: expect.arrayContaining([
            expect.objectContaining({ member_id: expect.any(String) }),
          ]),
        }),
      );
    });
    expect(router.back).toHaveBeenCalled();
  });
});
