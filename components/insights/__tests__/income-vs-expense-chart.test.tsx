/**
 * Tests for IncomeVsExpenseChart (AC7.3).
 *
 * gifted-charts BarChart is mocked to prevent SVG rendering in jsdom.
 */
import React from 'react';
import { render, screen } from '@testing-library/react-native';

import { formatMoney } from '@/lib/format/money';
import { IncomeVsExpenseChart } from '../income-vs-expense-chart';
import type { IncomeVsExpenseDataPoint } from '../income-vs-expense-chart';

jest.mock('react-native-gifted-charts', () => ({
  PieChart: () => null,
  BarChart: () => {
    const React = require('react');
    const { View } = require('react-native');
    return React.createElement(View, { testID: 'gifted-bar-chart' });
  },
  LineChart: () => null,
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const SAMPLE_DATA: IncomeVsExpenseDataPoint[] = [
  { bucket: '2026-04-01', incomes: 80000, expenses: 55000 },
  { bucket: '2026-05-01', incomes: 75000, expenses: 62000 },
  { bucket: '2026-06-01', incomes: 90000, expenses: 48000 },
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('IncomeVsExpenseChart', () => {
  describe('with sample data', () => {
    it('renders without throwing', () => {
      expect(() =>
        render(<IncomeVsExpenseChart data={SAMPLE_DATA} currency="ARS" testID="ive" />),
      ).not.toThrow();
    });

    it('passes testID to the root container', () => {
      render(<IncomeVsExpenseChart data={SAMPLE_DATA} currency="ARS" testID="ive" />);
      expect(screen.getByTestId('ive')).toBeTruthy();
    });

    it('renders the BarChart component', () => {
      render(<IncomeVsExpenseChart data={SAMPLE_DATA} currency="ARS" testID="ive" />);
      expect(screen.getByTestId('gifted-bar-chart')).toBeTruthy();
    });

    it('shows "Ingresos" legend label', () => {
      render(<IncomeVsExpenseChart data={SAMPLE_DATA} currency="ARS" testID="ive" />);
      expect(screen.getByText('Ingresos')).toBeTruthy();
    });

    it('shows "Gastos" legend label', () => {
      render(<IncomeVsExpenseChart data={SAMPLE_DATA} currency="ARS" testID="ive" />);
      expect(screen.getByText('Gastos')).toBeTruthy();
    });

    it('accessible summary contains total incomes formatted amount (ARS)', () => {
      render(<IncomeVsExpenseChart data={SAMPLE_DATA} currency="ARS" testID="ive" />);
      const totalIncomes = SAMPLE_DATA.reduce((s, d) => s + d.incomes, 0); // 245000
      const formatted = formatMoney(totalIncomes, 'ARS');
      const summaryEl = screen.getByTestId('ive-a11y-summary');
      expect(summaryEl.props.accessibilityLabel).toContain(formatted);
    });

    it('accessible summary contains total expenses formatted amount (ARS)', () => {
      render(<IncomeVsExpenseChart data={SAMPLE_DATA} currency="ARS" testID="ive" />);
      const totalExpenses = SAMPLE_DATA.reduce((s, d) => s + d.expenses, 0); // 165000
      const formatted = formatMoney(totalExpenses, 'ARS');
      const summaryEl = screen.getByTestId('ive-a11y-summary');
      expect(summaryEl.props.accessibilityLabel).toContain(formatted);
    });

    it('renders correctly for USD currency', () => {
      render(<IncomeVsExpenseChart data={SAMPLE_DATA} currency="USD" testID="ive" />);
      expect(screen.getByTestId('ive')).toBeTruthy();
    });
  });

  describe('with empty data', () => {
    it('renders nothing (returns null) without throwing', () => {
      const { toJSON } = render(<IncomeVsExpenseChart data={[]} currency="ARS" testID="ive" />);
      expect(toJSON()).toBeNull();
    });

    it('does not render the testID container for empty data', () => {
      render(<IncomeVsExpenseChart data={[]} currency="ARS" testID="ive" />);
      expect(screen.queryByTestId('ive')).toBeNull();
    });
  });

  describe('with a single data point', () => {
    it('renders without throwing', () => {
      const single: IncomeVsExpenseDataPoint[] = [
        { bucket: '2026-06-01', incomes: 10000, expenses: 8000 },
      ];
      expect(() =>
        render(<IncomeVsExpenseChart data={single} currency="ARS" testID="ive" />),
      ).not.toThrow();
    });
  });

  describe('with zero incomes', () => {
    it('renders without throwing when incomes are zero', () => {
      const noIncomes: IncomeVsExpenseDataPoint[] = [
        { bucket: '2026-06-01', incomes: 0, expenses: 5000 },
      ];
      expect(() =>
        render(<IncomeVsExpenseChart data={noIncomes} currency="ARS" testID="ive" />),
      ).not.toThrow();
    });
  });
});
