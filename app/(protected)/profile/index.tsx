/**
 * RADAR — Perfil screen
 *
 * Shows user avatar, full name, email, and account actions.
 * Sign-out is moved here from the home screen.
 */
import { router } from 'expo-router';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar, Body, Card, H1, H2, Icon } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { colors, radii, spacing } from '@/lib/theme';
import { useSession } from '@/hooks/use-session';
import { useAuthStore } from '@/stores';

export default function ProfileScreen(): React.JSX.Element {
  const { user } = useSession();

  const md = user?.user_metadata ?? {};
  const firstName =
    typeof md.first_name === 'string' && md.first_name.trim().length > 0
      ? md.first_name.trim()
      : null;
  const lastName =
    typeof md.last_name === 'string' && md.last_name.trim().length > 0 ? md.last_name.trim() : null;
  const fullName = [firstName, lastName].filter(Boolean).join(' ').trim() || 'Sin nombre';
  const email = user?.email ?? '';

  async function handleSignOut(): Promise<void> {
    await supabase.auth.signOut();
    useAuthStore.getState().reset();
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header row */}
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Volver"
            hitSlop={12}
            style={styles.backButton}
          >
            <Icon name="ChevronLeft" size={24} color={colors.fg[1]} strokeWidth={1.5} />
          </Pressable>
          <H2 style={styles.headerTitle}>Perfil</H2>
          <View style={styles.headerSpacer} />
        </View>

        {/* Hero card */}
        <Card variant="base" padding={6} style={styles.heroCard}>
          <View style={styles.heroContent}>
            <Avatar firstName={firstName} lastName={lastName} size={96} />
            <H1 style={styles.fullName}>{fullName}</H1>
            <Body color={colors.fg[2]} style={styles.email}>
              {email}
            </Body>
          </View>
        </Card>

        {/* Section: Cuenta */}
        <View style={styles.section}>
          <Card variant="base" style={[styles.listCard, styles.listCardNoPadding]}>
            <Pressable
              onPress={() => router.push('/(protected)/profile/edit-name')}
              accessibilityRole="button"
              accessibilityLabel="Editar nombre"
              style={styles.listRow}
              testID="edit-name-row"
            >
              <Body style={styles.listRowLabel}>Editar nombre</Body>
              <Icon name="ChevronRight" size={20} color={colors.fg[3]} strokeWidth={1.5} />
            </Pressable>
            <View style={styles.rowDivider} />
            <Pressable
              onPress={() => router.push('/(protected)/profile/categories')}
              accessibilityRole="button"
              accessibilityLabel="Categorías"
              style={styles.listRow}
              testID="categories-row"
            >
              <Body style={styles.listRowLabel}>Categorías</Body>
              <Icon name="ChevronRight" size={20} color={colors.fg[3]} strokeWidth={1.5} />
            </Pressable>
          </Card>
        </View>

        <View style={styles.divider} />

        {/* Section: Sesión */}
        <View style={styles.section}>
          <Card variant="base" style={[styles.listCard, styles.listCardNoPadding]}>
            <Pressable
              onPress={handleSignOut}
              accessibilityRole="button"
              accessibilityLabel="Cerrar sesión"
              style={styles.listRow}
              testID="sign-out-row"
            >
              <Body style={styles.destructiveLabel}>Cerrar sesión</Body>
            </Pressable>
          </Card>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.bg[0],
  },
  scrollView: {
    flex: 1,
    backgroundColor: colors.bg[0],
  },
  scrollContent: {
    paddingBottom: spacing[8],
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[5],
    paddingTop: spacing[4],
    paddingBottom: spacing[3],
  },
  backButton: {
    padding: spacing[1],
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
  },
  headerSpacer: {
    width: 24 + spacing[1] * 2, // matches backButton tap area
  },

  // Hero card
  heroCard: {
    marginHorizontal: spacing[5],
    marginBottom: spacing[5],
  },
  heroContent: {
    alignItems: 'center',
    gap: spacing[2],
  },
  fullName: {
    textAlign: 'center',
    marginTop: spacing[2],
  },
  email: {
    textAlign: 'center',
  },

  // List sections
  section: {
    marginHorizontal: spacing[5],
    marginBottom: spacing[3],
  },
  listCard: {
    borderRadius: radii.md,
  },
  listCardNoPadding: {
    padding: 0,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[4],
    minHeight: 44,
  },
  listRowLabel: {
    color: colors.fg[1],
  },
  rowDivider: {
    height: 1,
    backgroundColor: colors.line[1],
    marginHorizontal: spacing[4],
  },
  destructiveLabel: {
    color: colors.money.out,
  },

  // Divider
  divider: {
    height: 1,
    backgroundColor: colors.line[1],
    marginHorizontal: spacing[5],
    marginBottom: spacing[3],
  },
});
