/**
 * RADAR — Sign-in screen (C2)
 *
 * Full rewrite using DS primitives. All copy is Spanish rioplatense.
 * Form validation via react-hook-form + zod. Supabase auth on submit.
 */
import { zodResolver } from '@hookform/resolvers/zod';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { z } from 'zod';

import { Body, Button, H1, Input } from '@/components/ui';
import { LogoMark } from '@/components/ui/logo';
import { supabase } from '@/lib/supabase';
import { colors, spacing } from '@/lib/theme';

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const schema = z.object({
  email: z.string().email('Ingresá un email válido.'),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres.'),
});

type FormData = z.infer<typeof schema>;

// ---------------------------------------------------------------------------
// Error mapping
// ---------------------------------------------------------------------------

function mapAuthError(message: string): string {
  if (message.toLowerCase().includes('invalid login credentials')) {
    return 'Email o contraseña incorrectos.';
  }
  if (message.toLowerCase().includes('email not confirmed')) {
    return 'Tu email todavía no está confirmado.';
  }
  return 'No pudimos iniciar sesión. Probá de nuevo.';
}

function mapResendError(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes('rate') || lower.includes('too many')) {
    return 'Esperá un toque antes de pedir otro código.';
  }
  return 'No pudimos reenviar el código. Probá de nuevo.';
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function SignInScreen(): React.JSX.Element {
  const [authError, setAuthError] = useState<string | null>(null);
  const [needsConfirmation, setNeedsConfirmation] = useState<{ email: string } | null>(null);
  const [isResending, setIsResending] = useState(false);

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = async (data: FormData): Promise<void> => {
    setAuthError(null);
    setNeedsConfirmation(null);
    const { error } = await supabase.auth.signInWithPassword({
      email: data.email,
      password: data.password,
    });
    if (error) {
      setAuthError(mapAuthError(error.message));
      if (error.message.toLowerCase().includes('email not confirmed')) {
        setNeedsConfirmation({ email: data.email });
      }
    }
  };

  async function handleResendAndGo(): Promise<void> {
    if (!needsConfirmation) return;
    setIsResending(true);
    setAuthError(null);
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: needsConfirmation.email,
      });
      if (error) {
        setAuthError(mapResendError(error.message));
        return;
      }
      router.push({
        pathname: '/(auth)/verify-otp',
        params: { email: needsConfirmation.email },
      });
    } finally {
      setIsResending(false);
    }
  }

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
          <View style={{ paddingTop: spacing[6], paddingBottom: spacing[6] }}>
            <LogoMark size={48} />
            <H1 style={{ marginTop: spacing[4] }}>Iniciá sesión</H1>
            <Body style={{ marginTop: spacing[2], color: colors.fg[2] }}>
              Bienvenido de vuelta a RADAR.
            </Body>
          </View>

          {/* Form */}
          <View style={{ gap: spacing[4] }}>
            <Controller
              control={control}
              name="email"
              render={({ field: { onChange, onBlur, value } }) => (
                <Input
                  label="Email"
                  placeholder="vos@ejemplo.com"
                  autoCapitalize="none"
                  keyboardType="email-address"
                  autoComplete="email"
                  onBlur={onBlur}
                  onChangeText={onChange}
                  value={value}
                  editable={!isSubmitting}
                  error={errors.email?.message}
                />
              )}
            />

            <View>
              <Controller
                control={control}
                name="password"
                render={({ field: { onChange, onBlur, value } }) => (
                  <Input
                    label="Contraseña"
                    secureTextEntry
                    autoComplete="password"
                    onBlur={onBlur}
                    onChangeText={onChange}
                    value={value}
                    editable={!isSubmitting}
                    error={errors.password?.message}
                  />
                )}
              />
              <View style={{ alignItems: 'flex-end', marginTop: spacing[1] }}>
                <Button
                  variant="ghost"
                  size="sm"
                  onPress={() => {
                    console.log('Olvidaste tu contraseña — feature pendiente');
                  }}
                >
                  ¿Olvidaste tu contraseña?
                </Button>
              </View>
            </View>

            {/* Auth error */}
            {authError != null && (
              <Body style={{ color: colors.money.out, textAlign: 'center' }}>{authError}</Body>
            )}

            {/* Resend CTA — shown when email is unconfirmed */}
            {needsConfirmation != null && (
              <View style={{ alignItems: 'center' }}>
                <Button
                  variant="primary"
                  size="md"
                  loading={isResending}
                  onPress={handleResendAndGo}
                  accessibilityLabel="Reenviar código de verificación"
                >
                  Reenviar código y verificar
                </Button>
              </View>
            )}

            {/* Submit */}
            <View style={{ marginTop: spacing[5] }}>
              <Button
                variant="primary"
                size="lg"
                fullWidth
                loading={isSubmitting}
                onPress={handleSubmit(onSubmit)}
                accessibilityLabel="Iniciar sesión"
              >
                Iniciar sesión
              </Button>
            </View>

            {/* Sign-up link */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                flexWrap: 'wrap',
                marginTop: spacing[2],
                marginBottom: spacing[6],
              }}
            >
              <Body>¿No tenés cuenta?</Body>
              <Button variant="ghost" size="sm" onPress={() => router.push('/(auth)/sign-up')}>
                Sumate
              </Button>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
