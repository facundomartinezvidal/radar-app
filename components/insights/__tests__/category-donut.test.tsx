/**
 * Tests for CategoryDonut (AC7.1).
 *
 * gifted-charts renders SVG internally via react-native-svg which is already
 * mocked globally in jest.setup.ts. We additionally mock the gifted-charts
 * module itself so the PieChart never tries to measure on-screen.
 */
import React from 'react';
import { render, screen } from '@testing-library/react-native';

import { formatMoney } from '@/lib/format/money';
import { CategoryDonut } from '../category-donut';
import type { CategorySlice } from '@/lib/insights/types';

jest.mock('react-native-gifted-charts', () => ({
  PieChart: (props: { centerLabelComponent?: () => React.ReactNode }) => {
    const React = require('react');
    const { View } = require('react-native');
    return React.createElement(
      View,
      { testID: 'gifted-pie-chart' },
      props.centerLabelComponent ? props.centerLabelComponent() : null,
    );
  },
  BarChart: () => null,
  LineChart: () => null,
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const SAMPLE_DATA: CategorySlice[] = [
  {
    categoryId: 'cat-1',
    name: 'Comida',
    color: '#F59E0B',
    icon: 'UtensilsCrossed',
    total: 5000,
    count: 3,
  },
  {
    categoryId: 'cat-2',
    name: 'Transporte',
    color: '#0077B6',
    icon: 'Car',
    total: 2000,
    count: 2,
  },
  {
    categoryId: null,
    name: 'Sin categoría',
    color: '#888888',
    icon: 'CircleDashed',
    total: 1000,
    count: 1,
  },
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CategoryDonut', () => {
  describe('with sample data', () => {
    it('renders without throwing', () => {
      expect(() =>
        render(<CategoryDonut data={SAMPLE_DATA} currency="ARS" testID="donut" />),
      ).not.toThrow();
    });

    it('passes testID to the root container', () => {
      render(<CategoryDonut data={SAMPLE_DATA} currency="ARS" testID="donut" />);
      expect(screen.getByTestId('donut')).toBeTruthy();
    });

    it('renders the PieChart component', () => {
      render(<CategoryDonut data={SAMPLE_DATA} currency="ARS" testID="donut" />);
      expect(screen.getByTestId('gifted-pie-chart')).toBeTruthy();
    });

    it('shows the formatted total in the center label', () => {
      render(<CategoryDonut data={SAMPLE_DATA} currency="ARS" testID="donut" />);
      const total = SAMPLE_DATA.reduce((s, d) => s + d.total, 0); // 8000
      const formatted = formatMoney(total, 'ARS');
      // formatMoney(8000, 'ARS') → "$ 8.000,00" — check substring
      expect(screen.getByText(formatted)).toBeTruthy();
    });

    it('renders "gastado" caption in the center label', () => {
      render(<CategoryDonut data={SAMPLE_DATA} currency="ARS" testID="donut" />);
      expect(screen.getByText('gastado')).toBeTruthy();
    });

    it('renders legend row for each category slice', () => {
      render(<CategoryDonut data={SAMPLE_DATA} currency="ARS" testID="donut" />);
      expect(screen.getByText('Comida')).toBeTruthy();
      expect(screen.getByText('Transporte')).toBeTruthy();
      expect(screen.getByText('Sin categoría')).toBeTruthy();
    });

    it('shows formatted amounts in the legend (ARS)', () => {
      render(<CategoryDonut data={SAMPLE_DATA} currency="ARS" testID="donut" />);
      expect(screen.getByText(formatMoney(5000, 'ARS'))).toBeTruthy();
      expect(screen.getByText(formatMoney(2000, 'ARS'))).toBeTruthy();
      expect(screen.getByText(formatMoney(1000, 'ARS'))).toBeTruthy();
    });

    it('shows formatted amounts in the legend (USD)', () => {
      render(<CategoryDonut data={SAMPLE_DATA} currency="USD" testID="donut" />);
      expect(screen.getByText(formatMoney(5000, 'USD'))).toBeTruthy();
    });

    it('shows percentage strings in the legend', () => {
      render(<CategoryDonut data={SAMPLE_DATA} currency="ARS" testID="donut" />);
      // 5000/8000 = 62.5%
      expect(screen.getByText('62.5%')).toBeTruthy();
      // 2000/8000 = 25.0%
      expect(screen.getByText('25.0%')).toBeTruthy();
    });
  });

  describe('with empty data', () => {
    it('renders nothing (returns null) without throwing', () => {
      const { toJSON } = render(<CategoryDonut data={[]} currency="ARS" testID="donut" />);
      expect(toJSON()).toBeNull();
    });

    it('does not render the testID container for empty data', () => {
      render(<CategoryDonut data={[]} currency="ARS" testID="donut" />);
      expect(screen.queryByTestId('donut')).toBeNull();
    });
  });

  describe('with single slice', () => {
    it('renders 100% for a single category', () => {
      const single: CategorySlice[] = [
        {
          categoryId: 'cat-1',
          name: 'Solo',
          color: '#EF4444',
          icon: 'Tag',
          total: 1500,
          count: 1,
        },
      ];
      render(<CategoryDonut data={single} currency="ARS" testID="donut" />);
      expect(screen.getByText('100.0%')).toBeTruthy();
    });
  });
});
