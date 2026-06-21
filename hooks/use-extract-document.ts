/**
 * TanStack Query mutation hook for the document OCR edge function.
 *
 * Wraps `extractDocument` from `@/lib/ocr` in a `useMutation` — callers get
 * loading / error / data state without managing the async lifecycle manually.
 *
 * No cache invalidation is needed: the OCR call is a one-shot transformation
 * (document → prefill data) that does not touch the expenses / categories cache.
 */
import { useMutation } from '@tanstack/react-query';

import { extractDocument } from '@/lib/ocr';
import type { DocumentOcrResult } from '@/lib/schemas/document';

interface ExtractDocumentVariables {
  imageBase64?: string;
  pdfBase64?: string;
  mimeType: string;
  categoryNames?: string[];
}

export function useExtractDocument() {
  return useMutation<DocumentOcrResult, Error, ExtractDocumentVariables>({
    mutationFn: ({ imageBase64, pdfBase64, mimeType, categoryNames }) =>
      extractDocument({ imageBase64, pdfBase64, mimeType, categoryNames }),
  });
}
