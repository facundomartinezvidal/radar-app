/**
 * Shared form for income recurrence create/edit.
 *
 * Drives react-hook-form + zod on `createRecurrenceSchema`. Fields:
 * - amount       → AmountInput
 * - currency     → CurrencyToggle
 * - category_id  → CategoryPicker (kind='income')
 * - description  → Input (optional)
 * - frequency    → FrequencySelector (inline pill selector, 4 options)
 * - start_date   → DateField
 * - end_date     → DateField gated behind a "Sin fecha de fin" toggle
 *
 * Computed server-side fields (`day_of_month`, `next_run_on`) are NOT included.
 *
 * Props mirror IncomeForm for consistency.
 */
import { zodResolver } from '@hookform/resolvers/zod';
import React, { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Pressable, View } from 'react-native';

import { Body, BodySm, Button, Input, Text } from '@/components/ui';
import { AmountInput } from '@/components/expenses/amount-input';
import { CategoryPicker } from '@/components/expenses/category-picker';
import { CurrencyToggle } from '@/components/expenses/currency-toggle';
import { DateField } from '@/components/expenses/date-field';
import type { CategoryRow } from '@/lib/repositories/expenses';
import type { IncomeRecurrenceWithCategory } from '@/lib/repositories/incomes';
import type { Currency } from '@/lib/schemas/income';
import {
  FREQUENCIES,
  type CreateRecurrenceInput,
  type Frequency,
  createRecurrenceSchema,
} from '@/lib/schemas/income-recurrence';
import { colors, radii, spacing } from '@/lib/theme';

// ---------------------------------------------------------------------------
// Frequency labels (Spanish)
// ---------------------------------------------------------------------------

const FREQUENCY_LABELS: Record<Frequency, string> = {
  weekly: 'Semanal',
  biweekly: 'Quincenal',
  monthly: 'Mensual',
  yearly: 'Anual',
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface RecurrenceFormProps {
  categories: CategoryRow[];
  /** Optional initial values (edit mode — DB row). */
  initial?: IncomeRecurrenceWithCategory | null;
  onSubmit: (input: CreateRecurrenceInput) => Promise<void> | void;
  submitLabel?: string;
  isSubmitting?: boolean;
  submitError?: string | null;
}

// Internal field shape — adds amountText as a UI-only field so the user can
// type partial values while zod validates the numeric `amount`.
interface RecurrenceFormInternalFields {
  amount: number;
  amountText: string;
  currency: Currency;
  category_id: string | null;
  description: string | null;
  frequency: Frequency;
  start_date: string;
  end_date: string | null;
}

// ---------------------------------------------------------------------------
// FrequencySelector — inline pill selector mirroring CurrencyToggle's pattern
// ---------------------------------------------------------------------------

interface FrequencySelectorProps {
  value: Frequency;
  onChange: (next: Frequency) => void;
  disabled?: boolean;
}

function FrequencySelector({
  value,
  onChange,
  disabled = false,
}: FrequencySelectorProps): React.JSX.Element {
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel="Frecuencia"
      style={{
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: spacing[2],
        padding: spacing[1],
        backgroundColor: colors.bg[2],
        borderRadius: radii.md,
        borderWidth: 1,
        borderColor: colors.line[2],
      }}
    >
      {FREQUENCIES.map((freq) => {
        const selected = freq === value;
        return (
          <Pressable
            key={freq}
            disabled={disabled}
            onPress={() => onChange(freq)}
            accessibilityRole="radio"
            accessibilityState={{ selected, disabled }}
            accessibilityLabel={`Frecuencia ${FREQUENCY_LABELS[freq]}`}
            style={{ flex: 1, minWidth: 60 }}
          >
            <View
              style={{
                alignItems: 'center',
                paddingVertical: spacing[2],
                borderRadius: radii.sm,
                backgroundColor: selected ? colors.money.in : 'transparent',
              }}
            >
              <Text
                variant="bodySm"
                color={selected ? colors.fg.onBrand : colors.fg[2]}
                style={{ fontWeight: '700' }}
              >
                {FREQUENCY_LABELS[freq]}
              </Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/** Today's ISO date string (YYYY-MM-DD) — used as start_date default. */
function todayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export function RecurrenceForm({
  categories,
  initial,
  onSubmit,
  submitLabel = 'Crear ingreso recurrente',
  isSubmitting = false,
  submitError = null,
}: RecurrenceFormProps): React.JSX.Element {
  // Resolve default values: initial (edit mode) > blank
  const resolvedAmount = initial ? Number(initial.amount) : 0;
  const resolvedAmountText = initial ? String(initial.amount).replace('.', ',') : '';
  const resolvedCurrency = (initial?.currency ?? 'ARS') as Currency;
  const resolvedCategoryId = initial?.category_id ?? null;
  const resolvedDescription = initial?.description ?? '';
  const resolvedFrequency = (initial?.frequency ?? 'monthly') as Frequency;
  const resolvedStartDate = initial?.start_date ?? todayDate();
  const resolvedEndDate = initial?.end_date ?? null;

  // "Sin fecha de fin" toggle: true = indefinite (end_date null), false = show picker
  const [indefinite, setIndefinite] = useState<boolean>(resolvedEndDate === null);

  const {
    control,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<RecurrenceFormInternalFields>({
    // Cast: we add `amountText` as a UI-only field; zod validates the numeric `amount`.
    resolver: zodResolver(createRecurrenceSchema) as never,
    mode: 'onChange',
    defaultValues: {
      amount: resolvedAmount,
      amountText: resolvedAmountText,
      currency: resolvedCurrency,
      category_id: resolvedCategoryId,
      description: resolvedDescription,
      frequency: resolvedFrequency,
      start_date: resolvedStartDate,
      end_date: resolvedEndDate,
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
      frequency: data.frequency,
      start_date: data.start_date,
      end_date: indefinite ? null : (data.end_date ?? null),
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

      {/* Frequency */}
      <View style={{ gap: spacing[2] }}>
        <BodySm color={colors.fg[3]}>Frecuencia</BodySm>
        <Controller
          control={control}
          name="frequency"
          render={({ field: { onChange, value } }) => (
            <FrequencySelector value={value} onChange={onChange} disabled={isSubmitting} />
          )}
        />
        <BodySm color={colors.fg[3]}>Se registrará automáticamente cada período.</BodySm>
        {errors.frequency?.message != null && (
          <BodySm color={colors.money.out}>{errors.frequency.message}</BodySm>
        )}
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
              placeholder="Descripción del ingreso recurrente"
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

      {/* Start date */}
      <Controller
        control={control}
        name="start_date"
        render={({ field: { onChange, value } }) => (
          <DateField
            label="Fecha de inicio"
            value={value}
            onChange={(iso) => onChange(iso.slice(0, 10))}
            disabled={isSubmitting}
          />
        )}
      />
      {errors.start_date?.message != null && (
        <BodySm color={colors.money.out}>{errors.start_date.message}</BodySm>
      )}

      {/* End date toggle + picker */}
      <View style={{ gap: spacing[3] }}>
        <Pressable
          accessibilityRole="switch"
          accessibilityLabel="Sin fecha de fin"
          accessibilityState={{ checked: indefinite, disabled: isSubmitting }}
          disabled={isSubmitting}
          onPress={() => {
            const next = !indefinite;
            setIndefinite(next);
            if (next) {
              // Clear end_date when toggling back to indefinite
              setValue('end_date', null, { shouldValidate: true });
            }
          }}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingVertical: spacing[2],
          }}
        >
          <BodySm color={colors.fg[2]}>Sin fecha de fin</BodySm>
          {/* Visual toggle indicator */}
          <View
            style={{
              width: 44,
              height: 24,
              borderRadius: radii.pill,
              backgroundColor: indefinite ? colors.money.in : colors.bg[3],
              borderWidth: 1,
              borderColor: indefinite ? colors.money.in : colors.line[2],
              justifyContent: 'center',
              paddingHorizontal: 3,
            }}
          >
            <View
              style={{
                width: 18,
                height: 18,
                borderRadius: radii.pill,
                backgroundColor: colors.fg[1],
                alignSelf: indefinite ? 'flex-end' : 'flex-start',
              }}
            />
          </View>
        </Pressable>

        {!indefinite && (
          <Controller
            control={control}
            name="end_date"
            render={({ field: { onChange, value } }) => (
              <DateField
                label="Fecha de fin"
                value={value ?? todayDate()}
                onChange={(iso) => onChange(iso.slice(0, 10))}
                disabled={isSubmitting}
              />
            )}
          />
        )}
        {errors.end_date?.message != null && (
          <BodySm color={colors.money.out}>{errors.end_date.message}</BodySm>
        )}
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
