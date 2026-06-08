/**
 * Tests for GroupCard.
 *
 * Covers:
 *   - Renders group name
 *   - Renders member count label
 *   - Renders MemberAvatarsRow (presence check)
 *   - Pressing the card calls onPress with the group id
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';

import { GroupCard } from '../group-card';
import type { GroupMemberRow, GroupWithMembers } from '@/hooks/use-groups';

jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));

function makeMember(id: string, displayName: string): GroupMemberRow {
  return {
    id,
    group_id: 'group-1',
    user_id: null,
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
  members: [makeMember('m1', 'Facundo Martinez'), makeMember('m2', 'Jonathan Mayan')],
} as GroupWithMembers;

describe('GroupCard', () => {
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
});
