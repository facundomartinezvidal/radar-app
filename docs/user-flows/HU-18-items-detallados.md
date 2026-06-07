# HU-18 — Items detallados

## 1. Identificación

| Campo            | Valor                                                                                                      |
| ---------------- | ---------------------------------------------------------------------------------------------------------- |
| **ID**           | HU-18                                                                                                      |
| **Historia**     | Items detallados                                                                                           |
| **Persona**      | Cualquier usuario autenticado — primario: El estudiante / El joven profesional con tickets de supermercado |
| **Estado**       | MVP                                                                                                        |
| **Relevancia**   | Media                                                                                                      |
| **Complejidad**  | Media                                                                                                      |
| **Release**      | Entrega 3                                                                                                  |
| **Trazabilidad** | `feat/expense-line-items` — migraciones `20260603152601` + `20260603152639`, `expense-items-field.tsx`     |

---

## 2. Historia

> **Como** usuario que escanea un ticket,
> **quiero** ver y editar el detalle de ítems (nombre, cantidad, precio unitario, total de línea),
> **para** saber exactamente en qué se compone mi gasto y tener registro preciso de cada renglón.

---

## 3. Pre-condiciones

- El usuario está autenticado (JWT válido).
- El formulario de gasto está montado: ya sea `review.tsx` (post-escaneo) o
  `new.tsx` / `[id].tsx` (ingreso manual o edición).
- La edge function `extract-receipt` está desplegada y el secret `GROQ_API_KEY`
  configurado (requerido sólo para el flujo OCR).
- La tabla `expense_items` existe en el proyecto Supabase con RLS habilitado.
- Las funciones RPC `create_expense_with_items` y `update_expense_with_items`
  están definidas en el proyecto.

---

## 4. Post-condiciones

- **Éxito con ítems**: el gasto se guarda con su conjunto de ítems; la tabla
  `expense_items` contiene N filas vinculadas al `expense_id` creado.
- **Éxito sin ítems**: el gasto se guarda sin ítems (compatible con el
  comportamiento previo a esta feature).
- **Cualquier fallo de persistencia**: la transacción revierte completamente;
  no quedan filas huérfanas en `expenses` ni en `expense_items`.

---

## 5. Flujo principal

Escenario: usuario escanea un ticket de supermercado con renglones legibles.

1. El usuario captura o selecciona una imagen del ticket (HU-02 / HU-03).
2. `review.tsx` comprime la imagen y llama a la edge function
   `extract-receipt` (ver HU-05).
3. La edge function extrae los campos del ticket. Si el ticket tiene renglones
   legibles, devuelve `items: [{ name, quantity, unitPrice, lineTotal }, …]`
   junto con `amount`, `currency`, `merchant`, etc.
4. `mapOcrItems()` en `lib/ocr.ts` normaliza los ítems del OCR:
   - Descarta ítems sin nombre.
   - Aplica `quantity = 1` por defecto cuando no está presente.
   - Calcula `line_total = round2(qty × unitPrice)` cuando `lineTotal` es
     nulo pero ambos operandos están disponibles; en caso contrario,
     `line_total = 0`.
   - Limita el resultado a 50 ítems.
5. `mapOcrToPrefill()` incluye los ítems normalizados en `prefill.items` y
   los pasa a `<ExpenseForm prefill={...}>`.
6. El formulario muestra la sección "Detalle" **auto-expandida** con los
   ítems pre-cargados. Cada ítem muestra:
   - Campo **Nombre** (texto, requerido).
   - Campo **Cant.** (numérico decimal, mayor a cero).
   - Campo **Precio unit.** (numérico decimal, opcional).
   - Campo **Total** (numérico decimal, requerido).
7. El usuario revisa y edita los ítems según corresponda:
   - Modificar **Cant.** o **Precio unit.** recalcula **Total** automáticamente
     cuando **Precio unit.** no es nulo.
   - Editar **Total** directamente establece el valor manualmente; la edición
     siguiente de **Cant.** o **Precio unit.** vuelve a recalcular.
   - Presionar **Quitar ítem** (ícono X) elimina el renglón.
   - Presionar **Agregar ítem** añade una fila vacía al final.
8. Si `|Σ Total de ítems − Monto del gasto| > 0,50`, aparece un aviso
   en color ámbar:
   `La suma de los ítems ($ X) no coincide con el total ($ Y). Puede deberse a descuentos o propinas.`
   El aviso es informativo; no bloquea el guardado.
9. El usuario completa el resto del formulario (monto, categoría, fecha) y
   presiona **Registrar gasto**.
10. `createExpense()` en el repositorio llama al RPC
    `create_expense_with_items` con los datos del gasto y el arreglo de
    ítems serializado como JSONB. La transacción inserta la fila en
    `expenses` y todos los ítems en `expense_items` en un único paso.
11. El gasto se guarda correctamente. La app navega a la pantalla de inicio
    con el gasto visible en el historial.

---

## 6. Flujos alternativos

### 6.a — OCR sin ítems (ticket sin detalle de renglones)

- La edge function no detecta renglones legibles o el ticket sólo muestra el
  total. Devuelve `items: []`.
- `mapOcrToPrefill()` no incluye `items` en el prefill.
- El formulario muestra la sección "Detalle" **colapsada** y vacía.
- El usuario puede agregar ítems manualmente o guardar sin ítems.

### 6.b — OCR con ítems pero payload fuera de especificación

- La edge function o el modelo devuelve `items` como un tipo inesperado
  (string, objeto, null).
- `normaliseItems()` en la edge function lo descarta y devuelve `[]`.
- El esquema zod del cliente (`z.array(ocrItemSchema).catch([])`) produce `[]`
  como segunda línea de defensa.
- El flujo continúa como si no hubiera ítems (flujo 6.a).

### 6.c — Aviso de diferencia entre suma de ítems y total

- El usuario edita los ítems y la suma de sus totales de línea difiere del
  monto del gasto en más de $0,50.
- El aviso ámbar aparece debajo de la lista de ítems.
- El usuario puede:
  a. Ajustar los ítems hasta que la suma coincida.
  b. Ignorar el aviso y guardar igual (el monto del gasto manda).

### 6.d — Edición manual sin OCR

- El usuario ingresa un gasto desde `new.tsx` sin haber escaneado ningún
  ticket.
- La sección "Detalle" aparece **colapsada** y vacía.
- El usuario presiona el encabezado "Detalle" para expandirla.
- El usuario agrega ítems manualmente con **Agregar ítem**.
- El flujo de guardado es idéntico al flujo principal (pasos 9–11).

### 6.e — Edición de un gasto existente con ítems

- El usuario accede a `[id].tsx`. El repositorio carga el gasto con
  `items:expense_items(*)` en un único select anidado.
- El formulario hidrata `ExpenseItemsField` con los ítems existentes,
  ordenados por `position` ascendente.
- El usuario modifica ítems y presiona **Guardar cambios**.
- `updateExpense()` detecta `input.items !== undefined` y enruta al RPC
  `update_expense_with_items`:
  - Actualiza las columnas del gasto (sólo las presentes en `p_patch`).
  - Elimina todos los ítems actuales del gasto.
  - Reinserta el conjunto nuevo.
- Los ids de los ítems cambian en cada guardado (limitación conocida).

### 6.f — Borrado de todos los ítems

- El usuario presiona **Quitar ítem** en todos los renglones hasta que la
  lista queda vacía.
- El aviso de diferencia desaparece (sin ítems, no hay suma que comparar).
- El usuario guarda: `updateExpense()` pasa `items: []` al RPC, que borra
  todos los ítems del gasto. El gasto persiste sin ítems.

### 6.g — Falla de persistencia (violación de constraint o error de red)

- El RPC encuentra una violación de constraint (nombre vacío, línea total
  negativo, etc.) o la llamada falla por red.
- La transacción revierte completamente: ni el gasto ni los ítems quedan
  en la base de datos.
- El repositorio devuelve `{ data: null, error }`.
- El formulario muestra el error genérico de guardado:
  `No se pudo guardar el gasto. Intentá nuevamente.`

---

## 7. Diagrama

```mermaid
flowchart TD
    Start([Usuario en review.tsx con imageUri]) --> OCR[extract-receipt Edge Fn]
    OCR -->|items detectados| MapItems[mapOcrItems - normaliza]
    OCR -->|items: vacío / off-spec| NoItems[prefill sin items]
    MapItems --> Prefill[mapOcrToPrefill - prefill.items]
    Prefill --> Form[ExpenseForm - sección Detalle expandida]
    NoItems --> FormEmpty[ExpenseForm - sección Detalle colapsada]

    Form --> Edit[Usuario revisa / edita ítems]
    FormEmpty --> AddManual[Usuario agrega ítems manualmente]
    Edit --> Mismatch{|Σ − monto| > 0.50}
    AddManual --> Mismatch
    Mismatch -->|sí| Warning[Aviso ámbar - no bloqueante]
    Mismatch -->|no| Submit
    Warning --> Submit[Registrar gasto]

    Submit --> RPC[create_expense_with_items RPC]
    RPC -->|éxito| Saved[Gasto + ítems guardados]
    RPC -->|falla| Rollback[Rollback - aviso error]
    Saved --> Home([Pantalla inicio])

    UpdatePath([Usuario edita gasto existente]) --> LoadItems[getExpense - select anidado]
    LoadItems --> FormEdit[ExpenseForm con ítems hidratados]
    FormEdit --> UpdateRPC[update_expense_with_items RPC]
    UpdateRPC -->|p_items null| PreserveItems[Ítems sin cambios]
    UpdateRPC -->|p_items array| DeleteReinsert[Delete-all + reinsert]
```

---

## 8. Pantallas involucradas

| Pantalla                                      | Rol en HU-18                                         |
| --------------------------------------------- | ---------------------------------------------------- |
| `app/(protected)/expense/review.tsx`          | Post-escaneo: OCR pre-llena `items` en el formulario |
| `app/(protected)/expense/new.tsx`             | Ingreso manual: sección Detalle colapsada y editable |
| `app/(protected)/expense/[id].tsx`            | Edición: hidrata ítems existentes; guarda via RPC    |
| `components/expenses/expense-items-field.tsx` | Sección "Detalle" — lista de renglones editable      |
| `components/expenses/expense-form.tsx`        | Monta `ExpenseItemsField`; pasa `prefill.items`      |

---

## 9. State matrix

| Estado                       | Trigger                                               | Visual en la sección Detalle                                                                          |
| ---------------------------- | ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| **Sin ítems, colapsado**     | No hay ítems en prefill ni en el gasto existente      | Encabezado "Detalle" con `ChevronRight`. Al presionar, expande la sección vacía.                      |
| **Con ítems, expandido**     | `prefill.items.length > 0` o ítems cargados del gasto | Encabezado "Detalle · N" con `ChevronDown`. Lista de N filas con nombre, cant., precio unit. y total. |
| **Ítem con error de nombre** | `name` vacío o sólo espacios al validar               | Borde rojo en el campo Nombre. Mensaje de error debajo: `Ingresá un nombre.`                          |
| **Aviso de diferencia**      | `                                                     | Σ line_total − amount                                                                                 | > 0.50` y al menos un ítem | Texto ámbar debajo de la lista: `La suma de los ítems ($ X) no coincide con el total ($ Y). Puede deberse a descuentos o propinas.` |
| **Sin aviso de diferencia**  | Lista vacía, o suma dentro del umbral                 | Sin aviso ámbar. La sección muestra sólo la lista (o vacía) y el botón "Agregar ítem".                |
| **Límite de ítems**          | `items.length >= 50`                                  | Botón "Agregar ítem" deshabilitado (`opacity: 0.4`).                                                  |
| **Deshabilitado**            | `disabled={true}` (ej. submit en curso)               | Todos los inputs y botones no editables.                                                              |

---

## 10. Criterios de aceptación

- [ ] La edge function devuelve `items: []` cuando el ticket no tiene renglones
      legibles; el flujo continúa sin errores.
- [ ] La edge function descarta ítems con nombre vacío o en blanco.
- [ ] La edge function limita el resultado a 50 ítems cuando el ticket tiene más.
- [ ] Un payload `items` fuera de especificación (no-array) produce `items: []`
      en el cliente sin romper el flujo.
- [ ] La sección "Detalle" se muestra auto-expandida cuando `prefill.items` tiene
      al menos un ítem; colapsada en caso contrario.
- [ ] Editar **Cant.** o **Precio unit.** recalcula **Total** cuando **Precio unit.**
      no es nulo.
- [ ] Editar **Total** directamente no se sobreescribe hasta la próxima edición de
      **Cant.** o **Precio unit.**
- [ ] El aviso de diferencia aparece cuando `|Σ Total de ítems − Monto| > 0,50` y
      desaparece cuando la lista está vacía o la diferencia ≤ 0,50.
- [ ] El aviso de diferencia no bloquea el guardado.
- [ ] `createExpense` con ítems es atómico: un error en cualquier ítem revierte
      el gasto completo.
- [ ] `updateExpense` con `items: []` explícito borra todos los ítems del gasto.
- [ ] `updateExpense` sin `items` en el payload deja los ítems del gasto
      intactos.
- [ ] Los gastos creados antes de esta feature (sin ítems) se muestran y editan
      correctamente (backward compat).
- [ ] Eliminar un gasto borra sus ítems (`on delete cascade`).
- [ ] Un usuario no puede leer ni insertar ítems de gastos de otro usuario
      (RLS owner-only).
- [ ] Todo el microcopy de la sección está en español rioplatense formal y sin
      emoji.

---

## 11. Notas técnicas

- **Tabla**: `public.expense_items` — columnas `id`, `expense_id`, `user_id`,
  `name`, `quantity numeric(14,3)`, `unit_price numeric(14,2)` (nullable),
  `line_total numeric(14,2)`, `position integer`, `created_at`, `updated_at`.
- **RLS**: cuatro políticas owner-only usando `(select auth.uid()) = user_id`
  (forma con subquery cacheada, igual que `expenses`). `user_id` lo inserta
  siempre la RPC desde `auth.uid()`, nunca el cliente.
- **RPCs**: `create_expense_with_items` y `update_expense_with_items` son
  `security invoker` con `set search_path = ''`. El parámetro `p_items null`
  en `update_expense_with_items` significa "no tocar ítems".
- **Update = delete-all + reinsert**: los ids de ítems cambian en cada
  guardado. No almacenar ids de ítems en estado del cliente entre ediciones.
- **Lectura**: `'*, category:categories(*), items:expense_items(*)'` — un
  único select anidado. Los ítems se ordenan por `position` en el cliente
  (función `normalizeItems` en `lib/repositories/expenses.ts`).
- **OCR → form**: `mapOcrItems()` en `lib/ocr.ts` normaliza de camelCase
  (`unitPrice`, `lineTotal`) a snake_case (`unit_price`, `line_total`).
- **Montos**: `line_total` se muestra con `font-variant-numeric: tabular-nums`
  y `formatMoney`. El campo de entrada acepta tanto punto como coma decimal.
- **Cantidades fraccionarias** (venta por peso): `numeric(14,3)` soporta
  hasta 3 decimales. Las diferencias de redondeo entre `qty × precio` y
  el total impreso se manifiestan como aviso de diferencia; el total impreso
  manda.
- **Valores negativos** (descuentos como renglón): rechazados por
  `check (line_total >= 0)` en la DB y `min(0)` en zod. El descuento
  aparece como diferencia entre la suma y el total; el aviso lo menciona
  explícitamente ("descuentos o propinas").
- **Migraciones**: `supabase/migrations/20260603152601_create_expense_items.sql`
  y `20260603152639_expense_items_rpc.sql` — aplicadas al remoto vía MCP
  `apply_migration`.
- **Tests**:
  - `lib/__tests__/ocr.test.ts` — `mapOcrItems` con todos los casos de edge
    (nombre vacío, lineTotal null, qty null, más de 50 ítems).
  - `lib/repositories/__tests__/expenses.test.ts` — create/update con y sin
    ítems, update preservando ítems.
  - `components/expenses/__tests__/expense-items-field.test.tsx` — agregar,
    quitar, recálculo, aviso de diferencia.
  - `app/(protected)/expense/__tests__/review.test.tsx` — prefill con ítems,
    sin ítems, payload off-spec.
