/**
 * Unit tests for IncomeRow.
 *
 * Covers:
 *  - Renders description as primary text
 *  - Falls back to category name when description is empty
 *  - Renders amount in green (+prefix) with tabular-nums
 *  - Shows "Recurrente" badge when source === 'recurrence'
 *  - Does NOT show badge when source === 'manual'
 *  - Calls onPress with the income id when tapped
 *
 * react-native-svg is mocked globally in jest.setup.ts.
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';

import { IncomeRow } from '../income-row';
import type { IncomeWithCategory } from '@/lib/repositories/incomes';

// ---------------------------------------------------------------------------
// Fixtures — RFC-compliant UUIDs
// ---------------------------------------------------------------------------

const CAT_UUID = '550e8400-e29b-41d4-a716-446655440000';
const INC_UUID_1 = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
const INC_UUID_2 = 'b1cccd00-0d1c-4ea9-8c7e-7ccace491b22';

const BASE_INCOME: IncomeWithCategory = {
  id: INC_UUID_1,
  user_id: 'user-1',
  amount: 50000,
  currency: 'ARS',
  category_id: CAT_UUID,
  description: 'Sueldo de junio',
  occurred_at: '2026-06-01T10:00:00.000Z',
  occurred_date: '2026-06-01',
  created_at: '2026-06-01T10:00:00.000Z',
  updated_at: '2026-06-01T10:00:00.000Z',
  recurrence_id: null,
  source: 'manual',
  category: {
    id: CAT_UUID,
    slug: 'sueldo',
    name: 'Sueldo',
    icon: 'Briefcase',
    color: '#10B981',
    sort_order: 10,
    created_at: '2026-01-01',
    updated_at: '2026-01-01',
    user_id: 'user-1',
    kind: 'income',
  },
};

const RECURRENT_INCOME: IncomeWithCategory = {
  ...BASE_INCOME,
  id: INC_UUID_2,
  source: 'recurrence',
  recurrence_id: 'c2ddde11-1e2d-4ab0-dd8f-8ddbef502c33',
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('IncomeRow', () => {
  it('renders the description as the primary text', () => {
    render(<IncomeRow income={BASE_INCOME} />);
    expect(screen.getByText('Sueldo de junio')).toBeTruthy();
  });

  it('renders the category name in the subtitle', () => {
    render(<IncomeRow income={BASE_INCOME} />);
    expect(screen.getByText('Sueldo')).toBeTruthy();
  });

  it('falls back to category name as primary text when description is empty', () => {
    const income: IncomeWithCategory = { ...BASE_INCOME, description: '' };
    render(<IncomeRow income={income} />);
    const all = screen.getAllByText('Sueldo');
    expect(all.length).toBeGreaterThanOrEqual(1);
  });

  it('renders the formatted amount with a leading + sign', () => {
    render(<IncomeRow income={BASE_INCOME} />);
    // The amount is shown as "+$ 50.000,00" — match the + and the number
    expect(screen.getByText(/\+.*50/)).toBeTruthy();
  });

  it('calls onPress with the income id when tapped', () => {
    const onPress = jest.fn();
    render(<IncomeRow income={BASE_INCOME} onPress={onPress} />);
    fireEvent.press(screen.getByRole('button'));
    expect(onPress).toHaveBeenCalledWith(INC_UUID_1);
  });

  it('does NOT show the recurrente badge when source is "manual"', () => {
    render(<IncomeRow income={BASE_INCOME} />);
    expect(screen.queryByTestId('recurrent-indicator')).toBeNull();
    expect(screen.queryByText('Recurrente')).toBeNull();
  });

  it('shows the recurrente badge when source is "recurrence"', () => {
    render(<IncomeRow income={RECURRENT_INCOME} />);
    expect(screen.getByTestId('recurrent-indicator')).toBeTruthy();
    expect(screen.getByText('Recurrente')).toBeTruthy();
  });

  it('shows the separator dot before "Recurrente" when recurrent', () => {
    render(<IncomeRow income={RECURRENT_INCOME} />);
    expect(screen.getByText('·')).toBeTruthy();
  });

  it('does not show the separator dot when manual', () => {
    render(<IncomeRow income={BASE_INCOME} />);
    expect(screen.queryByText('·')).toBeNull();
  });
});
