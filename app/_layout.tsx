import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
} from '@expo-google-fonts/inter';
import {
  JetBrainsMono_400Regular,
  JetBrainsMono_500Medium,
} from '@expo-google-fonts/jetbrains-mono';
import { DarkTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { View } from 'react-native';
import 'react-native-reanimated';

import Providers from '@/components/providers';
import { useAuthListener } from '@/hooks/use-auth-listener';
import { colors } from '@/lib/theme';

// Keep the splash screen visible until fonts are loaded.
SplashScreen.preventAutoHideAsync();

// Customise the DarkTheme so navigation chrome matches RADAR DS tokens.
const radarTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: colors.bg[0], // #0A0F1A
    card: colors.bg[1], // #0F1724
    text: colors.fg[1], // #F4F7FB
    primary: colors.brand[500], // #0077B6
    border: colors.line[1], // rgba(255,255,255,0.06)
  },
};

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
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
    JetBrainsMono_400Regular,
    JetBrainsMono_500Medium,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  // Hold render until fonts are ready to prevent FOUT (flash of unstyled text).
  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <Providers>
      <AuthBootstrap />
      <ThemeProvider value={radarTheme}>
        {/* Global dark base — prevents white flashes behind navigation chrome */}
        <View style={{ flex: 1, backgroundColor: colors.bg[0] }}>
          <Stack>
            <Stack.Screen name="(auth)" options={{ headerShown: false }} />
            <Stack.Screen name="(protected)" options={{ headerShown: false }} />
          </Stack>
        </View>
        <StatusBar style="light" />
      </ThemeProvider>
    </Providers>
  );
}
