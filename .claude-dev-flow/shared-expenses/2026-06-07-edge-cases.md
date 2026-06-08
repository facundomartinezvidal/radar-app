# Edge Cases: Gastos compartidos (HU-17)

Date: 2026-06-07

## Consentimiento / membership

### Invitar a un correo inexistente
- **Trigger**: `invite_group_member` con correo sin cuenta.
- **Esperado**: devuelve `{status:'not_found'}`; no crea fila; UI sugiere agregar como placeholder.
- **Prioridad**: P1.

### Invitar a alguien ya miembro
- **Trigger**: correo ya `active`/`pending` en el grupo.
- **Esperado**: `{status:'already_member'}`; no duplica (unique `(group_id,user_id)`).
- **Prioridad**: P1.

### Invitado rechaza y luego es re-invitado
- **Trigger**: `declined` → vuelven a invitar.
- **Esperado**: la fila `declined` puede pasar a `pending` de nuevo (update por owner) — no romper unique.
- **Prioridad**: P2.

### Tercero ajeno intenta ver/editar el grupo
- **Trigger**: usuario C sin membership consulta grupo/gastos/balances.
- **Esperado**: RLS niega (no filas). `is_group_member` false.
- **Prioridad**: P0 (seguridad).

### Invitado `pending` intenta leer gastos del grupo
- **Trigger**: B invitado pero no aceptó, consulta `expenses`/`expense_splits`.
- **Esperado**: NO ve gastos (RLS usa `status='active'`); sí ve su propia fila `group_members` pending para poder aceptar.
- **Prioridad**: P0.

### Otro responde una invitación que no es suya
- **Trigger**: `respond_group_invite(p_member_id)` con member de otro user.
- **Esperado**: RPC no hace nada (filtra `user_id = auth.uid()` y `status='pending'`).
- **Prioridad**: P0.

## Split / montos

### Σsplits ≠ monto del gasto
- **Trigger**: cliente manda splits que no suman el total.
- **Esperado**: RPC rechaza (tolerancia 0.01). UI bloquea submit y muestra el delta.
- **Prioridad**: P0 (integridad).

### División igual con remainder (no divisible)
- **Trigger**: $100 / 3 miembros.
- **Esperado**: 33.34 / 33.33 / 33.33 (remainder al último, Σ==100). `computeShares` testeado.
- **Prioridad**: P1.

### Porcentajes que no suman 100
- **Trigger**: percent entries suman 90 o 110.
- **Esperado**: validación rechaza antes de submit.
- **Prioridad**: P1.

### Miembro con share 0
- **Trigger**: custom asigna 0 a un miembro.
- **Esperado**: permitido (≥0); ese miembro no debe nada por ese gasto.
- **Prioridad**: P2.

### paid_by_member que no pertenece al grupo
- **Trigger**: `p_paid_by_member_id` de otro grupo.
- **Esperado**: RPC rechaza.
- **Prioridad**: P0.

### Gasto con un solo miembro activo
- **Trigger**: grupo recién creado, solo el owner.
- **Esperado**: split trivial (100% al owner) — balance neto 0; permitir o avisar "agregá miembros".
- **Prioridad**: P2.

## Balances / settlement

### Saldar más de lo que se debe
- **Trigger**: settlement con monto > deuda.
- **Esperado**: MVP registra el monto igual (puede dejar saldo a favor); documentar. Idealmente validar ≤ deuda.
- **Prioridad**: P2.

### Balances multi-moneda
- **Trigger**: gastos ARS y USD en el mismo grupo.
- **Esperado**: balances y "quién debe a quién" separados por moneda (no se mezclan ni convierten).
- **Prioridad**: P1.

### Borrar grupo con gastos
- **Trigger**: owner borra grupo.
- **Esperado**: cascade borra members/splits/settlements; `expenses.group_id` → set null (el gasto del creador sobrevive como personal). Confirmar UX.
- **Prioridad**: P1.

### Borrar un miembro con deudas/gastos
- **Trigger**: owner saca a un miembro que pagó o debe.
- **Esperado**: cascade en splits/settlements de ese member; recalcular balances. Avisar que se pierde su historial de saldo. Posible restricción si tiene saldo abierto.
- **Prioridad**: P2.

## Datos / UI

### Nombre de grupo vacío o >60
- **Esperado**: check DB + zod rechazan (1–60).
- **Prioridad**: P1.

### Placeholder con nombre duplicado
- **Trigger**: dos placeholders "Juan".
- **Esperado**: permitido (no hay unique en display_name); se distinguen por id/avatar.
- **Prioridad**: P3.

### Lista de grupos vacía
- **Esperado**: empty state "No hay grupos." + CTA crear (copy DS, sin humor).
- **Prioridad**: P2.

### Sección "Mis grupos" en Home hoy hardcodeada
- **Trigger**: wiring a datos reales.
- **Esperado**: si no hay grupos, ocultar o mostrar CTA; si hay, chips con balance real.
- **Prioridad**: P1.
