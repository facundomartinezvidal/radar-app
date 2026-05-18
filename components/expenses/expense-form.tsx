/**
 * Shared form for create/edit. Drives react-hook-form + zod and emits
 * onSubmit with a validated payload. Parent screen wires the mutation.
 */
import { zodResolver } from '@hookform/resolvers/zod';
import React from 'react';
import { Controller, useForm } from 'react-hook-form';
import { View } from 'react-native';

import { Body, BodySm, Button, Input } from '@/components/ui';
import { type CreateExpenseInput, createExpenseSchema, type Currency } from '@/lib/schemas/expense';
import type { CategoryRow, ExpenseWithCategory } from '@/lib/repositories/expenses';
import { colors, spacing } from '@/lib/theme';

import { AmountInput } from './amount-input';
import { CategoryPicker } from './category-picker';
import { CurrencyToggle } from './currency-toggle';

export interface ExpenseFormProps {
  categories: CategoryRow[];
  /** Optional initial values (edit mode). */
  initial?: ExpenseWithCategory | null;
  onSubmit: (input: CreateExpenseInput) => Promise<void> | void;
  submitLabel?: string;
  isSubmitting?: boolean;
  submitError?: string | null;
}

interface InternalFields {
  amount: number;
  amountText: string;
  currency: Currency;
  category_id: string | null;
  description: string | null;
}

export function ExpenseForm({
  categories,
  initial,
  onSubmit,
  submitLabel = 'Registrar gasto',
  isSubmitting = false,
  submitError = null,
}: ExpenseFormProps): React.JSX.Element {
  const {
    control,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<InternalFields>({
    // Cast: we add `amountText` as a UI-only field so the user can type
    // partial values; zod validates the numeric `amount`.
    resolver: zodResolver(createExpenseSchema) as never,
    mode: 'onChange',
    defaultValues: {
      amount: initial ? Number(initial.amount) : 0,
      amountText: initial ? String(initial.amount).replace('.', ',') : '',
      currency: (initial?.currency as Currency | undefined) ?? 'ARS',
      category_id: initial?.category_id ?? null,
      description: initial?.description ?? '',
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
    });
  });

  return (
    <View style={{ gap: spacing[5] }}>
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
