import { useAuthStore } from '@/stores';

export function useSession() {
  const { session, user, isLoading } = useAuthStore();
  return { session, user, isLoading, isAuthenticated: !!session };
}
