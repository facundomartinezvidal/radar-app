# HU-28 — Consultar movimientos por WhatsApp

## 1. Identificación

| Campo            | Valor                                                                                              |
| ---------------- | -------------------------------------------------------------------------------------------------- |
| **ID**           | HU-28                                                                                              |
| **Historia**     | Consultar gastos y movimientos por WhatsApp en lenguaje natural                                    |
| **Persona**      | Usuario con número vinculado                                                                       |
| **Estado**       | MVP                                                                                                |
| **Relevancia**   | Media                                                                                              |
| **Release**      | Entrega 4                                                                                          |
| **Trazabilidad** | `feat/whatsapp-bot` — `queries.ts`, `get_personal_totals_for` / `get_expense_by_category_for` RPCs |

## 2. Historia

> **Como** usuario con número de WhatsApp vinculado,
> **quiero** preguntarle al bot cuánto gasté o en qué gasté,
> **para** obtener un resumen de mis movimientos sin abrir la app.

## 3. Pre-condiciones

- El número del usuario está vinculado.
- Las queries son de solo lectura; no requieren confirmación.

## 4. Post-condiciones

- El bot responde con los totales o el desglose por categoría para el período indicado.
- Si no hay movimientos en el período, responde amigablemente sin errores.

## 5. Flujo principal — total del período

1. El usuario envía: _"¿cuánto gasté este mes?"_
2. `classifyIntent` → intent `query`, `entities.queryPeriod = 'month'`.
3. `handleQuery` → `resolvePeriod('month', now())`:
   - `from`: primer día del mes 00:00:00.000Z
   - `to`: último día del mes 23:59:59.999Z
4. No hay `queryCategory` → llama a `get_personal_totals_for(userId, from, to)`.
5. La respuesta es share-aware: para gastos compartidos se cuenta sólo la porción del usuario.
6. Bot responde:
   > _"Gastos — Este mes:_
   > _ARS: $ 45.000,00 (12 mov.)_
   > _USD: USD 120,00 (2 mov.)"_

## 6. Flujos alternativos

### 6.a — Desglose por categoría

- Mensaje: _"¿en qué gasté esta semana?"_
- `entities.queryCategory` presente (o intent `query` con señal de categorías) → `get_expense_by_category_for(userId, currency, from, to)`.
- Bot responde las top 5 categorías + "Otros" rollup + total:
  > _"Gastos por categoría (ARS) — Esta semana:_
  > _• Supermercado: $ 12.000,00_
  > _• Restaurante: $ 8.500,00_
  > _• Transporte: $ 3.200,00_
  > **_Total: $ 23.700,00_**"

### 6.b — Período personalizado

- Mensaje: _"¿qué gasté del 1 al 15 de junio?"_
- `entities.queryPeriod = {from: '2026-06-01', to: '2026-06-15'}`.
- `resolvePeriod` devuelve `label: "Del 06/01 al 06/15:"`.

### 6.c — Período sin movimientos

- El RPC devuelve 0 filas.
- Bot: _"No tenés movimientos en ese período."_

### 6.d — Número no vinculado

- `resolve_wa_user` devuelve NULL.
- Bot: mensaje de vinculación. No se ejecuta ninguna query.

### 6.e — Error de RPC

- El RPC falla (error interno de Postgres).
- Bot: _"No pude consultar tus movimientos ahora, probá de nuevo."_

## 7. Períodos soportados

| `queryPeriod` | Resolución                                        | Label en respuesta    |
| ------------- | ------------------------------------------------- | --------------------- |
| `today`       | Hoy 00:00 → 23:59:59                              | `Hoy:`                |
| `week`        | Lunes 00:00 de la semana ISO actual → fin del día | `Esta semana:`        |
| `month`       | Primer día del mes → último día del mes           | `Este mes:`           |
| `prev_month`  | Primer y último día del mes anterior              | `Mes pasado:`         |
| `year`        | 1/1 → 31/12 del año actual                        | `Este año:`           |
| `{from, to}`  | Rango personalizado                               | `Del MM/DD al MM/DD:` |
| `undefined`   | Default: mes actual                               | `Este mes:`           |

La aritmética es UTC. Argentina (UTC-3) puede diferir hasta 3 horas en el primer/último día del período — aceptable para el prototipo.

## 8. Componentes / archivos

| Componente / archivo              | Ruta                                              | Rol                                                        |
| --------------------------------- | ------------------------------------------------- | ---------------------------------------------------------- |
| Handler de queries                | `supabase/functions/whatsapp-webhook/queries.ts`  | `handleQuery`, `resolvePeriod`, `formatAmount`             |
| Clasificador de intent            | `supabase/functions/whatsapp-webhook/classify.ts` | `queryPeriod` + `queryCategory` en entities                |
| `get_personal_totals_for` RPC     | `20260622010559_whatsapp_service_rpcs.sql`        | DEFINER Pattern 1; share-aware; totales por moneda         |
| `get_expense_by_category_for` RPC | `20260622010559_whatsapp_service_rpcs.sql`        | DEFINER Pattern 1; top categorías ordenadas por total DESC |

## 9. Criterios de aceptación

- [ ] _"¿cuánto gasté este mes?"_ devuelve totales por moneda para el mes actual.
- [ ] _"¿en qué gasté esta semana?"_ devuelve top 5 categorías + total.
- [ ] Los valores coinciden con los que muestra la app (share-aware).
- [ ] Un período sin movimientos devuelve mensaje amigable, no error.
- [ ] Un número no vinculado recibe el prompt de vinculación.
- [ ] Los RPCs no son ejecutables por `authenticated`.

## 10. Notas técnicas

- **Formato de moneda**: ARS → `$ 12.345,67`; USD → `USD 1.234,56` (locale argentino, separador de miles con punto, decimales con coma).
- **Share-aware CASE**: el CASE de `get_expense_by_category_for` es idéntico al de `get_expense_by_category`; sólo se reemplaza `auth.uid()` por `p_user_id`.
- **Top N = 5 categorías**: las categorías restantes se agrupan como "Otros".
- **Moneda en by-category**: default `ARS` cuando no se especifica.

## 11. Documentos relacionados

- [Feature doc](../features/whatsapp-bot.md)
- [ADR: schema y RPCs](../decisions/2026-06-21-whatsapp-bot-schema.md)
- [OpenSpec spec](../../openspec/changes/whatsapp-bot/specs/whatsapp-queries/spec.md)
- [Insights RPCs INVOKER](../decisions/2026-06-20-insights-aggregation-rpcs.md)
