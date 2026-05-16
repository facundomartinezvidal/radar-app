import { useEffect, useRef } from 'react';

import { registerForPushNotificationsAsync, savePushTokenToSupabase } from '@/lib/notifications';
import { useSession } from '@/hooks/use-session';

/**
 * Registers the device for push notifications once the user is authenticated.
 * The registration is guarded by a ref so it only runs once per session,
 * even if the component re-renders.
 */
export function useRegisterPush(): void {
  const { isAuthenticated, user } = useSession();
  const hasRegistered = useRef(false);

  useEffect(() => {
    if (!isAuthenticated || !user || hasRegistered.current) {
      return;
    }

    hasRegistered.current = true;

    const userId = user.id;

    void (async () => {
      try {
        const token = await registerForPushNotificationsAsync();
        if (token) {
          await savePushTokenToSupabase(userId, token);
        }
      } catch (err) {
        console.error('[useRegisterPush] Failed to register push token:', err);
      }
    })();
  }, [isAuthenticated, user]);
}
