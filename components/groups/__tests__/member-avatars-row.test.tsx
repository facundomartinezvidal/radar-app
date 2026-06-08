/**
 * Tests for MemberAvatarsRow.
 *
 * Covers:
 *   - Renders with 0 members without crashing
 *   - Renders correct number of avatars up to max
 *   - Shows "+N" overflow when members > max
 *   - Accessible label includes member count
 */
import React from 'react';
import { render, screen } from '@testing-library/react-native';

import { MemberAvatarsRow } from '../member-avatars-row';
import type { GroupMemberRow } from '@/hooks/use-groups';

jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));

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

const MEMBERS = [
  makeMember('m1', 'Facundo Martinez'),
  makeMember('m2', 'Jonathan Mayan'),
  makeMember('m3', 'Inaki Moreno'),
];

describe('MemberAvatarsRow', () => {
  it('renders without crashing when members is empty', () => {
    expect(() => render(<MemberAvatarsRow members={[]} />)).not.toThrow();
  });

  it('has accessible label with correct member count', () => {
    render(<MemberAvatarsRow members={MEMBERS} />);
    expect(screen.getByLabelText('3 miembros')).toBeTruthy();
  });

  it('has accessible label for 1 member (singular)', () => {
    render(<MemberAvatarsRow members={[MEMBERS[0]!]} />);
    expect(screen.getByLabelText('1 miembro')).toBeTruthy();
  });

  it('shows "+N" overflow indicator when members exceed max', () => {
    const manyMembers = [
      makeMember('m1', 'Ana'),
      makeMember('m2', 'Bruno'),
      makeMember('m3', 'Carlos'),
      makeMember('m4', 'Diana'),
      makeMember('m5', 'Esteban'),
    ];
    render(<MemberAvatarsRow members={manyMembers} max={4} />);
    // max=4, visible=3, overflow=+2
    expect(screen.getByText('+2')).toBeTruthy();
  });

  it('does not show overflow when members <= max', () => {
    render(<MemberAvatarsRow members={MEMBERS} max={4} />);
    expect(screen.queryByText(/^\+/)).toBeNull();
  });
});
