## Context

El flujo de captura actual es: `camera.tsx` (cámara/galería, `mediaTypes: ['images']`) →
`expense/review.tsx` (`compressForOcr` → `useExtractReceipt` → Groq `extract-receipt` →
`mapOcrToPrefill` → `<ExpenseForm prefill>`). El modelo Groq `meta-llama/llama-4-scout-17b-16e-instruct`
es **vision-only**; el repo **no maneja PDF**. `expenses` e `incomes` son tablas separadas (sin columna
de dirección). `income-form.tsx` existe pero **no** acepta `prefill`. El bucket `media` aún no existe
(persistencia pendiente). Esta feature amplía la captura a documentos genéricos clasificados, reusando
al máximo el pipeline OCR existente.

## Goals / Non-Goals

**Goals:**
- Aceptar PDF + imágenes vía `expo-document-picker` desde el tab de captura.
- Clasificar el documento (`receipt`/`transfer`/`card_statement`/`screenshot`/`unknown`) e inferir dirección.
- Rutear transferencia recibida → ingreso y enviada → gasto, con override del usuario.
- Importar en lote los consumos seleccionados de un resumen de tarjeta.
- No romper el flujo OCR existente (`extract-receipt` queda intacta).

**Non-Goals:**
- Persistir el archivo original (bucket `media` + RLS) — fase 2.
- PDF > 3 páginas; render de PDF en cliente (dev build).
- Dedupe/conciliación contra registros existentes; integración WhatsApp.

## Decisions

1. **Nueva edge function `extract-document` (no extender `extract-receipt`)** — mantiene estable el
   baseline de tests y separa el contrato nuevo (clasificación + transacciones[]). `extract-receipt`
   sigue para el flujo de foto→ticket si se desea, pero el nuevo flujo unificado usa `extract-document`.

2. **Conversión PDF→PNG server-side con mupdf (WASM) en Deno**, hasta 3 páginas, render secuencial y
   Groq vision por página. Las transacciones de todas las páginas se concatenan. Imágenes pasan directo.
   *Rationale*: Groq es vision-only y Expo Go no rasteriza PDF; el servidor es el único lugar viable.

3. **Contrato de salida unificado con `transactions[]`** — todo documento devuelve un arreglo; single =
   longitud 1, statement = N. Cada transacción lleva `direction` ('expense'|'income'). Evita ramas de
   esquema distintas y simplifica el cliente. Validado con Zod (`documentOcrResultSchema`).

4. **Ruteo por dirección en `review.tsx`** — 1 transacción → `ExpenseForm` o `IncomeForm` según
   `direction`; N → `transaction-import-list`. Se agrega `IncomePrefill` a `income-form.tsx`, espejo del
   `prefill` de `ExpenseForm`, reusando `matchCategory`/`mapOcrItems`.

5. **Import en lote vía RPC `import_transactions(p_rows jsonb)` SECURITY INVOKER** — transaccional
   (todo o nada) y respeta RLS (inserta sólo bajo el `user_id` autenticado). Sigue el patrón de los RPCs
   existentes (expense_items, shared-expenses). Migración dual-ship según `docs/conventions/database.md`.

6. **Reuso máximo** — `compressForOcr`, `matchCategory`, `mapOcrItems`, `normalizeName`,
   `useCreateExpense`, `useCreateIncome`, taxonomía de errores de OCR. Nuevo error `PDF_CONVERT_ERROR`.

## Risks / Trade-offs

- **mupdf-wasm en el runtime de Supabase Edge** (riesgo principal): validar en el primer atomic change
  del edge fn. Si el WASM no corre, fallback: servicio de conversión externo o degradar PDF a
  "subí una captura" (imágenes siguen funcionando). Decidir antes de invertir en el resto del edge fn.
- **Latencia/costo Groq multi-página**: 3 páginas = 3 llamadas vision → mayor latencia y costo. Mitigado
  por el límite duro de 3 páginas y spinner explícito; cap de transacciones (~100) en la lista.
- **Precisión de la dirección**: el modelo puede equivocar enviada/recibida. Mitigado por el toggle de
  override del usuario y el default a `expense`.
- **Atomicidad del import**: RPC todo-o-nada evita estados parciales pero un único error aborta todo el
  lote; aceptable para el MVP (el usuario reintenta).
- **Moneda mixta en resúmenes**: cada transacción lleva su propia `currency`; la lista debe mostrar y
  agrupar correctamente ARS/USD sin asumir una sola moneda.
