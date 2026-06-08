/**
 * Minimal smoke tests for ExpenseForm — verifies the Fecha (occurred_at) field
 * is rendered in both create and edit modes, the OCR suggestion CTA, and the
 * group config (who-paid + split-editor) extension.
 *
 * react-native-svg is mocked globally in jest.setup.ts.
 *
 * Note: jest.mock() calls below are hoisted above all imports by Jest at
 * runtime, so the effective execution order is: mock factories → module
 * imports → test bodies.
 */
import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react-native';
import { router } from 'expo-router';

import { ExpenseForm } from '../expense-form';
import type { CategoryRow } from '@/lib/repositories/expenses';
import type { GroupMemberRow, GroupWithMembers } from '@/lib/repositories/groups';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() },
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
}));

jest.mock('@react-native-community/datetimepicker', () => {
  const ReactLib = require('react');
  const { View } = require('react-native');
  const Mock = () => ReactLib.createElement(View, { testID: 'mock-datetimepicker' });
  Mock.displayName = 'MockDateTimePicker';
  return { __esModule: true, default: Mock };
});

jest.mock('@/hooks/use-categories', () => ({
  useCreateCategory: jest.fn(() => ({ mutateAsync: jest.fn(), isPending: false })),
  useUpdateCategory: jest.fn(() => ({ mutateAsync: jest.fn(), isPending: false })),
  useDeleteCategory: jest.fn(() => ({ mutateAsync: jest.fn(), isPending: false })),
}));

jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const CATEGORIES: CategoryRow[] = [
  {
    id: 'cat-1',
    slug: 'comida',
    name: 'Comida',
    icon: 'UtensilsCrossed',
    color: '#F59E0B',
    sort_order: 10,
    created_at: '2026-01-01',
    updated_at: '2026-01-01',
    user_id: null,
  },
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ExpenseForm', () => {
  it('renders the Fecha label in create mode', () => {
    render(<ExpenseForm categories={CATEGORIES} onSubmit={jest.fn()} />);
    expect(screen.getByText('Fecha')).toBeTruthy();
  });

  it('renders with a formatted date in create mode (today)', () => {
    render(<ExpenseForm categories={CATEGORIES} onSubmit={jest.fn()} />);
    // Should show the current year (today's date is the default occurred_at)
    const year = String(new Date().getFullYear());
    expect(screen.getByText(new RegExp(year))).toBeTruthy();
  });

  it('renders with an initial occurred_at in edit mode and shows the formatted date', () => {
    const initial = {
      id: 'exp-1',
      user_id: 'user-1',
      amount: 1500,
      currency: 'ARS',
      category_id: 'cat-1',
      description: 'Almuerzo',
      // March 10, 2026
      occurred_at: '2026-03-10T15:00:00.000Z',
      created_at: '2026-03-10T15:00:00.000Z',
      updated_at: '2026-03-10T15:00:00.000Z',
      group_id: null,
      paid_by_member_id: null,
      category: CATEGORIES[0] ?? null,
    } satisfies Parameters<typeof ExpenseForm>[0]['initial'] & object;

    render(
      <ExpenseForm
        categories={CATEGORIES}
        initial={initial}
        onSubmit={jest.fn()}
        submitLabel="Guardar cambios"
      />,
    );

    expect(screen.getByText('Fecha')).toBeTruthy();
    // "marzo" is the es-AR long month name for March
    expect(screen.getByText(/marzo/i)).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// OCR suggestion CTA / recommendation card
// ---------------------------------------------------------------------------

describe('ExpenseForm — OCR suggestion CTA', () => {
  it('renders the suggestion CTA when prefill has suggestedCategoryName and no category is selected', () => {
    render(
      <ExpenseForm
        categories={CATEGORIES}
        prefill={{ suggestedCategoryName: 'Farmacia' }}
        onSubmit={jest.fn()}
      />,
    );

    expect(screen.getByText('Crear categoría "Farmacia"')).toBeTruthy();
  });

  it('does NOT render the suggestion CTA when prefill has a matched category_id', () => {
    render(
      <ExpenseForm
        categories={CATEGORIES}
        prefill={{ suggestedCategoryName: 'Farmacia', category_id: 'cat-1' }}
        onSubmit={jest.fn()}
      />,
    );

    expect(screen.queryByText('Crear categoría "Farmacia"')).toBeNull();
  });

  it('does NOT render the suggestion CTA when prefill has no suggestedCategoryName', () => {
    render(<ExpenseForm categories={CATEGORIES} prefill={{ amount: 500 }} onSubmit={jest.fn()} />);

    expect(screen.queryByText(/Crear categoría/)).toBeNull();
  });

  it('does NOT render the suggestion CTA when no prefill is provided', () => {
    render(<ExpenseForm categories={CATEGORIES} onSubmit={jest.fn()} />);

    expect(screen.queryByText(/Crear categoría/)).toBeNull();
  });

  it('has accessibilityLabel "Crear categoría sugerida" on the CTA button', () => {
    render(
      <ExpenseForm
        categories={CATEGORIES}
        prefill={{ suggestedCategoryName: 'Farmacia' }}
        onSubmit={jest.fn()}
      />,
    );

    expect(screen.getByLabelText('Crear categoría sugerida')).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// OCR recommendation card — heading + reason text
// ---------------------------------------------------------------------------

describe('ExpenseForm — recommendation card content', () => {
  it('shows the recommended category name in the card heading', () => {
    render(
      <ExpenseForm
        categories={CATEGORIES}
        prefill={{ suggestedCategoryName: 'Ropa', suggestedCategoryReason: 'Es indumentaria.' }}
        onSubmit={jest.fn()}
      />,
    );

    expect(screen.getByText('Categoría recomendada: Ropa')).toBeTruthy();
  });

  it('shows the reason text when suggestedCategoryReason is provided', () => {
    render(
      <ExpenseForm
        categories={CATEGORIES}
        prefill={{
          suggestedCategoryName: 'Ropa',
          suggestedCategoryReason:
            'El comercio es Zara, una tienda de indumentaria; conviene una categoría de ropa separada de tus otros gastos.',
        }}
        onSubmit={jest.fn()}
      />,
    );

    expect(
      screen.getByText(
        'El comercio es Zara, una tienda de indumentaria; conviene una categoría de ropa separada de tus otros gastos.',
      ),
    ).toBeTruthy();
  });

  it('shows the fallback text when suggestedCategoryReason is absent', () => {
    render(
      <ExpenseForm
        categories={CATEGORIES}
        prefill={{ suggestedCategoryName: 'Ropa' }}
        onSubmit={jest.fn()}
      />,
    );

    expect(screen.getByText('Este gasto no encaja en tus categorías actuales.')).toBeTruthy();
  });

  it('shows the fallback text when suggestedCategoryReason is null', () => {
    render(
      <ExpenseForm
        categories={CATEGORIES}
        prefill={{ suggestedCategoryName: 'Ropa', suggestedCategoryReason: null }}
        onSubmit={jest.fn()}
      />,
    );

    expect(screen.getByText('Este gasto no encaja en tus categorías actuales.')).toBeTruthy();
  });

  it('does NOT render the recommendation card when category_id is matched', () => {
    render(
      <ExpenseForm
        categories={CATEGORIES}
        prefill={{
          suggestedCategoryName: 'Ropa',
          suggestedCategoryReason: 'Es indumentaria.',
          category_id: 'cat-1',
        }}
        onSubmit={jest.fn()}
      />,
    );

    expect(screen.queryByText('Categoría recomendada: Ropa')).toBeNull();
    expect(screen.queryByText('Es indumentaria.')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// GroupConfig extension
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

const GROUP_MEMBERS: GroupMemberRow[] = [
  makeMember('m1', 'Facundo Martinez'),
  makeMember('m2', 'Jonathan Mayan'),
];

describe('ExpenseForm — groupConfig', () => {
  it('renders ¿Quién pagó? label when groupConfig is provided', () => {
    render(
      <ExpenseForm
        categories={CATEGORIES}
        onSubmit={jest.fn()}
        groupConfig={{ members: GROUP_MEMBERS, currentMemberId: 'm1' }}
      />,
    );
    expect(screen.getByText('¿Quién pagó?')).toBeTruthy();
  });

  it('renders split editor section label "División" when groupConfig is provided', () => {
    render(
      <ExpenseForm
        categories={CATEGORIES}
        onSubmit={jest.fn()}
        groupConfig={{ members: GROUP_MEMBERS, currentMemberId: 'm1' }}
      />,
    );
    expect(screen.getByText('División')).toBeTruthy();
  });

  it('renders both member names in who-paid selector', () => {
    render(
      <ExpenseForm
        categories={CATEGORIES}
        onSubmit={jest.fn()}
        groupConfig={{ members: GROUP_MEMBERS, currentMemberId: 'm1' }}
      />,
    );
    // Both members should appear in the who-paid row
    const facundoElements = screen.getAllByText('Facundo Martinez');
    expect(facundoElements.length).toBeGreaterThanOrEqual(1);
    const jonathanElements = screen.getAllByText('Jonathan Mayan');
    expect(jonathanElements.length).toBeGreaterThanOrEqual(1);
  });

  it('does NOT render ¿Quién pagó? when groupConfig is absent', () => {
    render(<ExpenseForm categories={CATEGORIES} onSubmit={jest.fn()} />);
    expect(screen.queryByText('¿Quién pagó?')).toBeNull();
  });

  it('does NOT render División label when groupConfig is absent', () => {
    render(<ExpenseForm categories={CATEGORIES} onSubmit={jest.fn()} />);
    expect(screen.queryByText('División')).toBeNull();
  });

  it('calls onSubmitShared with paid_by_member_id, splits, and group_id on valid submit', async () => {
    const onSubmitShared = jest.fn().mockResolvedValue(undefined);
    render(
      <ExpenseForm
        categories={CATEGORIES}
        onSubmit={jest.fn()}
        onSubmitShared={onSubmitShared}
        groupConfig={{ members: GROUP_MEMBERS, currentMemberId: 'm1', groupId: 'g1' }}
        prefill={{ amount: 1000 }}
        submitLabel="Registrar gasto"
      />,
    );

    await act(async () => {
      fireEvent.press(screen.getByLabelText('Registrar gasto'));
    });

    expect(onSubmitShared).toHaveBeenCalledWith(
      expect.objectContaining({
        paid_by_member_id: 'm1',
        group_id: 'g1',
        splits: expect.arrayContaining([
          expect.objectContaining({ member_id: 'm1' }),
          expect.objectContaining({ member_id: 'm2' }),
        ]),
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// Share toggle (shareableGroups)
// ---------------------------------------------------------------------------

function makeGroup(id: string, name: string, members: GroupMemberRow[]): GroupWithMembers {
  return {
    id,
    name,
    icon: 'House',
    color: '#0077B6',
    created_by: 'u1',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    members,
  } as GroupWithMembers;
}

function makeMemberWithUser(
  id: string,
  displayName: string,
  userId: string | null,
): GroupMemberRow {
  return {
    id,
    group_id: 'g2',
    user_id: userId,
    display_name: displayName,
    role: 'member',
    status: 'active',
    joined_at: null,
    invited_by: null,
    created_at: '2026-01-01T00:00:00Z',
  } satisfies GroupMemberRow;
}

const TOGGLE_MEMBERS: GroupMemberRow[] = [
  makeMemberWithUser('m10', 'Facundo Martinez', 'u1'),
  makeMemberWithUser('m11', 'Jonathan Mayan', null),
];

const SHAREABLE_GROUPS: GroupWithMembers[] = [makeGroup('g2', 'Depto', TOGGLE_MEMBERS)];

describe('ExpenseForm — share toggle (shareableGroups)', () => {
  it('renders the ¿Gasto compartido? toggle when shareableGroups is non-empty and groupConfig is absent', () => {
    render(
      <ExpenseForm
        categories={CATEGORIES}
        shareableGroups={SHAREABLE_GROUPS}
        currentUserId="u1"
        onSubmit={jest.fn()}
      />,
    );
    expect(screen.getByLabelText('¿Gasto compartido?')).toBeTruthy();
  });

  it('renders the toggle even when shareableGroups is empty (discoverable)', () => {
    render(
      <ExpenseForm
        categories={CATEGORIES}
        shareableGroups={[]}
        currentUserId="u1"
        onSubmit={jest.fn()}
      />,
    );
    // The toggle must render so users with no groups can discover shared expenses
    expect(screen.getByLabelText('¿Gasto compartido?')).toBeTruthy();
  });

  it('does NOT render the toggle when shareableGroups is absent', () => {
    render(<ExpenseForm categories={CATEGORIES} onSubmit={jest.fn()} />);
    expect(screen.queryByLabelText('¿Gasto compartido?')).toBeNull();
  });

  it('does NOT render the toggle when groupConfig is provided (pre-bound group screen)', () => {
    render(
      <ExpenseForm
        categories={CATEGORIES}
        onSubmit={jest.fn()}
        groupConfig={{ members: GROUP_MEMBERS, currentMemberId: 'm1', groupId: 'g1' }}
        shareableGroups={SHAREABLE_GROUPS}
        currentUserId="u1"
      />,
    );
    expect(screen.queryByLabelText('¿Gasto compartido?')).toBeNull();
    // But who-paid is still shown (from groupConfig)
    expect(screen.getByText('¿Quién pagó?')).toBeTruthy();
  });

  // ---------------------------------------------------------------------------
  // Empty shareableGroups — discoverable empty state
  // ---------------------------------------------------------------------------

  it('shows "Todavía no tenés grupos." when toggle ON and shareableGroups is empty', () => {
    render(
      <ExpenseForm
        categories={CATEGORIES}
        shareableGroups={[]}
        currentUserId="u1"
        onSubmit={jest.fn()}
      />,
    );

    fireEvent.press(screen.getByLabelText('¿Gasto compartido?'));

    expect(screen.getByText('Todavía no tenés grupos.')).toBeTruthy();
  });

  it('shows "Crear grupo" CTA when toggle ON and shareableGroups is empty', () => {
    render(
      <ExpenseForm
        categories={CATEGORIES}
        shareableGroups={[]}
        currentUserId="u1"
        onSubmit={jest.fn()}
      />,
    );

    fireEvent.press(screen.getByLabelText('¿Gasto compartido?'));

    expect(screen.getByLabelText('Crear grupo')).toBeTruthy();
  });

  it('"Crear grupo" navigates to /(protected)/groups/new', () => {
    const mockPush = router.push as jest.Mock;
    render(
      <ExpenseForm
        categories={CATEGORIES}
        shareableGroups={[]}
        currentUserId="u1"
        onSubmit={jest.fn()}
      />,
    );

    fireEvent.press(screen.getByLabelText('¿Gasto compartido?'));
    fireEvent.press(screen.getByLabelText('Crear grupo'));

    expect(mockPush).toHaveBeenCalledWith('/(protected)/groups/new');
  });

  it('does NOT show group selector trigger when shareableGroups is empty and toggle is ON', () => {
    render(
      <ExpenseForm
        categories={CATEGORIES}
        shareableGroups={[]}
        currentUserId="u1"
        onSubmit={jest.fn()}
      />,
    );

    fireEvent.press(screen.getByLabelText('¿Gasto compartido?'));

    expect(screen.queryByLabelText('Elegí un grupo')).toBeNull();
  });

  it('blocks submit when toggle ON and shareableGroups is empty (does not call onSubmit or onSubmitShared)', async () => {
    const onSubmit = jest.fn().mockResolvedValue(undefined);
    const onSubmitShared = jest.fn();
    render(
      <ExpenseForm
        categories={CATEGORIES}
        shareableGroups={[]}
        currentUserId="u1"
        onSubmit={onSubmit}
        onSubmitShared={onSubmitShared}
        prefill={{ amount: 500 }}
        submitLabel="Registrar gasto"
      />,
    );

    // Toggle ON with no groups
    fireEvent.press(screen.getByLabelText('¿Gasto compartido?'));

    await act(async () => {
      fireEvent.press(screen.getByLabelText('Registrar gasto'));
    });

    expect(onSubmit).not.toHaveBeenCalled();
    expect(onSubmitShared).not.toHaveBeenCalled();
  });

  it('shows the group selector trigger after toggling ON', () => {
    render(
      <ExpenseForm
        categories={CATEGORIES}
        shareableGroups={SHAREABLE_GROUPS}
        currentUserId="u1"
        onSubmit={jest.fn()}
      />,
    );

    fireEvent.press(screen.getByLabelText('¿Gasto compartido?'));

    expect(screen.getByLabelText('Elegí un grupo')).toBeTruthy();
  });

  it('shows the group list when group selector trigger is pressed', () => {
    render(
      <ExpenseForm
        categories={CATEGORIES}
        shareableGroups={SHAREABLE_GROUPS}
        currentUserId="u1"
        onSubmit={jest.fn()}
      />,
    );

    // Toggle ON
    fireEvent.press(screen.getByLabelText('¿Gasto compartido?'));
    // Open group selector
    fireEvent.press(screen.getByLabelText('Elegí un grupo'));

    expect(screen.getByLabelText('Grupo Depto')).toBeTruthy();
  });

  it('shows ¿Quién pagó? and División after selecting a group', () => {
    render(
      <ExpenseForm
        categories={CATEGORIES}
        shareableGroups={SHAREABLE_GROUPS}
        currentUserId="u1"
        onSubmit={jest.fn()}
      />,
    );

    // Toggle ON
    fireEvent.press(screen.getByLabelText('¿Gasto compartido?'));
    // Open and select group
    fireEvent.press(screen.getByLabelText('Elegí un grupo'));
    fireEvent.press(screen.getByLabelText('Grupo Depto'));

    expect(screen.getByText('¿Quién pagó?')).toBeTruthy();
    expect(screen.getByText('División')).toBeTruthy();
  });

  it('blocks submit with "Elegí un grupo." when toggle is ON but no group selected', async () => {
    render(
      <ExpenseForm
        categories={CATEGORIES}
        shareableGroups={SHAREABLE_GROUPS}
        currentUserId="u1"
        onSubmit={jest.fn()}
        prefill={{ amount: 500 }}
        submitLabel="Registrar gasto"
      />,
    );

    // Toggle ON without selecting a group
    fireEvent.press(screen.getByLabelText('¿Gasto compartido?'));

    await act(async () => {
      fireEvent.press(screen.getByLabelText('Registrar gasto'));
    });

    expect(screen.getByText('Elegí un grupo.')).toBeTruthy();
  });

  it('calls onSubmitShared with group_id when toggle ON + group selected + valid form', async () => {
    const onSubmitShared = jest.fn().mockResolvedValue(undefined);
    render(
      <ExpenseForm
        categories={CATEGORIES}
        shareableGroups={SHAREABLE_GROUPS}
        currentUserId="u1"
        onSubmit={jest.fn()}
        onSubmitShared={onSubmitShared}
        prefill={{ amount: 1000 }}
        submitLabel="Registrar gasto"
      />,
    );

    // Toggle ON
    fireEvent.press(screen.getByLabelText('¿Gasto compartido?'));
    // Open and select group
    fireEvent.press(screen.getByLabelText('Elegí un grupo'));
    fireEvent.press(screen.getByLabelText('Grupo Depto'));

    await act(async () => {
      fireEvent.press(screen.getByLabelText('Registrar gasto'));
    });

    expect(onSubmitShared).toHaveBeenCalledWith(
      expect.objectContaining({
        group_id: 'g2',
        paid_by_member_id: expect.any(String),
        splits: expect.arrayContaining([
          expect.objectContaining({ member_id: expect.any(String) }),
        ]),
      }),
    );
  });

  it('calls personal onSubmit (not onSubmitShared) when toggle is OFF', async () => {
    const onSubmit = jest.fn().mockResolvedValue(undefined);
    const onSubmitShared = jest.fn();
    render(
      <ExpenseForm
        categories={CATEGORIES}
        shareableGroups={SHAREABLE_GROUPS}
        currentUserId="u1"
        onSubmit={onSubmit}
        onSubmitShared={onSubmitShared}
        prefill={{ amount: 500 }}
        submitLabel="Registrar gasto"
      />,
    );

    // Do NOT toggle — keep toggle OFF (default)
    await act(async () => {
      fireEvent.press(screen.getByLabelText('Registrar gasto'));
    });

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ amount: 500 }));
    expect(onSubmitShared).not.toHaveBeenCalled();
  });
});
