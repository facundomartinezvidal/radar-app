/**
 * Tests for PeriodBarChart (AC7.2 / HU-24).
 *
 * gifted-charts BarChart renders SVG; mock the module so tests run in jsdom.
 * react-native-svg is globally mocked in jest.setup.ts.
 */
import React from 'react';
import { render, screen } from '@testing-library/react-native';

import { formatMoney } from '@/lib/format/money';
import { PeriodBarChart } from '../period-bar-chart';
import type { ChartPoint } from '@/lib/insights/types';

jest.mock('react-native-gifted-charts', () => ({
  PieChart: () => null,
  BarChart: (props: { data?: { value: number }[] }) => {
    const React = require('react');
    const { View } = require('react-native');
    return React.createElement(View, { testID: 'gifted-bar-chart' });
  },
  LineChart: () => null,
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const MONTHLY_DATA: ChartPoint[] = [
  { bucket: '2026-04-01', total: 12000, count: 5 },
  { bucket: '2026-05-01', total: 8500, count: 4 },
  { bucket: '2026-06-01', total: 15000, count: 7 },
];

const DAY_DATA: ChartPoint[] = [
  { bucket: '2026-06-01', total: 200, count: 1 },
  { bucket: '2026-06-02', total: 350, count: 2 },
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PeriodBarChart', () => {
  describe('with monthly data', () => {
    it('renders without throwing', () => {
      expect(() =>
        render(<PeriodBarChart data={MONTHLY_DATA} currency="ARS" testID="bar" />),
      ).not.toThrow();
    });

    it('passes testID to the root container', () => {
      render(<PeriodBarChart data={MONTHLY_DATA} currency="ARS" testID="bar" />);
      expect(screen.getByTestId('bar')).toBeTruthy();
    });

    it('renders the BarChart component', () => {
      render(<PeriodBarChart data={MONTHLY_DATA} currency="ARS" testID="bar" />);
      expect(screen.getByTestId('gifted-bar-chart')).toBeTruthy();
    });

    it('shows the currency label (ARS)', () => {
      render(<PeriodBarChart data={MONTHLY_DATA} currency="ARS" testID="bar" />);
      expect(screen.getByText('ARS')).toBeTruthy();
    });

    it('shows the currency label (USD)', () => {
      render(<PeriodBarChart data={MONTHLY_DATA} currency="USD" testID="bar" />);
      expect(screen.getByText('USD')).toBeTruthy();
    });

    it('includes accessible summary view with max formatted amount', () => {
      render(<PeriodBarChart data={MONTHLY_DATA} currency="ARS" testID="bar" />);
      // Max is 15000 — the accessible View has accessibilityLabel containing this
      // Use testID to locate the summary element then check its accessibilityLabel
      const summaryEl = screen.getByTestId('bar-a11y-summary');
      expect(summaryEl.props.accessibilityLabel).toContain(formatMoney(15000, 'ARS'));
    });
  });

  describe('with day-granularity data', () => {
    it('renders without throwing', () => {
      expect(() =>
        render(<PeriodBarChart data={DAY_DATA} currency="ARS" testID="bar" />),
      ).not.toThrow();
    });
  });

  describe('with empty data', () => {
    it('renders nothing (returns null) without throwing', () => {
      const { toJSON } = render(<PeriodBarChart data={[]} currency="ARS" testID="bar" />);
      expect(toJSON()).toBeNull();
    });

    it('does not render the testID container for empty data', () => {
      render(<PeriodBarChart data={[]} currency="ARS" testID="bar" />);
      expect(screen.queryByTestId('bar')).toBeNull();
    });
  });

  describe('with single data point', () => {
    it('renders without throwing', () => {
      const single: ChartPoint[] = [{ bucket: '2026-06-01', total: 500, count: 1 }];
      expect(() =>
        render(<PeriodBarChart data={single} currency="ARS" testID="bar" />),
      ).not.toThrow();
    });
  });
});
