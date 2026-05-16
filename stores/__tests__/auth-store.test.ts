import type { Session } from '@supabase/supabase-js';

import { useAuthStore } from '@/stores';

// Build a minimal mock session that satisfies the Supabase Session shape.
const mockSession = {
  user: { id: 'u1', email: 't@t.com' },
  access_token: 'x',
  refresh_token: 'y',
  expires_in: 3600,
  token_type: 'bearer',
} as unknown as Session;

describe('useAuthStore', () => {
  // Reset the store to its initial state before each test so tests are isolated.
  beforeEach(() => {
    useAuthStore.setState({
      session: null,
      user: null,
      isLoading: true,
    });
  });

  describe('initial state', () => {
    it('has session set to null', () => {
      const { session } = useAuthStore.getState();
      expect(session).toBeNull();
    });

    it('has user set to null', () => {
      const { user } = useAuthStore.getState();
      expect(user).toBeNull();
    });

    it('has isLoading set to true', () => {
      const { isLoading } = useAuthStore.getState();
      expect(isLoading).toBe(true);
    });
  });

  describe('setSession', () => {
    it('updates session when called with a valid session object', () => {
      useAuthStore.getState().setSession(mockSession);
      expect(useAuthStore.getState().session).toBe(mockSession);
    });

    it('derives user from session.user', () => {
      useAuthStore.getState().setSession(mockSession);
      expect(useAuthStore.getState().user).toEqual(mockSession.user);
    });

    it('sets isLoading to false after receiving a session', () => {
      useAuthStore.getState().setSession(mockSession);
      expect(useAuthStore.getState().isLoading).toBe(false);
    });

    it('resets session to null when called with null', () => {
      // First set a session so we have something to clear.
      useAuthStore.getState().setSession(mockSession);
      useAuthStore.getState().setSession(null);
      expect(useAuthStore.getState().session).toBeNull();
    });

    it('resets user to null when called with null', () => {
      useAuthStore.getState().setSession(mockSession);
      useAuthStore.getState().setSession(null);
      expect(useAuthStore.getState().user).toBeNull();
    });

    it('sets isLoading to false even when called with null', () => {
      useAuthStore.getState().setSession(null);
      expect(useAuthStore.getState().isLoading).toBe(false);
    });
  });

  describe('reset', () => {
    it('clears session back to null', () => {
      useAuthStore.getState().setSession(mockSession);
      useAuthStore.getState().reset();
      expect(useAuthStore.getState().session).toBeNull();
    });

    it('clears user back to null', () => {
      useAuthStore.getState().setSession(mockSession);
      useAuthStore.getState().reset();
      expect(useAuthStore.getState().user).toBeNull();
    });

    it('sets isLoading to false (not re-initialising to true)', () => {
      // The store's reset() intentionally sets isLoading: false so the UI
      // knows the reset is complete, not that loading is in progress.
      useAuthStore.getState().setSession(mockSession);
      useAuthStore.getState().reset();
      expect(useAuthStore.getState().isLoading).toBe(false);
    });
  });
});
