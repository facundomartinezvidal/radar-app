/**
 * ExpenseItemsField — collapsible line-items section for ExpenseForm.
 *
 * Driven by react-hook-form useFieldArray on the parent form's `items` field.
 * Recompute rule: editing qty or unit_price recomputes line_total when
 * unit_price is non-null. Editing line_total directly sets it (manual wins);
 * subsequent qty/price edits will recompute again.
 */
import React, { useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import {
  type Control,
  type UseFormSetValue,
  type UseFormWatch,
  useFieldArray,
  type FieldErrors,
} from 'react-hook-form';
import { ChevronDown, ChevronRight, Plus, X } from 'lucide-react-native';

import { BodySm } from '@/components/ui';
import { formatMoney } from '@/lib/format/money';
import { type Currency } from '@/lib/schemas/expense';
import { colors, radii, spacing, typography } from '@/lib/theme';

import type { ExpenseFormInternalFields } from './expense-form';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ExpenseItemsFieldProps {
  control: Control<ExpenseFormInternalFields>;
  watch: UseFormWatch<ExpenseFormInternalFields>;
  setValue: UseFormSetValue<ExpenseFormInternalFields>;
  errors: FieldErrors<ExpenseFormInternalFields>;
  currency: Currency;
  disabled?: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Parse a user-typed amount (Spanish or plain decimal) into a number. */
function parseNumericInput(text: string): number {
  const cleaned = text
    .trim()
    .replace(/\.(?=\d{3}(\D|$))/g, '') // strip thousands dot separator
    .replace(',', '.'); // swap decimal comma for dot
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : NaN;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ExpenseItemsField({
  control,
  watch,
  setValue,
  errors,
  currency,
  disabled = false,
}: ExpenseItemsFieldProps): React.JSX.Element {
  const { fields, append, remove } = useFieldArray({
    control,
    name: 'items',
  });

  // Start expanded when there are pre-populated items, collapsed otherwise.
  const [expanded, setExpanded] = useState(() => fields.length > 0);

  const watchedItems = watch('items');
  const watchedAmount = watch('amount');

  // Sum of all line_totals
  const itemsSum = (watchedItems ?? []).reduce(
    (acc, item) => acc + (Number(item.line_total) || 0),
    0,
  );
  const showMismatch =
    (watchedItems ?? []).length > 0 &&
    typeof watchedAmount === 'number' &&
    Math.abs(itemsSum - watchedAmount) > 0.5;

  const MAX_ITEMS = 50;
  const canAdd = !disabled && (watchedItems ?? []).length < MAX_ITEMS;

  const headerLabel =
    (watchedItems ?? []).length > 0 ? `Detalle · ${(watchedItems ?? []).length}` : 'Detalle';

  return (
    <View>
      {/* Section header — collapsible toggle */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={expanded ? 'Ocultar detalle de ítems' : 'Mostrar detalle de ítems'}
        onPress={() => setExpanded((prev) => !prev)}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingVertical: spacing[2],
          minHeight: 44,
        }}
      >
        <BodySm color={colors.fg[3]}>{headerLabel}</BodySm>
        {expanded ? (
          <ChevronDown size={16} color={colors.fg[3]} strokeWidth={1.5} />
        ) : (
          <ChevronRight size={16} color={colors.fg[3]} strokeWidth={1.5} />
        )}
      </Pressable>

      {expanded && (
        <View>
          {/* Item rows */}
          {fields.map((field, index) => {
            const itemErrors = errors.items?.[index];
            return (
              <View
                key={field.id}
                style={{
                  borderBottomWidth: 1,
                  borderBottomColor: colors.line[1],
                  paddingVertical: spacing[3],
                  gap: spacing[2],
                }}
              >
                {/* Line 1: name + remove button */}
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: spacing[2],
                  }}
                >
                  <TextInput
                    value={watchedItems?.[index]?.name ?? ''}
                    onChangeText={(text) => {
                      setValue(`items.${index}.name`, text, { shouldValidate: true });
                    }}
                    placeholder="Nombre del ítem"
                    placeholderTextColor={colors.fg[4]}
                    maxLength={120}
                    editable={!disabled}
                    accessibilityLabel={`Nombre del ítem ${index + 1}`}
                    style={{
                      flex: 1,
                      fontFamily: typography.family.regular,
                      fontSize: typography.size.body,
                      color: colors.fg[1],
                      backgroundColor: colors.bg[2],
                      borderRadius: radii.md,
                      borderWidth: 1,
                      borderColor: itemErrors?.name ? colors.money.out : colors.line[2],
                      paddingHorizontal: spacing[3],
                      paddingVertical: spacing[2],
                      minHeight: 44,
                    }}
                  />
                  <Pressable
                    onPress={() => remove(index)}
                    disabled={disabled}
                    accessibilityLabel="Quitar ítem"
                    accessibilityRole="button"
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    style={{
                      width: 44,
                      height: 44,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <X size={18} color={colors.fg[3]} strokeWidth={1.5} />
                  </Pressable>
                </View>

                {/* Name error */}
                {itemErrors?.name?.message != null && (
                  <BodySm color={colors.money.out}>{itemErrors.name.message}</BodySm>
                )}

                {/* Line 2: quantity + unit price + line total */}
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: spacing[2],
                  }}
                >
                  {/* Quantity */}
                  <View style={{ flex: 1.2, gap: spacing[1] }}>
                    <BodySm color={colors.fg[3]}>Cant.</BodySm>
                    <TextInput
                      value={
                        watchedItems?.[index]?.quantity != null
                          ? String(watchedItems[index].quantity)
                          : ''
                      }
                      onChangeText={(text) => {
                        const cleaned = text.replace(/[^0-9.,]/g, '');
                        const parsed = parseNumericInput(cleaned);
                        const qty = Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
                        setValue(`items.${index}.quantity`, qty, { shouldValidate: true });
                        // Recompute line_total when unit_price is set
                        const unitPrice = watchedItems?.[index]?.unit_price ?? null;
                        if (unitPrice !== null) {
                          setValue(`items.${index}.line_total`, round2(qty * unitPrice), {
                            shouldValidate: true,
                          });
                        }
                      }}
                      placeholder="Cant."
                      placeholderTextColor={colors.fg[4]}
                      keyboardType="decimal-pad"
                      inputMode="decimal"
                      editable={!disabled}
                      accessibilityLabel={`Cantidad del ítem ${index + 1}`}
                      style={{
                        fontFamily: typography.family.regular,
                        fontSize: typography.size.bodySm,
                        color: colors.fg[1],
                        backgroundColor: colors.bg[2],
                        borderRadius: radii.md,
                        borderWidth: 1,
                        borderColor: itemErrors?.quantity ? colors.money.out : colors.line[2],
                        paddingHorizontal: spacing[3],
                        paddingVertical: spacing[2],
                        minHeight: 44,
                        fontVariant: ['tabular-nums'],
                      }}
                    />
                    {itemErrors?.quantity?.message != null && (
                      <BodySm color={colors.money.out}>{itemErrors.quantity.message}</BodySm>
                    )}
                  </View>

                  {/* Unit price */}
                  <View style={{ flex: 2, gap: spacing[1] }}>
                    <BodySm color={colors.fg[3]}>Precio unit.</BodySm>
                    <TextInput
                      value={
                        watchedItems?.[index]?.unit_price != null
                          ? String(watchedItems[index].unit_price)
                          : ''
                      }
                      onChangeText={(text) => {
                        const cleaned = text.replace(/[^0-9.,]/g, '');
                        const parsed = parseNumericInput(cleaned);
                        const unitPrice = Number.isFinite(parsed) ? parsed : null;
                        setValue(`items.${index}.unit_price`, unitPrice, { shouldValidate: true });
                        // Recompute line_total when both qty and unit_price are set
                        const qty = watchedItems?.[index]?.quantity ?? 0;
                        if (unitPrice !== null) {
                          setValue(`items.${index}.line_total`, round2(qty * unitPrice), {
                            shouldValidate: true,
                          });
                        }
                      }}
                      placeholder="Precio unit."
                      placeholderTextColor={colors.fg[4]}
                      keyboardType="decimal-pad"
                      inputMode="decimal"
                      editable={!disabled}
                      accessibilityLabel={`Precio unitario del ítem ${index + 1}`}
                      style={{
                        fontFamily: typography.family.regular,
                        fontSize: typography.size.bodySm,
                        color: colors.fg[1],
                        backgroundColor: colors.bg[2],
                        borderRadius: radii.md,
                        borderWidth: 1,
                        borderColor: itemErrors?.unit_price ? colors.money.out : colors.line[2],
                        paddingHorizontal: spacing[3],
                        paddingVertical: spacing[2],
                        minHeight: 44,
                        fontVariant: ['tabular-nums'],
                      }}
                    />
                    {itemErrors?.unit_price?.message != null && (
                      <BodySm color={colors.money.out}>{itemErrors.unit_price.message}</BodySm>
                    )}
                  </View>

                  {/* Line total — editable; setting it manually overrides auto-compute */}
                  <View style={{ flex: 2, gap: spacing[1] }}>
                    <BodySm color={colors.fg[3]}>Total</BodySm>
                    <TextInput
                      value={
                        watchedItems?.[index]?.line_total != null
                          ? String(watchedItems[index].line_total)
                          : '0'
                      }
                      onChangeText={(text) => {
                        const cleaned = text.replace(/[^0-9.,]/g, '');
                        const parsed = parseNumericInput(cleaned);
                        const lineTotal = Number.isFinite(parsed) ? parsed : 0;
                        setValue(`items.${index}.line_total`, lineTotal, { shouldValidate: true });
                      }}
                      placeholder="0,00"
                      placeholderTextColor={colors.fg[4]}
                      keyboardType="decimal-pad"
                      inputMode="decimal"
                      editable={!disabled}
                      accessibilityLabel={`Total del ítem ${index + 1}`}
                      style={{
                        fontFamily: typography.family.monoRegular,
                        fontSize: typography.size.bodySm,
                        color: colors.fg[1],
                        backgroundColor: colors.bg[2],
                        borderRadius: radii.md,
                        borderWidth: 1,
                        borderColor: itemErrors?.line_total ? colors.money.out : colors.line[2],
                        paddingHorizontal: spacing[3],
                        paddingVertical: spacing[2],
                        minHeight: 44,
                        textAlign: 'right',
                        fontVariant: ['tabular-nums'],
                      }}
                    />
                    {itemErrors?.line_total?.message != null && (
                      <BodySm color={colors.money.out}>{itemErrors.line_total.message}</BodySm>
                    )}
                  </View>
                </View>
              </View>
            );
          })}

          {/* "Agregar ítem" button */}
          <View style={{ paddingTop: spacing[3] }}>
            <Pressable
              onPress={() => {
                if (!canAdd) return;
                append({ name: '', quantity: 1, unit_price: null, line_total: 0 });
              }}
              disabled={!canAdd}
              accessibilityLabel="Agregar ítem"
              accessibilityRole="button"
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: spacing[2],
                minHeight: 44,
                paddingHorizontal: spacing[4],
                borderRadius: radii.md,
                borderWidth: 1,
                borderColor: colors.line[2],
                backgroundColor: pressed ? colors.bg[3] : colors.bg[2],
                opacity: canAdd ? 1 : 0.4,
              })}
            >
              <Plus size={16} color={colors.fg[2]} strokeWidth={1.5} />
              <BodySm color={colors.fg[2]}>Agregar ítem</BodySm>
            </Pressable>
          </View>

          {/* Sum mismatch warning */}
          {showMismatch && (
            <View style={{ paddingTop: spacing[2] }}>
              <BodySm color={colors.amber[500]}>
                {`La suma de los ítems (${formatMoney(itemsSum, currency)}) no coincide con el total (${formatMoney(watchedAmount, currency)}). Puede deberse a descuentos o propinas.`}
              </BodySm>
            </View>
          )}
        </View>
      )}
    </View>
  );
}
