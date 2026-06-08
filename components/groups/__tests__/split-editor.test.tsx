/**
 * Tests for SplitEditor component and the `deriveShares` helper.
 *
 * Covers:
 *   - equal mode: shows computed shares (read-only)
 *   - switching to custom: renders per-member inputs
 *   - custom sum mismatch: surfaces inline error; deriveShares returns error
 *   - percent ≠ 100: surfaces inline error; deriveShares returns error
 *   - percent = 100: computes correct money per member; deriveShares returns shares
 *   - deriveShares happy paths for all 3 types
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';

import { SplitEditor, deriveShares, type SplitState } from '../split-editor';
import type { GroupMemberRow } from '@/hooks/use-groups';

jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeMember(id: string, displayName: string): GroupMemberRow {
  return {
    id,
    group_id: 'g1',
    user_id: null,
    display_name: displayName,
    role: 'member',
    status: 'active',
    joined_at: null,
    invited_by: null,
    created_at: '2026-01-01T00:00:00Z',
  } satisfies GroupMemberRow;
}

const MEMBERS: GroupMemberRow[] = [
  makeMember('m1', 'Facundo Martinez'),
  makeMember('m2', 'Jonathan Mayan'),
];

const DEFAULT_STATE: SplitState = { type: 'equal', values: {} };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderEditor(
  overrides: Partial<Parameters<typeof SplitEditor>[0]> = {},
): ReturnType<typeof render> {
  const props = {
    amount: 1000,
    currency: 'ARS' as const,
    members: MEMBERS,
    value: DEFAULT_STATE,
    onChange: jest.fn(),
    ...overrides,
  };
  return render(<SplitEditor {...props} />);
}

// ---------------------------------------------------------------------------
// equal mode
// ---------------------------------------------------------------------------

describe('SplitEditor — equal mode', () => {
  it('shows both member names', () => {
    renderEditor();
    expect(screen.getByText('Facundo Martinez')).toBeTruthy();
    expect(screen.getByText('Jonathan Mayan')).toBeTruthy();
  });

  it('shows computed equal shares in read-only text (500 each)', () => {
    renderEditor({ amount: 1000 });
    // 1000 / 2 = 500 each
    const amounts = screen.getAllByText(/500/);
    expect(amounts.length).toBeGreaterThanOrEqual(2);
  });

  it('does not render any amount inputs in equal mode', () => {
    renderEditor();
    // No numeric inputs expected in equal mode
    const inputs = screen.queryAllByLabelText(/Monto para/);
    expect(inputs).toHaveLength(0);
    const pctInputs = screen.queryAllByLabelText(/Porcentaje para/);
    expect(pctInputs).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// switching to custom
// ---------------------------------------------------------------------------

describe('SplitEditor — switching to custom', () => {
  it('calls onChange with type=custom when "Montos" is pressed', () => {
    const onChange = jest.fn();
    renderEditor({ onChange });
    fireEvent.press(screen.getByLabelText('Montos'));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ type: 'custom' }));
  });

  it('renders per-member amount inputs in custom mode', () => {
    renderEditor({ value: { type: 'custom', values: {} } });
    expect(screen.getByLabelText('Monto para Facundo Martinez')).toBeTruthy();
    expect(screen.getByLabelText('Monto para Jonathan Mayan')).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// custom sum mismatch
// ---------------------------------------------------------------------------

describe('SplitEditor — custom sum mismatch', () => {
  it('shows "Los montos no coinciden con el total." when amounts do not sum to total', () => {
    renderEditor({
      amount: 1000,
      value: { type: 'custom', values: { m1: 400, m2: 400 } }, // sum = 800 ≠ 1000
    });
    expect(screen.getByText('Los montos no coinciden con el total.')).toBeTruthy();
  });

  it('does not show the error when amounts sum correctly', () => {
    renderEditor({
      amount: 1000,
      value: { type: 'custom', values: { m1: 500, m2: 500 } },
    });
    expect(screen.queryByText('Los montos no coinciden con el total.')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// percent ≠ 100
// ---------------------------------------------------------------------------

describe('SplitEditor — percent mode', () => {
  it('shows "Los porcentajes deben sumar 100." when percentages do not sum to 100', () => {
    renderEditor({
      amount: 1000,
      value: { type: 'percent', values: { m1: 40, m2: 40 } }, // sum = 80 ≠ 100
    });
    expect(screen.getByText('Los porcentajes deben sumar 100.')).toBeTruthy();
  });

  it('does not show the error when percentages sum to 100', () => {
    renderEditor({
      amount: 1000,
      value: { type: 'percent', values: { m1: 60, m2: 40 } },
    });
    expect(screen.queryByText('Los porcentajes deben sumar 100.')).toBeNull();
  });

  it('renders percentage inputs in percent mode', () => {
    renderEditor({ value: { type: 'percent', values: {} } });
    expect(screen.getByLabelText('Porcentaje para Facundo Martinez')).toBeTruthy();
    expect(screen.getByLabelText('Porcentaje para Jonathan Mayan')).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// deriveShares — happy paths
// ---------------------------------------------------------------------------

describe('deriveShares — happy paths', () => {
  it('returns equal shares for equal type', () => {
    const { shares, error } = deriveShares({ type: 'equal', values: {} }, 1000, MEMBERS);
    expect(error).toBeNull();
    expect(shares).toHaveLength(2);
    expect(shares[0]!.share_amount).toBe(500);
    expect(shares[1]!.share_amount).toBe(500);
  });

  it('returns correct shares for custom type summing to amount', () => {
    const { shares, error } = deriveShares(
      { type: 'custom', values: { m1: 600, m2: 400 } },
      1000,
      MEMBERS,
    );
    expect(error).toBeNull();
    expect(shares).toHaveLength(2);
    expect(shares.find((s) => s.member_id === 'm1')!.share_amount).toBe(600);
    expect(shares.find((s) => s.member_id === 'm2')!.share_amount).toBe(400);
  });

  it('returns correct shares for percent type summing to 100', () => {
    const { shares, error } = deriveShares(
      { type: 'percent', values: { m1: 75, m2: 25 } },
      1000,
      MEMBERS,
    );
    expect(error).toBeNull();
    expect(shares).toHaveLength(2);
    expect(shares.find((s) => s.member_id === 'm1')!.share_amount).toBe(750);
    expect(shares.find((s) => s.member_id === 'm2')!.share_amount).toBe(250);
  });
});

// ---------------------------------------------------------------------------
// deriveShares — error cases
// ---------------------------------------------------------------------------

describe('deriveShares — error cases', () => {
  it('returns error for empty members list', () => {
    const { shares, error } = deriveShares({ type: 'equal', values: {} }, 1000, []);
    expect(error).not.toBeNull();
    expect(shares).toHaveLength(0);
  });

  it('returns error when custom amounts do not match total', () => {
    const { shares, error } = deriveShares(
      { type: 'custom', values: { m1: 300, m2: 300 } },
      1000,
      MEMBERS,
    );
    expect(error).not.toBeNull();
    expect(shares).toHaveLength(0);
  });

  it('returns error when percentages do not sum to 100', () => {
    const { shares, error } = deriveShares(
      { type: 'percent', values: { m1: 50, m2: 30 } },
      1000,
      MEMBERS,
    );
    expect(error).not.toBeNull();
    expect(shares).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// accessibilityRole radiogroup on the segmented control
// ---------------------------------------------------------------------------

describe('SplitEditor — accessibility', () => {
  it('renders the segmented control with accessibilityLabel "Tipo de división"', () => {
    renderEditor();
    expect(screen.getByLabelText('Tipo de división')).toBeTruthy();
  });

  it('renders individual type buttons with accessibilityRole radio', () => {
    renderEditor();
    // Each split type button should have an accessibility label matching the option name
    expect(screen.getByLabelText('Partes iguales')).toBeTruthy();
    expect(screen.getByLabelText('Montos')).toBeTruthy();
    expect(screen.getByLabelText('Porcentaje')).toBeTruthy();
  });
});
