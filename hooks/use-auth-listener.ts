import { useEffect } from 'react';

import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores';

/**
 * Bootstraps auth state from Supabase on mount and subscribes to subsequent
 * auth state changes, keeping the Zustand store in sync.
 *
 * Mount this hook once at the root layout level via an `<AuthBootstrap />`
 * component so it runs for the lifetime of the app.
 */
export function useAuthListener(): void {
  useEffect(() => {
    // Hydrate store with the persisted session on first load.
    void supabase.auth.getSession().then(({ data: { session } }) => {
      useAuthStore.getState().setSession(session);
    });

    // Subscribe to subsequent auth state changes.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      useAuthStore.setState({
        session,
        user: session?.user ?? null,
        isLoading: false,
      });
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);
}
