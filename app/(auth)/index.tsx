/**
 * RADAR — Splash / Onboarding screen (C1)
 *
 * First screen unauth users land on. Designed to communicate the brand and
 * value pillars before any auth step:
 *   - Ambient radar rings (decorative background)
 *   - Eyebrow status pill ("Tu plata, clarísima")
 *   - LogoMark + Wordmark hero
 *   - Display headline + supporting subhead
 *   - Three value pills (Personal · Compartido · ARS + USD)
 *   - Primary CTA "Empezar" with brand glow
 *   - Ghost CTA "Ya tengo cuenta"
 *   - Legal microcopy
 */
import { router } from 'expo-router';
import React from 'react';
import { View, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from 'react-native-svg';

import { Body, Button, Caption, Display, Icon, Micro, Pill } from '@/components/ui';
import { LogoMark, LogoWordmark } from '@/components/ui/logo';
import { colors, radii, shadows, spacing } from '@/lib/theme';

// ---------------------------------------------------------------------------
// Ambient background — large faint radar rings positioned behind the hero.
// Purely decorative; never receives interaction.
// ---------------------------------------------------------------------------

function AmbientRadar(): React.JSX.Element {
  const { width } = Dimensions.get('window');
  const size = width * 1.6;

  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        top: -size * 0.25,
        left: -(size - width) / 2,
        width: size,
        height: size,
        opacity: 0.55,
      }}
    >
      <Svg width={size} height={size} viewBox="0 0 400 400" fill="none">
        <Defs>
          <LinearGradient
            id="ambientSweep"
            x1="200"
            y1="0"
            x2="380"
            y2="280"
            gradientUnits="userSpaceOnUse"
          >
            <Stop offset="0" stopColor={colors.brand[500]} stopOpacity={0} />
            <Stop offset="1" stopColor={colors.brand[500]} stopOpacity={0.18} />
          </LinearGradient>
        </Defs>
        <Circle
          cx={200}
          cy={200}
          r={190}
          stroke={colors.brand[500]}
          strokeWidth={1}
          opacity={0.08}
        />
        <Circle
          cx={200}
          cy={200}
          r={150}
          stroke={colors.brand[500]}
          strokeWidth={1}
          opacity={0.1}
        />
        <Circle
          cx={200}
          cy={200}
          r={110}
          stroke={colors.brand[500]}
          strokeWidth={1}
          opacity={0.12}
        />
        <Circle
          cx={200}
          cy={200}
          r={70}
          stroke={colors.brand[500]}
          strokeWidth={1}
          opacity={0.15}
        />
        <Path d="M200 200 L200 10 A190 190 0 0 1 369 290 Z" fill="url(#ambientSweep)" />
      </Svg>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Hero LogoMark with a soft brand glow ring.
// ---------------------------------------------------------------------------

function HeroLogo(): React.JSX.Element {
  return (
    <View style={{ alignItems: 'center', justifyContent: 'center' }}>
      <View
        style={{
          width: 152,
          height: 152,
          borderRadius: radii.pill,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'rgba(0,119,182,0.06)',
          borderWidth: 1,
          borderColor: 'rgba(0,119,182,0.18)',
          // Inset highlight per DS
          borderTopColor: 'rgba(255,255,255,0.06)',
          borderTopWidth: 1,
        }}
      >
        <View
          style={{
            width: 116,
            height: 116,
            borderRadius: radii.pill,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(0,119,182,0.1)',
            borderWidth: 1,
            borderColor: 'rgba(0,119,182,0.24)',
          }}
        >
          <LogoMark size={88} />
        </View>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Value pill row — three pillars from the brief.
// ---------------------------------------------------------------------------

function ValuePills(): React.JSX.Element {
  return (
    <View
      style={{
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'center',
        gap: spacing[2],
        paddingHorizontal: spacing[4],
      }}
    >
      <Pill
        variant="brand"
        size="md"
        icon={<Icon name="PieChart" size={14} color={colors.brand[300]} />}
      >
        Personal
      </Pill>
      <Pill
        variant="brand"
        size="md"
        icon={<Icon name="Users" size={14} color={colors.brand[300]} />}
      >
        Compartido
      </Pill>
      <Pill
        variant="alert"
        size="md"
        icon={<Icon name="DollarSign" size={14} color={colors.amber[500]} />}
      >
        ARS + USD
      </Pill>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function SplashScreen(): React.JSX.Element {
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg[0] }}>
      <AmbientRadar />

      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        {/* HEADER — eyebrow + tiny wordmark */}
        <View
          style={{
            paddingHorizontal: spacing[5],
            paddingTop: spacing[4],
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Pill variant="brand" size="sm">
            Tu plata, clarísima
          </Pill>
          <LogoWordmark height={20} />
        </View>

        {/* HERO BLOCK */}
        <View
          style={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: spacing[5],
          }}
        >
          <HeroLogo />

          <View style={{ marginTop: spacing[7], alignItems: 'center' }}>
            <Display style={{ textAlign: 'center', color: colors.fg[1] }}>
              Sabé a dónde va tu plata.
            </Display>
          </View>

          <View style={{ marginTop: spacing[4], paddingHorizontal: spacing[4] }}>
            <Body style={{ textAlign: 'center', color: colors.fg[2] }}>
              Tu billetera, tus grupos y tu USD en un solo radar.
            </Body>
          </View>

          <View style={{ marginTop: spacing[6] }}>
            <ValuePills />
          </View>
        </View>

        {/* CTA BLOCK — anchored bottom */}
        <View
          style={{
            paddingHorizontal: spacing[5],
            paddingBottom: spacing[5],
            gap: spacing[3],
          }}
        >
          {/* Primary CTA with brand glow */}
          <View
            style={{
              ...shadows.two,
              shadowColor: colors.brand[500],
              shadowOpacity: 0.45,
              shadowRadius: 24,
              shadowOffset: { width: 0, height: 8 },
            }}
          >
            <Button
              variant="primary"
              size="lg"
              fullWidth
              onPress={() => router.push('/(auth)/sign-up')}
              accessibilityLabel="Empezar"
              rightIcon={<Icon name="ArrowRight" size={18} color={colors.fg.onBrand} />}
            >
              Empezar
            </Button>
          </View>

          {/* Secondary — ghost link to sign-in */}
          <Button
            variant="ghost"
            size="md"
            fullWidth
            onPress={() => router.push('/(auth)/sign-in')}
            accessibilityLabel="Ya tengo cuenta"
          >
            Ya tengo cuenta
          </Button>

          {/* Trust microcopy */}
          <View style={{ alignItems: 'center', marginTop: spacing[2] }}>
            <Micro style={{ textAlign: 'center', color: colors.fg[3] }}>
              Al continuar aceptás los Términos y la Política de Privacidad.
            </Micro>
          </View>

          {/* Hairline + locale badge */}
          <View
            style={{
              marginTop: spacing[3],
              paddingTop: spacing[3],
              borderTopWidth: 1,
              borderTopColor: colors.line[1],
              alignItems: 'center',
            }}
          >
            <Caption style={{ color: colors.fg[4] }}>Hecho en Argentina · v0.1</Caption>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}
