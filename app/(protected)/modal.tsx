/**
 * Modal screen — RADAR (Phase C5c)
 *
 * Placeholder modal using DS primitives.
 * ThemedText / ThemedView replaced with DS Text + View.
 */
import { useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Button, H2 } from '@/components/ui';
import { colors, spacing } from '@/lib/theme';

export default function ModalScreen(): React.JSX.Element {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <H2>Modal</H2>
      <Body style={styles.body}>Contenido del modal.</Body>
      <Button variant="secondary" size="md" onPress={() => router.back()}>
        Cerrar
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing[5],
    backgroundColor: colors.bg[1],
    gap: spacing[4],
  },
  body: {
    color: colors.fg[2],
  },
});
