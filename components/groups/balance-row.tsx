/**
 * RADAR — BalanceRow
 *
 * Displays a single payment edge in the "Quién le debe a quién" section.
 * Shows: Avatar(from) → ArrowRight → Avatar(to), names, amount, and a
 * "Saldar" outline button.
 */
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { Avatar, Body, Button, Caption, Icon, Money } from '@/components/ui';
import type { GroupMemberRow } from '@/lib/repositories/groups';
import { formatMoney } from '@/lib/format/money';
import { colors, spacing } from '@/lib/theme';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BalanceRowProps {
  from: GroupMemberRow;
  to: GroupMemberRow;
  amount: number;
  currency: string;
  onSettle?: () => void;
  settling?: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function memberFirstName(member: GroupMemberRow): string | undefined {
  const parts = (member.display_name ?? '').trim().split(' ');
  return parts[0] ?? undefined;
}

function memberLastName(member: GroupMemberRow): string | undefined {
  const parts = (member.display_name ?? '').trim().split(' ');
  return parts.length > 1 ? parts.slice(1).join(' ') : undefined;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function BalanceRow({
  from,
  to,
  amount,
  currency,
  onSettle,
  settling = false,
}: BalanceRowProps): React.JSX.Element {
  const fromFirst = memberFirstName(from);
  const fromLast = memberLastName(from);
  const toFirst = memberFirstName(to);
  const toLast = memberLastName(to);

  const amountLabel = formatMoney(amount, currency as 'ARS' | 'USD');

  return (
    <View style={styles.container} testID="balance-row">
      {/* Avatars + arrow */}
      <View style={styles.avatarRow}>
        <View style={styles.memberCol} accessibilityLabel={`De ${from.display_name ?? ''}`}>
          <Avatar firstName={fromFirst} lastName={fromLast} size={36} />
          <Caption color={colors.fg[3]} numberOfLines={1} style={styles.memberName}>
            {from.display_name ?? '—'}
          </Caption>
        </View>

        <Icon name="ArrowRight" size={20} color={colors.fg[3]} strokeWidth={1.5} />

        <View style={styles.memberCol} accessibilityLabel={`A ${to.display_name ?? ''}`}>
          <Avatar firstName={toFirst} lastName={toLast} size={36} />
          <Caption color={colors.fg[3]} numberOfLines={1} style={styles.memberName}>
            {to.display_name ?? '—'}
          </Caption>
        </View>
      </View>

      {/* Amount + Saldar */}
      <View style={styles.actionRow}>
        <Body style={styles.fromName} numberOfLines={1}>
          {from.display_name ?? '—'}
          <Body color={colors.fg[3]}>{' le debe '}</Body>
          {to.display_name ?? '—'}
        </Body>
        <Money tone="in" accessibilityLabel={amountLabel} testID="balance-row-amount">
          {amountLabel}
        </Money>
        {onSettle !== undefined && (
          <Button
            variant="secondary"
            size="sm"
            onPress={onSettle}
            disabled={settling}
            loading={settling}
            accessibilityLabel="Saldar deuda"
          >
            Saldar
          </Button>
        )}
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    gap: spacing[3],
    paddingVertical: spacing[3],
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  memberCol: {
    alignItems: 'center',
    gap: spacing[1],
    flex: 1,
  },
  memberName: {
    textAlign: 'center',
  },
  actionRow: {
    gap: spacing[2],
    alignItems: 'flex-start',
  },
  fromName: {
    flexShrink: 1,
  },
});
