# Edge Cases: Categorías personalizadas (HU-16)

Date: 2026-06-07

## Data

### Nombre duplicado por usuario
- **Trigger**: crear/editar a un nombre que ya tiene el usuario → mismo slug → unique index `categories_slug_user_unique`.
- **Esperado**: error `23505` mapeado a "Ya tenés una categoría con ese nombre." (no crash).
- **Test**: repo mock devuelve 23505.

### Colisión de slug entre usuarios distintos
- **Trigger**: usuario A y B crean "Farmacia" → mismo slug `custom-farmacia`.
- **Esperado**: permitido — el unique es parcial por usuario, no global. La constraint global vieja se dropea en la migración.

### Nombre con tildes / emoji / solo espacios
- **Trigger**: "Almacén", "  ", "🐶".
- **Esperado**: trim; vacío post-trim → rechazo zod ("Ingresá un nombre."); slug normaliza tildes vía `normalizeName`. >40 chars → rechazo.

### Categoría de sistema editada/borrada por usuario
- **Trigger**: intento UPDATE/DELETE sobre fila `user_id null`.
- **Esperado**: RLS lo bloquea (policies own-only). UI no ofrece editar/borrar sistema.

### Borrar categoría con muchos gastos asociados
- **Trigger**: delete de custom con N gastos.
- **Esperado**: FK `on delete set null` → todos esos gastos quedan `category_id null` (sin categoría); listas/totales siguen funcionando. Invalidar `expenseKeys.all`.

## OCR / IA

### `categories` vacío o ausente en el body
- **Trigger**: cliente viejo o lista vacía.
- **Esperado**: edge fn usa fallback (9 nombres de sistema). Backward compat.

### IA sugiere un nombre que YA existe (sistema o custom)
- **Trigger**: `suggestedNewCategory = "Comida"` pese a estar en la lista.
- **Esperado**: `matchCategory` debe haber matcheado antes; si igual llega sugerencia y hay match, no se muestra CTA (solo cuando `category_id === null`). Si la sugerencia coincide con una existente por normalización, el CTA crearía duplicado → al confirmar, el unique lo frena con mensaje claro.

### IA devuelve sugerencia larga / con símbolos
- **Trigger**: `suggestedNewCategory = "Productos de farmacia y perfumería varios"`.
- **Esperado**: edge fn trunca ≤40 y trimea; el form igual valida 40.

### Match y sugerencia ambos presentes
- **Esperado**: gana el match (`category_id` seteado); `suggestedCategoryName` no se setea.

### Ticket no es ticket / OCR falla
- **Esperado**: comportamiento actual sin cambios (todos null, confidence 0, sin sugerencia).

## UI / flujo

### Crear inline durante alta y luego cancelar el gasto
- **Trigger**: usuario crea categoría en el sheet, después descarta el gasto.
- **Esperado**: la categoría queda creada (es entidad propia, no atada al gasto). Aceptable.

### Crear inline sin conexión
- **Trigger**: offline al confirmar creación.
- **Esperado**: error de red → mensaje "No se pudo guardar la categoría. Intentá nuevamente."; el sheet no cierra; sin selección.

### Lista de categorías larga (muchas custom)
- **Esperado**: picker scroll horizontal (ya soportado); pantalla Perfil scroll vertical.

### Ícono custom inválido en render
- **Trigger**: fila con `icon` que no resuelve en Lucide (no debería pasar por el enum, pero datos legacy).
- **Esperado**: `<Icon>` ya retorna null para nombres inválidos; fallback visual neutro.

## Concurrencia

### Dos dispositivos editan la misma categoría
- **Esperado**: last-write-wins (update directo). Sin locking — aceptable para MVP.

### Borrar categoría seleccionada en un form abierto en otro lado
- **Esperado**: al refetch, el picker no la muestra; el form con `category_id` colgado → al guardar, FK set null o validación; aceptable, edge raro.
