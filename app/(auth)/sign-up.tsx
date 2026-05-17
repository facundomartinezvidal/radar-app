/**
 * RADAR — Sign-up screen (C3)
 *
 * Full rewrite using DS primitives. All copy is Spanish rioplatense.
 * Form validation via react-hook-form + zod. Supabase auth on submit.
 * Shows a success state after email confirmation is sent.
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

const schema = z
  .object({
    email: z.string().email('Ingresá un email válido.'),
    password: z.string().min(8, 'Mínimo 8 caracteres.'),
    confirmPassword: z.string().min(8, 'Confirmá tu contraseña.'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Las contraseñas no coinciden.',
    path: ['confirmPassword'],
  });

type FormData = z.infer<typeof schema>;

// ---------------------------------------------------------------------------
// Error mapping
// ---------------------------------------------------------------------------

function mapAuthError(message: string): string {
  if (message.toLowerCase().includes('user already registered')) {
    return 'Ya hay una cuenta con ese email.';
  }
  return 'No pudimos crear la cuenta. Probá de nuevo.';
}

// ---------------------------------------------------------------------------
// Email sent state
// ---------------------------------------------------------------------------

interface EmailSentViewProps {
  onBack: () => void;
}

function EmailSentView({ onBack }: EmailSentViewProps): React.JSX.Element {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg[0] }}>
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: spacing[5],
        }}
      >
        <LogoMark size={96} color={colors.brand[300]} />
        <H1 style={{ marginTop: spacing[5], textAlign: 'center' }}>Revisá tu mail</H1>
        <Body
          style={{
            marginTop: spacing[3],
            textAlign: 'center',
            color: colors.fg[2],
          }}
        >
          Te mandamos un link para activar tu cuenta. Abrí el mail y volvé.
        </Body>
        <View style={{ marginTop: spacing[6], width: '100%' }}>
          <Button variant="secondary" fullWidth onPress={onBack}>
            Volver a iniciar sesión
          </Button>
        </View>
      </View>
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function SignUpScreen(): React.JSX.Element {
  const [authError, setAuthError] = useState<string | null>(null);
  const [emailSent, setEmailSent] = useState(false);

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '', confirmPassword: '' },
  });

  const onSubmit = async (data: FormData): Promise<void> => {
    setAuthError(null);
    const { error } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
    });
    if (error) {
      setAuthError(mapAuthError(error.message));
    } else {
      setEmailSent(true);
    }
  };

  if (emailSent) {
    return <EmailSentView onBack={() => router.push('/(auth)/sign-in')} />;
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
            <H1 style={{ marginTop: spacing[4] }}>Creá tu cuenta</H1>
            <Body style={{ marginTop: spacing[2], color: colors.fg[2] }}>
              Empezá a controlar tu plata.
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

            <Controller
              control={control}
              name="password"
              render={({ field: { onChange, onBlur, value } }) => (
                <Input
                  label="Contraseña"
                  secureTextEntry
                  autoComplete="new-password"
                  onBlur={onBlur}
                  onChangeText={onChange}
                  value={value}
                  editable={!isSubmitting}
                  error={errors.password?.message}
                />
              )}
            />

            <Controller
              control={control}
              name="confirmPassword"
              render={({ field: { onChange, onBlur, value } }) => (
                <Input
                  label="Confirmar contraseña"
                  secureTextEntry
                  autoComplete="new-password"
                  onBlur={onBlur}
                  onChangeText={onChange}
                  value={value}
                  editable={!isSubmitting}
                  error={errors.confirmPassword?.message}
                />
              )}
            />

            {/* Auth error */}
            {authError != null && (
              <Body style={{ color: colors.money.out, textAlign: 'center' }}>{authError}</Body>
            )}

            {/* Submit */}
            <View style={{ marginTop: spacing[5] }}>
              <Button
                variant="primary"
                size="lg"
                fullWidth
                loading={isSubmitting}
                onPress={handleSubmit(onSubmit)}
                accessibilityLabel="Crear cuenta"
              >
                Crear cuenta
              </Button>
            </View>

            {/* Sign-in link */}
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
              <Body>¿Ya tenés cuenta?</Body>
              <Button variant="ghost" size="sm" onPress={() => router.push('/(auth)/sign-in')}>
                Iniciá sesión
              </Button>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
