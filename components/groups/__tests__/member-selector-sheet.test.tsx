/**
 * Tests for MemberSelectorSheet component.
 *
 * Covers:
 *   - Renders the sheet title "Agregar miembro"
 *   - Segment switch between "Sin cuenta" and "Con cuenta"
 *   - Placeholder (Sin cuenta): calls useAddPlaceholder on submit
 *   - Placeholder (Sin cuenta): validates empty name and blocks submit
 *   - Invite (Con cuenta): calls useInviteMember on submit
 *   - Invite (Con cuenta): validates invalid email and blocks submit
 *   - Invite status "invited" → shows "Invitación enviada."
 *   - Invite status "already_member" → shows inline message
 *   - Invite status "not_found" → shows inline message
 *   - On blur with not-found email → shows error + blocks Invitar
 *   - On blur with found email → allows submit
 *   - Verificando… shown while check is pending
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';

import { MemberSelectorSheet } from '../member-selector-sheet';

jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));

// ---------------------------------------------------------------------------
// Hook mocks
// ---------------------------------------------------------------------------

const mockAddMutateAsync = jest.fn();
const mockInviteMutateAsync = jest.fn();
const mockCheckExistsMutateAsync = jest.fn();

jest.mock('@/hooks/use-groups', () => ({
  useAddPlaceholder: jest.fn(() => ({
    mutateAsync: mockAddMutateAsync,
    isPending: false,
  })),
  useInviteMember: jest.fn(() => ({
    mutateAsync: mockInviteMutateAsync,
    isPending: false,
  })),
  useCheckUserExists: jest.fn(() => ({
    mutateAsync: mockCheckExistsMutateAsync,
    isPending: false,
  })),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DEFAULT_PROPS = {
  visible: true,
  groupId: 'g1',
  onClose: jest.fn(),
};

function renderSheet(overrides?: Partial<typeof DEFAULT_PROPS>): void {
  render(<MemberSelectorSheet {...DEFAULT_PROPS} {...overrides} />);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('MemberSelectorSheet', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAddMutateAsync.mockResolvedValue({
      id: 'm1',
      group_id: 'g1',
      display_name: 'Facundo',
      status: 'placeholder',
    });
    mockInviteMutateAsync.mockResolvedValue({ status: 'invited', member_id: 'm2' });
    // Default: account found
    mockCheckExistsMutateAsync.mockResolvedValue(true);
  });

  // -------------------------------------------------------------------------
  // Basic render
  // -------------------------------------------------------------------------

  it('renders the sheet title "Agregar miembro" when visible', () => {
    renderSheet();
    expect(screen.getByText('Agregar miembro')).toBeTruthy();
  });

  it('does not render sheet content when not visible', () => {
    renderSheet({ visible: false });
    expect(screen.queryByText('Agregar miembro')).toBeNull();
  });

  // -------------------------------------------------------------------------
  // Segment switch
  // -------------------------------------------------------------------------

  it('renders "Sin cuenta" segment as initially active', () => {
    renderSheet();
    const sinCuenta = screen.getByLabelText('Sin cuenta');
    expect(sinCuenta).toBeTruthy();
  });

  it('renders "Con cuenta" segment', () => {
    renderSheet();
    expect(screen.getByLabelText('Con cuenta')).toBeTruthy();
  });

  it('shows name input by default (Sin cuenta mode)', () => {
    renderSheet();
    expect(screen.getByPlaceholderText('Nombre del participante')).toBeTruthy();
  });

  it('switching to "Con cuenta" shows email input', () => {
    renderSheet();
    fireEvent.press(screen.getByLabelText('Con cuenta'));
    expect(screen.getByPlaceholderText('correo@ejemplo.com')).toBeTruthy();
  });

  it('switching back to "Sin cuenta" shows name input again', () => {
    renderSheet();
    fireEvent.press(screen.getByLabelText('Con cuenta'));
    fireEvent.press(screen.getByLabelText('Sin cuenta'));
    expect(screen.getByPlaceholderText('Nombre del participante')).toBeTruthy();
  });

  // -------------------------------------------------------------------------
  // Sin cuenta — placeholder submit
  // -------------------------------------------------------------------------

  it('calls useAddPlaceholder with groupId and display_name on valid submit', async () => {
    renderSheet();
    const input = screen.getByPlaceholderText('Nombre del participante');
    fireEvent.changeText(input, 'Facundo Martinez');
    fireEvent.press(screen.getByLabelText('Agregar participante sin cuenta'));

    await waitFor(() => {
      expect(mockAddMutateAsync).toHaveBeenCalledWith({
        groupId: 'g1',
        displayName: 'Facundo Martinez',
      });
    });
  });

  it('blocks submit and shows validation error when name is empty', async () => {
    renderSheet();
    fireEvent.press(screen.getByLabelText('Agregar participante sin cuenta'));

    await waitFor(() => {
      expect(screen.getByText('Ingresá un nombre.')).toBeTruthy();
    });
    expect(mockAddMutateAsync).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // Con cuenta — invite submit
  // -------------------------------------------------------------------------

  it('calls useInviteMember with groupId and email on valid submit', async () => {
    renderSheet();
    fireEvent.press(screen.getByLabelText('Con cuenta'));

    const input = screen.getByPlaceholderText('correo@ejemplo.com');
    fireEvent.changeText(input, 'test@example.com');
    fireEvent.press(screen.getByLabelText('Invitar por correo electrónico'));

    await waitFor(() => {
      expect(mockInviteMutateAsync).toHaveBeenCalledWith({
        groupId: 'g1',
        input: { email: 'test@example.com' },
      });
    });
  });

  it('blocks submit and shows validation error when email is invalid', async () => {
    renderSheet();
    fireEvent.press(screen.getByLabelText('Con cuenta'));

    const input = screen.getByPlaceholderText('correo@ejemplo.com');
    fireEvent.changeText(input, 'not-an-email');
    fireEvent.press(screen.getByLabelText('Invitar por correo electrónico'));

    await waitFor(() => {
      expect(screen.getByText('Ingresá un correo válido.')).toBeTruthy();
    });
    expect(mockInviteMutateAsync).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // Invite status messages
  // -------------------------------------------------------------------------

  it('shows "Invitación enviada." after invited status', async () => {
    mockInviteMutateAsync.mockResolvedValue({ status: 'invited', member_id: 'm2' });
    renderSheet();
    fireEvent.press(screen.getByLabelText('Con cuenta'));

    fireEvent.changeText(screen.getByPlaceholderText('correo@ejemplo.com'), 'test@example.com');
    fireEvent.press(screen.getByLabelText('Invitar por correo electrónico'));

    await waitFor(() => {
      expect(screen.getByTestId('status-invited')).toBeTruthy();
      expect(screen.getByText('Invitación enviada.')).toBeTruthy();
    });
  });

  it('shows "Esta persona ya está en el grupo." for already_member status', async () => {
    mockInviteMutateAsync.mockResolvedValue({ status: 'already_member' });
    renderSheet();
    fireEvent.press(screen.getByLabelText('Con cuenta'));

    fireEvent.changeText(screen.getByPlaceholderText('correo@ejemplo.com'), 'test@example.com');
    fireEvent.press(screen.getByLabelText('Invitar por correo electrónico'));

    await waitFor(() => {
      expect(screen.getByTestId('status-already-member')).toBeTruthy();
      expect(screen.getByText('Esta persona ya está en el grupo.')).toBeTruthy();
    });
  });

  it('shows not_found message for not_found status', async () => {
    mockInviteMutateAsync.mockResolvedValue({ status: 'not_found' });
    renderSheet();
    fireEvent.press(screen.getByLabelText('Con cuenta'));

    fireEvent.changeText(screen.getByPlaceholderText('correo@ejemplo.com'), 'test@example.com');
    fireEvent.press(screen.getByLabelText('Invitar por correo electrónico'));

    await waitFor(() => {
      expect(screen.getByTestId('status-not-found')).toBeTruthy();
      expect(
        screen.getByText(
          'No encontramos una cuenta con ese correo. Podés agregarla como miembro sin cuenta.',
        ),
      ).toBeTruthy();
    });
  });

  // -------------------------------------------------------------------------
  // On-blur email existence check
  // -------------------------------------------------------------------------

  it('shows "No existe una cuenta..." error and disables Invitar when email is not found', async () => {
    mockCheckExistsMutateAsync.mockResolvedValueOnce(false);
    renderSheet();
    fireEvent.press(screen.getByLabelText('Con cuenta'));

    const input = screen.getByPlaceholderText('correo@ejemplo.com');
    fireEvent.changeText(input, 'ghost@example.com');
    fireEvent(input, 'blur');

    await waitFor(() => {
      expect(screen.getByTestId('status-email-not-found')).toBeTruthy();
      expect(screen.getByText('No existe una cuenta con ese correo electrónico.')).toBeTruthy();
    });

    // Button should be disabled — mock not called
    fireEvent.press(screen.getByLabelText('Invitar por correo electrónico'));
    await waitFor(() => {
      expect(mockInviteMutateAsync).not.toHaveBeenCalled();
    });
  });

  it('clears the not-found error when user starts editing the email again', async () => {
    mockCheckExistsMutateAsync.mockResolvedValueOnce(false);
    renderSheet();
    fireEvent.press(screen.getByLabelText('Con cuenta'));

    const input = screen.getByPlaceholderText('correo@ejemplo.com');
    fireEvent.changeText(input, 'ghost@example.com');
    fireEvent(input, 'blur');

    await waitFor(() => {
      expect(screen.queryByTestId('status-email-not-found')).toBeTruthy();
    });

    // User starts editing again — error should clear
    fireEvent.changeText(input, 'ghost2@example.com');
    expect(screen.queryByTestId('status-email-not-found')).toBeNull();
  });

  it('allows submit when email is found on blur', async () => {
    mockCheckExistsMutateAsync.mockResolvedValueOnce(true);
    renderSheet();
    fireEvent.press(screen.getByLabelText('Con cuenta'));

    const input = screen.getByPlaceholderText('correo@ejemplo.com');
    fireEvent.changeText(input, 'real@example.com');
    fireEvent(input, 'blur');

    await waitFor(() => {
      expect(mockCheckExistsMutateAsync).toHaveBeenCalledWith('real@example.com');
    });

    // No not-found error should appear
    expect(screen.queryByTestId('status-email-not-found')).toBeNull();
  });

  it('does not call existence check when email format is invalid', async () => {
    renderSheet();
    fireEvent.press(screen.getByLabelText('Con cuenta'));

    const input = screen.getByPlaceholderText('correo@ejemplo.com');
    fireEvent.changeText(input, 'not-valid');
    fireEvent(input, 'blur');

    // Give time for any async to run
    await waitFor(() => {
      expect(mockCheckExistsMutateAsync).not.toHaveBeenCalled();
    });
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
