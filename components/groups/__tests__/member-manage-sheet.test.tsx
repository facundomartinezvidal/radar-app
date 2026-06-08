/**
 * Tests for MemberManageSheet component.
 *
 * Covers:
 *   - Renders sheet title "Miembros" when visible
 *   - Does not render when not visible
 *   - Lists all members with their names
 *   - Shows "Vos" label for the current user
 *   - Shows "Pendiente" pill for pending members
 *   - Rename button shown ONLY for placeholders (user_id == null)
 *   - Remove button hidden for the group owner
 *   - Remove button hidden for the current user
 *   - Remove button shown for other regular members
 *   - Pressing remove shows Alert.alert confirmation with correct copy
 *   - Confirming removal calls useRemoveMember
 *   - Pressing rename button shows inline RenameForm (input visible)
 *   - RenameForm validates empty name
 *   - RenameForm calls useUpdateMember on valid submit
 *   - Close button calls onClose
 */
import React from 'react';
import { Alert } from 'react-native';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';

import { MemberManageSheet } from '../member-manage-sheet';
import type { GroupMemberRow } from '@/hooks/use-groups';

jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));

// ---------------------------------------------------------------------------
// Hook mocks
// ---------------------------------------------------------------------------

const mockUpdateMutateAsync = jest.fn();
const mockRemoveMutateAsync = jest.fn();

jest.mock('@/hooks/use-groups', () => ({
  useUpdateMember: jest.fn(() => ({
    mutateAsync: mockUpdateMutateAsync,
    isPending: false,
  })),
  useRemoveMember: jest.fn(() => ({
    mutateAsync: mockRemoveMutateAsync,
    isPending: false,
  })),
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeMember(
  id: string,
  displayName: string | null,
  userId: string | null,
  role: 'owner' | 'member' = 'member',
  status: 'active' | 'pending' | 'placeholder' = 'active',
): GroupMemberRow {
  return {
    id,
    group_id: 'g1',
    user_id: userId,
    display_name: displayName,
    role,
    status,
    joined_at: null,
    invited_by: null,
    created_at: '2026-01-01T00:00:00Z',
  } satisfies GroupMemberRow;
}

// m-owner: current user, is the owner (user_id=u1, role=owner)
// m-reg: registered user (user_id=u2, role=member)
// m-placeholder: anonymous placeholder (user_id=null)
// m-pending: pending invite (user_id=u3, status=pending)
const OWNER = makeMember('m-owner', 'Facundo Martinez', 'u1', 'owner', 'active');
const REG_MEMBER = makeMember('m-reg', 'Jonathan Mayan', 'u2', 'member', 'active');
const PLACEHOLDER = makeMember('m-placeholder', 'Carlos Sin Cuenta', null, 'member', 'placeholder');
const PENDING_MEMBER = makeMember('m-pending', 'Iñaki Moreno', 'u3', 'member', 'pending');

const ALL_MEMBERS = [OWNER, REG_MEMBER, PLACEHOLDER, PENDING_MEMBER];

const DEFAULT_PROPS = {
  visible: true,
  groupId: 'g1',
  members: ALL_MEMBERS,
  currentUserId: 'u1',
  ownerMemberId: 'm-owner',
  onClose: jest.fn(),
};

function renderSheet(overrides?: Partial<typeof DEFAULT_PROPS>): void {
  render(<MemberManageSheet {...DEFAULT_PROPS} {...overrides} />);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('MemberManageSheet', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUpdateMutateAsync.mockResolvedValue({ id: 'm-placeholder', display_name: 'Nuevo Nombre' });
    mockRemoveMutateAsync.mockResolvedValue({ id: 'm-reg' });
  });

  // -------------------------------------------------------------------------
  // Basic render
  // -------------------------------------------------------------------------

  it('renders sheet title "Miembros" when visible', () => {
    renderSheet();
    expect(screen.getByText('Miembros')).toBeTruthy();
  });

  it('does not render sheet content when not visible', () => {
    renderSheet({ visible: false });
    expect(screen.queryByText('Miembros')).toBeNull();
  });

  // -------------------------------------------------------------------------
  // Member list display
  // -------------------------------------------------------------------------

  it('shows "Vos" for the current user', () => {
    renderSheet();
    expect(screen.getByText('Vos')).toBeTruthy();
  });

  it('shows the display_name of a registered member', () => {
    renderSheet();
    expect(screen.getByText('Jonathan Mayan')).toBeTruthy();
  });

  it('shows the display_name of a placeholder', () => {
    renderSheet();
    expect(screen.getByText('Carlos Sin Cuenta')).toBeTruthy();
  });

  it('shows "Pendiente" pill for pending members', () => {
    renderSheet();
    expect(screen.getByTestId(`pending-pill-${PENDING_MEMBER.id}`)).toBeTruthy();
  });

  it('does not show "Pendiente" pill for active members', () => {
    renderSheet();
    expect(screen.queryByTestId(`pending-pill-${REG_MEMBER.id}`)).toBeNull();
  });

  // -------------------------------------------------------------------------
  // Rename guards — only for placeholders
  // -------------------------------------------------------------------------

  it('shows rename button for placeholder members', () => {
    renderSheet();
    expect(screen.getByTestId(`rename-button-${PLACEHOLDER.id}`)).toBeTruthy();
  });

  it('does not show rename button for the current (registered) user', () => {
    renderSheet();
    expect(screen.queryByTestId(`rename-button-${OWNER.id}`)).toBeNull();
  });

  it('does not show rename button for other registered members', () => {
    renderSheet();
    expect(screen.queryByTestId(`rename-button-${REG_MEMBER.id}`)).toBeNull();
  });

  it('does not show rename button for a pending registered member', () => {
    // PENDING_MEMBER has user_id set, so rename should not appear
    renderSheet();
    expect(screen.queryByTestId(`rename-button-${PENDING_MEMBER.id}`)).toBeNull();
  });

  // -------------------------------------------------------------------------
  // Remove guards
  // -------------------------------------------------------------------------

  it('does not show remove button for the group owner', () => {
    renderSheet();
    expect(screen.queryByTestId(`remove-button-${OWNER.id}`)).toBeNull();
  });

  it('does not show remove button for the current user (even if not owner)', () => {
    // Make REG_MEMBER the current user
    renderSheet({ currentUserId: 'u2', ownerMemberId: 'm-owner' });
    expect(screen.queryByTestId(`remove-button-${REG_MEMBER.id}`)).toBeNull();
  });

  it('shows remove button for a regular member who is not the owner or current user', () => {
    renderSheet();
    expect(screen.getByTestId(`remove-button-${REG_MEMBER.id}`)).toBeTruthy();
  });

  it('shows remove button for a placeholder member', () => {
    renderSheet();
    expect(screen.getByTestId(`remove-button-${PLACEHOLDER.id}`)).toBeTruthy();
  });

  it('shows remove button for a pending member', () => {
    renderSheet();
    expect(screen.getByTestId(`remove-button-${PENDING_MEMBER.id}`)).toBeTruthy();
  });

  // -------------------------------------------------------------------------
  // Remove flow
  // -------------------------------------------------------------------------

  it('pressing remove shows Alert with confirmation copy', () => {
    const alertSpy = jest.spyOn(Alert, 'alert');
    renderSheet();

    fireEvent.press(screen.getByTestId(`remove-button-${REG_MEMBER.id}`));

    expect(alertSpy).toHaveBeenCalledWith(
      expect.stringContaining('Sacar'),
      '¿Confirmás que querés sacar a este miembro?',
      expect.arrayContaining([
        expect.objectContaining({ text: 'Cancelar', style: 'cancel' }),
        expect.objectContaining({ text: 'Sacar', style: 'destructive' }),
      ]),
    );
  });

  it('confirming removal calls useRemoveMember with the correct memberId and groupId', async () => {
    jest.spyOn(Alert, 'alert').mockImplementation((_title, _msg, buttons) => {
      const destructive = (buttons ?? []).find((b) => b.style === 'destructive');
      destructive?.onPress?.();
    });

    renderSheet();
    fireEvent.press(screen.getByTestId(`remove-button-${REG_MEMBER.id}`));

    await waitFor(() => {
      expect(mockRemoveMutateAsync).toHaveBeenCalledWith({
        memberId: REG_MEMBER.id,
        groupId: 'g1',
      });
    });
  });

  it('cancelling removal does not call useRemoveMember', async () => {
    jest.spyOn(Alert, 'alert').mockImplementation((_title, _msg, buttons) => {
      const cancel = (buttons ?? []).find((b) => b.style === 'cancel');
      cancel?.onPress?.();
    });

    renderSheet();
    fireEvent.press(screen.getByTestId(`remove-button-${PLACEHOLDER.id}`));

    await waitFor(() => {
      expect(mockRemoveMutateAsync).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Rename flow
  // -------------------------------------------------------------------------

  it('pressing rename button shows the rename input', () => {
    renderSheet();
    fireEvent.press(screen.getByTestId(`rename-button-${PLACEHOLDER.id}`));
    expect(screen.getByTestId(`rename-input-${PLACEHOLDER.id}`)).toBeTruthy();
  });

  it('rename input is pre-populated with the current display_name', () => {
    renderSheet();
    fireEvent.press(screen.getByTestId(`rename-button-${PLACEHOLDER.id}`));
    const input = screen.getByTestId(`rename-input-${PLACEHOLDER.id}`);
    // The input value should be the current display_name
    expect(input.props.value).toBe('Carlos Sin Cuenta');
  });

  it('shows validation error when submitting empty name', async () => {
    renderSheet();
    fireEvent.press(screen.getByTestId(`rename-button-${PLACEHOLDER.id}`));
    const input = screen.getByTestId(`rename-input-${PLACEHOLDER.id}`);
    fireEvent.changeText(input, '');
    fireEvent.press(screen.getByLabelText('Confirmar cambio de nombre'));

    await waitFor(() => {
      expect(screen.getByText('Ingresá un nombre.')).toBeTruthy();
    });
    expect(mockUpdateMutateAsync).not.toHaveBeenCalled();
  });

  it('calls useUpdateMember with correct args on valid rename submit', async () => {
    renderSheet();
    fireEvent.press(screen.getByTestId(`rename-button-${PLACEHOLDER.id}`));
    const input = screen.getByTestId(`rename-input-${PLACEHOLDER.id}`);
    fireEvent.changeText(input, 'Nuevo Nombre');
    fireEvent.press(screen.getByLabelText('Confirmar cambio de nombre'));

    await waitFor(() => {
      expect(mockUpdateMutateAsync).toHaveBeenCalledWith({
        memberId: PLACEHOLDER.id,
        displayName: 'Nuevo Nombre',
        groupId: 'g1',
      });
    });
  });

  it('hides rename form after successful update', async () => {
    renderSheet();
    fireEvent.press(screen.getByTestId(`rename-button-${PLACEHOLDER.id}`));
    const input = screen.getByTestId(`rename-input-${PLACEHOLDER.id}`);
    fireEvent.changeText(input, 'Nuevo Nombre');
    fireEvent.press(screen.getByLabelText('Confirmar cambio de nombre'));

    await waitFor(() => {
      expect(mockUpdateMutateAsync).toHaveBeenCalled();
    });
    // After success the rename form should be dismissed
    await waitFor(() => {
      expect(screen.queryByTestId(`rename-input-${PLACEHOLDER.id}`)).toBeNull();
    });
  });

  it('pressing cancel hides the rename form without saving', () => {
    renderSheet();
    fireEvent.press(screen.getByTestId(`rename-button-${PLACEHOLDER.id}`));
    expect(screen.getByTestId(`rename-input-${PLACEHOLDER.id}`)).toBeTruthy();

    fireEvent.press(screen.getByLabelText('Cancelar cambio de nombre'));
    expect(screen.queryByTestId(`rename-input-${PLACEHOLDER.id}`)).toBeNull();
    expect(mockUpdateMutateAsync).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // Close button
  // -------------------------------------------------------------------------

  it('calls onClose when X button is pressed', () => {
    const onClose = jest.fn();
    renderSheet({ onClose });
    fireEvent.press(screen.getByLabelText('Cerrar'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
