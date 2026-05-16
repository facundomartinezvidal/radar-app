import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import Providers from '@/components/providers';
import { useAuthListener } from '@/hooks/use-auth-listener';
import { useColorScheme } from '@/hooks/use-color-scheme';

export const unstable_settings = {
  anchor: '(protected)',
};

/**
 * Mounts the Supabase auth listener for the lifetime of the app.
 * Returns null — purely a side-effect component.
 */
function AuthBootstrap(): null {
  useAuthListener();
  return null;
}

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <Providers>
      <AuthBootstrap />
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <Stack>
          <Stack.Screen name="(auth)" options={{ headerShown: false }} />
          <Stack.Screen name="(protected)" options={{ headerShown: false }} />
        </Stack>
        <StatusBar style="auto" />
      </ThemeProvider>
    </Providers>
  );
}
