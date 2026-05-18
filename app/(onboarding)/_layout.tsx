import { Redirect, Stack } from 'expo-router';

import { hasCompletedProfile } from '@/lib/profile/completion';
import { colors } from '@/lib/theme';
import { useSession } from '@/hooks/use-session';

export default function OnboardingLayout() {
  const { isAuthenticated, isLoading, user } = useSession();

  if (isLoading) {
    return null;
  }

  if (!isAuthenticated) {
    return <Redirect href="/(auth)/sign-in" />;
  }

  if (hasCompletedProfile(user)) {
    return <Redirect href="/(protected)/(tabs)" />;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.bg[0] },
      }}
    />
  );
}
