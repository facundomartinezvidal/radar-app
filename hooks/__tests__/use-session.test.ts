import { renderHook } from '@testing-library/react-native';
import type { Session } from '@supabase/supabase-js';
import { act } from '@testing-library/react-native';

import { useSession } from '@/hooks/use-session';
import { useAuthStore } from '@/stores';

const mockSession = {
  user: { id: 'u1', email: 't@t.com' },
  access_token: 'x',
  refresh_token: 'y',
  expires_in: 3600,
  token_type: 'bearer',
} as unknown as Session;

describe('useSession', () => {
  beforeEach(() => {
    // Restore initial store state before each test.
    useAuthStore.setState({
      session: null,
      user: null,
      isLoading: true,
    });
  });

  it('returns session as null when the store has no session', () => {
    const { result } = renderHook(() => useSession());
    expect(result.current.session).toBeNull();
  });

  it('returns user as null when the store has no session', () => {
    const { result } = renderHook(() => useSession());
    expect(result.current.user).toBeNull();
  });

  it('returns isLoading as true in the initial state', () => {
    const { result } = renderHook(() => useSession());
    expect(result.current.isLoading).toBe(true);
  });

  it('returns isAuthenticated as false when there is no session', () => {
    const { result } = renderHook(() => useSession());
    expect(result.current.isAuthenticated).toBe(false);
  });

  it('returns isAuthenticated as true after a session is set in the store', () => {
    const { result } = renderHook(() => useSession());

    act(() => {
      useAuthStore.setState({ session: mockSession, user: mockSession.user, isLoading: false });
    });

    expect(result.current.isAuthenticated).toBe(true);
  });

  it('exposes the session object after it is set in the store', () => {
    const { result } = renderHook(() => useSession());

    act(() => {
      useAuthStore.setState({ session: mockSession, user: mockSession.user, isLoading: false });
    });

    expect(result.current.session).toBe(mockSession);
  });

  it('exposes the user object derived from the session', () => {
    const { result } = renderHook(() => useSession());

    act(() => {
      useAuthStore.setState({ session: mockSession, user: mockSession.user, isLoading: false });
    });

    expect(result.current.user).toEqual(mockSession.user);
  });

  it('isAuthenticated reverts to false when session is cleared', () => {
    useAuthStore.setState({ session: mockSession, user: mockSession.user, isLoading: false });

    const { result } = renderHook(() => useSession());

    act(() => {
      useAuthStore.setState({ session: null, user: null, isLoading: false });
    });

    expect(result.current.isAuthenticated).toBe(false);
  });
});
