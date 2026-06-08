/**
 * Tests for NewGroupScreen (app/(protected)/groups/new.tsx).
 *
 * Covers:
 *   - Renders the GroupForm
 *   - Submitting with no invites calls useCreateGroup only and navigates
 *   - Submitting with invites calls useCreateGroup then useInviteMember per email
 *     with the new group id
 *   - A not_found result triggers the summary Alert (non-blocking)
 *   - already_member / invited results do NOT trigger an alert
 *   - A failed invite does NOT abort navigation (group already created)
 *   - Create step failure shows server error and does NOT navigate
 */
import React from 'react';
import { Alert } from 'react-native';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';

import NewGroupScreen from '../new';

jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));

jest.mock('react-native-safe-area-context', () => {
  const { View } = require('react-native');
  return {
    SafeAreaView: View,
    SafeAreaProvider: View,
    useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
  };
});

const mockRouterReplace = jest.fn();
const mockRouterBack = jest.fn();

jest.mock('expo-router', () => ({
  router: {
    replace: (...args: unknown[]) => mockRouterReplace(...args),
    back: (...args: unknown[]) => mockRouterBack(...args),
    push: jest.fn(),
  },
}));

const mockCreateMutateAsync = jest.fn();
const mockInviteMutateAsync = jest.fn();
const mockCheckExistsMutateAsync = jest.fn();

jest.mock('@/hooks/use-groups', () => ({
  useCreateGroup: jest.fn(() => ({
    mutateAsync: mockCreateMutateAsync,
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

/** Fill the group name and optionally add email invites, then press submit. */
async function fillAndSubmit(emails: string[] = []): Promise<void> {
  fireEvent.changeText(screen.getByPlaceholderText('Nombre del grupo'), 'Depto');

  for (let i = 0; i < emails.length; i++) {
    fireEvent.press(screen.getByTestId('add-invite-button'));
    fireEvent.changeText(screen.getByTestId(`invite-input-${i}`), emails[i] as string);
  }

  fireEvent.press(screen.getByText('Crear grupo'));
  await waitFor(() => expect(mockCreateMutateAsync).toHaveBeenCalled());
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('NewGroupScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCreateMutateAsync.mockResolvedValue({ id: 'g-new' });
    mockInviteMutateAsync.mockResolvedValue({ status: 'invited' });
    // Default: account found (on-blur existence check passes)
    mockCheckExistsMutateAsync.mockResolvedValue(true);
  });

  it('renders the GroupForm', () => {
    render(<NewGroupScreen />);
    expect(screen.getByPlaceholderText('Nombre del grupo')).toBeTruthy();
  });

  it('submitting with no invites calls useCreateGroup and navigates to the group', async () => {
    render(<NewGroupScreen />);
    await fillAndSubmit();

    expect(mockCreateMutateAsync).toHaveBeenCalledWith(expect.objectContaining({ name: 'Depto' }));
    expect(mockInviteMutateAsync).not.toHaveBeenCalled();

    await waitFor(() => {
      expect(mockRouterReplace).toHaveBeenCalledWith('/(protected)/groups/g-new');
    });
  });

  it('submitting with invites calls useCreateGroup then useInviteMember per email with the new group id', async () => {
    render(<NewGroupScreen />);
    await fillAndSubmit(['ana@example.com', 'bob@example.com']);

    await waitFor(() => {
      expect(mockInviteMutateAsync).toHaveBeenCalledTimes(2);
    });

    expect(mockInviteMutateAsync).toHaveBeenNthCalledWith(1, {
      groupId: 'g-new',
      input: { email: 'ana@example.com' },
    });
    expect(mockInviteMutateAsync).toHaveBeenNthCalledWith(2, {
      groupId: 'g-new',
      input: { email: 'bob@example.com' },
    });
  });

  it('navigates to the group after invites are processed', async () => {
    render(<NewGroupScreen />);
    await fillAndSubmit(['ana@example.com']);

    await waitFor(() => {
      expect(mockRouterReplace).toHaveBeenCalledWith('/(protected)/groups/g-new');
    });
  });

  it('shows summary Alert when any invite returns not_found', async () => {
    mockInviteMutateAsync.mockResolvedValue({ status: 'not_found' });
    const alertSpy = jest.spyOn(Alert, 'alert');

    render(<NewGroupScreen />);
    await fillAndSubmit(['ghost@example.com']);

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith(
        'Invitaciones no enviadas',
        expect.stringContaining('ghost@example.com'),
      );
    });
  });

  it('does NOT show alert when all invites are invited/already_member', async () => {
    mockInviteMutateAsync
      .mockResolvedValueOnce({ status: 'invited' })
      .mockResolvedValueOnce({ status: 'already_member' });
    const alertSpy = jest.spyOn(Alert, 'alert');

    render(<NewGroupScreen />);
    await fillAndSubmit(['a@x.com', 'b@x.com']);

    await waitFor(() => {
      expect(mockRouterReplace).toHaveBeenCalledWith('/(protected)/groups/g-new');
    });
    expect(alertSpy).not.toHaveBeenCalled();
  });

  it('a failed invite does NOT abort navigation (group is already created)', async () => {
    mockInviteMutateAsync.mockRejectedValue(new Error('Network error'));

    render(<NewGroupScreen />);
    await fillAndSubmit(['flaky@example.com']);

    await waitFor(() => {
      expect(mockRouterReplace).toHaveBeenCalledWith('/(protected)/groups/g-new');
    });
  });

  it('create step failure shows server error and does NOT navigate', async () => {
    mockCreateMutateAsync.mockRejectedValue(new Error('No se pudo crear el grupo.'));

    render(<NewGroupScreen />);
    fireEvent.changeText(screen.getByPlaceholderText('Nombre del grupo'), 'Depto');
    fireEvent.press(screen.getByText('Crear grupo'));

    await waitFor(() => {
      expect(screen.getByText('No se pudo crear el grupo.')).toBeTruthy();
    });
    expect(mockRouterReplace).not.toHaveBeenCalled();
    expect(mockInviteMutateAsync).not.toHaveBeenCalled();
  });

  it('create step failure with unknown error shows fallback message', async () => {
    mockCreateMutateAsync.mockRejectedValue('unknown');

    render(<NewGroupScreen />);
    fireEvent.changeText(screen.getByPlaceholderText('Nombre del grupo'), 'Depto');
    fireEvent.press(screen.getByText('Crear grupo'));

    await waitFor(() => {
      expect(screen.getByText('No se pudo crear el grupo. Intentá nuevamente.')).toBeTruthy();
    });
  });
});
