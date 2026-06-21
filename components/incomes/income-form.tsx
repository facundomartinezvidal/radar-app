/**
 * Shared form for income create/edit. Drives react-hook-form + zod and emits
 * onSubmit with a validated payload. Parent screen wires the mutation.
 *
 * Incomes have NO line items and NO group/split — simpler than ExpenseForm.
 * Reuses the exact same sub-components (AmountInput, CurrencyToggle,
 * CategoryPicker, DateField) from the expenses family.
 */
import { zodResolver } from '@hookform/resolvers/zod';
import React from 'react';
import { Controller, useForm } from 'react-hook-form';
import { View } from 'react-native';

import { Body, BodySm, Button, Input } from '@/components/ui';
import { AmountInput } from '@/components/expenses/amount-input';
import { CategoryPicker } from '@/components/expenses/category-picker';
import { CurrencyToggle } from '@/components/expenses/currency-toggle';
import { DateField } from '@/components/expenses/date-field';
import type { CategoryRow } from '@/lib/repositories/expenses';
import type { IncomeWithCategory } from '@/lib/repositories/incomes';
import { type CreateIncomeInput, type Currency, createIncomeSchema } from '@/lib/schemas/income';
import { colors, spacing } from '@/lib/theme';

// ---------------------------------------------------------------------------
// Prefill interface (OCR review path)
// ---------------------------------------------------------------------------

/**
 * Partial prefill from document OCR — used by the review screen when no DB row
 * exists yet. Mirrors `ExpenseFormPrefill` but scoped to income fields.
 */
export interface IncomeFormPrefill {
  /** Detected income amount. Omitted when null or <= 0. */
  amount?: number;
  /** Detected currency. Omitted when null (form defaults to ARS). */
  currency?: Currency;
  /**
   * Matched income category ID. Pass null (not undefined) to leave the
   * category blank — expense-matched category ids don't map to income
   * categories.
   */
  category_id?: string | null;
  /** Description / counterparty name. Omitted when null. */
  description?: string | null;
  /** Transaction date as ISO 8601 datetime. Omitted when future or null. */
  occurred_at?: string;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface IncomeFormProps {
  categories: CategoryRow[];
  /** Optional initial values (edit mode — DB row). Takes precedence over prefill. */
  initial?: IncomeWithCategory | null;
  /**
   * Optional OCR-detected prefill (review mode — no DB row yet).
   * Only used when `initial` is absent/null.
   */
  prefill?: IncomeFormPrefill;
  /**
   * When true, renders a low-confidence notice above the form asking the user
   * to verify the detected data. Does NOT block submit.
   */
  lowConfidence?: boolean;
  onSubmit: (input: CreateIncomeInput) => Promise<void> | void;
  submitLabel?: string;
  isSubmitting?: boolean;
  submitError?: string | null;
}

// Internal field shape — adds amountText as a UI-only field so the user can
// type partial values while zod validates the numeric `amount`.
interface IncomeFormInternalFields {
  amount: number;
  amountText: string;
  currency: Currency;
  category_id: string | null;
  description: string | null;
  occurred_at: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function IncomeForm({
  categories,
  initial,
  prefill,
  lowConfidence = false,
  onSubmit,
  submitLabel = 'Registrar ingreso',
  isSubmitting = false,
  submitError = null,
}: IncomeFormProps): React.JSX.Element {
  // Resolve default values: initial (edit mode) > prefill (OCR review) > blank
  const resolvedAmount = initial ? Number(initial.amount) : (prefill?.amount ?? 0);
  const resolvedAmountText = initial
    ? String(initial.amount).replace('.', ',')
    : prefill?.amount != null
      ? String(prefill.amount).replace('.', ',')
      : '';
  const resolvedCurrency = (initial?.currency ?? prefill?.currency ?? 'ARS') as Currency;
  const resolvedCategoryId =
    initial !== undefined && initial !== null
      ? (initial.category_id ?? null)
      : (prefill?.category_id ?? null);
  const resolvedDescription =
    initial !== undefined && initial !== null
      ? (initial.description ?? '')
      : (prefill?.description ?? '');
  const resolvedOccurredAt =
    initial?.occurred_at ?? prefill?.occurred_at ?? new Date().toISOString();

  const {
    control,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<IncomeFormInternalFields>({
    // Cast: we add `amountText` as a UI-only field; zod validates the numeric `amount`.
    resolver: zodResolver(createIncomeSchema) as never,
    mode: 'onChange',
    defaultValues: {
      amount: resolvedAmount,
      amountText: resolvedAmountText,
      currency: resolvedCurrency,
      category_id: resolvedCategoryId,
      description: resolvedDescription,
      occurred_at: resolvedOccurredAt,
    },
  });

  const currency = watch('currency');
  const amountText = watch('amountText');

  const submit = handleSubmit(async (data) => {
    await onSubmit({
      amount: data.amount,
      currency: data.currency,
      category_id: data.category_id,
      description: data.description ?? null,
      occurred_at: data.occurred_at,
    });
  });

  return (
    <View style={{ gap: spacing[5] }}>
      {/* Low-confidence OCR notice */}
      {lowConfidence && (
        <BodySm color={colors.amber[500]}>
          Revisá los datos detectados, la confianza es baja.
        </BodySm>
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
      </View>

      {/* Description */}
      <View style={{ gap: spacing[2] }}>
        <Controller
          control={control}
          name="description"
          render={({ field: { onChange, onBlur, value } }) => (
            <Input
              label="Descripción (opcional)"
              placeholder="Descripción del ingreso"
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
