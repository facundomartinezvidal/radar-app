/**
 * RADAR — SplitEditor
 *
 * Lets the user choose how to divide a shared expense among group members.
 * Supports three split types: equal, custom (fixed amounts), and percent.
 *
 * The component is uncontrolled — it calls `onChange` every time the user
 * changes the type or any per-member value so the parent always has the
 * latest state.
 *
 * Goal 1 (HU-17): currentMemberId prop — labels the current user as "Vos".
 * Goal 2 (HU-17): includedMemberIds in SplitState — lets users choose the
 *   participating subset. deriveShares runs only over included members.
 */
import React from 'react';
import { Pressable, TextInput, View } from 'react-native';

import { Avatar, BodySm, Caption } from '@/components/ui';
import type { GroupMemberRow } from '@/hooks/use-groups';
import { computeShares, type ShareEntry } from '@/lib/split-math';
import type { SplitType } from '@/lib/schemas/group';
import { colors, radii, spacing, typography } from '@/lib/theme';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SplitState {
  type: SplitType;
  /** Record<member_id, number> — amount for custom, percentage for percent, ignored for equal. */
  values: Record<string, number>;
  /**
   * IDs of members who participate in this expense (subset of all members).
   * Default (empty array = unset) is interpreted as ALL members included.
   * Use the exported `resolveIncluded` helper to normalize.
   */
  includedMemberIds: string[];
}

export interface SplitEditorProps {
  amount: number;
  currency: 'ARS' | 'USD';
  members: GroupMemberRow[];
  value: SplitState;
  onChange: (s: SplitState) => void;
  disabled?: boolean;
  /** ID of the current authenticated member — displayed as "Vos". */
  currentMemberId?: string | null;
}

// ---------------------------------------------------------------------------
// Helper — resolveIncluded
// ---------------------------------------------------------------------------

/**
 * Returns the effective included member list.
 * When `includedMemberIds` is empty (unset / default) ALL members are included.
 */
export function resolveIncluded(state: SplitState, members: GroupMemberRow[]): GroupMemberRow[] {
  if (state.includedMemberIds.length === 0) {
    return members;
  }
  return members.filter((m) => state.includedMemberIds.includes(m.id));
}

// ---------------------------------------------------------------------------
// Helper — deriveShares (exported for parent / submit gating)
// ---------------------------------------------------------------------------

/**
 * Wraps `computeShares` and returns a friendly error string instead of throwing.
 * Runs only over the INCLUDED members (subset). Returns `{ shares: [], error }`
 * when invalid, `{ shares, error: null }` when valid.
 *
 * Guard: at least one member must be included.
 */
export function deriveShares(
  state: SplitState,
  amount: number,
  members: GroupMemberRow[],
): { shares: ShareEntry[]; error: string | null } {
  const included = resolveIncluded(state, members);
  if (included.length === 0) {
    return { shares: [], error: 'Elegí al menos un participante.' };
  }
  const memberIds = included.map((m) => m.id);
  try {
    const shares = computeShares(amount, memberIds, {
      type: state.type,
      values: state.values,
    });
    return { shares, error: null };
  } catch (e) {
    return {
      shares: [],
      error: e instanceof Error ? e.message : 'Error al calcular la división.',
    };
  }
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SPLIT_LABELS: Record<SplitType, string> = {
  equal: 'Partes iguales',
  custom: 'Montos',
  percent: 'Porcentaje',
};

const SPLIT_TYPES: SplitType[] = ['equal', 'custom', 'percent'];

// ---------------------------------------------------------------------------
// Sub-component: segmented control
// ---------------------------------------------------------------------------

interface SegmentedControlProps {
  value: SplitType;
  onChange: (type: SplitType) => void;
  disabled?: boolean;
}

function SegmentedControl({
  value,
  onChange,
  disabled = false,
}: SegmentedControlProps): React.JSX.Element {
  return (
    <View
      style={{
        flexDirection: 'row',
        backgroundColor: colors.bg[2],
        borderRadius: radii.md,
        borderWidth: 1,
        borderColor: colors.line[2],
        padding: spacing[1],
        gap: spacing[1],
      }}
      accessibilityRole="radiogroup"
      accessibilityLabel="Tipo de división"
    >
      {SPLIT_TYPES.map((type) => {
        const selected = type === value;
        return (
          <Pressable
            key={type}
            onPress={() => {
              if (!disabled) onChange(type);
            }}
            disabled={disabled}
            accessibilityRole="radio"
            accessibilityState={{ selected, disabled }}
            accessibilityLabel={SPLIT_LABELS[type]}
            style={({ pressed }) => ({
              flex: 1,
              paddingVertical: spacing[2],
              paddingHorizontal: spacing[2],
              borderRadius: radii.sm,
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: 36,
              backgroundColor: selected
                ? colors.brand[500]
                : pressed
                  ? colors.bg[3]
                  : 'transparent',
              opacity: disabled ? 0.5 : 1,
            })}
          >
            <Caption
              color={selected ? colors.fg.onBrand : colors.fg[2]}
              style={{ fontWeight: selected ? '600' : '400', textAlign: 'center' }}
            >
              {SPLIT_LABELS[type]}
            </Caption>
          </Pressable>
        );
      })}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Sub-component: single member row
// ---------------------------------------------------------------------------

interface MemberRowProps {
  member: GroupMemberRow;
  rightSlot: React.ReactNode;
  /** When true the member is the current authenticated user — displayed as "Vos". */
  isSelf?: boolean;
  /** Include/exclude toggle state for this row. */
  included: boolean;
  onToggleInclude: () => void;
  disabled?: boolean;
}

function MemberRow({
  member,
  rightSlot,
  isSelf = false,
  included,
  onToggleInclude,
  disabled = false,
}: MemberRowProps): React.JSX.Element {
  const displayName = isSelf ? 'Vos' : (member.display_name ?? 'Miembro');
  const nameParts = displayName.trim().split(' ');
  const firstName = nameParts[0] ?? null;
  const lastName = nameParts.length > 1 ? (nameParts[nameParts.length - 1] ?? null) : null;
  const includeLabelName = isSelf ? 'Vos' : (member.display_name ?? 'Miembro');

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        minHeight: 44,
        gap: spacing[3],
        paddingVertical: spacing[2],
        opacity: included ? 1 : 0.45,
      }}
    >
      {/* Include toggle checkbox */}
      <Pressable
        onPress={onToggleInclude}
        disabled={disabled}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: included, disabled }}
        accessibilityLabel={`Incluir a ${includeLabelName}`}
        style={({ pressed }) => ({
          width: 22,
          height: 22,
          borderRadius: radii.xs,
          borderWidth: 1.5,
          borderColor: included ? colors.brand[500] : colors.line[3],
          backgroundColor: included ? colors.brand[500] : pressed ? colors.bg[3] : 'transparent',
          alignItems: 'center',
          justifyContent: 'center',
        })}
      >
        {included && (
          <View
            style={{
              width: 12,
              height: 12,
              borderRadius: 2,
              backgroundColor: colors.fg.onBrand,
              // Render a simple checkmark via two nested views (no SVG dependency)
            }}
          >
            {/* Minimal filled square to indicate "checked" — accessible via accessibilityState */}
          </View>
        )}
      </Pressable>

      <Avatar firstName={firstName} lastName={lastName} size={32} />
      <BodySm color={included ? colors.fg[2] : colors.fg[4]} style={{ flex: 1 }} numberOfLines={1}>
        {displayName}
      </BodySm>
      {included ? rightSlot : null}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Helpers — formatting
// ---------------------------------------------------------------------------

function formatCurrency(amount: number, currency: 'ARS' | 'USD'): string {
  const prefix = currency === 'USD' ? 'US$ ' : '$ ';
  return `${prefix}${amount.toLocaleString('es-AR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function SplitEditor({
  amount,
  currency,
  members,
  value,
  onChange,
  disabled = false,
  currentMemberId,
}: SplitEditorProps): React.JSX.Element {
  // Resolve which members are included (default = all)
  const includedMembers = resolveIncluded(value, members);
  const includedIds = includedMembers.map((m) => m.id);

  // ----- Derived display values -----
  const equalShares =
    amount > 0 && includedIds.length > 0
      ? computeShares(amount, includedIds, { type: 'equal' })
      : includedIds.map((id) => ({ member_id: id, share_amount: 0 }));

  // Live totals for validation display — only over included members
  const customSum = includedIds.reduce((acc, id) => acc + (value.values[id] ?? 0), 0);
  const percentSum = includedIds.reduce((acc, id) => acc + (value.values[id] ?? 0), 0);

  const customDelta = Math.abs(customSum - amount);
  const showCustomError = value.type === 'custom' && includedIds.length > 0 && customDelta > 0.01;
  const showPercentError =
    value.type === 'percent' && includedIds.length > 0 && Math.abs(percentSum - 100) > 0.01;

  function handleTypeChange(type: SplitType): void {
    onChange({ ...value, type });
  }

  function handleValueChange(memberId: string, raw: string): void {
    const parsed = parseFloat(raw.replace(',', '.'));
    const num = Number.isFinite(parsed) ? parsed : 0;
    onChange({
      ...value,
      values: { ...value.values, [memberId]: num },
    });
  }

  function handleToggleInclude(memberId: string): void {
    const current = resolveIncluded(value, members).map((m) => m.id);
    const allIds = members.map((m) => m.id);
    // Compute the new included set
    let nextIncluded: string[];
    if (current.includes(memberId)) {
      nextIncluded = current.filter((id) => id !== memberId);
    } else {
      // Re-add; keep original member order
      nextIncluded = allIds.filter((id) => id === memberId || current.includes(id));
    }
    // If all members are included, store as empty array (= default all)
    const storedIncluded = nextIncluded.length === allIds.length ? [] : nextIncluded;
    onChange({ ...value, includedMemberIds: storedIncluded });
  }

  return (
    <View style={{ gap: spacing[3] }}>
      {/* Segmented control */}
      <SegmentedControl value={value.type} onChange={handleTypeChange} disabled={disabled} />

      {/* Member rows */}
      <View style={{ gap: 0 }}>
        {members.map((member, index) => {
          const isLast = index === members.length - 1;
          const isIncluded = includedIds.includes(member.id);
          const isSelf = currentMemberId != null && member.id === currentMemberId;
          const displayNameForA11y = isSelf ? 'Vos' : (member.display_name ?? 'Miembro');

          const rightSlot = (() => {
            if (value.type === 'equal') {
              const share = equalShares.find((s) => s.member_id === member.id);
              return (
                <BodySm
                  color={colors.fg[1]}
                  style={{ fontVariant: ['tabular-nums'], fontFamily: typography.family.medium }}
                >
                  {formatCurrency(share?.share_amount ?? 0, currency)}
                </BodySm>
              );
            }

            if (value.type === 'custom') {
              const rawVal = value.values[member.id];
              const displayVal = rawVal !== undefined && rawVal !== 0 ? String(rawVal) : '';
              return (
                <TextInput
                  style={{
                    width: 100,
                    height: 40,
                    backgroundColor: colors.bg[2],
                    borderRadius: radii.sm,
                    borderWidth: 1,
                    borderColor: colors.line[2],
                    paddingHorizontal: spacing[3],
                    paddingVertical: 0,
                    fontFamily: typography.family.regular,
                    fontSize: typography.size.bodySm,
                    color: colors.fg[1],
                    textAlign: 'right',
                  }}
                  keyboardType="decimal-pad"
                  placeholder="0,00"
                  placeholderTextColor={colors.fg[4]}
                  value={displayVal}
                  onChangeText={(t) => handleValueChange(member.id, t)}
                  editable={!disabled}
                  accessibilityLabel={`Monto para ${displayNameForA11y}`}
                />
              );
            }

            // percent
            const rawVal = value.values[member.id];
            const pct = rawVal !== undefined ? rawVal : 0;
            const moneyShare = amount > 0 ? (amount * pct) / 100 : 0;
            const displayVal = rawVal !== undefined && rawVal !== 0 ? String(rawVal) : '';
            return (
              <View style={{ alignItems: 'flex-end', gap: spacing[1] }}>
                <TextInput
                  style={{
                    width: 72,
                    height: 40,
                    backgroundColor: colors.bg[2],
                    borderRadius: radii.sm,
                    borderWidth: 1,
                    borderColor: colors.line[2],
                    paddingHorizontal: spacing[3],
                    paddingVertical: 0,
                    fontFamily: typography.family.regular,
                    fontSize: typography.size.bodySm,
                    color: colors.fg[1],
                    textAlign: 'right',
                  }}
                  keyboardType="decimal-pad"
                  placeholder="0"
                  placeholderTextColor={colors.fg[4]}
                  value={displayVal}
                  onChangeText={(t) => handleValueChange(member.id, t)}
                  editable={!disabled}
                  accessibilityLabel={`Porcentaje para ${displayNameForA11y}`}
                />
                <Caption color={colors.fg[3]} style={{ fontVariant: ['tabular-nums'] }}>
                  {formatCurrency(moneyShare, currency)}
                </Caption>
              </View>
            );
          })();

          return (
            <View key={member.id}>
              <MemberRow
                member={member}
                rightSlot={rightSlot}
                isSelf={isSelf}
                included={isIncluded}
                onToggleInclude={() => handleToggleInclude(member.id)}
                disabled={disabled}
              />
              {!isLast && (
                <View
                  style={{
                    height: 1,
                    backgroundColor: colors.line[1],
                    marginLeft: spacing[3] + 32,
                  }}
                />
              )}
            </View>
          );
        })}
      </View>

      {/* Live validation feedback */}
      {value.type === 'custom' && includedIds.length > 0 && (
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Caption color={colors.fg[3]}>Total ingresado</Caption>
          <Caption
            color={showCustomError ? colors.money.out : colors.money.in}
            style={{ fontVariant: ['tabular-nums'] }}
          >
            {formatCurrency(customSum, currency)}
          </Caption>
        </View>
      )}
      {value.type === 'percent' && includedIds.length > 0 && (
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Caption color={colors.fg[3]}>Total porcentaje</Caption>
          <Caption
            color={showPercentError ? colors.money.out : colors.money.in}
            style={{ fontVariant: ['tabular-nums'] }}
          >
            {`${percentSum.toLocaleString('es-AR', { maximumFractionDigits: 2 })}%`}
          </Caption>
        </View>
      )}

      {showCustomError && (
        <BodySm color={colors.money.out}>Los montos no coinciden con el total.</BodySm>
      )}
      {showPercentError && (
        <BodySm color={colors.money.out}>Los porcentajes deben sumar 100.</BodySm>
      )}

      {includedIds.length === 0 && (
        <BodySm color={colors.money.out}>Elegí al menos un participante.</BodySm>
      )}
    </View>
  );
}
