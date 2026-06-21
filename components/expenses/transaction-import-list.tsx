/**
 * TransactionImportList — bulk-import UI for card statement results (HU-25).
 *
 * Renders each extracted transaction as a selectable row. Each row has:
 *  - A checkbox (include/exclude)
 *  - Amount (tabular-nums; red=expense, green=income)
 *  - Date
 *  - Merchant / description
 *  - Inline CategoryPicker (switches list based on row direction)
 *  - Gasto / Ingreso direction toggle (resets category_id on switch)
 *
 * A "Seleccionar todo" / "Deseleccionar todo" header control and a count badge
 * are shown above the list. The primary "Importar (N)" button is disabled when
 * 0 rows are selected or when the form is submitting.
 */
import React, { useCallback, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { CategoryPicker } from '@/components/expenses/category-picker';
import { Body, BodySm, Button, Icon } from '@/components/ui';
import type { ImportTransactionRow } from '@/lib/repositories/transactions';
import type { CategoryRow } from '@/lib/repositories/expenses';
import type { DocumentTransactionPrefill } from '@/lib/ocr';
import type { Currency } from '@/lib/schemas/expense';
import { colors, radii, spacing, typography } from '@/lib/theme';
import { Text } from '@/components/ui/text';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RowState {
  selected: boolean;
  direction: 'expense' | 'income';
  amount: number;
  currency: Currency;
  category_id: string | null;
  description: string | null;
  occurred_at: string;
}

export interface TransactionImportListProps {
  transactions: DocumentTransactionPrefill[];
  expenseCategories: CategoryRow[];
  incomeCategories: CategoryRow[];
  isSubmitting?: boolean;
  submitError?: string | null;
  onImport: (rows: ImportTransactionRow[]) => Promise<void> | void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildInitialRows(transactions: DocumentTransactionPrefill[]): RowState[] {
  return transactions.map((tx) => ({
    selected: true,
    direction: tx.direction,
    amount: tx.amount ?? 0,
    currency: tx.currency ?? 'ARS',
    category_id: tx.category_id ?? null,
    description: tx.description ?? null,
    occurred_at: tx.occurred_at ?? new Date().toISOString(),
  }));
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' });
  } catch {
    return iso.slice(0, 10);
  }
}

function formatAmount(amount: number, currency: Currency): string {
  const prefix = currency === 'USD' ? 'US$' : '$';
  return `${prefix} ${amount.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ---------------------------------------------------------------------------
// TransactionImportList
// ---------------------------------------------------------------------------

export function TransactionImportList({
  transactions,
  expenseCategories,
  incomeCategories,
  isSubmitting = false,
  submitError,
  onImport,
}: TransactionImportListProps): React.JSX.Element {
  const [rows, setRows] = useState<RowState[]>(() => buildInitialRows(transactions));
  const [noValidNotice, setNoValidNotice] = useState(false);

  const selectedCount = rows.filter((r) => r.selected).length;
  const allSelected = rows.length > 0 && selectedCount === rows.length;

  // -------------------------------------------------------------------------
  // Row mutators
  // -------------------------------------------------------------------------

  const toggleSelected = useCallback((index: number) => {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, selected: !r.selected } : r)));
  }, []);

  const toggleAll = useCallback(() => {
    const nextSelected = !allSelected;
    setRows((prev) => prev.map((r) => ({ ...r, selected: nextSelected })));
  }, [allSelected]);

  const setCategory = useCallback((index: number, id: string | null) => {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, category_id: id } : r)));
  }, []);

  const toggleDirection = useCallback((index: number) => {
    setRows((prev) =>
      prev.map((r, i) =>
        i === index
          ? {
              ...r,
              direction: r.direction === 'expense' ? 'income' : 'expense',
              // Reset category when direction changes — categories are kind-scoped.
              category_id: null,
            }
          : r,
      ),
    );
  }, []);

  // -------------------------------------------------------------------------
  // Import handler
  // -------------------------------------------------------------------------

  const handleImport = useCallback(async (): Promise<void> => {
    setNoValidNotice(false);

    const validRows: ImportTransactionRow[] = rows
      .filter((r) => r.selected && r.amount > 0)
      .map((r) => ({
        direction: r.direction,
        amount: r.amount,
        currency: r.currency,
        category_id: r.category_id,
        description: r.description,
        occurred_at: r.occurred_at,
      }));

    if (validRows.length === 0) {
      setNoValidNotice(true);
      return;
    }

    await onImport(validRows);
  }, [rows, onImport]);

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <View>
      {/* Header: select-all + count */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: spacing[3],
        }}
      >
        <Pressable
          onPress={toggleAll}
          accessibilityRole="button"
          accessibilityLabel={allSelected ? 'Deseleccionar todo' : 'Seleccionar todo'}
          style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[2] }}
        >
          <View
            style={{
              width: 20,
              height: 20,
              borderRadius: 4,
              borderWidth: 2,
              borderColor: allSelected ? colors.brand[500] : colors.line[3],
              backgroundColor: allSelected ? colors.brand[500] : 'transparent',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {allSelected && (
              <Icon name="Check" size={13} color={colors.fg.onBrand} strokeWidth={2.5} />
            )}
          </View>
          <BodySm color={colors.fg[2]}>
            {allSelected ? 'Deseleccionar todo' : 'Seleccionar todo'}
          </BodySm>
        </Pressable>

        <BodySm color={colors.fg[3]}>
          {selectedCount} de {rows.length} seleccionados
        </BodySm>
      </View>

      {/* Transaction rows */}
      <ScrollView scrollEnabled={false} style={{ marginBottom: spacing[4] }}>
        {rows.map((row, index) => {
          const isExpense = row.direction === 'expense';
          const amountColor = isExpense ? colors.money.out : colors.money.in;
          const categories = isExpense ? expenseCategories : incomeCategories;

          return (
            <View
              key={index}
              style={{
                backgroundColor: row.selected ? colors.bg[2] : colors.bg[1],
                borderRadius: radii.md,
                borderWidth: 1,
                borderColor: row.selected ? colors.line[2] : colors.line[1],
                padding: spacing[4],
                marginBottom: spacing[3],
                opacity: row.selected ? 1 : 0.6,
              }}
            >
              {/* Row top: checkbox + amount + date */}
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'flex-start',
                  gap: spacing[3],
                  marginBottom: spacing[3],
                }}
              >
                {/* Checkbox */}
                <Pressable
                  onPress={() => toggleSelected(index)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: row.selected }}
                  accessibilityLabel={`Seleccionar transacción ${index + 1}`}
                  hitSlop={8}
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: 4,
                    borderWidth: 2,
                    borderColor: row.selected ? colors.brand[500] : colors.line[3],
                    backgroundColor: row.selected ? colors.brand[500] : 'transparent',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginTop: 2,
                  }}
                >
                  {row.selected && (
                    <Icon name="Check" size={13} color={colors.fg.onBrand} strokeWidth={2.5} />
                  )}
                </Pressable>

                {/* Amount + description */}
                <View style={{ flex: 1 }}>
                  <Text
                    variant="body"
                    color={amountColor}
                    style={{
                      fontFamily: typography.family.monoMedium,
                      fontVariant: ['tabular-nums'],
                      fontWeight: '600',
                    }}
                  >
                    {isExpense ? '-' : '+'}
                    {formatAmount(row.amount, row.currency)}
                  </Text>
                  {row.description ? (
                    <BodySm color={colors.fg[2]} style={{ marginTop: 2 }}>
                      {row.description}
                    </BodySm>
                  ) : null}
                </View>

                {/* Date */}
                <BodySm color={colors.fg[3]} style={{ marginTop: 2 }}>
                  {formatDate(row.occurred_at)}
                </BodySm>
              </View>

              {/* Row bottom: direction toggle + category picker */}
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing[3],
                }}
              >
                {/* Direction toggle */}
                <View
                  style={{
                    flexDirection: 'row',
                    backgroundColor: colors.bg[3],
                    borderRadius: radii.sm,
                    overflow: 'hidden',
                  }}
                >
                  <Pressable
                    onPress={() => {
                      if (row.direction !== 'expense') toggleDirection(index);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={`Gasto fila ${index + 1}`}
                    style={{
                      paddingHorizontal: spacing[3],
                      paddingVertical: spacing[1],
                      backgroundColor:
                        row.direction === 'expense' ? colors.money.out : 'transparent',
                    }}
                  >
                    <BodySm color={row.direction === 'expense' ? colors.fg.onBrand : colors.fg[3]}>
                      Gasto
                    </BodySm>
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      if (row.direction !== 'income') toggleDirection(index);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={`Ingreso fila ${index + 1}`}
                    style={{
                      paddingHorizontal: spacing[3],
                      paddingVertical: spacing[1],
                      backgroundColor: row.direction === 'income' ? colors.money.in : 'transparent',
                    }}
                  >
                    <BodySm color={row.direction === 'income' ? colors.fg.onBrand : colors.fg[3]}>
                      Ingreso
                    </BodySm>
                  </Pressable>
                </View>

                {/* Category picker */}
                <View style={{ flex: 1 }}>
                  <CategoryPicker
                    categories={categories}
                    value={row.category_id}
                    onChange={(id) => setCategory(index, id)}
                    disabled={!row.selected || isSubmitting}
                  />
                </View>
              </View>
            </View>
          );
        })}
      </ScrollView>

      {/* No valid rows notice */}
      {noValidNotice && (
        <View
          style={{
            backgroundColor: colors.bg[1],
            borderLeftWidth: 3,
            borderLeftColor: colors.amber[500],
            borderRadius: radii.sm,
            padding: spacing[4],
            marginBottom: spacing[4],
          }}
        >
          <BodySm color={colors.fg[2]}>
            No hay transacciones válidas seleccionadas para importar.
          </BodySm>
        </View>
      )}

      {/* Submit error */}
      {submitError ? (
        <View
          style={{
            backgroundColor: colors.bg[1],
            borderLeftWidth: 3,
            borderLeftColor: colors.money.out,
            borderRadius: radii.sm,
            padding: spacing[4],
            marginBottom: spacing[4],
          }}
        >
          <BodySm color={colors.fg[2]}>{submitError}</BodySm>
        </View>
      ) : null}

      {/* Import button */}
      <Button
        variant="primary"
        size="lg"
        disabled={selectedCount === 0 || isSubmitting}
        loading={isSubmitting}
        onPress={() => void handleImport()}
        accessibilityLabel={`Importar ${selectedCount} transacciones`}
      >
        {isSubmitting ? 'Importando…' : `Importar (${selectedCount})`}
      </Button>

      <Body color={colors.fg[3]} style={{ textAlign: 'center', marginTop: spacing[3] }}>
        {selectedCount} transacción{selectedCount !== 1 ? 'es' : ''} seleccionada
        {selectedCount !== 1 ? 's' : ''}
      </Body>
    </View>
  );
}
