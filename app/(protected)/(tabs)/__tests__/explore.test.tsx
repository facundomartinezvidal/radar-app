/**
 * Tests for InsightsScreen (AC9.2).
 *
 * Covers:
 *   - Happy path: hooks return data → charts + AiInsightsCard rendered, section titles present
 *   - Loading: core hooks isLoading → Loader shown, charts absent
 *   - Empty: totals all zero, not loading → InsightsEmptyState shown, charts absent, filters visible
 *   - Currency toggle: changing to USD updates the currency passed to hooks
 *   - AI card: aiQuery returns heuristic insights as normal data → card renders them
 *
 * Strategy:
 *   - Mock `hooks/use-insights` entirely so we control what each hook returns.
 *   - Mock `react-native-gifted-charts` to stubs so chart primitives render fast.
 *   - Wrap in QueryClientProvider per the HomeScreen test convention.
 */
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, fireEvent } from '@testing-library/react-native';

import InsightsScreen from '../explore';

// ---------------------------------------------------------------------------
// Infrastructure mocks (mirrors index.test.tsx)
// ---------------------------------------------------------------------------

jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));

jest.mock('react-native-safe-area-context', () => {
  const { View } = require('react-native');
  return {
    SafeAreaView: View,
    SafeAreaProvider: View,
    useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
  };
});

// ---------------------------------------------------------------------------
// Chart library stub — lets gifted-charts components render without SVG engine
// ---------------------------------------------------------------------------

jest.mock('react-native-gifted-charts', () => ({
  PieChart: () => null,
  BarChart: () => null,
  LineChart: () => null,
}));

// ---------------------------------------------------------------------------
// Mock hooks/use-insights — all 5 hooks
// ---------------------------------------------------------------------------

const mockUseExpenseByCategory = jest.fn();
const mockUseExpenseByPeriod = jest.fn();
const mockUseIncomeByPeriod = jest.fn();
const mockUseTrend = jest.fn();
const mockUseAiInsights = jest.fn();

jest.mock('@/hooks/use-insights', () => ({
  useExpenseByCategory: (...args: unknown[]) => mockUseExpenseByCategory(...args),
  useExpenseByPeriod: (...args: unknown[]) => mockUseExpenseByPeriod(...args),
  useIncomeByPeriod: (...args: unknown[]) => mockUseIncomeByPeriod(...args),
  useTrend: (...args: unknown[]) => mockUseTrend(...args),
  useAiInsights: (...args: unknown[]) => mockUseAiInsights(...args),
  insightKeys: {
    all: ['insights'],
    byCategory: jest.fn(),
    byPeriod: jest.fn(),
    incomeByPeriod: jest.fn(),
    ai: jest.fn(),
  },
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const CATEGORY_DATA = [
  {
    categoryId: 'cat-1',
    name: 'Comida',
    color: '#F59E0B',
    icon: 'UtensilsCrossed',
    total: 5000,
    count: 3,
  },
  { categoryId: 'cat-2', name: 'Transporte', color: '#0077B6', icon: 'Car', total: 2000, count: 2 },
];

const EXPENSE_BARS = [
  { bucket: '2026-06-01', total: 5000, count: 3 },
  { bucket: '2026-06-02', total: 2000, count: 2 },
];

const INCOME_BARS = [{ bucket: '2026-06-01', total: 8000, count: 1 }];

const TREND_DATA = [{ bucket: '2026-06-01', expenses: 7000, incomes: 8000 }];

const AI_INSIGHTS = [
  {
    kind: 'positive' as const,
    title: 'Buen balance',
    body: 'Tus ingresos superan tus gastos este mes.',
  },
  { kind: 'tip' as const, title: 'Ahorrá más', body: 'Considerá reducir gastos en Comida.' },
];

// ---------------------------------------------------------------------------
// Default mock return values (happy path)
// ---------------------------------------------------------------------------

function setupHappyPath(): void {
  mockUseExpenseByCategory.mockReturnValue({
    data: CATEGORY_DATA,
    isLoading: false,
    isError: false,
  });
  mockUseExpenseByPeriod.mockReturnValue({ data: EXPENSE_BARS, isLoading: false, isError: false });
  mockUseIncomeByPeriod.mockReturnValue({ data: INCOME_BARS, isLoading: false, isError: false });
  mockUseTrend.mockReturnValue({
    data: TREND_DATA,
    isLoading: false,
    isError: false,
    isSuccess: true,
  });
  mockUseAiInsights.mockReturnValue({ data: AI_INSIGHTS, isLoading: false, isError: false });
}

function setupLoading(): void {
  mockUseExpenseByCategory.mockReturnValue({ data: undefined, isLoading: true, isError: false });
  mockUseExpenseByPeriod.mockReturnValue({ data: undefined, isLoading: true, isError: false });
  mockUseIncomeByPeriod.mockReturnValue({ data: undefined, isLoading: true, isError: false });
  mockUseTrend.mockReturnValue({
    data: undefined,
    isLoading: true,
    isError: false,
    isSuccess: false,
  });
  mockUseAiInsights.mockReturnValue({ data: undefined, isLoading: false, isError: false });
}

function setupEmpty(): void {
  mockUseExpenseByCategory.mockReturnValue({ data: [], isLoading: false, isError: false });
  mockUseExpenseByPeriod.mockReturnValue({ data: [], isLoading: false, isError: false });
  mockUseIncomeByPeriod.mockReturnValue({ data: [], isLoading: false, isError: false });
  mockUseTrend.mockReturnValue({ data: [], isLoading: false, isError: false, isSuccess: true });
  mockUseAiInsights.mockReturnValue({ data: [], isLoading: false, isError: false });
}

// ---------------------------------------------------------------------------
// Render helper
// ---------------------------------------------------------------------------

function renderScreen(): void {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <InsightsScreen />
    </QueryClientProvider>,
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('InsightsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── Renders without crash ────────────────────────────────────────────────

  it('renders without crashing', () => {
    setupHappyPath();
    expect(() => renderScreen()).not.toThrow();
  });

  // ── Happy path ───────────────────────────────────────────────────────────

  describe('happy path — hooks return data', () => {
    beforeEach(() => {
      setupHappyPath();
    });

    it('shows the Insights header', () => {
      renderScreen();
      expect(screen.getByText('Insights')).toBeTruthy();
    });

    it('shows the section title "Gastos por categoría"', () => {
      renderScreen();
      expect(screen.getByText('Gastos por categoría')).toBeTruthy();
    });

    it('shows the section title "Gastos por período"', () => {
      renderScreen();
      expect(screen.getByText('Gastos por período')).toBeTruthy();
    });

    it('shows the section title "Ingresos vs gastos"', () => {
      renderScreen();
      expect(screen.getByText('Ingresos vs gastos')).toBeTruthy();
    });

    it('shows the section title "Tendencia"', () => {
      renderScreen();
      expect(screen.getByText('Tendencia')).toBeTruthy();
    });

    it('shows the totals summary card', () => {
      renderScreen();
      expect(screen.getByTestId('totals-summary')).toBeTruthy();
    });

    it('shows category donut card', () => {
      renderScreen();
      expect(screen.getByTestId('category-donut-card')).toBeTruthy();
    });

    it('shows expense bars card', () => {
      renderScreen();
      expect(screen.getByTestId('expense-bars-card')).toBeTruthy();
    });

    it('shows income-vs-expense card', () => {
      renderScreen();
      expect(screen.getByTestId('income-vs-expense-card')).toBeTruthy();
    });

    it('shows trend card', () => {
      renderScreen();
      expect(screen.getByTestId('trend-card')).toBeTruthy();
    });

    it('does NOT show the loading indicator', () => {
      renderScreen();
      expect(screen.queryByTestId('screen-loader')).toBeNull();
    });

    it('does NOT show InsightsEmptyState', () => {
      renderScreen();
      expect(screen.queryByText('No hay movimientos en este período')).toBeNull();
    });
  });

  // ── Loading state ────────────────────────────────────────────────────────

  describe('loading state', () => {
    beforeEach(() => {
      setupLoading();
    });

    it('shows the screen loader', () => {
      renderScreen();
      expect(screen.getByTestId('screen-loader')).toBeTruthy();
    });

    it('does NOT render chart cards while loading', () => {
      renderScreen();
      expect(screen.queryByTestId('category-donut-card')).toBeNull();
      expect(screen.queryByTestId('expense-bars-card')).toBeNull();
      expect(screen.queryByTestId('income-vs-expense-card')).toBeNull();
      expect(screen.queryByTestId('trend-card')).toBeNull();
    });

    it('does NOT render section titles while loading', () => {
      renderScreen();
      expect(screen.queryByText('Gastos por categoría')).toBeNull();
      expect(screen.queryByText('Gastos por período')).toBeNull();
    });

    it('keeps the filters block visible', () => {
      renderScreen();
      expect(screen.getByTestId('filters-block')).toBeTruthy();
    });
  });

  // ── Empty state ──────────────────────────────────────────────────────────

  describe('empty state — no movements in period', () => {
    beforeEach(() => {
      setupEmpty();
    });

    it('shows InsightsEmptyState', () => {
      renderScreen();
      expect(screen.getByText('No hay movimientos en este período')).toBeTruthy();
    });

    it('does NOT render chart section titles', () => {
      renderScreen();
      expect(screen.queryByText('Gastos por categoría')).toBeNull();
      expect(screen.queryByText('Gastos por período')).toBeNull();
      expect(screen.queryByText('Ingresos vs gastos')).toBeNull();
      expect(screen.queryByText('Tendencia')).toBeNull();
    });

    it('does NOT show the totals summary card', () => {
      renderScreen();
      expect(screen.queryByTestId('totals-summary')).toBeNull();
    });

    it('keeps the filters block visible', () => {
      renderScreen();
      expect(screen.getByTestId('filters-block')).toBeTruthy();
    });

    it('shows the PeriodFilterBar preset chips', () => {
      renderScreen();
      // "Este mes" appears as both the active preset chip and the month-selector label
      const matches = screen.getAllByText('Este mes');
      expect(matches.length).toBeGreaterThanOrEqual(1);
    });

    it('does NOT show the screen loader', () => {
      renderScreen();
      expect(screen.queryByTestId('screen-loader')).toBeNull();
    });
  });

  // ── Currency toggle ──────────────────────────────────────────────────────

  describe('currency toggle', () => {
    beforeEach(() => {
      setupHappyPath();
    });

    it('renders the CurrencyToggle with ARS selected by default', () => {
      renderScreen();
      // CurrencyToggle renders "Moneda ARS" and "Moneda USD" accessibility labels
      const arsRadio = screen.getByLabelText('Moneda ARS');
      expect(arsRadio).toBeTruthy();
    });

    it('initially calls hooks with ARS currency', () => {
      renderScreen();
      expect(mockUseExpenseByCategory).toHaveBeenCalledWith('ARS', expect.any(Object));
      expect(mockUseExpenseByPeriod).toHaveBeenCalledWith('ARS', expect.any(Object));
      expect(mockUseIncomeByPeriod).toHaveBeenCalledWith('ARS', expect.any(Object));
      expect(mockUseTrend).toHaveBeenCalledWith('ARS', expect.any(Object));
    });

    it('useTrend is called with a trailing-6-month window (bucket="month", label contains "meses")', () => {
      renderScreen();
      const trendCall = mockUseTrend.mock.calls[0];
      // Second arg is the trendWindow Period
      const trendPeriod = trendCall?.[1] as { bucket: string; label: string };
      expect(trendPeriod?.bucket).toBe('month');
      expect(trendPeriod?.label).toContain('meses');
    });

    it('shows "Últimos 6 meses" caption under "Ingresos vs gastos"', () => {
      renderScreen();
      expect(screen.getByTestId('ive-caption')).toBeTruthy();
    });

    it('shows "Últimos 6 meses" caption under "Tendencia"', () => {
      renderScreen();
      expect(screen.getByTestId('trend-caption')).toBeTruthy();
    });

    it('switches to USD and re-calls hooks with USD after pressing USD toggle', () => {
      renderScreen();

      // Press the USD radio option
      fireEvent.press(screen.getByLabelText('Moneda USD'));

      // After re-render hooks should be called with 'USD'
      expect(mockUseExpenseByCategory).toHaveBeenCalledWith('USD', expect.any(Object));
      expect(mockUseExpenseByPeriod).toHaveBeenCalledWith('USD', expect.any(Object));
      expect(mockUseIncomeByPeriod).toHaveBeenCalledWith('USD', expect.any(Object));
      expect(mockUseTrend).toHaveBeenCalledWith('USD', expect.any(Object));
    });
  });

  // ── AI recommendations ───────────────────────────────────────────────────

  describe('AI / heuristic insights card', () => {
    it('renders Recomendaciones heading when insights are available', () => {
      setupHappyPath();
      renderScreen();
      expect(screen.getByText('Recomendaciones')).toBeTruthy();
    });

    it('renders individual insight titles from aiQuery.data', () => {
      setupHappyPath();
      renderScreen();
      expect(screen.getByText('Buen balance')).toBeTruthy();
      expect(screen.getByText('Ahorrá más')).toBeTruthy();
    });

    it('does NOT render the AiInsightsCard when insights array is empty and not loading', () => {
      setupHappyPath();
      // Override aiQuery to return empty
      mockUseAiInsights.mockReturnValue({ data: [], isLoading: false, isError: false });
      renderScreen();
      expect(screen.queryByText('Recomendaciones')).toBeNull();
    });

    it('aiQuery loading state shows card with loader (not insights)', () => {
      setupHappyPath();
      mockUseAiInsights.mockReturnValue({ data: undefined, isLoading: true, isError: false });
      renderScreen();
      // Card header renders when loading
      expect(screen.getByText('Recomendaciones')).toBeTruthy();
      // Individual insight titles should not appear
      expect(screen.queryByText('Buen balance')).toBeNull();
    });
  });
});
