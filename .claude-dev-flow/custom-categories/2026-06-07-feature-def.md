# Feature: Categorías personalizadas (HU-16)

Date: 2026-06-07
Status: Approved (definition) — pending `/build`
Feature Branch: `feat/custom-categories`
Base Branch: `main`
Complexity: BAJO · MVP · Entrega 3

## Business Context

**Problem**: las 9 categorías de sistema no alcanzan para todo gasto. El usuario necesita crear las propias (p.ej. "Farmacia", "Mascotas") y que el OCR del ticket las contemple — y, si ninguna aplica, que la IA sugiera crear una.

**Target users**: las 3 personas de RADAR (estudiante, joven profesional, independiente multi-moneda) — taxonomía de gasto personal.

**Success metrics**: usuario puede crear/editar/borrar categorías propias; el picker y los gastos las muestran; el OCR matchea contra sistema+custom y sugiere nueva cuando no hay match.

**Priority**: feature de Entrega 3 (2026-06-01 ya pasó como Prototype v1; esto es iteración posterior). Complejidad BAJO.

## Decisiones del usuario (entrevista)

| Tema | Decisión |
|------|----------|
| Ícono + color | Set curado (~24 íconos Lucide + ~8 colores DS) |
| CRUD ubicación | Inline desde el picker + pantalla "Categorías" en Perfil |
| OCR sin match | IA sugiere nombre → CTA "Crear categoría 'X'" con confirmación manual |
| Borrar con gastos | Gastos quedan sin categoría (`category_id → null`) |

## Functional Requirements

### User stories
1. Como usuario, quiero crear una categoría con nombre/ícono/color para clasificar gastos que no encajan en las de sistema.
   - Aceptación: aparece en el picker y persiste; nombre 1–40 chars; ícono del set curado; color de la paleta.
2. Como usuario, quiero editar/borrar mis categorías desde Perfil.
   - Aceptación: editar actualiza nombre/ícono/color; borrar pide confirmación y deja sus gastos sin categoría.
3. Como usuario, quiero crear una categoría sin salir del alta de gasto (inline desde el picker).
   - Aceptación: "+ Categoría" abre sheet; al crear queda seleccionada en el form.
4. Como usuario, al escanear un ticket quiero que la IA considere mis categorías y, si ninguna aplica, me sugiera crear una.
   - Aceptación: OCR recibe nombres sistema+custom; matchea; si no hay match y hay sugerencia, el review muestra CTA "Crear categoría '<nombre>'".

### Comportamiento detallado
- Categoría de sistema = `user_id null` (read-only para el usuario). Personalizada = `user_id = auth.uid()` (CRUD propio).
- Slug autogenerado desde el nombre (repo); único por usuario → impide nombres duplicados.
- Listado: sistema (sort_order 10–99) primero, custom (sort_order 100) luego, desempate por nombre.

## Non-Functional

- **Seguridad/RLS**: SELECT `user_id is null or auth.uid()=user_id`; INSERT/UPDATE/DELETE solo propias. Reemplaza el `select using(true)` actual (que con la nueva columna expondría categorías ajenas).
- **Performance**: índice en `user_id`; `listCategories` cacheado 1h (ya existente), invalidado en mutaciones.
- **Sin RPC**: CRUD de una sola tabla, insert/update/delete directos bajo RLS.
- **Edge function**: timeout 20s sin cambio; `categories` opcional con fallback a las 9 de sistema (backward compat).

## Edge cases — ver `2026-06-07-edge-cases.md`

## Acceptance criteria (testables)

- [ ] `createCategorySchema` rechaza nombre vacío/>40, ícono/color fuera del set.
- [ ] `createCategory` setea `user_id`, `slug` generado, `sort_order=100`; error `23505` → "Ya tenés una categoría con ese nombre.".
- [ ] RLS: usuario B no ve categoría custom de A (MCP `execute_sql`).
- [ ] Borrar categoría custom → `expenses.category_id` de sus gastos queda null.
- [ ] OCR: edge fn devuelve `suggestedNewCategory` cuando ninguna categoría de la lista aplica; null cuando alguna matchea.
- [ ] `mapOcrToPrefill` setea `suggestedCategoryName` solo cuando `category_id` es null.
- [ ] Review muestra CTA de sugerencia; al crear, asigna `category_id` al form.
- [ ] Picker tiene chip "+ Categoría" que abre el sheet y selecciona la nueva.
- [ ] Pantalla Perfil → Categorías lista/edita/borra (con confirm).
- [ ] Gates verdes en cada atomic; AGENTS.md actualizado.

## Out of scope (explícito)

- Compartir categorías en grupos (HU de shared/groups futura).
- Reordenar categorías (drag) / sort_order configurable por usuario.
- Búsqueda libre en las ~1500 Lucide / color picker libre (se eligió set curado).
- Auto-creación silenciosa por OCR (se eligió confirmación manual).
- Migrar `expense_items`/identidad estable (no aplica).

## Implementation plan — atomic changes

Branches `feat/custom-categories-<x>` (sufijo guión por límite git), PRs → `feat/custom-categories` → `main`.

1. `-schema` — migración alter `categories` + MCP apply + advisors + types.
2. `-data-layer` — `category-options.ts`, `schemas/category.ts`, `repositories/categories.ts`, hooks, order de `listCategories`.
3. `-edge-function` — edge fn (lista dinámica + `suggestedNewCategory`) + deploy; `ocr.ts` schema + `lib/ocr.ts`.
4. `-category-ui` — icon/color picker, `category-form.tsx`, picker "+ Categoría", pantalla Perfil.
5. `-ocr-wiring` — review CTA sugerencia + pasar nombres a `extractReceipt`.
6. `-docs` — feature doc, ADR, user-flow HU-16 (+ Obsidian mirror), AGENTS.md.

### Dependency graph
```
1 → 2 → 4 ┐
1 → 3 ────┼→ 5 → 6
          ┘
```

## Git workflow summary

- Global: `feat/custom-categories` desde `main`.
- Atomics: `feat/custom-categories-<x>` (guión).
- PRs: atomic → `feat/custom-categories`; final → `main`.
- Conventional Commits + firma Skater Elephant.
