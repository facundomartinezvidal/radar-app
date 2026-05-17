/**
 * RADAR — Splash / Onboarding screen (C1)
 *
 * First screen unauth users land on. Shows LogoMark + LogoWordmark, tagline,
 * and two CTAs: "Empezar" (→ sign-up) and "Ya tengo cuenta" (→ sign-in).
 */
import { router } from 'expo-router';
import React from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LogoMark, LogoWordmark } from '@/components/ui/logo';
import { Button, H2 } from '@/components/ui';
import { colors, spacing } from '@/lib/theme';

export default function SplashScreen(): React.JSX.Element {
  return (
    <SafeAreaView
      style={{
        flex: 1,
        backgroundColor: colors.bg[0],
      }}
    >
      {/* Logo centrado verticalmente */}
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <LogoMark size={96} />
        <View style={{ marginTop: spacing[4] }}>
          <LogoWordmark height={32} />
        </View>
        <View style={{ marginTop: spacing[5] }}>
          <H2 style={{ textAlign: 'center', color: colors.fg[2] }}>Sabé a dónde va tu plata.</H2>
        </View>
      </View>

      {/* CTAs empujados al fondo */}
      <View
        style={{
          paddingHorizontal: spacing[5],
          paddingBottom: spacing[7],
          gap: spacing[3],
        }}
      >
        <Button
          variant="primary"
          size="lg"
          fullWidth
          onPress={() => router.push('/(auth)/sign-up')}
          accessibilityLabel="Empezar"
        >
          Empezar
        </Button>
        <Button
          variant="ghost"
          size="md"
          fullWidth
          onPress={() => router.push('/(auth)/sign-in')}
          accessibilityLabel="Ya tengo cuenta"
        >
          Ya tengo cuenta
        </Button>
      </View>
    </SafeAreaView>
  );
}
