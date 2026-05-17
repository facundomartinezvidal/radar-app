/**
 * Insights / Explorar tab — RADAR (Phase C5d)
 *
 * Placeholder screen while the full analytics feature is built.
 * Real data (spending patterns, AI insights) will be wired up post-scaffold.
 */
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Body, H2, Icon } from '@/components/ui';
import { colors, spacing } from '@/lib/theme';

export default function ExploreScreen(): React.JSX.Element {
  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <View style={styles.container}>
        <Icon name="ChartLine" size={48} color={colors.fg[3]} strokeWidth={1.5} />
        <H2 style={styles.title}>Próximamente</H2>
        <Body style={styles.description}>
          Acá vas a ver el análisis de tus gastos y los insights de la IA.
        </Body>
        <Body style={styles.subtitle}>Estamos trabajando en eso.</Body>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.bg[0],
  },
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[4],
    paddingHorizontal: spacing[6],
  },
  title: {
    textAlign: 'center',
  },
  description: {
    textAlign: 'center',
    color: colors.fg[2],
  },
  subtitle: {
    textAlign: 'center',
    color: colors.fg[3],
  },
});
