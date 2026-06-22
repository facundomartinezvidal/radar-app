# HU-29 — Recomendaciones de gastos por WhatsApp

## 1. Identificación

| Campo            | Valor                                                                                           |
| ---------------- | ----------------------------------------------------------------------------------------------- |
| **ID**           | HU-29                                                                                           |
| **Historia**     | Recibir recomendaciones de gastos desde el bot de WhatsApp                                      |
| **Persona**      | Usuario con número vinculado y al menos algunos movimientos registrados                         |
| **Estado**       | MVP                                                                                             |
| **Relevancia**   | Media                                                                                           |
| **Release**      | Entrega 4                                                                                       |
| **Trazabilidad** | `feat/whatsapp-bot` — `recommendations.ts`, `generate-insights` edge fn (s2s), read `_for` RPCs |

## 2. Historia

> **Como** usuario con número de WhatsApp vinculado,
> **quiero** pedir recomendaciones de gastos al bot,
> **para** obtener un análisis rápido de mis hábitos sin abrir la app.

## 3. Pre-condiciones

- El número del usuario está vinculado.
- El usuario tiene al menos algunos movimientos registrados para que las recomendaciones sean útiles.
- `generate-insights` está desplegado y `GROQ_API_KEY` configurado.

## 4. Post-condiciones

- El bot responde con 1–3 insights en formato legible para WhatsApp.
- Si no hay datos suficientes, responde con un mensaje amigable.
- En caso de fallo del servicio, responde con un error amigable sin crashear.

## 5. Flujo principal

1. El usuario envía: _"¿cómo vengo este mes?"_ o _"dame un consejo de gastos"_.
2. `classifyIntent` → intent `recommendation`, confidence ≥ 0.4.
3. `handleRecommendation` resuelve el período (default: mes actual) y moneda (default: ARS).
4. Reúne 5 llamadas RPC en paralelo:
   - `get_personal_totals_for(userId, from, to)` → totales gasto/ingreso/neto
   - `get_expense_by_category_for(userId, currency, from, to)` → desglose por categoría + %
   - `get_expense_by_period_for(userId, currency, 'month', from, to)` → tendencia gastos
   - `get_income_by_period_for(userId, currency, 'month', from, to)` → tendencia ingresos
   - `get_personal_totals_for(userId, prevFrom, prevTo)` → mes anterior (para comparar)
5. `buildInsightsPayload` ensambla los datos en el formato de `generate-insights`.
6. Guard de datos insuficientes: si `totals.expenses == 0 && totals.incomes == 0` → responde _"Todavía no tengo suficientes datos…"_
7. POST a `generate-insights` con `Authorization: Bearer <service_role_key>` + `x-whatsapp-internal-secret` (timeout 20 s).
8. Bot formatea los top 1–3 insights como bloques `*título*\ncuerpo` separados por línea en blanco.

## 6. Flujos alternativos

### 6.a — Datos insuficientes

- `totals.expenses` y `totals.incomes` son ambos 0.
- Bot: _"Todavía no tengo suficientes datos de este período para darte recomendaciones. Registrá algunos gastos y volvé a preguntarme."_

### 6.b — `generate-insights` vacío

- El servicio responde con `insights: []` (el modelo no encontró nada destacable).
- Bot: mismo mensaje de "no tengo suficientes datos".

### 6.c — `generate-insights` timeout o error de red

- El fetch supera los 20 s o lanza error.
- Bot: _"No pude generar recomendaciones ahora, probá más tarde."_
- El bot no crashea; la conversación puede continuar.

### 6.d — Error en algún RPC de agregación

- Uno o más de los 5 RPCs falla.
- `Promise.all` lanza; catch interno → bot: _"No pude consultar tus datos ahora, probá más tarde."_

### 6.e — Número no vinculado

- `resolve_wa_user` devuelve NULL.
- Bot: mensaje de vinculación. No se ejecuta ninguna llamada de datos.

### 6.f — Moneda USD explícita

- Mensaje: _"dame recomendaciones en dólares"_.
- `entities.currency = 'USD'`.
- Todas las RPCs y el payload de insights usan `currency: 'USD'`.

## 7. Diagrama

```mermaid
flowchart TD
    WA([Usuario: dame un consejo]) --> Classify[classifyIntent\nrecommendation]
    Classify -->|low confidence| Help[Mensaje de ayuda]
    Classify -->|OK| Resolve[resolvePeriod + resolvePrevPeriod]
    Resolve --> ParallelRPCs["5 RPCs en paralelo\n(Promise.all)"]
    ParallelRPCs -->|error| RPCErr[No pude consultar tus datos]
    ParallelRPCs -->|OK| BuildPayload[buildInsightsPayload]
    BuildPayload --> NoData{totals.expenses + incomes == 0?}
    NoData -->|sí| NoDataReply[No tengo suficientes datos]
    NoData -->|no| CallInsights[generate-insights edge fn\nservice-role s2s\ntimeout 20s]
    CallInsights -->|timeout/error| InsightsErr[No pude generar recomendaciones]
    CallInsights -->|insights: []| NoDataReply
    CallInsights -->|insights 1-N| Format[formatInsightsReply\ntop 1-3 insights]
    Format --> Reply[Respuesta con *título* + cuerpo]
```

## 8. Componentes / archivos

| Componente / archivo              | Ruta                                                     | Rol                                                                  |
| --------------------------------- | -------------------------------------------------------- | -------------------------------------------------------------------- |
| Handler de recomendaciones        | `supabase/functions/whatsapp-webhook/recommendations.ts` | `handleRecommendation`, `buildInsightsPayload`, `isInsufficientData` |
| Clasificador de intent            | `supabase/functions/whatsapp-webhook/classify.ts`        | Intent `recommendation`; `queryPeriod` y `currency` en entities      |
| `get_personal_totals_for` RPC     | `20260622010559_whatsapp_service_rpcs.sql`               | DEFINER Pattern 1; período actual + período anterior                 |
| `get_expense_by_category_for` RPC | `20260622010559_whatsapp_service_rpcs.sql`               | DEFINER Pattern 1; byCategory con %                                  |
| `get_expense_by_period_for` RPC   | `20260622010559_whatsapp_service_rpcs.sql`               | DEFINER Pattern 1; tendencia gastos                                  |
| `get_income_by_period_for` RPC    | `20260622010559_whatsapp_service_rpcs.sql`               | DEFINER Pattern 1; tendencia ingresos                                |
| `generate-insights` (reusado)     | `supabase/functions/generate-insights/index.ts`          | Ahora acepta service-role bypass para s2s                            |

## 9. Criterios de aceptación

- [ ] _"dame un consejo de gastos"_ genera una respuesta con 1–3 insights.
- [ ] Con datos insuficientes el bot responde amigablemente sin error.
- [ ] Un fallo de `generate-insights` devuelve mensaje amigable sin crashear.
- [ ] Los valores de los insights coinciden con los que muestra la pantalla de Insights de la app.
- [ ] Un número no vinculado recibe el prompt de vinculación.

## 10. Notas técnicas

- **`buildInsightsPayload`**: exportado para testing unitario. Los `numeric` de Postgres llegan como strings en algunos casos — se aplica `Number()` a todos los valores antes de pasarlos.
- **Período anterior**: siempre se resuelve como el mes calendario anterior al período actual (no una ventana rodante).
- **`generate-insights` bypass**: igual al de HU-27 (`Authorization: Bearer <service_role_key>` + `x-whatsapp-internal-secret`).
- **Top 1–3 insights**: el handler pasa `insights.slice(0, 3)` — el modelo puede devolver más, pero el bot sólo muestra los primeros tres para no saturar el chat.

## 11. Documentos relacionados

- [Feature doc](../features/whatsapp-bot.md)
- [ADR: schema y RPCs](../decisions/2026-06-21-whatsapp-bot-schema.md)
- [OpenSpec spec](../../openspec/changes/whatsapp-bot/specs/whatsapp-recommendations/spec.md)
- [Insights feature](../features/insights.md) (generate-insights base)
- [HU-23 / HU-24](HU-23-filtros-temporales-insights.md)
