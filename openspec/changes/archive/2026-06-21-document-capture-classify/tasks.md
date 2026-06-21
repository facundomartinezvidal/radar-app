## 1. Entrada de documentos (document-picker)

- [x] 1.1 Agregar dependencia `expo-document-picker` (compat SDK 54) y actualizar `package.json`/lockfile
- [x] 1.2 Agregar modo/botón "Documento" en `app/(protected)/(tabs)/camera.tsx` (junto a Cámara/Galería)
- [x] 1.3 Abrir el selector aceptando `application/pdf` + imágenes (jpg/png/heic/webp)
- [x] 1.4 Validar tipo y tamaño (~10 MB) con mensajes en español; no iniciar OCR si falla
- [x] 1.5 Navegar a `expense/review` con `uri`, `mimeType`, `name`, `kind` ('image'|'pdf')
- [x] 1.6 Tests: selección PDF/imagen, cancelación, tipo no soportado, archivo grande

## 2. Edge function extract-document

- [x] 2.1 SPIKE: validar que mupdf rasteriza PDF→PNG (Node spike OK; esm.sh falló en edge, npm: boota — ver amendment)
- [x] 2.2 Crear `supabase/functions/extract-document/index.ts` con verificación JWT (espejo de extract-receipt)
- [x] 2.3 Conversión PDF→PNG (mupdf vía npm:, lazy), máximo 3 páginas, flag de truncado; imágenes pasan directo
- [x] 2.4 Prompt Groq vision (español) que devuelve `documentType`, `direction` y `transactions[]`
- [x] 2.5 Una sola llamada Groq con todas las páginas; normalizar/validar salida (transacciones cap 100)
- [x] 2.6 Taxonomía de errores reusada + nuevo `PDF_CONVERT_ERROR`
- [x] 2.7 Desplegado v2 (ACTIVE); OPTIONS 204. Runtime PDF queda para E2E autenticado (residual, contenido)

## 3. Cliente: schema + lib OCR (ocr-client)

- [x] 3.1 Crear `lib/schemas/document.ts` (`documentOcrResultSchema`, tipos `DocumentOcrResult`/`DocumentTransaction`)
- [x] 3.2 `lib/ocr.ts`: `extractDocument()` que invoca `extract-document` y valida con Zod
- [x] 3.3 `mapDocumentToPrefill()` reusando `matchCategory`, `mapOcrItems`, `normalizeName`
- [x] 3.4 Helper de partición de transacciones por `direction` (expense/income)
- [x] 3.5 `hooks/use-extract-document.ts` (mutation TanStack, espejo de use-extract-receipt)
- [x] 3.6 Tests: parsing, schema inválido → fallback, mapeo single y multi, dirección por defecto

## 4. Ruteo de transacción única (review-routing)

- [x] 4.1 Agregar soporte `prefill` (`IncomePrefill`) a `components/incomes/income-form.tsx`
- [x] 4.2 En `expense/review.tsx`: branch single-expense → `ExpenseForm`, single-income → `IncomeForm`
- [x] 4.3 Badge del tipo de documento + toggle ingreso/gasto que preserva datos extraídos
- [x] 4.4 Estado `unknown`/sin monto → formulario vacío con aviso; banner de baja confianza (no bloquea)
- [x] 4.5 Tests: ruteo por dirección, override de dirección, unknown, baja confianza

## 5. Import multi-transacción (statement-import)

- [x] 5.1 Migración `supabase/migrations/<ts>_import_transactions_rpc.sql`: RPC `import_transactions(p_rows jsonb)` SECURITY INVOKER (dual-ship)
- [x] 5.2 Regenerar `types/supabase.ts`
- [x] 5.3 `lib/repositories/transactions.ts` + `hooks/use-import-transactions.ts`
- [x] 5.4 `components/expenses/transaction-import-list.tsx`: filas con checkbox, monto tabular, fecha, comercio, categoría editable, toggle gasto/ingreso, "seleccionar todo"
- [x] 5.5 Manejo de moneda mixta (ARS/USD por fila); confirmar → crear N → navegar al resumen con conteo
- [x] 5.6 Tests: selección parcial, sin selección, filas mixtas, import atómico, RLS por usuario

## 6. Documentación y AGENTS

- [x] 6.1 `docs/features/document-capture-classify.md`
- [x] 6.2 `docs/decisions/2026-06-21-document-classification-ocr.md`
- [x] 6.3 `docs/user-flows/HU-25-adjuntar-comprobantes.md` (+ mirror al vault de Obsidian)
- [x] 6.4 Actualizar `AGENTS.md`: §6 RPC `import_transactions`, §10 shipped/pending, §9 baseline de tests
- [x] 6.5 Verificación final: `pnpm format:check && pnpm lint && pnpm typecheck && pnpm test`
