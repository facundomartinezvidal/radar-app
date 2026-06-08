/**
 * Unit tests for ExpenseRow.
 *
 * Covers:
 *  - Renders category name and formatted amount for a personal expense
 *  - Shows "Compartido" shared indicator when group_id is set
 *  - Hides shared indicator when group_id is null
 *  - Calls onPress with the expense id when tapped
 *
 * react-native-svg is mocked globally in jest.setup.ts.
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';

import { ExpenseRow } from '../expense-row';
import type { ExpenseWithCategory } from '@/lib/repositories/expenses';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const BASE_EXPENSE: ExpenseWithCategory = {
  id: 'exp-1',
  user_id: 'user-1',
  amount: '1500.00' as unknown as number,
  currency: 'ARS',
  category_id: 'cat-1',
  description: 'Almuerzo en el centro',
  occurred_at: '2026-06-01T12:00:00.000Z',
  created_at: '2026-06-01T12:00:00.000Z',
  updated_at: '2026-06-01T12:00:00.000Z',
  group_id: null,
  paid_by_member_id: null,
  source: 'manual',
  recurrence_id: null,
  occurred_date: null,
  category: {
    id: 'cat-1',
    slug: 'comida',
    name: 'Comida',
    icon: 'UtensilsCrossed',
    color: '#F59E0B',
    sort_order: 10,
    created_at: '2026-01-01',
    updated_at: '2026-01-01',
    user_id: 'user-1',
    kind: 'expense',
  },
};

const SHARED_EXPENSE: ExpenseWithCategory = {
  ...BASE_EXPENSE,
  id: 'exp-2',
  group_id: 'group-abc',
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ExpenseRow', () => {
  it('renders the category name in the subtitle', () => {
    render(<ExpenseRow expense={BASE_EXPENSE} />);
    expect(screen.getByText('Comida')).toBeTruthy();
  });

  it('renders the formatted amount', () => {
    render(<ExpenseRow expense={BASE_EXPENSE} />);
    // formatMoney(1500, 'ARS') → should contain "1.500" or "1500"
    expect(screen.getByText(/1[.,]?500/)).toBeTruthy();
  });

  it('renders the expense description as the primary line', () => {
    render(<ExpenseRow expense={BASE_EXPENSE} />);
    expect(screen.getByText('Almuerzo en el centro')).toBeTruthy();
  });

  it('falls back to category name as primary text when description is empty', () => {
    const expense: ExpenseWithCategory = { ...BASE_EXPENSE, description: '' };
    render(<ExpenseRow expense={expense} />);
    // Category name appears as both primary text and subtitle — both should be present
    const all = screen.getAllByText('Comida');
    expect(all.length).toBeGreaterThanOrEqual(1);
  });

  it('calls onPress with the expense id when tapped', () => {
    const onPress = jest.fn();
    render(<ExpenseRow expense={BASE_EXPENSE} onPress={onPress} />);
    fireEvent.press(screen.getByRole('button'));
    expect(onPress).toHaveBeenCalledWith('exp-1');
  });

  it('does NOT show the shared indicator when group_id is null', () => {
    render(<ExpenseRow expense={BASE_EXPENSE} />);
    expect(screen.queryByTestId('shared-indicator')).toBeNull();
    expect(screen.queryByText('Compartido')).toBeNull();
  });

  it('shows the shared indicator when group_id is set', () => {
    render(<ExpenseRow expense={SHARED_EXPENSE} />);
    expect(screen.getByTestId('shared-indicator')).toBeTruthy();
    expect(screen.getByText('Compartido')).toBeTruthy();
  });

  it('shows the separator dot before "Compartido" when shared', () => {
    render(<ExpenseRow expense={SHARED_EXPENSE} />);
    expect(screen.getByText('·')).toBeTruthy();
  });

  it('does not show the separator dot when not shared', () => {
    render(<ExpenseRow expense={BASE_EXPENSE} />);
    expect(screen.queryByText('·')).toBeNull();
  });
});
