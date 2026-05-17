/**
 * RADAR — Verify OTP screen (C3.b)
 *
 * After sign-up the user lands here with their email as a route param. They
 * enter the 6-digit code from the confirmation email and submit; on success
 * Supabase creates a session, the auth listener flips the store, and the
 * `(auth)` layout redirects to `(protected)/(tabs)` automatically.
 *
 * Why OTP instead of email-link?
 *   In Expo Go, custom deep-link schemes (`radar://`) don't resolve back to
 *   the app. OTP avoids deep-linking entirely: code in, code out, all in-app.
 */
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Body, BodySm, Button, H1, Text } from '@/components/ui';
import { LogoMark } from '@/components/ui/logo';
import { supabase } from '@/lib/supabase';
import { colors, radii, spacing, typography } from '@/lib/theme';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const OTP_LENGTH = 6;
const RESEND_COOLDOWN_SECONDS = 60;

// ---------------------------------------------------------------------------
// Error mapping
// ---------------------------------------------------------------------------

function mapVerifyError(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes('expired') || lower.includes('invalid')) {
    return 'Código inválido o expirado. Pedí uno nuevo.';
  }
  if (lower.includes('too many')) {
    return 'Demasiados intentos. Esperá unos minutos y probá de nuevo.';
  }
  return 'No pudimos verificar el código. Probá de nuevo.';
}

function mapResendError(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes('rate') || lower.includes('too many')) {
    return 'Esperá un toque antes de pedir otro código.';
  }
  return 'No pudimos reenviar el código. Probá de nuevo.';
}

// ---------------------------------------------------------------------------
// OTP input — single hidden TextInput driving 6 visual cells
// ---------------------------------------------------------------------------

interface OtpInputProps {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  hasError?: boolean;
}

function OtpInput({
  value,
  onChange,
  disabled = false,
  hasError = false,
}: OtpInputProps): React.JSX.Element {
  const cells = Array.from({ length: OTP_LENGTH }, (_, i) => value[i] ?? '');
  const focusedIndex = Math.min(value.length, OTP_LENGTH - 1);

  return (
    <View>
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          gap: spacing[2],
        }}
      >
        {cells.map((char, idx) => {
          const isFocused = !disabled && idx === focusedIndex && value.length < OTP_LENGTH;
          const borderColor = hasError
            ? colors.money.out
            : isFocused
              ? colors.brand[400]
              : colors.line[2];
          return (
            <View
              key={idx}
              style={{
                flex: 1,
                aspectRatio: 1,
                maxWidth: 56,
                backgroundColor: colors.bg[2],
                borderRadius: radii.md,
                borderWidth: isFocused || hasError ? 2 : 1,
                borderColor,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text
                variant="h2"
                color={colors.fg[1]}
                style={{ fontFamily: typography.family.monoMedium }}
              >
                {char}
              </Text>
            </View>
          );
        })}
      </View>

      {/* Invisible TextInput captures keystrokes for the whole cell row */}
      <TextInput
        autoFocus
        value={value}
        onChangeText={(text) => onChange(text.replace(/[^0-9]/g, '').slice(0, OTP_LENGTH))}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="one-time-code"
        editable={!disabled}
        maxLength={OTP_LENGTH}
        caretHidden
        accessibilityLabel="Código de verificación"
        style={{
          position: 'absolute',
          opacity: 0,
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
        }}
      />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function VerifyOtpScreen(): React.JSX.Element {
  const params = useLocalSearchParams<{ email?: string }>();
  const email = typeof params.email === 'string' ? params.email : '';

  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  // Resend cooldown countdown
  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setInterval(() => setCooldown((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, [cooldown]);

  async function handleVerify(): Promise<void> {
    if (code.length !== OTP_LENGTH) {
      setError('Ingresá los 6 dígitos.');
      return;
    }
    if (!email) {
      setError('Falta el email. Volvé a registrarte.');
      return;
    }
    setError(null);
    setInfo(null);
    setIsVerifying(true);
    try {
      const { error: verifyError } = await supabase.auth.verifyOtp({
        email,
        token: code,
        type: 'signup',
      });
      if (verifyError) {
        setError(mapVerifyError(verifyError.message));
        return;
      }
      // On success the auth listener picks up the new session and
      // (auth)/_layout.tsx redirects to (protected)/(tabs).
    } finally {
      setIsVerifying(false);
    }
  }

  async function handleResend(): Promise<void> {
    if (cooldown > 0 || isResending) return;
    if (!email) {
      setError('Falta el email. Volvé a registrarte.');
      return;
    }
    setError(null);
    setInfo(null);
    setIsResending(true);
    try {
      const { error: resendError } = await supabase.auth.resend({
        type: 'signup',
        email,
      });
      if (resendError) {
        setError(mapResendError(resendError.message));
        return;
      }
      setInfo('Te mandamos un código nuevo.');
      setCooldown(RESEND_COOLDOWN_SECONDS);
    } finally {
      setIsResending(false);
    }
  }

  // Auto-submit when the user types the 6th digit
  useEffect(() => {
    if (code.length === OTP_LENGTH && !isVerifying) {
      void handleVerify();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg[0] }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, paddingHorizontal: spacing[5] }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={{ paddingTop: spacing[6], paddingBottom: spacing[5] }}>
            <LogoMark size={48} />
            <H1 style={{ marginTop: spacing[4] }}>Confirmá tu cuenta</H1>
            <Body style={{ marginTop: spacing[2], color: colors.fg[2] }}>
              Te mandamos un código de 6 dígitos a{'\n'}
              <Text color={colors.fg[1]}>{email || 'tu email'}</Text>.
            </Body>
          </View>

          {/* OTP input */}
          <View style={{ marginTop: spacing[4] }}>
            <OtpInput
              value={code}
              onChange={(v) => {
                setError(null);
                setCode(v);
              }}
              disabled={isVerifying}
              hasError={error != null}
            />
          </View>

          {/* Status messages */}
          {error != null && (
            <BodySm style={{ marginTop: spacing[3], color: colors.money.out, textAlign: 'center' }}>
              {error}
            </BodySm>
          )}
          {error == null && info != null && (
            <BodySm style={{ marginTop: spacing[3], color: colors.money.in, textAlign: 'center' }}>
              {info}
            </BodySm>
          )}

          {/* Verify button */}
          <View style={{ marginTop: spacing[5] }}>
            <Button
              variant="primary"
              size="lg"
              fullWidth
              loading={isVerifying}
              disabled={code.length !== OTP_LENGTH}
              onPress={handleVerify}
              accessibilityLabel="Verificar código"
            >
              Verificar código
            </Button>
          </View>

          {/* Resend */}
          <View style={{ marginTop: spacing[4], alignItems: 'center' }}>
            <BodySm style={{ color: colors.fg[2] }}>¿No te llegó?</BodySm>
            <Button
              variant="ghost"
              size="sm"
              loading={isResending}
              disabled={cooldown > 0 || isResending}
              onPress={handleResend}
            >
              {cooldown > 0 ? `Reenviar en ${cooldown}s` : 'Reenviar código'}
            </Button>
          </View>

          {/* Back to sign-up */}
          <View style={{ marginTop: spacing[3], alignItems: 'center', marginBottom: spacing[6] }}>
            <Button variant="ghost" size="sm" onPress={() => router.replace('/(auth)/sign-up')}>
              Usar otro email
            </Button>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
