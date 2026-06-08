# Execution Summary: custom-categories (HU-16)

Date: 2026-06-07
Feature branch: `feat/custom-categories` → `main` (PR #19, OPEN)
Base: `main` (after merging HU-18 PR #11 first, per user decision)

## Resultado

HU-16 "Categorías personalizadas" implementada end-to-end en 6 cambios atómicos (PRs #13–#18, todos mergeados a `feat/custom-categories`):

1. **Schema** (#13): `categories` + `user_id` nullable + `updated_at`/trigger, slug global UNIQUE → índices parciales (sistema-global + por-usuario), check de nombre, RLS por-ownership. Migración `20260607224119_custom_categories` aplicada vía MCP. Sin advisors nuevos.
2. **Data layer** (#14): `category-options.ts`, `schemas/category.ts`, `repositories/categories.ts` (CRUD, slug, 23505→amigable), `hooks/use-categories.ts`. Sin RPC.
3. **Edge function** (#15): `extract-receipt` v3 — lista dinámica de categorías + `suggestedNewCategory`.
4. **UI** (#16): icon/color picker, `CategoryForm`, picker "+ Categoría", pantalla Perfil > Categorías (editar/borrar).
5. **OCR wiring** (#17): CTA "Crear categoría 'X'" + envío de nombres al OCR; `CategoryCreateSheet` reusable.
6. **Docs** (#18): feature doc, ADR, user-flow HU-16 (+ mirror Obsidian), AGENTS.md.

## Métricas

- Tests: 472 → 572 (+100), 48 suites, 100% pass
- Gates verdes en cada atomic + en la rama integrada (format/lint/typecheck/test)
- Migración remota = archivo local (1:1)

## Decisiones del usuario aplicadas

- Set curado de íconos/colores · CRUD inline + Perfil · OCR sugiere con confirmación manual · borrar → gastos sin categoría.

## Desviaciones / incidentes

- Base real = `main` tras mergear HU-18 (#11) primero (HU-16 dependía de su código). Decisión del usuario.
- Atomic branches con guión (`feat/custom-categories-<x>`) — git ref conflict con `feat/x/y`.
- Agente de atomic 4 se desconectó (socket) tras escribir archivos sin commitear; segundo agente completó test faltante + fix de tipado + gates + commit.
- `Home`→`House`: seed de sistema "Hogar" usa icon `Home` (no existe en lucide v1 → renderiza vacío). Pre-existente, fuera de scope; anotado en AGENTS.md §10 pendientes.

## Pendiente post-merge (humano)

- Review + merge de PR #19 a `main`.
- QA manual en device: scan ticket sin match → CTA sugerencia → crear → asigna · alta inline "+ Categoría" · Perfil editar/borrar · RLS cross-user.
- Cleanup `Home`→`House` en seed de categorías (mini-migración).
