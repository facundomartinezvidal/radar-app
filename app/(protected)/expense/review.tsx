/**
 * RADAR — Document review screen (HU-06 / HU-25).
 *
 * Receives a document (image or PDF) from the camera screen via query params,
 * runs OCR via `useExtractDocument`, and routes to the appropriate form:
 *
 * - Single transaction, direction=expense → ExpenseForm (prefilled)
 * - Single transaction, direction=income  → IncomeForm (prefilled)
 * - Multiple transactions (card_statement) → Placeholder notice (Group 5)
 * - No transactions / unknown             → ExpenseForm (empty) + notice
 *
 * A direction toggle lets the user flip expense↔income while preserving the
 * extracted data.
 */
import * as FileSystem from 'expo-file-system/legacy';
import { Image } from 'expo-image';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  ExpenseForm,
  type ExpenseFormPrefill,
  type SharedExpenseSubmitPayload,
} from '@/components/expenses/expense-form';
import { ScanOverlay } from '@/components/expenses/scan-overlay';
import { ScanStatus } from '@/components/expenses/scan-status';
import { TransactionImportList } from '@/components/expenses/transaction-import-list';
import { IncomeForm, type IncomeFormPrefill } from '@/components/incomes/income-form';
import { Body, BodySm, Button, H1, Icon, Loader } from '@/components/ui';
import { useExtractDocument } from '@/hooks/use-extract-document';
import { useCategories, useCreateExpense } from '@/hooks/use-expenses';
import { useImportTransactions } from '@/hooks/use-import-transactions';
import type { ImportTransactionRow } from '@/hooks/use-import-transactions';
import { useGroups, useCreateSharedExpense } from '@/hooks/use-groups';
import { useCreateIncome } from '@/hooks/use-incomes';
import { useAuthStore } from '@/stores/auth-store';
import { compressForOcr } from '@/lib/image';
import type { CompressedImage } from '@/lib/image';
import { OcrError, mapDocumentToPrefill } from '@/lib/ocr';
import type { DocumentPrefill, DocumentTransactionPrefill } from '@/lib/ocr';
import type { CreateExpenseInput } from '@/lib/schemas/expense';
import type { DocumentType } from '@/lib/schemas/document';
import { colors, radii, spacing } from '@/lib/theme';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Direction = 'expense' | 'income';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** OCR error codes that allow the user to retry the request. */
const RETRYABLE_CODES = new Set(['OCR_TIMEOUT', 'NETWORK_ERROR']);

/** Map DocumentType to a human-readable Spanish label. */
function documentTypeLabel(docType: DocumentType): string {
  switch (docType) {
    case 'receipt':
      return 'Ticket';
    case 'transfer':
      return 'Transferencia';
    case 'card_statement':
      return 'Resumen';
    case 'screenshot':
      return 'Captura';
    case 'unknown':
    default:
      return 'Documento';
  }
}

/** Build an ExpenseFormPrefill from a DocumentTransactionPrefill. */
function toExpensePrefill(tx: DocumentTransactionPrefill): ExpenseFormPrefill {
  return {
    amount: tx.amount,
    currency: tx.currency,
    description: tx.description,
    category_id: tx.category_id,
    occurred_at: tx.occurred_at,
    items: tx.items,
    suggestedCategoryName: tx.suggestedCategoryName,
    suggestedCategoryReason: tx.suggestedCategoryReason,
  };
}

/** Build an IncomeFormPrefill from a DocumentTransactionPrefill. */
function toIncomePrefill(tx: DocumentTransactionPrefill): IncomeFormPrefill {
  return {
    amount: tx.amount,
    currency: tx.currency,
    description: tx.description,
    // Expense-matched category_ids don't map to income categories — leave null.
    category_id: null,
    occurred_at: tx.occurred_at,
  };
}

/** True when a transaction has at least one meaningful field filled in. */
function txHasData(tx: DocumentTransactionPrefill): boolean {
  return (
    tx.amount != null ||
    tx.currency != null ||
    tx.description != null ||
    tx.category_id != null ||
    tx.occurred_at != null ||
    (tx.items != null && tx.items.length > 0)
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ReviewScreen(): React.JSX.Element {
  const params = useLocalSearchParams<{
    uri?: string;
    kind?: string;
    mimeType?: string;
    name?: string;
    // legacy alias for images from camera/gallery
    imageUri?: string;
  }>();

  // Support legacy imageUri param as well as the new uri+kind params.
  const effectiveUri: string | undefined = params.uri ?? params.imageUri;
  const effectiveKind: 'image' | 'pdf' = params.kind === 'pdf' ? 'pdf' : 'image';

  const expenseCategoriesQuery = useCategories();
  const incomeCategoriesQuery = useCategories('income');
  const extractMutation = useExtractDocument();
  const createExpenseMutation = useCreateExpense();
  const createIncomeMutation = useCreateIncome();
  const groupsQuery = useGroups();
  const createSharedMutation = useCreateSharedExpense();
  const currentUserId = useAuthStore((s) => s.user?.id ?? null);

  const importTransactionsMutation = useImportTransactions();

  const [submitError, setSubmitError] = useState<string | null>(null);
  const [doc, setDoc] = useState<DocumentPrefill | null>(null);
  const [isCompressing, setIsCompressing] = useState(false);
  const [compressionError, setCompressionError] = useState<OcrError | null>(null);

  // Direction state for the toggle — initialised once OCR resolves.
  const [direction, setDirection] = useState<Direction>('expense');

  // Guard against double-run in StrictMode / re-renders.
  const hasTriggeredRef = useRef(false);

  // Track mount status so async callbacks can bail out after unmount.
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Both category lists must be loaded before we can trigger OCR.
  const categoriesLoading = expenseCategoriesQuery.isLoading || incomeCategoriesQuery.isLoading;

  // -------------------------------------------------------------------------
  // OCR trigger
  // -------------------------------------------------------------------------

  const triggerOcr = useCallback(
    async (uri: string): Promise<void> => {
      const categoryNames = expenseCategoriesQuery.data?.map((c) => c.name) ?? [];

      if (effectiveKind === 'pdf') {
        // Read PDF bytes as base64 — no image compression.
        let pdfBase64: string;
        try {
          pdfBase64 = await FileSystem.readAsStringAsync(uri, {
            encoding: FileSystem.EncodingType.Base64,
          });
        } catch {
          if (mountedRef.current) {
            setIsCompressing(false);
            setCompressionError(
              new OcrError(
                'NETWORK_ERROR',
                'No se pudo leer el archivo PDF. Ingresá los datos manualmente.',
              ),
            );
            hasTriggeredRef.current = false;
          }
          return;
        }
        if (mountedRef.current) {
          setIsCompressing(false);
          extractMutation.mutate({
            pdfBase64,
            mimeType: 'application/pdf',
            categoryNames,
          });
        }
      } else {
        // Image path — compress first.
        let compressed: CompressedImage;
        try {
          compressed = await compressForOcr(uri);
        } catch {
          if (mountedRef.current) {
            setIsCompressing(false);
            setCompressionError(
              new OcrError(
                'NETWORK_ERROR',
                'No se pudo procesar la imagen. Ingresá los datos manualmente.',
              ),
            );
            hasTriggeredRef.current = false;
          }
          return;
        }
        if (mountedRef.current) {
          setIsCompressing(false);
          extractMutation.mutate({
            imageBase64: compressed.base64,
            mimeType: compressed.mimeType,
            categoryNames,
          });
        }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [effectiveKind, expenseCategoriesQuery.data],
  );

  useEffect(() => {
    if (!effectiveUri || categoriesLoading || hasTriggeredRef.current) return;
    hasTriggeredRef.current = true;

    let cancelled = false;

    async function run(): Promise<void> {
      if (!effectiveUri) return;
      if (cancelled) return;
      setIsCompressing(true);
      await triggerOcr(effectiveUri);
      if (cancelled) return;
    }

    void run();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveUri, categoriesLoading]);

  // Map OCR result → DocumentPrefill once data arrives, and initialise direction.
  useEffect(() => {
    if (extractMutation.data && expenseCategoriesQuery.data) {
      const mapped = mapDocumentToPrefill(extractMutation.data, expenseCategoriesQuery.data);
      setDoc(mapped);
      // Initialise direction from the first transaction if present.
      if (mapped.transactions.length === 1 && mapped.transactions[0]) {
        setDirection(mapped.transactions[0].direction);
      }
    }
  }, [extractMutation.data, expenseCategoriesQuery.data]);

  // -------------------------------------------------------------------------
  // Retry handler
  // -------------------------------------------------------------------------

  const handleRetry = useCallback((): void => {
    if (!effectiveUri) return;
    hasTriggeredRef.current = false;
    extractMutation.reset();
    setDoc(null);
    setCompressionError(null);

    void (async () => {
      setIsCompressing(true);
      await triggerOcr(effectiveUri);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveUri, triggerOcr]);

  // -------------------------------------------------------------------------
  // Submit handlers
  // -------------------------------------------------------------------------

  async function handleSubmitExpense(input: CreateExpenseInput): Promise<void> {
    setSubmitError(null);
    try {
      await createExpenseMutation.mutateAsync(input);
      router.replace('/(protected)/(tabs)' as Parameters<typeof router.replace>[0]);
    } catch (e) {
      setSubmitError(
        e instanceof Error ? e.message : 'No se pudo guardar el gasto. Intentá nuevamente.',
      );
    }
  }

  async function handleSubmitShared(payload: SharedExpenseSubmitPayload): Promise<void> {
    setSubmitError(null);
    try {
      await createSharedMutation.mutateAsync({
        amount: payload.amount,
        currency: payload.currency ?? 'ARS',
        category_id: payload.category_id,
        description: payload.description,
        occurred_at: payload.occurred_at,
        items: (payload.items ?? []).map((item) => ({
          name: item.name,
          quantity: item.quantity,
          unit_price: item.unit_price,
          line_total: item.line_total,
        })),
        group_id: payload.group_id,
        paid_by_member_id: payload.paid_by_member_id,
        splits: payload.splits,
      });
      router.replace('/(protected)/(tabs)' as Parameters<typeof router.replace>[0]);
    } catch (e) {
      setSubmitError(
        e instanceof Error ? e.message : 'No se pudo guardar el gasto. Intentá nuevamente.',
      );
    }
  }

  async function handleSubmitIncome(
    input: import('@/lib/schemas/income').CreateIncomeInput,
  ): Promise<void> {
    setSubmitError(null);
    try {
      await createIncomeMutation.mutateAsync(input);
      router.replace('/(protected)/(tabs)' as Parameters<typeof router.replace>[0]);
    } catch (e) {
      setSubmitError(
        e instanceof Error ? e.message : 'No se pudo guardar el ingreso. Intentá nuevamente.',
      );
    }
  }

  async function handleImport(rows: ImportTransactionRow[]): Promise<void> {
    setSubmitError(null);
    try {
      await importTransactionsMutation.mutateAsync(rows);
      router.replace('/(protected)/(tabs)' as Parameters<typeof router.replace>[0]);
    } catch (e) {
      setSubmitError(
        e instanceof Error
          ? e.message
          : 'No se pudieron importar las transacciones. Intentá nuevamente.',
      );
    }
  }

  // -------------------------------------------------------------------------
  // Derived state
  // -------------------------------------------------------------------------

  const isLoading = isCompressing || extractMutation.isPending || categoriesLoading;
  const isSubmitting =
    createExpenseMutation.isPending ||
    createIncomeMutation.isPending ||
    createSharedMutation.isPending ||
    importTransactionsMutation.isPending;

  // compressionError takes priority over the OCR mutation error.
  const ocrError: Error | null = compressionError ?? extractMutation.error;
  const ocrErrorCode = ocrError instanceof OcrError ? ocrError.code : ocrError ? 'UNKNOWN' : null;
  const canRetry = ocrErrorCode !== null && RETRYABLE_CODES.has(ocrErrorCode);

  // Detect empty doc (no meaningful transactions).
  const tx: DocumentTransactionPrefill | null =
    doc !== null && doc.transactions.length === 1 ? (doc.transactions[0] ?? null) : null;

  const hasOcrData = tx !== null && txHasData(tx);

  const expenseCategories = expenseCategoriesQuery.data ?? [];
  const incomeCategories = incomeCategoriesQuery.data ?? [];

  // -------------------------------------------------------------------------
  // Sub-renders
  // -------------------------------------------------------------------------

  /** Document type badge + direction toggle row (shown for single-transaction results). */
  function renderBadgeAndToggle(): React.JSX.Element | null {
    if (!doc || doc.transactions.length !== 1) return null;

    return (
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing[3],
          marginBottom: spacing[4],
        }}
      >
        {/* Document type badge */}
        <View
          style={{
            backgroundColor: colors.bg[2],
            borderRadius: radii.sm,
            paddingHorizontal: spacing[3],
            paddingVertical: spacing[1],
          }}
        >
          <BodySm color={colors.fg[2]}>{documentTypeLabel(doc.documentType)}</BodySm>
        </View>

        {/* Direction toggle */}
        <View
          style={{
            flexDirection: 'row',
            backgroundColor: colors.bg[2],
            borderRadius: radii.sm,
            overflow: 'hidden',
          }}
        >
          <Pressable
            onPress={() => setDirection('expense')}
            accessibilityLabel="Gasto"
            accessibilityRole="button"
            style={{
              paddingHorizontal: spacing[3],
              paddingVertical: spacing[1],
              backgroundColor: direction === 'expense' ? colors.brand[500] : 'transparent',
            }}
          >
            <BodySm color={direction === 'expense' ? colors.fg.onBrand : colors.fg[2]}>
              Gasto
            </BodySm>
          </Pressable>
          <Pressable
            onPress={() => setDirection('income')}
            accessibilityLabel="Ingreso"
            accessibilityRole="button"
            style={{
              paddingHorizontal: spacing[3],
              paddingVertical: spacing[1],
              backgroundColor: direction === 'income' ? colors.money.in : 'transparent',
            }}
          >
            <BodySm color={direction === 'income' ? colors.fg.onBrand : colors.fg[2]}>
              Ingreso
            </BodySm>
          </Pressable>
        </View>
      </View>
    );
  }

  /** PDF truncation notice. */
  function renderTruncatedNotice(): React.JSX.Element | null {
    if (!doc?.truncated) return null;
    return (
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
        <BodySm color={colors.fg[2]}>Procesamos las primeras 3 páginas del PDF.</BodySm>
      </View>
    );
  }

  /** The form area for a single transaction routing. */
  function renderSingleTransactionForm(): React.JSX.Element {
    if (!tx) {
      // 0 transactions — empty expense form with notice
      return (
        <>
          <View
            style={{
              backgroundColor: colors.bg[1],
              borderLeftWidth: 3,
              borderLeftColor: colors.fg[3],
              borderRadius: radii.sm,
              padding: spacing[4],
              marginBottom: spacing[4],
            }}
          >
            <BodySm color={colors.fg[2]}>No se detectaron datos. Completá manualmente.</BodySm>
          </View>
          <ExpenseForm
            categories={expenseCategories}
            shareableGroups={groupsQuery.data ?? []}
            currentUserId={currentUserId}
            isSubmitting={isSubmitting}
            submitError={submitError}
            onSubmit={handleSubmitExpense}
            onSubmitShared={handleSubmitShared}
            submitLabel="Registrar gasto"
          />
        </>
      );
    }

    if (!hasOcrData) {
      // Transaction with no data
      return (
        <>
          <View
            style={{
              backgroundColor: colors.bg[1],
              borderLeftWidth: 3,
              borderLeftColor: colors.fg[3],
              borderRadius: radii.sm,
              padding: spacing[4],
              marginBottom: spacing[4],
            }}
          >
            <BodySm color={colors.fg[2]}>No se detectaron datos. Completá manualmente.</BodySm>
          </View>
          <ExpenseForm
            categories={expenseCategories}
            shareableGroups={groupsQuery.data ?? []}
            currentUserId={currentUserId}
            isSubmitting={isSubmitting}
            submitError={submitError}
            onSubmit={handleSubmitExpense}
            onSubmitShared={handleSubmitShared}
            submitLabel="Registrar gasto"
          />
        </>
      );
    }

    const lowConfidence = doc !== null && doc.confidence < 0.5;

    if (direction === 'income') {
      return (
        <IncomeForm
          categories={incomeCategories}
          prefill={toIncomePrefill(tx)}
          lowConfidence={lowConfidence}
          isSubmitting={isSubmitting}
          submitError={submitError}
          onSubmit={handleSubmitIncome}
          submitLabel="Registrar ingreso"
        />
      );
    }

    // direction === 'expense'
    return (
      <ExpenseForm
        categories={expenseCategories}
        prefill={toExpensePrefill(tx)}
        lowConfidence={lowConfidence}
        shareableGroups={groupsQuery.data ?? []}
        currentUserId={currentUserId}
        isSubmitting={isSubmitting}
        submitError={submitError}
        onSubmit={handleSubmitExpense}
        onSubmitShared={handleSubmitShared}
        submitLabel="Registrar gasto"
      />
    );
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg[0] }}>
      <Stack.Screen options={{ headerShown: false }} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, paddingHorizontal: spacing[5] }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing[3],
              paddingTop: spacing[4],
              paddingBottom: spacing[5],
            }}
          >
            <Pressable
              onPress={() => router.back()}
              accessibilityLabel="Volver"
              hitSlop={12}
              style={{ padding: spacing[1] }}
            >
              <Icon name="ChevronLeft" size={24} color={colors.fg[1]} />
            </Pressable>
            <H1>Revisar documento</H1>
          </View>

          {/* Image thumbnail — only for kind=image (PDFs have no image uri to preview) */}
          {effectiveUri && effectiveKind === 'image' && !isLoading ? (
            <View style={{ marginBottom: spacing[5] }}>
              <Image
                source={{ uri: effectiveUri }}
                style={{
                  width: '100%',
                  height: 160,
                  borderRadius: radii.lg,
                  backgroundColor: colors.bg[2],
                }}
                contentFit="cover"
                accessibilityLabel="Imagen del documento"
              />
            </View>
          ) : null}

          {/* Loading state — with image */}
          {isLoading && effectiveUri && effectiveKind === 'image' ? (
            <View
              style={{
                marginBottom: spacing[5],
                gap: spacing[4],
                alignItems: 'center',
              }}
            >
              <ScanOverlay imageUri={effectiveUri} />
              <ScanStatus />
            </View>
          ) : null}

          {/* Loading state — PDF or no uri */}
          {isLoading && (effectiveKind === 'pdf' || !effectiveUri) && (
            <View
              style={{
                flex: 1,
                justifyContent: 'center',
                alignItems: 'center',
                gap: spacing[4],
                paddingVertical: spacing[8],
              }}
            >
              <Loader size={32} color={colors.fg[2]} />
              <Body color={colors.fg[2]}>Analizando documento…</Body>
            </View>
          )}

          {/* OCR error — retryable (TIMEOUT / NETWORK) */}
          {!isLoading && ocrError !== null && canRetry && (
            <>
              <View
                style={{
                  backgroundColor: colors.bg[1],
                  borderLeftWidth: 3,
                  borderLeftColor: colors.money.out,
                  borderRadius: radii.sm,
                  padding: spacing[4],
                  marginBottom: spacing[4],
                  gap: spacing[3],
                }}
              >
                <BodySm color={colors.fg[2]}>
                  No se pudo analizar el documento. Ingresá los datos manualmente.
                </BodySm>
                <Button
                  variant="secondary"
                  size="md"
                  onPress={handleRetry}
                  accessibilityLabel="Reintentar"
                >
                  Reintentar
                </Button>
              </View>
              <ExpenseForm
                categories={expenseCategories}
                shareableGroups={groupsQuery.data ?? []}
                currentUserId={currentUserId}
                isSubmitting={isSubmitting}
                submitError={submitError}
                onSubmit={handleSubmitExpense}
                onSubmitShared={handleSubmitShared}
                submitLabel="Registrar gasto"
              />
            </>
          )}

          {/* OCR error — non-retryable */}
          {!isLoading && ocrError !== null && !canRetry && (
            <>
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
                <BodySm color={colors.fg[2]}>
                  No se pudo analizar el documento. Ingresá los datos manualmente.
                </BodySm>
              </View>
              <ExpenseForm
                categories={expenseCategories}
                shareableGroups={groupsQuery.data ?? []}
                currentUserId={currentUserId}
                isSubmitting={isSubmitting}
                submitError={submitError}
                onSubmit={handleSubmitExpense}
                onSubmitShared={handleSubmitShared}
                submitLabel="Registrar gasto"
              />
            </>
          )}

          {/* Missing effectiveUri — defensive fallback */}
          {!isLoading && !effectiveUri && ocrError === null && doc === null && (
            <>
              <View
                style={{
                  backgroundColor: colors.bg[1],
                  borderLeftWidth: 3,
                  borderLeftColor: colors.fg[3],
                  borderRadius: radii.sm,
                  padding: spacing[4],
                  marginBottom: spacing[4],
                }}
              >
                <BodySm color={colors.fg[2]}>No se detectaron datos. Completá manualmente.</BodySm>
              </View>
              <ExpenseForm
                categories={expenseCategories}
                shareableGroups={groupsQuery.data ?? []}
                currentUserId={currentUserId}
                isSubmitting={isSubmitting}
                submitError={submitError}
                onSubmit={handleSubmitExpense}
                onSubmitShared={handleSubmitShared}
                submitLabel="Registrar gasto"
              />
            </>
          )}

          {/* OCR success — route by transaction count */}
          {!isLoading && ocrError === null && doc !== null && (
            <>
              {renderTruncatedNotice()}

              {/* >1 transactions — bulk import */}
              {doc.transactions.length > 1 && (
                <TransactionImportList
                  transactions={doc.transactions}
                  expenseCategories={expenseCategories}
                  incomeCategories={incomeCategories}
                  isSubmitting={importTransactionsMutation.isPending}
                  submitError={submitError}
                  onImport={handleImport}
                />
              )}

              {/* 0 or 1 transaction — single routing */}
              {doc.transactions.length <= 1 && (
                <>
                  {renderBadgeAndToggle()}
                  {renderSingleTransactionForm()}
                </>
              )}
            </>
          )}

          <View style={{ height: spacing[8] }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
