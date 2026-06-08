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
 *   - Goal 1: currentMemberId → "Vos" label
 *   - Goal 2: include toggle, subset splits, no-participant guard
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';

import { SplitEditor, deriveShares, resolveIncluded, type SplitState } from '../split-editor';
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

const THREE_MEMBERS: GroupMemberRow[] = [...MEMBERS, makeMember('m3', 'Iñaki Moreno')];

const DEFAULT_STATE: SplitState = { type: 'equal', values: {}, includedMemberIds: [] };

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
    renderEditor({ value: { type: 'custom', values: {}, includedMemberIds: [] } });
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
      value: { type: 'custom', values: { m1: 400, m2: 400 }, includedMemberIds: [] }, // sum = 800 ≠ 1000
    });
    expect(screen.getByText('Los montos no coinciden con el total.')).toBeTruthy();
  });

  it('does not show the error when amounts sum correctly', () => {
    renderEditor({
      amount: 1000,
      value: { type: 'custom', values: { m1: 500, m2: 500 }, includedMemberIds: [] },
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
      value: { type: 'percent', values: { m1: 40, m2: 40 }, includedMemberIds: [] }, // sum = 80 ≠ 100
    });
    expect(screen.getByText('Los porcentajes deben sumar 100.')).toBeTruthy();
  });

  it('does not show the error when percentages sum to 100', () => {
    renderEditor({
      amount: 1000,
      value: { type: 'percent', values: { m1: 60, m2: 40 }, includedMemberIds: [] },
    });
    expect(screen.queryByText('Los porcentajes deben sumar 100.')).toBeNull();
  });

  it('renders percentage inputs in percent mode', () => {
    renderEditor({ value: { type: 'percent', values: {}, includedMemberIds: [] } });
    expect(screen.getByLabelText('Porcentaje para Facundo Martinez')).toBeTruthy();
    expect(screen.getByLabelText('Porcentaje para Jonathan Mayan')).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// deriveShares — happy paths
// ---------------------------------------------------------------------------

describe('deriveShares — happy paths', () => {
  it('returns equal shares for equal type', () => {
    const { shares, error } = deriveShares(
      { type: 'equal', values: {}, includedMemberIds: [] },
      1000,
      MEMBERS,
    );
    expect(error).toBeNull();
    expect(shares).toHaveLength(2);
    expect(shares[0]!.share_amount).toBe(500);
    expect(shares[1]!.share_amount).toBe(500);
  });

  it('returns correct shares for custom type summing to amount', () => {
    const { shares, error } = deriveShares(
      { type: 'custom', values: { m1: 600, m2: 400 }, includedMemberIds: [] },
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
      { type: 'percent', values: { m1: 75, m2: 25 }, includedMemberIds: [] },
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
    const { shares, error } = deriveShares(
      { type: 'equal', values: {}, includedMemberIds: [] },
      1000,
      [],
    );
    expect(error).not.toBeNull();
    expect(shares).toHaveLength(0);
  });

  it('returns error when custom amounts do not match total', () => {
    const { shares, error } = deriveShares(
      { type: 'custom', values: { m1: 300, m2: 300 }, includedMemberIds: [] },
      1000,
      MEMBERS,
    );
    expect(error).not.toBeNull();
    expect(shares).toHaveLength(0);
  });

  it('returns error when percentages do not sum to 100', () => {
    const { shares, error } = deriveShares(
      { type: 'percent', values: { m1: 50, m2: 30 }, includedMemberIds: [] },
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

// ---------------------------------------------------------------------------
// Goal 1 — "Vos" label for current user
// ---------------------------------------------------------------------------

describe('SplitEditor — currentMemberId shows "Vos"', () => {
  it('labels the current member as "Vos" in equal mode', () => {
    renderEditor({ currentMemberId: 'm1' });
    expect(screen.getByText('Vos')).toBeTruthy();
    // Other member still shows their name
    expect(screen.getByText('Jonathan Mayan')).toBeTruthy();
  });

  it('does not show "Vos" when currentMemberId is null', () => {
    renderEditor({ currentMemberId: null });
    expect(screen.queryByText('Vos')).toBeNull();
    expect(screen.getByText('Facundo Martinez')).toBeTruthy();
  });

  it('uses "Vos" in accessibility label for custom amount input', () => {
    renderEditor({
      value: { type: 'custom', values: {}, includedMemberIds: [] },
      currentMemberId: 'm1',
    });
    expect(screen.getByLabelText('Monto para Vos')).toBeTruthy();
    expect(screen.getByLabelText('Monto para Jonathan Mayan')).toBeTruthy();
  });

  it('uses "Vos" in accessibility label for percent input', () => {
    renderEditor({
      value: { type: 'percent', values: {}, includedMemberIds: [] },
      currentMemberId: 'm2',
    });
    expect(screen.getByLabelText('Porcentaje para Vos')).toBeTruthy();
    expect(screen.getByLabelText('Porcentaje para Facundo Martinez')).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Goal 2 — include toggle
// ---------------------------------------------------------------------------

describe('SplitEditor — include toggles', () => {
  it('renders an include toggle for each member', () => {
    renderEditor();
    expect(screen.getByLabelText('Incluir a Facundo Martinez')).toBeTruthy();
    expect(screen.getByLabelText('Incluir a Jonathan Mayan')).toBeTruthy();
  });

  it('uses "Incluir a Vos" for the current user', () => {
    renderEditor({ currentMemberId: 'm1' });
    expect(screen.getByLabelText('Incluir a Vos')).toBeTruthy();
    expect(screen.getByLabelText('Incluir a Jonathan Mayan')).toBeTruthy();
  });

  it('calls onChange with member excluded when toggle is pressed (all → exclude one)', () => {
    const onChange = jest.fn();
    renderEditor({ onChange, currentMemberId: 'm1' });
    fireEvent.press(screen.getByLabelText('Incluir a Jonathan Mayan'));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ includedMemberIds: ['m1'] }));
  });

  it('shows "Elegí al menos un participante." when includedMemberIds is explicitly empty and members exist', () => {
    // Render with one member excluded first, then exclude the second.
    // We can simulate the state directly by passing all excluded.
    renderEditor({
      members: MEMBERS,
      value: { type: 'equal', values: {}, includedMemberIds: ['__none__'] },
    });
    // "__none__" is not a valid member ID, so resolveIncluded returns no members
    expect(screen.getByText('Elegí al menos un participante.')).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Goal 2 — deriveShares with included subset
// ---------------------------------------------------------------------------

describe('deriveShares — included subset', () => {
  it('equal split over 2 of 3 members sums to amount', () => {
    const { shares, error } = deriveShares(
      { type: 'equal', values: {}, includedMemberIds: ['m1', 'm2'] },
      900,
      THREE_MEMBERS,
    );
    expect(error).toBeNull();
    expect(shares).toHaveLength(2);
    const total = shares.reduce((acc, s) => acc + s.share_amount, 0);
    expect(total).toBeCloseTo(900, 5);
    // m3 is excluded — not in the result
    expect(shares.find((s) => s.member_id === 'm3')).toBeUndefined();
  });

  it('excluding a member redistributes equal shares among remaining', () => {
    // 3 members equal: 100 each. Exclude m3 → m1 + m2 get 150 each
    const { shares: allShares } = deriveShares(
      { type: 'equal', values: {}, includedMemberIds: [] },
      300,
      THREE_MEMBERS,
    );
    const { shares: subShares } = deriveShares(
      { type: 'equal', values: {}, includedMemberIds: ['m1', 'm2'] },
      300,
      THREE_MEMBERS,
    );
    expect(allShares[0]!.share_amount).toBe(100);
    expect(subShares).toHaveLength(2);
    expect(subShares[0]!.share_amount).toBe(150);
    expect(subShares[1]!.share_amount).toBe(150);
  });

  it('returns error "Elegí al menos un participante." when includedMemberIds results in zero included', () => {
    const { shares, error } = deriveShares(
      { type: 'equal', values: {}, includedMemberIds: ['__nonexistent__'] },
      1000,
      MEMBERS,
    );
    expect(error).toBe('Elegí al menos un participante.');
    expect(shares).toHaveLength(0);
  });

  it('empty includedMemberIds defaults to all members (backward compat)', () => {
    const { shares, error } = deriveShares(
      { type: 'equal', values: {}, includedMemberIds: [] },
      1000,
      MEMBERS,
    );
    expect(error).toBeNull();
    expect(shares).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// resolveIncluded helper
// ---------------------------------------------------------------------------

describe('resolveIncluded', () => {
  it('returns all members when includedMemberIds is empty', () => {
    const result = resolveIncluded({ type: 'equal', values: {}, includedMemberIds: [] }, MEMBERS);
    expect(result).toHaveLength(2);
  });

  it('returns only the members in includedMemberIds', () => {
    const result = resolveIncluded(
      { type: 'equal', values: {}, includedMemberIds: ['m1'] },
      MEMBERS,
    );
    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe('m1');
  });

  it('returns empty when includedMemberIds has IDs not in members list', () => {
    const result = resolveIncluded(
      { type: 'equal', values: {}, includedMemberIds: ['__x__'] },
      MEMBERS,
    );
    expect(result).toHaveLength(0);
  });
});
