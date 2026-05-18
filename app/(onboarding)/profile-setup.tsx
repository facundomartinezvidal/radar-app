/**
 * RADAR — Profile-setup screen (Onboarding)
 *
 * Gates authenticated users who have no first_name / last_name in their
 * JWT user_metadata. On success `supabase.auth.updateUser` writes the names
 * to raw_user_meta_data; the sync trigger propagates to `profiles`.
 * No explicit navigation here — the USER_UPDATED event fires, the auth
 * listener rehydrates the store, and the (onboarding) layout gate redirects
 * to /(protected)/(tabs) automatically.
 */
import { zodResolver } from '@hookform/resolvers/zod';
import React, { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Body, Button, H1, Input } from '@/components/ui';
import { LogoMark } from '@/components/ui/logo';
import { profileUpdateSchema, type ProfileUpdateInput } from '@/lib/schemas/profile';
import { supabase } from '@/lib/supabase';
import { colors, spacing } from '@/lib/theme';

export default function ProfileSetupScreen(): React.JSX.Element {
  const [authError, setAuthError] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ProfileUpdateInput>({
    resolver: zodResolver(profileUpdateSchema),
    defaultValues: { firstName: '', lastName: '' },
  });

  const onSubmit = async (data: ProfileUpdateInput): Promise<void> => {
    setAuthError(null);
    const { error } = await supabase.auth.updateUser({
      data: { first_name: data.firstName, last_name: data.lastName },
    });
    if (error) {
      setAuthError('No se pudo guardar tu nombre. Intentá nuevamente.');
      return;
    }
    // No router.push — auth listener will fire USER_UPDATED → store rehidrata → gate redirige a tabs
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
            <H1 style={{ marginTop: spacing[4] }}>Completá tu perfil</H1>
            <Body style={{ marginTop: spacing[2], color: colors.fg[2] }}>
              Ingresá tu nombre y apellido para continuar.
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
                accessibilityLabel="Guardar nombre"
              >
                Continuar
              </Button>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
