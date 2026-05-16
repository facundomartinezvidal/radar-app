import { Redirect, Stack } from 'expo-router';

import { useSession } from '@/hooks/use-session';

export default function AuthLayout() {
  const { isAuthenticated, isLoading } = useSession();

  if (isLoading) {
    return null;
  }

  if (isAuthenticated) {
    return <Redirect href="/(protected)/(tabs)" />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}
