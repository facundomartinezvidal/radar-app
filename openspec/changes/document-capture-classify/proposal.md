## Why

Hoy la captura sólo acepta fotos y el OCR (`extract-receipt`) asume que toda imagen es un **ticket de
compra → un gasto**. Los usuarios de RADAR reciben comprobantes en **PDF y capturas** (transferencias,
resúmenes de tarjeta, billeteras como MP/Ualá) que no pueden subir, y una transferencia **recibida** se
registraría erróneamente como gasto. HU-25 amplía la captura a un flujo genérico de documentos con
clasificación de tipo y dirección.

## What Changes

- Nueva entrada **"Documento"** en el tab de captura: selecciona **PDF o imagen** vía `expo-document-picker`
  (además de cámara/galería).
- Nueva edge function **`extract-document`**: convierte PDF→imagen server-side (mupdf WASM, hasta 3
  páginas), corre Groq vision multi-página y devuelve **clasificación de documento** (`receipt`,
  `transfer`, `card_statement`, `screenshot`, `unknown`), **dirección** (enviada/recibida) y una lista de
  **transacciones**. `extract-receipt` se mantiene intacta.
- **Ruteo por dirección**: transferencia **enviada → gasto** (`ExpenseForm`), **recibida → ingreso**
  (`IncomeForm`, con nuevo soporte de `prefill`). El usuario puede invertir la dirección.
- **Import multi-transacción**: un resumen de tarjeta produce N transacciones → pantalla de lista con
  selección → RPC transaccional **`import_transactions`** crea sólo las filas elegidas en `expenses`/`incomes`.
- Persistencia del archivo original queda **fuera de alcance** (transitorio, como el OCR actual).

## Capabilities

### New Capabilities
- `document-capture`: entrada de archivos (PDF + imágenes), tipos aceptados, límites de tamaño/páginas, y el handoff a la pantalla de revisión.
- `document-classification`: extracción OCR que clasifica el tipo de documento, infiere la dirección de transferencia y devuelve transacciones (single o multi-página).
- `transaction-import`: ruteo de una transacción al formulario de gasto/ingreso y el import en lote de múltiples transacciones de un resumen.

### Modified Capabilities
<!-- Ninguna: los dominios de specs vivos existentes (insights-*) no cambian sus requisitos. -->

## Impact

- **Código (modificado)**: `app/(protected)/(tabs)/camera.tsx`, `app/(protected)/expense/review.tsx`,
  `components/incomes/income-form.tsx`, `lib/ocr.ts`, `AGENTS.md`, `package.json`.
- **Código (nuevo)**: `supabase/functions/extract-document/index.ts`, `lib/schemas/document.ts`,
  `hooks/use-extract-document.ts`, `components/expenses/transaction-import-list.tsx`,
  `lib/repositories/transactions.ts`, `hooks/use-import-transactions.ts`,
  `supabase/migrations/<ts>_import_transactions_rpc.sql`.
- **Dependencias**: nueva `expo-document-picker` (SDK 54); mupdf WASM en el edge runtime (riesgo a validar).
- **APIs/DB**: nueva edge function `extract-document`; nuevo RPC `import_transactions` (SECURITY INVOKER, RLS).
- **Reusa**: `compressForOcr` (`lib/image.ts`), `matchCategory`/`mapOcrItems` (`lib/ocr.ts`),
  `useCreateExpense`/`useCreateIncome`.
