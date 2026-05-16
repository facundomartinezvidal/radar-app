import type { Session, User } from '@supabase/supabase-js';
import { create } from 'zustand';

interface AuthState {
  session: Session | null;
  user: User | null;
  isLoading: boolean;
  setSession: (session: Session | null) => void;
  reset: () => void;
}

const initialState = {
  session: null,
  user: null,
  isLoading: true,
} satisfies Pick<AuthState, 'session' | 'user' | 'isLoading'>;

export const useAuthStore = create<AuthState>()((set) => ({
  ...initialState,

  setSession: (session) =>
    set({
      session,
      user: session?.user ?? null,
      isLoading: false,
    }),

  reset: () => set({ ...initialState, isLoading: false }),
}));
