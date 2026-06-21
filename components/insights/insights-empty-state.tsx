/**
 * InsightsEmptyState — shown when the selected period has no movements.
 *
 * Matches the visual style of the placeholder in explore.tsx:
 * centred icon + title + secondary line + optional CTA button.
 */
import React from 'react';
import { View } from 'react-native';

import { Body, Button, Icon, Text } from '@/components/ui';
import { colors, spacing } from '@/lib/theme';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface InsightsEmptyStateProps {
  onAddExpense?: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function InsightsEmptyState({ onAddExpense }: InsightsEmptyStateProps): React.JSX.Element {
  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing[4],
        paddingHorizontal: spacing[6],
      }}
    >
      <Icon name="Inbox" size={48} color={colors.fg[3]} strokeWidth={1.5} />

      <Text variant="h3" style={{ textAlign: 'center' }}>
        No hay movimientos en este período
      </Text>

      <Body style={{ textAlign: 'center', color: colors.fg[2] }}>
        Cambiá el período o registrá un gasto para ver tu análisis.
      </Body>

      {onAddExpense != null && (
        <Button variant="primary" size="md" onPress={onAddExpense}>
          Registrar gasto
        </Button>
      )}
    </View>
  );
}
