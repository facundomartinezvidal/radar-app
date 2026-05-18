import { Redirect, Stack } from 'expo-router';

import { useNotificationObserver } from '@/lib/notifications';
import { useRegisterPush } from '@/hooks/use-register-push';
import { hasCompletedProfile } from '@/lib/profile/completion';
import { useSession } from '@/hooks/use-session';
import { colors } from '@/lib/theme';

export default function ProtectedLayout() {
  const { isAuthenticated, isLoading, user } = useSession();

  useRegisterPush();
  useNotificationObserver();

  if (isLoading) {
    return null;
  }

  if (!isAuthenticated) {
    return <Redirect href="/(auth)/sign-in" />;
  }

  if (!hasCompletedProfile(user)) {
    return <Redirect href="/(onboarding)/profile-setup" />;
  }

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg[0] } }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
    </Stack>
  );
}
