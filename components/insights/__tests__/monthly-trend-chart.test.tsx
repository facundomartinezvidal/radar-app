/**
 * Tests for MonthlyTrendChart (AC7.4).
 *
 * gifted-charts LineChart renders SVG; mock the module for jsdom.
 * react-native-svg is globally mocked in jest.setup.ts.
 */
import React from 'react';
import { render, screen } from '@testing-library/react-native';

import { formatMoney } from '@/lib/format/money';
import { MonthlyTrendChart } from '../monthly-trend-chart';
import type { ChartPoint } from '@/lib/insights/types';

jest.mock('react-native-gifted-charts', () => ({
  PieChart: () => null,
  BarChart: () => null,
  LineChart: () => {
    const React = require('react');
    const { View } = require('react-native');
    return React.createElement(View, { testID: 'gifted-line-chart' });
  },
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const SAMPLE_DATA: ChartPoint[] = [
  { bucket: '2026-04-01', total: 45000, count: 10 },
  { bucket: '2026-05-01', total: 38000, count: 8 },
  { bucket: '2026-06-01', total: 52000, count: 12 },
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('MonthlyTrendChart', () => {
  describe('with sample data', () => {
    it('renders without throwing', () => {
      expect(() =>
        render(<MonthlyTrendChart data={SAMPLE_DATA} currency="ARS" testID="trend" />),
      ).not.toThrow();
    });

    it('passes testID to the root container', () => {
      render(<MonthlyTrendChart data={SAMPLE_DATA} currency="ARS" testID="trend" />);
      expect(screen.getByTestId('trend')).toBeTruthy();
    });

    it('renders the LineChart component', () => {
      render(<MonthlyTrendChart data={SAMPLE_DATA} currency="ARS" testID="trend" />);
      expect(screen.getByTestId('gifted-line-chart')).toBeTruthy();
    });

    it('shows the ARS currency label', () => {
      render(<MonthlyTrendChart data={SAMPLE_DATA} currency="ARS" testID="trend" />);
      expect(screen.getByText('ARS')).toBeTruthy();
    });

    it('shows the USD currency label when prop is USD', () => {
      render(<MonthlyTrendChart data={SAMPLE_DATA} currency="USD" testID="trend" />);
      expect(screen.getByText('USD')).toBeTruthy();
    });

    it('accessible summary contains the total expense formatted amount (ARS)', () => {
      render(<MonthlyTrendChart data={SAMPLE_DATA} currency="ARS" testID="trend" />);
      const total = SAMPLE_DATA.reduce((s, d) => s + d.total, 0); // 135000
      const formatted = formatMoney(total, 'ARS');
      const summaryEl = screen.getByTestId('trend-a11y-summary');
      expect(summaryEl.props.accessibilityLabel).toContain(formatted);
    });

    it('accessible summary contains the total expense formatted amount (USD)', () => {
      render(<MonthlyTrendChart data={SAMPLE_DATA} currency="USD" testID="trend" />);
      const total = SAMPLE_DATA.reduce((s, d) => s + d.total, 0);
      const formatted = formatMoney(total, 'USD');
      const summaryEl = screen.getByTestId('trend-a11y-summary');
      expect(summaryEl.props.accessibilityLabel).toContain(formatted);
    });
  });

  describe('with empty data', () => {
    it('renders nothing (returns null) without throwing', () => {
      const { toJSON } = render(<MonthlyTrendChart data={[]} currency="ARS" testID="trend" />);
      expect(toJSON()).toBeNull();
    });

    it('does not render the testID container for empty data', () => {
      render(<MonthlyTrendChart data={[]} currency="ARS" testID="trend" />);
      expect(screen.queryByTestId('trend')).toBeNull();
    });
  });

  describe('with a single data point', () => {
    it('renders without throwing', () => {
      const single: ChartPoint[] = [{ bucket: '2026-06-01', total: 1500, count: 1 }];
      expect(() =>
        render(<MonthlyTrendChart data={single} currency="ARS" testID="trend" />),
      ).not.toThrow();
    });
  });

  describe('with all-zero totals', () => {
    it('renders without throwing when all totals are zero', () => {
      const zeros: ChartPoint[] = [
        { bucket: '2026-04-01', total: 0, count: 0 },
        { bucket: '2026-05-01', total: 0, count: 0 },
      ];
      expect(() =>
        render(<MonthlyTrendChart data={zeros} currency="ARS" testID="trend" />),
      ).not.toThrow();
    });
  });
});
