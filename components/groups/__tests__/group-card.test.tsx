/**
 * Tests for GroupCard.
 *
 * Covers:
 *   - Renders group name
 *   - Renders member count label
 *   - Renders MemberAvatarsRow (presence check)
 *   - Pressing the card calls onPress with the group id
 *   - Renders balance badge when balances are present
 *   - No badge when balances are empty
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';

import { GroupCard } from '../group-card';
import type { GroupMemberRow, GroupWithMembers } from '@/hooks/use-groups';

jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));

const mockUseGroupBalances = jest.fn();

jest.mock('@/hooks/use-groups', () => ({
  useGroupBalances: (...args: unknown[]) => mockUseGroupBalances(...args),
}));

function makeMember(id: string, displayName: string, userId?: string): GroupMemberRow {
  return {
    id,
    group_id: 'group-1',
    user_id: userId ?? null,
    display_name: displayName,
    role: 'member',
    status: 'active',
    joined_at: null,
    invited_by: null,
    created_at: '2026-01-01T00:00:00Z',
  } satisfies GroupMemberRow;
}

const GROUP: GroupWithMembers = {
  id: 'group-1',
  name: 'Depto',
  icon: 'House',
  color: '#0077B6',
  created_by: 'user-1',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  members: [makeMember('m1', 'Facundo Martinez', 'user-1'), makeMember('m2', 'Jonathan Mayan')],
} as GroupWithMembers;

describe('GroupCard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseGroupBalances.mockReturnValue({ data: [], isLoading: false });
  });

  it('renders the group name', () => {
    render(<GroupCard group={GROUP} onPress={jest.fn()} />);
    expect(screen.getByText('Depto')).toBeTruthy();
  });

  it('renders member count label', () => {
    render(<GroupCard group={GROUP} onPress={jest.fn()} />);
    expect(screen.getByText('2 miembros')).toBeTruthy();
  });

  it('renders "1 miembro" for a single-member group', () => {
    const singleMemberGroup: GroupWithMembers = {
      ...GROUP,
      members: [makeMember('m1', 'Facundo')],
    };
    render(<GroupCard group={singleMemberGroup} onPress={jest.fn()} />);
    expect(screen.getByText('1 miembro')).toBeTruthy();
  });

  it('pressing the card calls onPress with the group id', () => {
    const onPress = jest.fn();
    render(<GroupCard group={GROUP} onPress={onPress} />);
    fireEvent.press(screen.getByTestId('group-card-group-1'));
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(onPress).toHaveBeenCalledWith('group-1');
  });

  it('renders accessible label for MemberAvatarsRow', () => {
    render(<GroupCard group={GROUP} onPress={jest.fn()} />);
    expect(screen.getByLabelText('2 miembros')).toBeTruthy();
  });

  it('renders "Te deben" badge when current user net is positive', () => {
    mockUseGroupBalances.mockReturnValue({
      data: [
        { member_id: 'm1', currency: 'ARS', net: 1500 },
        { member_id: 'm2', currency: 'ARS', net: -1500 },
      ],
      isLoading: false,
    });

    render(<GroupCard group={GROUP} onPress={jest.fn()} currentUserId="user-1" />);
    // Badge shows "Te deben $ 1.500,00"
    expect(screen.getByText(/Te deben/)).toBeTruthy();
  });

  it('renders "Debés" badge when current user net is negative', () => {
    mockUseGroupBalances.mockReturnValue({
      data: [
        { member_id: 'm1', currency: 'ARS', net: -800 },
        { member_id: 'm2', currency: 'ARS', net: 800 },
      ],
      isLoading: false,
    });

    render(<GroupCard group={GROUP} onPress={jest.fn()} currentUserId="user-1" />);
    expect(screen.getByText(/Debés/)).toBeTruthy();
  });

  it('renders "Al día" badge when current user net is near zero', () => {
    mockUseGroupBalances.mockReturnValue({
      data: [
        { member_id: 'm1', currency: 'ARS', net: 0 },
        { member_id: 'm2', currency: 'ARS', net: 0 },
      ],
      isLoading: false,
    });

    render(<GroupCard group={GROUP} onPress={jest.fn()} currentUserId="user-1" />);
    expect(screen.getByText(/Al día/)).toBeTruthy();
  });

  it('does not render a badge when currentUserId is not provided', () => {
    mockUseGroupBalances.mockReturnValue({
      data: [{ member_id: 'm1', currency: 'ARS', net: 1500 }],
      isLoading: false,
    });

    render(<GroupCard group={GROUP} onPress={jest.fn()} />);
    expect(screen.queryByText(/Te deben/)).toBeNull();
    expect(screen.queryByText(/Debés/)).toBeNull();
  });
});
