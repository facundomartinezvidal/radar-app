/**
 * Shared form for create/edit. Drives react-hook-form + zod and emits
 * onSubmit with a validated payload. Parent screen wires the mutation.
 */
import { zodResolver } from '@hookform/resolvers/zod';
import React, { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Pressable, View } from 'react-native';

import { Body, BodySm, Button, Input } from '@/components/ui';
import { CategoryCreateSheet } from '@/components/categories/category-create-sheet';
import {
  type CreateExpenseInput,
  type ExpenseItemInput,
  createExpenseSchema,
  type Currency,
} from '@/lib/schemas/expense';
import type { CategoryRow, ExpenseItemRow, ExpenseWithCategory } from '@/lib/repositories/expenses';
import { colors, radii, spacing } from '@/lib/theme';

import { AmountInput } from './amount-input';
import { CategoryPicker } from './category-picker';
import { CurrencyToggle } from './currency-toggle';
import { DateField } from './date-field';
import { ExpenseItemsField } from './expense-items-field';

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
  onSubmit: (input: CreateExpenseInput) => Promise<void> | void;
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
  onSubmit,
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

  const [suggestionSheetVisible, setSuggestionSheetVisible] = useState(false);

  const submit = handleSubmit(async (data) => {
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
