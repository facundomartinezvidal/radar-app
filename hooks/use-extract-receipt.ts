/**
 * TanStack Query mutation hook for the receipt OCR edge function.
 *
 * Wraps `extractReceipt` from `@/lib/ocr` in a `useMutation` — callers get
 * loading / error / data state without managing the async lifecycle manually.
 *
 * No cache invalidation is needed: the OCR call is a one-shot transformation
 * (image → prefill data) that does not touch the expenses / categories cache.
 */
import { useMutation } from '@tanstack/react-query';

import { extractReceipt } from '@/lib/ocr';
import type { OcrResult } from '@/lib/schemas/ocr';

interface ExtractReceiptVariables {
  imageBase64: string;
  mimeType: string;
}

export function useExtractReceipt() {
  return useMutation<OcrResult, Error, ExtractReceiptVariables>({
    mutationFn: ({ imageBase64, mimeType }) => extractReceipt(imageBase64, mimeType),
  });
}
