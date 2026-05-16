import { Redirect, Stack } from 'expo-router';

import { useNotificationObserver } from '@/lib/notifications';
import { useRegisterPush } from '@/hooks/use-register-push';
import { useSession } from '@/hooks/use-session';

export default function ProtectedLayout() {
  const { isAuthenticated, isLoading } = useSession();

  useRegisterPush();
  useNotificationObserver();

  if (isLoading) {
    return null;
  }

  if (!isAuthenticated) {
    return <Redirect href="/(auth)/sign-in" />;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
    </Stack>
  );
}
