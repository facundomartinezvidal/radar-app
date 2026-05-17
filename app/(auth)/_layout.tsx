import { Redirect, Stack } from 'expo-router';

import { useSession } from '@/hooks/use-session';
import { colors } from '@/lib/theme';

export default function AuthLayout() {
  const { isAuthenticated, isLoading } = useSession();

  if (isLoading) {
    return null;
  }

  if (isAuthenticated) {
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
