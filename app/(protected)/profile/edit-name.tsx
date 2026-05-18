/**
 * RADAR — Edit name screen
 *
 * Allows the user to update their first_name and last_name in user_metadata.
 * Pre-populated from current session. On success returns to the profile screen.
 */
import { zodResolver } from '@hookform/resolvers/zod';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Body, Button, H1, Icon, Input } from '@/components/ui';
import { profileUpdateSchema, type ProfileUpdateInput } from '@/lib/schemas/profile';
import { supabase } from '@/lib/supabase';
import { colors, spacing } from '@/lib/theme';
import { useSession } from '@/hooks/use-session';

export default function EditNameScreen(): React.JSX.Element {
  const { user } = useSession();
  const [authError, setAuthError] = useState<string | null>(null);

  const md = user?.user_metadata ?? {};
  const defaultFirstName = typeof md.first_name === 'string' ? md.first_name.trim() : '';
  const defaultLastName = typeof md.last_name === 'string' ? md.last_name.trim() : '';

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ProfileUpdateInput>({
    resolver: zodResolver(profileUpdateSchema),
    defaultValues: { firstName: defaultFirstName, lastName: defaultLastName },
  });

  const onSubmit = async (data: ProfileUpdateInput): Promise<void> => {
    setAuthError(null);
    const { error } = await supabase.auth.updateUser({
      data: { first_name: data.firstName, last_name: data.lastName },
    });
    if (error) {
      setAuthError('No pudimos guardar tu nombre. Probá de nuevo.');
      return;
    }
    // On success the auth listener fires USER_UPDATED → store rehydrates →
    // the profile screen re-renders with the new values.
    router.back();
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
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing[3],
              paddingTop: spacing[4],
              paddingBottom: spacing[5],
            }}
          >
            <Pressable
              onPress={() => router.back()}
              accessibilityLabel="Volver"
              hitSlop={12}
              style={{ padding: spacing[1] }}
            >
              <Icon name="ChevronLeft" size={24} color={colors.fg[1]} />
            </Pressable>
            <H1>Editar nombre</H1>
          </View>

          {/* Subtitle */}
          <Body style={{ marginBottom: spacing[5], color: colors.fg[2] }}>
            Actualizá tu nombre y apellido.
          </Body>

          {/* Form */}
          <View style={{ gap: spacing[4] }}>
            <Controller
              control={control}
              name="firstName"
              render={({ field: { onChange, onBlur, value } }) => (
                <Input
                  label="Nombre"
                  placeholder="Tu nombre"
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
                  placeholder="Tu apellido"
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
                Guardar
              </Button>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
