/**
 * RADAR — Receipt review screen (HU-06).
 *
 * Receives an `imageUri` query param from the camera screen, runs OCR via
 * `useExtractReceipt`, and renders a pre-filled `ExpenseForm` so the user
 * can validate and save the detected data as a real expense.
 */
import { Image } from 'expo-image';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ExpenseForm, type SharedExpenseSubmitPayload } from '@/components/expenses/expense-form';
import { ScanOverlay } from '@/components/expenses/scan-overlay';
import { ScanStatus } from '@/components/expenses/scan-status';
import { Body, BodySm, Button, H1, Icon, Loader } from '@/components/ui';
import { useExtractReceipt } from '@/hooks/use-extract-receipt';
import { useCategories, useCreateExpense } from '@/hooks/use-expenses';
import { useGroups, useCreateSharedExpense } from '@/hooks/use-groups';
import { useAuthStore } from '@/stores/auth-store';
import type { CompressedImage } from '@/lib/image';
import { compressForOcr } from '@/lib/image';
import { OcrError, mapOcrToPrefill } from '@/lib/ocr';
import type { ReceiptPrefill } from '@/lib/ocr';
import { colors, radii, spacing } from '@/lib/theme';
import type { CreateExpenseInput } from '@/lib/schemas/expense';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** OCR error codes that allow the user to retry the request. */
const RETRYABLE_CODES = new Set(['OCR_TIMEOUT', 'NETWORK_ERROR']);

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ReviewScreen(): React.JSX.Element {
  const { imageUri } = useLocalSearchParams<{ imageUri?: string }>();

  const categoriesQuery = useCategories();
  const extractMutation = useExtractReceipt();
  const createMutation = useCreateExpense();
  const groupsQuery = useGroups();
  const createSharedMutation = useCreateSharedExpense();
  const currentUserId = useAuthStore((s) => s.user?.id ?? null);

  const [submitError, setSubmitError] = useState<string | null>(null);
  const [prefill, setPrefill] = useState<ReceiptPrefill | null>(null);
  const [isCompressing, setIsCompressing] = useState(false);
  const [compressionError, setCompressionError] = useState<OcrError | null>(null);

  // Guard against double-run in StrictMode / re-renders.
  const hasTriggeredRef = useRef(false);

  // Track mount status so async callbacks in handleRetry can bail out after unmount.
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!imageUri || categoriesQuery.isLoading || hasTriggeredRef.current) return;
    hasTriggeredRef.current = true;

    let cancelled = false;

    async function run(): Promise<void> {
      if (!imageUri) return;
      setIsCompressing(true);
      let compressed: CompressedImage;
      try {
        compressed = await compressForOcr(imageUri);
      } catch {
        // Compression failed: surface a retryable error so the screen renders
        // the manual-entry form + notice. Reset the guard so "Reintentar" can
        // trigger a new compression attempt.
        if (!cancelled) {
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
      if (!cancelled) {
        setIsCompressing(false);
        extractMutation.mutate({
          imageBase64: compressed.base64,
          mimeType: compressed.mimeType,
          categoryNames: categoriesQuery.data?.map((c) => c.name) ?? [],
        });
      }
    }

    void run();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageUri, categoriesQuery.isLoading, categoriesQuery.data]);

  // Map OCR result → prefill once data arrives.
  useEffect(() => {
    if (extractMutation.data && categoriesQuery.data) {
      const mapped = mapOcrToPrefill(extractMutation.data, categoriesQuery.data);
      setPrefill(mapped);
    }
  }, [extractMutation.data, categoriesQuery.data]);

  // -------------------------------------------------------------------------
  // Handlers
  // -------------------------------------------------------------------------

  const handleRetry = useCallback((): void => {
    if (!imageUri) return;
    hasTriggeredRef.current = false;
    extractMutation.reset();
    setPrefill(null);
    setCompressionError(null);

    void (async () => {
      setIsCompressing(true);
      let compressed: CompressedImage;
      try {
        compressed = await compressForOcr(imageUri);
      } catch {
        if (mountedRef.current) {
          setIsCompressing(false);
          setCompressionError(
            new OcrError(
              'NETWORK_ERROR',
              'No se pudo procesar la imagen. Ingresá los datos manualmente.',
            ),
          );
        }
        return;
      }
      if (mountedRef.current) {
        setIsCompressing(false);
        hasTriggeredRef.current = true;
        extractMutation.mutate({
          imageBase64: compressed.base64,
          mimeType: compressed.mimeType,
          categoryNames: categoriesQuery.data?.map((c) => c.name) ?? [],
        });
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageUri]);

  async function handleSubmit(input: CreateExpenseInput): Promise<void> {
    setSubmitError(null);
    try {
      await createMutation.mutateAsync(input);
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

  // -------------------------------------------------------------------------
  // Derived state
  // -------------------------------------------------------------------------

  const isLoading = isCompressing || extractMutation.isPending || categoriesQuery.isLoading;
  const isSubmitting = createMutation.isPending || createSharedMutation.isPending;

  // compressionError takes priority over the OCR mutation error so both paths
  // render the same retryable branch (Reintentar + empty form).
  const ocrError: Error | null = compressionError ?? extractMutation.error;
  const ocrErrorCode = ocrError instanceof OcrError ? ocrError.code : ocrError ? 'UNKNOWN' : null;
  const canRetry = ocrErrorCode !== null && RETRYABLE_CODES.has(ocrErrorCode);

  // Show empty form with softer notice when there are no detected fields
  // (all fields undefined/null, no items, and lowConfidence false means "no data").
  const hasOcrData =
    prefill !== null &&
    (prefill.amount != null ||
      prefill.currency != null ||
      prefill.description != null ||
      prefill.category_id != null ||
      prefill.occurred_at != null ||
      (prefill.items != null && prefill.items.length > 0));

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
            <H1>Revisar gasto</H1>
          </View>

          {/* Receipt thumbnail — hidden while loading (ScanOverlay shows the image during OCR) */}
          {imageUri && !isLoading ? (
            <View style={{ marginBottom: spacing[5] }}>
              <Image
                source={{ uri: imageUri }}
                style={{
                  width: '100%',
                  height: 160,
                  borderRadius: radii.lg,
                  backgroundColor: colors.bg[2],
                }}
                contentFit="cover"
                accessibilityLabel="Imagen del ticket"
              />
            </View>
          ) : null}

          {/* Loading state */}
          {isLoading && imageUri ? (
            <View
              style={{
                marginBottom: spacing[5],
                gap: spacing[4],
                alignItems: 'center',
              }}
            >
              <ScanOverlay imageUri={imageUri} />
              <ScanStatus />
            </View>
          ) : null}

          {/* Loading state — defensive fallback when no imageUri */}
          {isLoading && !imageUri && (
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
              <Body color={colors.fg[2]}>Analizando ticket…</Body>
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
                  No se pudo analizar el ticket. Ingresá los datos manualmente.
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
                categories={categoriesQuery.data ?? []}
                shareableGroups={groupsQuery.data ?? []}
                currentUserId={currentUserId}
                isSubmitting={isSubmitting}
                submitError={submitError}
                onSubmit={handleSubmit}
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
                  No se pudo analizar el ticket. Ingresá los datos manualmente.
                </BodySm>
              </View>
              <ExpenseForm
                categories={categoriesQuery.data ?? []}
                shareableGroups={groupsQuery.data ?? []}
                currentUserId={currentUserId}
                isSubmitting={isSubmitting}
                submitError={submitError}
                onSubmit={handleSubmit}
                onSubmitShared={handleSubmitShared}
                submitLabel="Registrar gasto"
              />
            </>
          )}

          {/* No OCR data — empty + soft notice */}
          {!isLoading && ocrError === null && prefill !== null && !hasOcrData && (
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
                categories={categoriesQuery.data ?? []}
                shareableGroups={groupsQuery.data ?? []}
                currentUserId={currentUserId}
                isSubmitting={isSubmitting}
                submitError={submitError}
                onSubmit={handleSubmit}
                onSubmitShared={handleSubmitShared}
                submitLabel="Registrar gasto"
              />
            </>
          )}

          {/* Missing imageUri — defensive fallback */}
          {!isLoading && !imageUri && ocrError === null && prefill === null && (
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
                categories={categoriesQuery.data ?? []}
                shareableGroups={groupsQuery.data ?? []}
                currentUserId={currentUserId}
                isSubmitting={isSubmitting}
                submitError={submitError}
                onSubmit={handleSubmit}
                onSubmitShared={handleSubmitShared}
                submitLabel="Registrar gasto"
              />
            </>
          )}

          {/* OCR success — prefilled form */}
          {!isLoading && ocrError === null && prefill !== null && hasOcrData && (
            <ExpenseForm
              categories={categoriesQuery.data ?? []}
              prefill={prefill}
              lowConfidence={prefill.lowConfidence}
              shareableGroups={groupsQuery.data ?? []}
              currentUserId={currentUserId}
              isSubmitting={isSubmitting}
              submitError={submitError}
              onSubmit={handleSubmit}
              onSubmitShared={handleSubmitShared}
              submitLabel="Registrar gasto"
            />
          )}

          <View style={{ height: spacing[8] }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
