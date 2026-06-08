/**
 * Shared form for create/edit. Drives react-hook-form + zod and emits
 * onSubmit with a validated payload. Parent screen wires the mutation.
 */
import { zodResolver } from '@hookform/resolvers/zod';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Pressable, View } from 'react-native';

import { Avatar, Body, BodySm, Button, Icon, Input } from '@/components/ui';
import { CategoryCreateSheet } from '@/components/categories/category-create-sheet';
import {
  type CreateExpenseInput,
  type ExpenseItemInput,
  createExpenseSchema,
  type Currency,
} from '@/lib/schemas/expense';
import type { CategoryRow, ExpenseItemRow, ExpenseWithCategory } from '@/lib/repositories/expenses';
import type { GroupMemberRow, GroupWithMembers } from '@/lib/repositories/groups';
import type { ShareEntry } from '@/lib/split-math';
import { colors, radii, spacing, typography } from '@/lib/theme';

import { AmountInput } from './amount-input';
import { CategoryPicker } from './category-picker';
import { CurrencyToggle } from './currency-toggle';
import { DateField } from './date-field';
import { ExpenseItemsField } from './expense-items-field';
import { SplitEditor, deriveShares, type SplitState } from '@/components/groups/split-editor';

/** Partial prefill from OCR — used by the review screen when no DB row exists yet. */
export interface ExpenseFormPrefill {
  amount?: number;
  currency?: Currency;
  category_id?: string | null;
  description?: string | null;
  occurred_at?: string;
  /** OCR-detected line items. */
  items?: ExpenseItemInput[];
  /** Suggested new-category name when OCR found no matching category. */
  suggestedCategoryName?: string | null;
  /** One-sentence reason why the suggested category deserves its own slot. */
  suggestedCategoryReason?: string | null;
}

/** Expense row with optional line items (edit mode). */
export type ExpenseWithItems = ExpenseWithCategory & { items?: ExpenseItemRow[] };

/** Extended payload emitted by onSubmit when groupConfig is present. */
export interface SharedExpenseSubmitPayload extends CreateExpenseInput {
  paid_by_member_id: string;
  splits: ShareEntry[];
  /** The group this shared expense belongs to. */
  group_id: string;
}

/**
 * When provided, the form renders a "¿Quién pagó?" member selector and
 * a SplitEditor below the standard fields.
 */
export interface GroupConfig {
  /** Active members to display in the who-paid selector and split editor. */
  members: GroupMemberRow[];
  /** Pre-select this member as the payer (usually the current user). */
  currentMemberId: string | null;
  /**
   * The group id to include in the SharedExpenseSubmitPayload.
   * Required when passing groupConfig from a pre-bound group screen so the
   * form can include the correct group_id in the shared submit payload.
   */
  groupId?: string;
}

export interface ExpenseFormProps {
  categories: CategoryRow[];
  /** Optional initial values (edit mode — DB row, optionally with items). Takes precedence over prefill. */
  initial?: ExpenseWithItems | null;
  /**
   * Optional OCR-detected prefill (review mode — no DB row yet).
   * Only used when `initial` is absent/null.
   */
  prefill?: ExpenseFormPrefill;
  /**
   * When true, renders a low-confidence notice above the form asking the user
   * to verify the detected data. Does NOT block submit.
   */
  lowConfidence?: boolean;
  /**
   * When provided the form gains a "¿Quién pagó?" member selector and a
   * SplitEditor. Submit calls `onSubmitShared` (required when groupConfig
   * is set) with the extended payload including `paid_by_member_id` and
   * `splits`.
   *
   * When set, the toggle/selector UI is NOT shown (pre-bound group screen).
   */
  groupConfig?: GroupConfig;
  /**
   * Groups the current user belongs to — enables the "¿Gasto compartido?"
   * toggle when non-empty and `groupConfig` is NOT passed. The toggle lets
   * the user pick one group from the list and activates the shared split UI.
   * Ignored when `groupConfig` is already provided.
   */
  shareableGroups?: GroupWithMembers[];
  /**
   * The authenticated user's id. Used to derive `currentMemberId` when the
   * user selects a group via the in-form toggle. Required when
   * `shareableGroups` is non-empty; ignored otherwise.
   */
  currentUserId?: string | null;
  /**
   * Called on valid submit when `groupConfig` is NOT set.
   * When `groupConfig` IS set, pass `onSubmitShared` instead — this prop
   * is still required for the non-group fast path (default = no-op when
   * groupConfig is present, but TypeScript callers pass the right handler).
   */
  onSubmit: (input: CreateExpenseInput) => Promise<void> | void;
  /**
   * Called on valid submit when `groupConfig` is provided OR when the
   * user has toggled on the shared mode and selected a group.
   * Receives the full CreateExpenseInput fields PLUS `paid_by_member_id`,
   * `splits`, and `group_id`. Required when `groupConfig` is set.
   */
  onSubmitShared?: (input: SharedExpenseSubmitPayload) => Promise<void> | void;
  submitLabel?: string;
  isSubmitting?: boolean;
  submitError?: string | null;
}

export interface ExpenseFormInternalFields {
  amount: number;
  amountText: string;
  currency: Currency;
  category_id: string | null;
  description: string | null;
  occurred_at: string;
  items: ExpenseItemInput[];
}

export function ExpenseForm({
  categories,
  initial,
  prefill,
  lowConfidence = false,
  groupConfig,
  shareableGroups,
  currentUserId,
  onSubmit,
  onSubmitShared,
  submitLabel = 'Registrar gasto',
  isSubmitting = false,
  submitError = null,
}: ExpenseFormProps): React.JSX.Element {
  // Resolve default values: initial (edit mode) > prefill (OCR review) > blank
  const resolvedAmount = initial ? Number(initial.amount) : (prefill?.amount ?? 0);
  const resolvedAmountText = initial
    ? String(initial.amount).replace('.', ',')
    : prefill?.amount != null
      ? String(prefill.amount).replace('.', ',')
      : '';
  const resolvedCurrency = (initial?.currency ?? prefill?.currency ?? 'ARS') as Currency;
  const resolvedCategoryId = initial?.category_id ?? prefill?.category_id ?? null;
  const resolvedDescription = initial?.description ?? prefill?.description ?? '';
  const resolvedOccurredAt =
    initial?.occurred_at ?? prefill?.occurred_at ?? new Date().toISOString();

  // Map DB items (snake_case, numeric strings) → ExpenseItemInput shape.
  // Resolution order: initial.items > prefill.items > []
  const resolvedItems: ExpenseItemInput[] =
    initial?.items != null && initial.items.length > 0
      ? initial.items.map((row) => ({
          id: row.id,
          name: row.name,
          quantity: Number(row.quantity),
          unit_price: row.unit_price !== null ? Number(row.unit_price) : null,
          line_total: Number(row.line_total),
        }))
      : (prefill?.items ?? []);

  const {
    control,
    handleSubmit,
    setValue,
    getValues,
    watch,
    formState: { errors },
  } = useForm<ExpenseFormInternalFields>({
    // Cast: we add `amountText` as a UI-only field so the user can type
    // partial values; zod validates the numeric `amount`.
    resolver: zodResolver(createExpenseSchema) as never,
    mode: 'onChange',
    defaultValues: {
      amount: resolvedAmount,
      amountText: resolvedAmountText,
      currency: resolvedCurrency,
      category_id: resolvedCategoryId,
      description: resolvedDescription,
      occurred_at: resolvedOccurredAt,
      items: resolvedItems,
    },
  });

  const currency = watch('currency');
  const amountText = watch('amountText');
  const categoryId = watch('category_id');
  const amount = watch('amount');

  const [suggestionSheetVisible, setSuggestionSheetVisible] = useState(false);

  // In-form share toggle state (only relevant when shareableGroups is provided
  // and groupConfig is NOT — i.e. standard personal expense screens).
  // Show the toggle whenever shareableGroups is provided (even empty) so users
  // with zero groups can still discover the shared-expense feature.
  const showShareToggle = groupConfig == null && shareableGroups != null;
  const [isShared, setIsShared] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [groupSelectorOpen, setGroupSelectorOpen] = useState(false);
  const [noGroupError, setNoGroupError] = useState<string | null>(null);

  // Derive an effective GroupConfig: either from the prop (pre-bound group) or
  // from the in-form selection (toggle mode).
  const selectedGroup =
    isShared && selectedGroupId != null
      ? (shareableGroups?.find((g) => g.id === selectedGroupId) ?? null)
      : null;

  const effectiveGroupConfig: GroupConfig | null = (() => {
    if (groupConfig != null) return groupConfig;
    if (selectedGroup != null) {
      const activeMembers = selectedGroup.members.filter((m) => m.status === 'active');
      const currentMemberId = activeMembers.find((m) => m.user_id === currentUserId)?.id ?? null;
      return { members: activeMembers, currentMemberId };
    }
    return null;
  })();

  // Group-specific state: who paid and how to split.
  // Initial paidByMemberId comes from groupConfig prop (pre-bound group screen).
  const defaultPaidBy =
    groupConfig != null
      ? (groupConfig.currentMemberId ?? groupConfig.members[0]?.id ?? null)
      : null;
  const [paidByMemberId, setPaidByMemberId] = useState<string | null>(defaultPaidBy);
  const [splitState, setSplitState] = useState<SplitState>({ type: 'equal', values: {} });
  const [splitError, setSplitError] = useState<string | null>(null);

  // When the user selects a group via the toggle, reset payer + splits to that group's defaults.
  React.useEffect(() => {
    if (selectedGroup != null) {
      const activeMembers = selectedGroup.members.filter((m) => m.status === 'active');
      const newDefault =
        activeMembers.find((m) => m.user_id === currentUserId)?.id ?? activeMembers[0]?.id ?? null;
      setPaidByMemberId(newDefault);
      setSplitState({ type: 'equal', values: {} });
      setSplitError(null);
    } else if (!isShared) {
      // Toggle was turned off — reset to null
      setPaidByMemberId(null);
      setSplitState({ type: 'equal', values: {} });
      setSplitError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedGroup, isShared]);

  const submit = handleSubmit(async (data) => {
    if (effectiveGroupConfig != null) {
      // Shared path: validate group selection first (in-form toggle mode)
      if (groupConfig == null && isShared && selectedGroupId == null) {
        setNoGroupError('Elegí un grupo.');
        return;
      }
      setNoGroupError(null);

      // Validate split before submitting
      const effectivePaidBy = paidByMemberId ?? effectiveGroupConfig.members[0]?.id ?? '';
      const { shares, error: deriveError } = deriveShares(
        splitState,
        data.amount,
        effectiveGroupConfig.members,
      );
      if (deriveError != null) {
        setSplitError(deriveError);
        return;
      }
      setSplitError(null);

      // Resolve which group_id to use:
      //  - Pre-bound group screen: groupConfig.groupId
      //  - In-form toggle: selectedGroupId
      const resolvedGroupId =
        groupConfig != null ? (groupConfig.groupId ?? '') : (selectedGroupId ?? '');

      await onSubmitShared?.({
        amount: data.amount,
        currency: data.currency,
        category_id: data.category_id,
        description: data.description ?? null,
        occurred_at: data.occurred_at,
        items: data.items,
        paid_by_member_id: effectivePaidBy,
        splits: shares,
        group_id: resolvedGroupId,
      });
      return;
    }

    // Toggle is ON but no group selected yet — block submit
    if (isShared && groupConfig == null) {
      setNoGroupError('Elegí un grupo.');
      return;
    }

    await onSubmit({
      amount: data.amount,
      currency: data.currency,
      category_id: data.category_id,
      description: data.description ?? null,
      occurred_at: data.occurred_at,
      // Always include items so edit mode can clear them ([] is valid).
      items: data.items,
    });
  });

  return (
    <View style={{ gap: spacing[5] }}>
      {/* Low-confidence OCR notice */}
      {lowConfidence && (
        <BodySm color={colors.amber[500]}>Revisá los datos detectados antes de guardar.</BodySm>
      )}

      {/* ¿Gasto compartido? toggle — only when shareableGroups is provided and
          groupConfig is NOT set (pre-bound group screen bypasses this) */}
      {showShareToggle && (
        <View
          style={{
            borderRadius: radii.md,
            borderWidth: 1,
            borderColor: isShared ? colors.brand[500] : colors.line[2],
            backgroundColor: isShared ? `${colors.brand[500]}0D` : colors.bg[1],
          }}
        >
          {/* Toggle row */}
          <Pressable
            onPress={() => {
              if (!isSubmitting) {
                const next = !isShared;
                setIsShared(next);
                if (!next) {
                  setSelectedGroupId(null);
                  setGroupSelectorOpen(false);
                  setNoGroupError(null);
                }
              }
            }}
            disabled={isSubmitting}
            accessibilityRole="switch"
            accessibilityState={{ checked: isShared, disabled: isSubmitting }}
            accessibilityLabel="¿Gasto compartido?"
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingHorizontal: spacing[4],
              paddingVertical: spacing[3],
              minHeight: 44,
            }}
          >
            <BodySm
              color={isShared ? colors.fg[1] : colors.fg[2]}
              style={{ fontWeight: isShared ? '600' : '400' }}
            >
              ¿Gasto compartido?
            </BodySm>
            {/* Visual toggle pill */}
            <View
              style={{
                width: 44,
                height: 24,
                borderRadius: radii.pill,
                backgroundColor: isShared ? colors.brand[500] : colors.bg[3],
                justifyContent: 'center',
                paddingHorizontal: 3,
                alignItems: isShared ? 'flex-end' : 'flex-start',
              }}
            >
              <View
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: radii.pill,
                  backgroundColor: colors.fg[1],
                }}
              />
            </View>
          </Pressable>

          {/* Group selector — visible when toggle is ON */}
          {isShared && (
            <View
              style={{
                borderTopWidth: 1,
                borderTopColor: colors.line[2],
                paddingHorizontal: spacing[4],
                paddingTop: spacing[3],
                paddingBottom: spacing[4],
                gap: spacing[3],
              }}
            >
              {shareableGroups != null && shareableGroups.length === 0 ? (
                /* Empty state — user has no groups yet */
                <View
                  style={{
                    gap: spacing[3],
                    paddingTop: spacing[3],
                    alignItems: 'flex-start',
                  }}
                >
                  <BodySm color={colors.fg[2]}>Todavía no tenés grupos.</BodySm>
                  <Button
                    variant="secondary"
                    size="sm"
                    onPress={() => {
                      router.push('/(protected)/groups/new' as never);
                    }}
                    disabled={isSubmitting}
                    accessibilityLabel="Crear grupo"
                  >
                    Crear grupo
                  </Button>
                </View>
              ) : (
                <>
                  {/* Trigger */}
                  <Pressable
                    onPress={() => {
                      if (!isSubmitting) setGroupSelectorOpen((o) => !o);
                    }}
                    disabled={isSubmitting}
                    accessibilityRole="button"
                    accessibilityLabel="Elegí un grupo"
                    style={({ pressed }) => ({
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      paddingHorizontal: spacing[4],
                      paddingVertical: spacing[3],
                      minHeight: 44,
                      borderRadius: radii.md,
                      borderWidth: 1,
                      borderColor:
                        noGroupError != null && selectedGroupId == null
                          ? colors.money.out
                          : colors.line[2],
                      backgroundColor: pressed ? colors.bg[3] : colors.bg[2],
                    })}
                  >
                    <BodySm
                      color={selectedGroupId != null ? colors.fg[1] : colors.fg[3]}
                      style={{ flex: 1 }}
                    >
                      {selectedGroupId != null
                        ? (shareableGroups?.find((g) => g.id === selectedGroupId)?.name ??
                          'Elegí un grupo')
                        : 'Elegí un grupo'}
                    </BodySm>
                    <Icon
                      name={groupSelectorOpen ? 'ChevronUp' : 'ChevronDown'}
                      size={18}
                      color={colors.fg[3]}
                      strokeWidth={1.5}
                    />
                  </Pressable>

                  {/* Inline group list */}
                  {groupSelectorOpen && (
                    <View
                      style={{
                        borderRadius: radii.md,
                        borderWidth: 1,
                        borderColor: colors.line[2],
                        backgroundColor: colors.bg[2],
                        overflow: 'hidden',
                      }}
                    >
                      {(shareableGroups ?? []).map((group, idx) => {
                        const isSelected = group.id === selectedGroupId;
                        return (
                          <Pressable
                            key={group.id}
                            onPress={() => {
                              setSelectedGroupId(group.id);
                              setGroupSelectorOpen(false);
                              setNoGroupError(null);
                            }}
                            accessibilityRole="menuitem"
                            accessibilityLabel={`Grupo ${group.name}`}
                            accessibilityState={{ selected: isSelected }}
                            style={({ pressed }) => ({
                              flexDirection: 'row',
                              alignItems: 'center',
                              gap: spacing[3],
                              paddingHorizontal: spacing[3],
                              paddingVertical: spacing[3],
                              minHeight: 44,
                              borderTopWidth: idx > 0 ? 1 : 0,
                              borderTopColor: colors.line[1],
                              backgroundColor: isSelected
                                ? `${colors.brand[500]}1A`
                                : pressed
                                  ? colors.bg[3]
                                  : 'transparent',
                            })}
                          >
                            <BodySm
                              color={isSelected ? colors.fg[1] : colors.fg[2]}
                              style={{
                                flex: 1,
                                fontWeight: isSelected ? '600' : '400',
                                fontFamily: isSelected
                                  ? typography.family.semibold
                                  : typography.family.regular,
                              }}
                            >
                              {group.name}
                            </BodySm>
                            {isSelected && (
                              <Icon name="Check" size={16} color={colors.brand[500]} />
                            )}
                          </Pressable>
                        );
                      })}
                    </View>
                  )}

                  {/* Validation error */}
                  {noGroupError != null && <BodySm color={colors.money.out}>{noGroupError}</BodySm>}
                </>
              )}
            </View>
          )}
        </View>
      )}

      {/* Amount */}
      <View style={{ gap: spacing[2] }}>
        <BodySm color={colors.fg[3]}>Monto</BodySm>
        <AmountInput
          value={amountText}
          currency={currency}
          hasError={Boolean(errors.amount)}
          disabled={isSubmitting}
          onChange={(text, parsed) => {
            setValue('amountText', text, { shouldValidate: false });
            setValue('amount', Number.isFinite(parsed) ? parsed : 0, {
              shouldValidate: true,
            });
          }}
        />
        {errors.amount?.message != null && (
          <BodySm color={colors.money.out}>{errors.amount.message}</BodySm>
        )}
      </View>

      {/* Currency */}
      <View style={{ gap: spacing[2] }}>
        <BodySm color={colors.fg[3]}>Moneda</BodySm>
        <Controller
          control={control}
          name="currency"
          render={({ field: { onChange, value } }) => (
            <CurrencyToggle value={value} onChange={onChange} disabled={isSubmitting} />
          )}
        />
      </View>

      {/* Date */}
      <Controller
        control={control}
        name="occurred_at"
        render={({ field: { onChange, value } }) => (
          <DateField label="Fecha" value={value} onChange={onChange} disabled={isSubmitting} />
        )}
      />

      {/* Category */}
      <View style={{ gap: spacing[2] }}>
        <BodySm color={colors.fg[3]}>Categoría</BodySm>
        <Controller
          control={control}
          name="category_id"
          render={({ field: { onChange, value } }) => (
            <CategoryPicker
              categories={categories}
              value={value}
              onChange={onChange}
              disabled={isSubmitting}
            />
          )}
        />

        {/* OCR recommendation card — visible only when a name was suggested and no category is selected */}
        {prefill?.suggestedCategoryName != null &&
          prefill.suggestedCategoryName.length > 0 &&
          categoryId == null && (
            <>
              <View
                style={{
                  borderRadius: radii.md,
                  borderWidth: 1,
                  borderColor: `${colors.amber[500]}4D`,
                  backgroundColor: `${colors.amber[500]}0D`,
                  padding: spacing[3],
                  gap: spacing[2],
                }}
              >
                <BodySm color={colors.fg[1]} style={{ fontWeight: '600' }}>
                  {`Categoría recomendada: ${prefill.suggestedCategoryName}`}
                </BodySm>
                <BodySm color={colors.fg[2]}>
                  {prefill.suggestedCategoryReason != null &&
                  prefill.suggestedCategoryReason.length > 0
                    ? prefill.suggestedCategoryReason
                    : 'Este gasto no encaja en tus categorías actuales.'}
                </BodySm>
                <Pressable
                  onPress={() => setSuggestionSheetVisible(true)}
                  accessibilityRole="button"
                  accessibilityLabel="Crear categoría sugerida"
                  style={({ pressed }) => ({
                    alignSelf: 'flex-start',
                    paddingVertical: spacing[2],
                    paddingHorizontal: spacing[3],
                    borderRadius: radii.md,
                    borderWidth: 1,
                    borderColor: colors.amber[500],
                    backgroundColor: pressed ? `${colors.amber[500]}1A` : 'transparent',
                  })}
                >
                  <BodySm color={colors.amber[500]} style={{ fontWeight: '600' }}>
                    {`Crear categoría "${prefill.suggestedCategoryName}"`}
                  </BodySm>
                </Pressable>
              </View>

              <CategoryCreateSheet
                visible={suggestionSheetVisible}
                defaultName={prefill.suggestedCategoryName}
                onClose={() => setSuggestionSheetVisible(false)}
                onCreated={(id) => {
                  setValue('category_id', id, { shouldValidate: true, shouldDirty: true });
                  setSuggestionSheetVisible(false);
                }}
              />
            </>
          )}
      </View>

      {/* Line items */}
      <ExpenseItemsField
        control={control}
        setValue={setValue}
        getValues={getValues}
        errors={errors}
        currency={currency}
        disabled={isSubmitting}
      />

      {/* Description */}
      <View style={{ gap: spacing[2] }}>
        <Controller
          control={control}
          name="description"
          render={({ field: { onChange, onBlur, value } }) => (
            <Input
              label="Descripción (opcional)"
              placeholder="Descripción del gasto"
              value={value ?? ''}
              onChangeText={onChange}
              onBlur={onBlur}
              editable={!isSubmitting}
              maxLength={240}
              error={errors.description?.message}
            />
          )}
        />
      </View>

      {/* Who paid — when effectiveGroupConfig is present */}
      {effectiveGroupConfig != null && effectiveGroupConfig.members.length > 0 && (
        <View style={{ gap: spacing[2] }}>
          <BodySm color={colors.fg[3]}>¿Quién pagó?</BodySm>
          <View style={{ gap: spacing[2] }}>
            {effectiveGroupConfig.members.map((member) => {
              const selected = paidByMemberId === member.id;
              const displayName = member.display_name ?? 'Miembro';
              const nameParts = displayName.trim().split(' ');
              const firstName = nameParts[0] ?? null;
              const lastName =
                nameParts.length > 1 ? (nameParts[nameParts.length - 1] ?? null) : null;
              return (
                <Pressable
                  key={member.id}
                  onPress={() => {
                    if (!isSubmitting) setPaidByMemberId(member.id);
                  }}
                  disabled={isSubmitting}
                  accessibilityRole="radio"
                  accessibilityState={{ selected, disabled: isSubmitting }}
                  accessibilityLabel={`Pagó ${displayName}`}
                  style={({ pressed }) => ({
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: spacing[3],
                    paddingHorizontal: spacing[3],
                    paddingVertical: spacing[3],
                    minHeight: 44,
                    borderRadius: radii.md,
                    borderWidth: 1.5,
                    borderColor: selected ? colors.brand[500] : colors.line[2],
                    backgroundColor: selected
                      ? `${colors.brand[500]}1A`
                      : pressed
                        ? colors.bg[3]
                        : colors.bg[2],
                    opacity: isSubmitting ? 0.5 : 1,
                  })}
                >
                  <Avatar firstName={firstName} lastName={lastName} size={32} />
                  <BodySm
                    color={selected ? colors.fg[1] : colors.fg[2]}
                    style={{
                      flex: 1,
                      fontWeight: selected ? '600' : '400',
                      fontFamily: selected ? typography.family.semibold : typography.family.regular,
                    }}
                  >
                    {displayName}
                  </BodySm>
                  {selected && (
                    <View
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: 999,
                        backgroundColor: colors.brand[500],
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <View
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: 999,
                          backgroundColor: colors.fg.onBrand,
                        }}
                      />
                    </View>
                  )}
                </Pressable>
              );
            })}
          </View>
        </View>
      )}

      {/* Split editor — when effectiveGroupConfig is present */}
      {effectiveGroupConfig != null && effectiveGroupConfig.members.length > 0 && (
        <View style={{ gap: spacing[2] }}>
          <BodySm color={colors.fg[3]}>División</BodySm>
          <SplitEditor
            amount={amount}
            currency={currency as 'ARS' | 'USD'}
            members={effectiveGroupConfig.members}
            value={splitState}
            onChange={(s) => {
              setSplitState(s);
              // Clear cached split error when user changes split
              setSplitError(null);
            }}
            disabled={isSubmitting}
          />
          {splitError != null && <BodySm color={colors.money.out}>{splitError}</BodySm>}
        </View>
      )}

      {submitError != null && (
        <Body style={{ textAlign: 'center', color: colors.money.out }}>{submitError}</Body>
      )}

      <Button
        variant="primary"
        size="lg"
        fullWidth
        loading={isSubmitting}
        disabled={isSubmitting}
        onPress={submit}
        accessibilityLabel={submitLabel}
      >
        {submitLabel}
      </Button>
    </View>
  );
}
