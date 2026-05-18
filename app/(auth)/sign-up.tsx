/**
 * RADAR — Sign-up screen (C3, OTP flow)
 *
 * Calls `supabase.auth.signUp` without `emailRedirectTo` so Supabase delivers
 * an OTP code via email instead of a confirmation link. On success the user
 * is routed to /verify-otp with their email as a param to complete the flow.
 *
 * Name capture: collects `firstName` and `lastName` and forwards them via
 * `options.data` (`first_name` / `last_name`) so the DB trigger can populate
 * `profiles.first_name` and `profiles.last_name` on account creation.
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
import { nameSchema } from '@/lib/schemas/profile';
import { supabase } from '@/lib/supabase';
import { colors, spacing } from '@/lib/theme';

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const schema = z
  .object({
    firstName: nameSchema,
    lastName: nameSchema,
    email: z.string().email('Ingresá un correo electrónico válido.'),
    password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres.'),
    confirmPassword: z.string().min(8, 'Confirmá la contraseña.'),
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
    return 'Ya existe una cuenta con ese correo electrónico.';
  }
  return 'No se pudo crear la cuenta. Intentá nuevamente.';
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function SignUpScreen(): React.JSX.Element {
  const [authError, setAuthError] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { firstName: '', lastName: '', email: '', password: '', confirmPassword: '' },
  });

  const onSubmit = async (data: FormData): Promise<void> => {
    setAuthError(null);
    // Omitting `emailRedirectTo` forces Supabase to use the OTP token flow.
    // The user receives a 6-digit code in their email and types it on the
    // verify-otp screen — no deep-link / scheme config needed in Expo Go.
    const { error } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        data: {
          first_name: data.firstName,
          last_name: data.lastName,
        },
      },
    });
    if (error) {
      setAuthError(mapAuthError(error.message));
      return;
    }
    router.push({
      pathname: '/(auth)/verify-otp',
      params: { email: data.email },
    });
  };

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
            <H1 style={{ marginTop: spacing[4] }}>Crear tu cuenta</H1>
            <Body style={{ marginTop: spacing[2], color: colors.fg[2] }}>
              Comenzá a gestionar tus finanzas.
            </Body>
          </View>

          {/* Form */}
          <View style={{ gap: spacing[4] }}>
            <Controller
              control={control}
              name="firstName"
              render={({ field: { onChange, onBlur, value } }) => (
                <Input
                  label="Nombre"
                  placeholder="Nombre"
                  autoCapitalize="words"
                  autoComplete="given-name"
                  textContentType="givenName"
                  onBlur={onBlur}
                  onChangeText={onChange}
                  value={value}
                  editable={!isSubmitting}
                  error={errors.firstName?.message}
                />
              )}
            />

            <Controller
              control={control}
              name="lastName"
              render={({ field: { onChange, onBlur, value } }) => (
                <Input
                  label="Apellido"
                  placeholder="Apellido"
                  autoCapitalize="words"
                  autoComplete="family-name"
                  textContentType="familyName"
                  onBlur={onBlur}
                  onChangeText={onChange}
                  value={value}
                  editable={!isSubmitting}
                  error={errors.lastName?.message}
                />
              )}
            />

            <Controller
              control={control}
              name="email"
              render={({ field: { onChange, onBlur, value } }) => (
                <Input
                  label="Correo electrónico"
                  placeholder="nombre@ejemplo.com"
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
              <Body>¿Ya tenés una cuenta?</Body>
              <Button variant="ghost" size="sm" onPress={() => router.push('/(auth)/sign-in')}>
                Iniciar sesión
              </Button>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
