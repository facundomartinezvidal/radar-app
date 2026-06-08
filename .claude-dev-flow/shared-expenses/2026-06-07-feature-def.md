# Feature: Gastos compartidos (HU-17)

Date: 2026-06-07
Status: Approved (definition) — pending `/build`
Feature Branch: `feat/shared-expenses`
Base Branch: `main`
Complexity: MEDIO · MVP · Entrega 3

## Business Context

**Problem**: jóvenes en Argentina dividen gastos (alquiler, super, viajes) por WhatsApp → sin visibilidad, deudas que se arrastran. RADAR debe permitir crear **grupos**, registrar **gastos compartidos**, calcular **quién le debe a quién** y **saldar**. Segundo pilar de valor (diferenciador clave vs Splitwise).

**Target users**: el estudiante (comparte depto), el joven profesional (salidas/viajes), el independiente. Personas centrales de RADAR.

**Success metrics**: el usuario crea grupos, suma miembros registrados (con consentimiento) y no registrados (placeholders), registra un gasto compartido con división (iguales/custom/%), ve balances correctos y puede marcar deudas saldadas.

**Priority**: feature de Entrega 3. Complejidad MEDIO.

## Decisiones del usuario (entrevista)

| Tema | Decisión |
|------|----------|
| Miembro NO registrado | Placeholder solo-nombre (sin contacto, sin invitación), owned por el creador |
| Miembro registrado | Invitar por correo exacto → invitación `pending` → el invitado **acepta/rechaza** in-app (modelo de consentimiento, el más seguro) |
| División | Partes iguales **+ montos custom + porcentaje** |
| Liquidación | Balances "quién le debe a quién" **+ marcar saldado** (sin recordatorios push) |
| Captura del gasto | Reusar el `ExpenseForm` completo (OCR/ítems/categoría/moneda) + grupo + quién pagó + split |

**Racional de seguridad (preocupación del usuario):** "que un usuario no cree muchos compartidos y modifique de forma negativa el balance de otro" → un registrado solo entra en splits/balance **después de aceptar**. Nadie carga deuda sin consentimiento. Placeholders no tienen cuenta que dañar.

## Functional Requirements

### User stories
1. Como usuario quiero crear un grupo (nombre/ícono/color) para juntar gastos compartidos.
   - Aceptación: el grupo aparece en "Mis grupos"; el creador queda `owner/active`.
2. Como usuario quiero sumar miembros no registrados por nombre (placeholder).
   - Aceptación: el placeholder participa en splits y balance; no tiene `user_id`.
3. Como usuario quiero invitar a un usuario registrado por correo exacto.
   - Aceptación: el invitado nace `pending`, ve la invitación in-app y acepta/rechaza; solo al aceptar pasa a `active` y entra en splits/balance.
4. Como usuario quiero registrar un gasto compartido y elegir quién pagó y cómo se divide (iguales/custom/%).
   - Aceptación: `Σsplits == monto`; el gasto reusa el form completo (monto/moneda/categoría/fecha/ítems/OCR); se guarda con `group_id`, `paid_by_member_id` y filas `expense_splits`.
5. Como miembro quiero ver "quién le debe a quién" y mi situación.
   - Aceptación: balances netos por miembro y por moneda; pairwise simplificado (greedy); verde "te deben" / rojo "debés" / neutro "al día".
6. Como miembro quiero marcar una deuda como saldada.
   - Aceptación: se registra un `group_settlement` que ajusta los balances.

### Comportamiento detallado
- `group_members.status` = `active` | `pending` | `declined`. Solo `active` participa en splits/balance.
- Placeholder = `user_id null`, `status active`. Registrado invitado = `pending` hasta aceptar.
- Gasto compartido = `expenses` con `group_id` + `paid_by_member_id` + `expense_splits`. Lectura para miembros del grupo (RLS extendida); insert/update/delete del creador.

## Non-Functional

- **Seguridad/RLS**: `is_group_member()` SECURITY DEFINER rompe recursión y centraliza el chequeo. `invite_group_member()` DEFINER hace el lookup en `auth.users` por correo (clientes no pueden leerla). REVOKE EXECUTE de anon/public en funciones DEFINER. RLS de `expenses` select extendida a miembros del grupo.
- **Integridad**: RPC `create_shared_expense` valida `Σshare == amount` (tolerancia 0.01) y pertenencia de `paid_by`/`member_id` al grupo. Escrituras multi-fila atómicas (patrón `create_expense_with_items`).
- **Performance**: índices en `group_id`, `user_id`, `expense_id`. Balances vía RPC agregada.
- **Backward-compat**: el flujo de gasto personal queda intacto (las nuevas columnas son nullable; `ExpenseForm` sin grupo no cambia).

## Edge cases — ver `2026-06-07-edge-cases.md`

## Acceptance criteria (testables)

- [ ] `computeShares` divide iguales (remainder al último), valida custom (suma==total), percent (suma==100 → montos).
- [ ] `simplifyDebts` produce pares correctos, netea, separa por moneda.
- [ ] `create_group` deja al caller `owner/active` + placeholders `active`.
- [ ] `invite_group_member` → `pending` si existe el correo; `not_found`/`already_member` en su caso; no expone otros usuarios.
- [ ] `respond_group_invite(accept)` solo lo hace el invitado; aceptar → `active`+`joined_at`.
- [ ] RLS: B no ve grupo/gastos de A hasta aceptar; C ajeno no ve nada.
- [ ] `create_shared_expense` rechaza `Σsplits != amount`; guarda expense+items+splits.
- [ ] `get_group_balances` neto = paid - share + settle_in - settle_out, por moneda.
- [ ] `create_settlement` ajusta balances.
- [ ] UI: crear grupo, agregar placeholder, invitar, registrar gasto compartido (quién pagó + split), tab Saldos, Saldar, aceptar invitación.
- [ ] Gates verdes en cada atomic; AGENTS.md actualizado.

## Out of scope (explícito)

- Recordatorios push ("Recordar") — requiere `device_tokens` + wiring push (HU futura).
- Vincular automáticamente un placeholder a una cuenta cuando esa persona se registra.
- Editar splits de un gasto ya creado (re-split) — MVP crea, borra y recrea.
- Roles avanzados / permisos finos más allá de owner vs member.
- Multi-moneda mezclada en un mismo split (cada gasto es de una moneda).

## Implementation plan — atomic changes

Branches `feat/shared-expenses-<x>` (sufijo guión por límite git), PRs → `feat/shared-expenses` → `main`.

1. `-schema` — migración 1 (tablas + columnas en expenses + `is_group_member` + RLS), apply MCP, advisors, regen types, smoke RLS.
2. `-rpcs` — migración 2 (RPCs), apply MCP, advisors, regen types, smoke por RPC.
3. `-data-layer` — `schemas/group.ts`, `split-math.ts` (+tests), `repositories/groups.ts` + `shared-expenses.ts`, `hooks/use-groups.ts`.
4. `-groups-crud-ui` — `components/groups/*` base + pantallas `groups/index|new|[id]` (tab Gastos) + Home wiring.
5. `-shared-expense` — `ExpenseForm` extendido (quién pagó + `SplitEditor`) + `createSharedExpense` + entrada desde `[id]`.
6. `-balances-settlement` — tab Saldos (`simplifyDebts` + balances) + flujo Saldar.
7. `-invites` — inbox invitaciones (aceptar/rechazar) + invitar por correo UI + badge.
8. `-docs` — HU-17 doc (+ Obsidian mirror), ADR, AGENTS.md, baseline tests.

### Dependency graph
```
1 → 2 → 3 ┬→ 4 ┬→ 5
          │    ├→ 6
          │    └→ 7
          └────────→ 8 (tras 1–7)
```

## Git workflow summary

- Global: `feat/shared-expenses` desde `main`.
- Atomics: `feat/shared-expenses-<x>` (guión).
- PRs: atomic → `feat/shared-expenses`; final → `main`.
- Conventional Commits + firma Skater Elephant.
