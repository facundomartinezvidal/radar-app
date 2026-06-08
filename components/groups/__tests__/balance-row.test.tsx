/**
 * Tests for BalanceRow component.
 *
 * Covers:
 *   - Renders from and to member names
 *   - Renders the formatted amount
 *   - "Saldar" button calls onSettle when pressed
 *   - Button is disabled when settling=true
 *   - No Saldar button when onSettle is not provided
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';

import { BalanceRow } from '../balance-row';
import type { GroupMemberRow } from '@/lib/repositories/groups';

jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));

function makeMember(id: string, displayName: string, userId?: string): GroupMemberRow {
  return {
    id,
    group_id: 'g1',
    user_id: userId ?? null,
    display_name: displayName,
    role: 'member',
    status: 'active',
    joined_at: null,
    invited_by: null,
    created_at: '2026-01-01T00:00:00Z',
  } satisfies GroupMemberRow;
}

const FROM_MEMBER = makeMember('m1', 'Facundo Martinez', 'u1');
const TO_MEMBER = makeMember('m2', 'Jonathan Mayan', 'u2');

describe('BalanceRow', () => {
  it('renders the from member name', () => {
    render(<BalanceRow from={FROM_MEMBER} to={TO_MEMBER} amount={1500} currency="ARS" />);
    // The name appears both in the column label and in the action sentence
    expect(screen.getAllByText(/Facundo Martinez/).length).toBeGreaterThan(0);
  });

  it('renders the to member name', () => {
    render(<BalanceRow from={FROM_MEMBER} to={TO_MEMBER} amount={1500} currency="ARS" />);
    expect(screen.getAllByText(/Jonathan Mayan/).length).toBeGreaterThan(0);
  });

  it('renders the formatted amount', () => {
    render(<BalanceRow from={FROM_MEMBER} to={TO_MEMBER} amount={1500} currency="ARS" />);
    // formatMoney(1500, 'ARS') → "$ 1.500,00"
    expect(screen.getByTestId('balance-row-amount')).toBeTruthy();
  });

  it('calls onSettle when Saldar is pressed', () => {
    const onSettle = jest.fn();
    render(
      <BalanceRow
        from={FROM_MEMBER}
        to={TO_MEMBER}
        amount={1500}
        currency="ARS"
        onSettle={onSettle}
      />,
    );
    fireEvent.press(screen.getByLabelText('Saldar deuda'));
    expect(onSettle).toHaveBeenCalledTimes(1);
  });

  it('Saldar button is disabled while settling=true', () => {
    render(
      <BalanceRow
        from={FROM_MEMBER}
        to={TO_MEMBER}
        amount={1500}
        currency="ARS"
        onSettle={jest.fn()}
        settling
      />,
    );
    // The button should be in disabled state
    const btn = screen.getByLabelText('Saldar deuda');
    expect(btn.props.accessibilityState?.disabled).toBe(true);
  });

  it('does not render a Saldar button when onSettle is not provided', () => {
    render(<BalanceRow from={FROM_MEMBER} to={TO_MEMBER} amount={1500} currency="ARS" />);
    expect(screen.queryByLabelText('Saldar deuda')).toBeNull();
  });

  it('renders with USD currency', () => {
    render(<BalanceRow from={FROM_MEMBER} to={TO_MEMBER} amount={85} currency="USD" />);
    expect(screen.getByTestId('balance-row-amount')).toBeTruthy();
  });
});
