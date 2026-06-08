# Open Questions: Gastos compartidos (HU-17)

Date: 2026-06-07

## Resueltas en la entrevista

| Pregunta | Decisión |
|----------|----------|
| ¿Cómo se agrega un NO registrado? | Placeholder solo-nombre (sin contacto/invitación) |
| ¿Cómo se agrega un registrado? | Invitar por correo exacto → `pending` → aceptar/rechazar (consentimiento, el más seguro) |
| ¿Método de división? | Iguales + montos custom + porcentaje |
| ¿Alcance de liquidación? | Balances "quién le debe a quién" + marcar saldado (sin push) |
| ¿Cómo se captura el gasto? | Reusar `ExpenseForm` completo + grupo + quién pagó + split |
| Anti-abuso de balances | Resuelto por el modelo de consentimiento: un registrado solo entra al balance tras aceptar |

## Decididas por defecto (documentadas, no requieren al usuario)

1. **Grupos = stack, no tab nuevo**: se accede desde el quick-action "Grupos" y la sección "Mis grupos" del Home. Mantiene el tab bar en 4. Revisable si se quiere jerarquía de tab.
2. **Reusar `expenses` + `group_id`** en vez de tabla de gastos aparte (OCR/ítems/categoría gratis). RLS de select extendida a miembros.
3. **`is_group_member` SECURITY DEFINER** para romper recursión RLS (patrón estándar Supabase).
4. **Íconos/colores de grupo** reusan `CATEGORY_ICONS`/`CATEGORY_COLORS` (lucide + paleta DS, sin emoji aunque el brief mostraba emojis).
5. **Balances por moneda** (ARS/USD separados, sin conversión) — no hay fuente FX definida aún (pendiente global del proyecto).
6. **Re-split de un gasto existente**: MVP no edita splits; se borra y recrea. Identidad de splits no estable (aceptable).

## Pendientes para futuras HU (no bloquean)

- Recordatorios push ("Recordar a X") → requiere tabla `device_tokens` + wiring push.
- Vincular placeholder ↔ cuenta cuando esa persona se registra (por correo).
- Tope anti-spam de invitaciones pendientes por usuario (el usuario lo mencionó como opción; no elegido para MVP).
- Saldado parcial validado (≤ deuda) y "saldar todo" en un paso.
- Roles/permisos finos (admin, etc.).
- Edición de gasto compartido con re-split estable (si una HU de AI insights necesita identidad por split).
