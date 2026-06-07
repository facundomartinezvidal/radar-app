# Custom categories

Per-user custom categories alongside the 9 system categories — curated
icon/color picker, inline creation from the expense form, OCR-aware
suggestion, and CRUD from Perfil. Covers HU-16.

---

## What ships

| Capability                 | Surface                                                    | Notes                                                |
| -------------------------- | ---------------------------------------------------------- | ---------------------------------------------------- |
| Schema extension           | `supabase/migrations/20260607224119_custom_categories.sql` | Nullable `user_id`, partial unique indexes, RLS      |
| Category data layer        | `lib/repositories/categories.ts`                           | `createCategory`, `updateCategory`, `deleteCategory` |
| Category schemas           | `lib/schemas/category.ts`                                  | `createCategorySchema`, `updateCategorySchema`       |
| Icon / color options       | `lib/category-options.ts`                                  | Curated Lucide set + DS palette                      |
| Category mutations hook    | `hooks/use-categories.ts`                                  | Invalidates categories + expenses caches             |
| Category form + preview    | `components/categories/category-form.tsx`                  | Live chip preview, reusable                          |
| Inline-create sheet        | `components/categories/category-create-sheet.tsx`          | Opened from picker; auto-selects on create           |
| Expense category picker    | `components/expenses/category-picker.tsx`                  | "+ Categoría" chip → inline create                   |
| Perfil → Categorías screen | `app/(protected)/profile/categories.tsx`                   | List / edit / delete own categories                  |
| Category form screen       | `app/(protected)/profile/category-form.tsx`                | Create + edit route                                  |
| OCR dynamic list           | `supabase/functions/extract-receipt/index.ts` (v3)         | `categories: string[]` param, `suggestedNewCategory` |
| OCR suggestion wiring      | `lib/ocr.ts` `mapOcrToPrefill`                             | `suggestedCategoryName` only when `category_id null` |
| Review CTA                 | `app/(protected)/expense/review.tsx`                       | "Crear categoría '<nombre>'" + confirm               |

---

## Requirements

### User story

> As a user, I want to create categories with a name, icon, and color so I
> can classify expenses that don't fit the system categories.

Custom categories are full first-class citizens in the picker and in OCR
suggestion. System categories (9 seeded rows with `user_id null`) are
read-only for end users.

### Functional requirements

| #   | Requirement                                                                                                          |
| --- | -------------------------------------------------------------------------------------------------------------------- |
| 1   | Create a custom category with name (1–40 chars), icon (curated set), color (DS palette)                              |
| 2   | Edit name/icon/color of own categories from Perfil                                                                   |
| 3   | Delete own category — expenses linked to it become uncategorized (`category_id → null`)                              |
| 4   | "+ Categoría" chip in the expense picker opens an inline sheet; the new category is auto-selected on confirm         |
| 5   | Category list: system categories first (by sort_order), then custom (sort_order 100) sorted by name                  |
| 6   | Duplicate name per user → error "Ya tenés una categoría con ese nombre." (Postgres 23505 → friendly message)         |
| 7   | OCR edge function receives `categories: string[]` (system + custom names); matches or returns `suggestedNewCategory` |
| 8   | Review screen shows "Crear categoría '<nombre>'" CTA only when `category_id === null` and a suggestion exists        |
| 9   | User confirms before a category suggestion is created — no silent auto-creation                                      |
| 10  | Delete requires confirmation: "¿Confirmás que querés eliminar esta categoría?"                                       |

---

## User decisions

| Topic         | Decision                                                                                        |
| ------------- | ----------------------------------------------------------------------------------------------- |
| Icon + color  | Curated set (~24 Lucide icons + ~8 DS palette colors) — no free-form Lucide search or hex input |
| CRUD location | Inline from picker (create only) + Perfil → Categorías screen (full CRUD)                       |
| OCR no match  | AI suggests a name → "Crear categoría '<nombre>'" CTA with manual confirmation                  |
| Delete impact | Expenses left uncategorized (`category_id → null`); no cascade delete of expenses               |

---

## Architecture / data flow

```
lib/category-options.ts
  └─ CATEGORY_ICONS[]          ← ~24 curated Lucide icon names
  └─ CATEGORY_COLORS[]         ← ~8 DS palette hex values

lib/schemas/category.ts
  └─ createCategorySchema      ← name 1–40, icon enum, color enum
  └─ updateCategorySchema      ← same, all optional

lib/repositories/categories.ts
  └─ listCategories()          ← system (sort_order asc) → custom (name asc)
  └─ createCategory()          ← slug = normalizeName(name), sort_order=100
                               ← 23505 → "Ya tenés una categoría con ese nombre."
  └─ updateCategory()
  └─ deleteCategory()          ← FK on delete set null → expenses uncategorized

hooks/use-categories.ts
  └─ useCreateCategory()       ← mutation, invalidates categories + expenses
  └─ useUpdateCategory()
  └─ useDeleteCategory()

components/categories/category-form.tsx
  └─ icon picker + color picker + live preview chip

components/categories/category-create-sheet.tsx
  └─ wraps CategoryForm in a bottom sheet
  └─ on success → callback → auto-selects in CategoryPicker

components/expenses/category-picker.tsx
  └─ "+ Categoría" chip → CategoryCreateSheet
  └─ system rows first, custom rows after, sorted

app/(protected)/profile/categories.tsx
  └─ lists own categories; edit → category-form screen; delete + confirm

app/(protected)/profile/category-form.tsx
  └─ create + edit; validates via createCategorySchema / updateCategorySchema

─── OCR path ──────────────────────────────────────────────────────────────

lib/ocr.ts  extractReceipt()
  └─ forwards category names (system + custom) in `categories` param

supabase/functions/extract-receipt/index.ts (v3)
  └─ receives categories[], builds prompt dynamically
  └─ returns suggestedNewCategory (≤40 chars, trimmed) when no match
  └─ fallback: 9 system names when categories param absent/empty

lib/ocr.ts  mapOcrToPrefill()
  └─ if category_id matched → sets prefill.category_id, clears suggestion
  └─ if no match + suggestedNewCategory → sets prefill.suggestedCategoryName

app/(protected)/expense/review.tsx
  └─ renders "Crear categoría '<nombre>'" CTA when suggestedCategoryName present
  └─ CTA opens CategoryCreateSheet → on create, assigns category_id to form
```

---

## Key files

| File                                                       | Role                                                  |
| ---------------------------------------------------------- | ----------------------------------------------------- |
| `supabase/migrations/20260607224119_custom_categories.sql` | Schema: alter categories, indexes, RLS, trigger       |
| `lib/category-options.ts`                                  | Curated icon names + color hex values                 |
| `lib/schemas/category.ts`                                  | Zod schemas for create + update                       |
| `lib/repositories/categories.ts`                           | CRUD functions + slug generation + 23505 handling     |
| `hooks/use-categories.ts`                                  | TanStack Query mutations                              |
| `components/categories/category-form.tsx`                  | Reusable form with live preview                       |
| `components/categories/category-create-sheet.tsx`          | Bottom sheet wrapper for inline create                |
| `components/expenses/category-picker.tsx`                  | Picker with "+ Categoría" chip                        |
| `app/(protected)/profile/categories.tsx`                   | Perfil → Categorías list screen                       |
| `app/(protected)/profile/category-form.tsx`                | Create / edit category screen                         |
| `supabase/functions/extract-receipt/index.ts`              | Edge fn v3 — dynamic category list + suggestion       |
| `lib/ocr.ts`                                               | `extractReceipt` (forwards names) + `mapOcrToPrefill` |
| `app/(protected)/expense/review.tsx`                       | Review screen — OCR suggestion CTA                    |

---

## DB schema

### `public.categories` (altered by HU-16)

| Column       | Type        | Constraints                                                        |
| ------------ | ----------- | ------------------------------------------------------------------ |
| `id`         | uuid PK     | `gen_random_uuid()`                                                |
| `name`       | text        | `not null`; `btrim(name)` length 1–40 (`categories_name_nonempty`) |
| `slug`       | text        | `not null`; unique per scope (see indexes below)                   |
| `icon`       | text        | nullable                                                           |
| `color`      | text        | nullable                                                           |
| `sort_order` | integer     | system rows 10–99; custom rows `100`                               |
| `user_id`    | uuid FK     | nullable; `references auth.users(id) on delete cascade`            |
| `created_at` | timestamptz | `not null default now()`                                           |
| `updated_at` | timestamptz | trigger `categories_set_updated_at` (reuses `set_updated_at()`)    |

**Ownership:** `user_id IS NULL` = system category (read-only for users).
`user_id = auth.uid()` = user-owned (full CRUD).

**Slug uniqueness** (two partial indexes replacing the old global unique):

- `categories_slug_system_unique` — `(slug) WHERE user_id IS NULL` — one system slug globally.
- `categories_slug_user_unique` — `(user_id, slug) WHERE user_id IS NOT NULL` — also prevents
  duplicate names per user (slug derived from name).

Additional index: `categories_user_id_idx` on `(user_id)`.

**RLS policies** (replace the old open SELECT):

| Policy                      | Operation | Condition                                               |
| --------------------------- | --------- | ------------------------------------------------------- |
| `categories_select_visible` | SELECT    | `user_id is null OR (select auth.uid()) = user_id`      |
| `categories_insert_own`     | INSERT    | `(select auth.uid()) = user_id AND user_id is not null` |
| `categories_update_own`     | UPDATE    | `(select auth.uid()) = user_id`                         |
| `categories_delete_own`     | DELETE    | `(select auth.uid()) = user_id`                         |

No RPC — single-table CRUD runs directly under caller RLS.

---

## OCR suggestion flow

1. `extractReceipt()` fetches the user's category names (system + own) and passes
   them as `categories: string[]` to the edge function.
2. The edge function builds the category selection prompt dynamically. If none of
   the provided categories fit the receipt, it returns `suggestedNewCategory` (a
   short Spanish name, truncated to ≤40 chars). When a category matches,
   `suggestedNewCategory` is `null`.
3. `mapOcrToPrefill()` evaluates: if `category_id` is set, any suggestion is
   discarded. Only when `category_id === null` does `suggestedCategoryName` flow
   into the prefill.
4. `review.tsx` renders a "Crear categoría '<nombre>'" CTA when
   `suggestedCategoryName` is present. Tapping it opens `CategoryCreateSheet`
   pre-filled with the suggested name. On confirm, the new category's id is
   assigned to the form's `category_id` field.
5. Backward compat: if `categories` param is absent or empty, the edge function
   falls back to the 9 system category names.

---

## Edge cases

| Scenario                                           | Behavior                                                                                |
| -------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Duplicate name per user                            | Postgres 23505 → "Ya tenés una categoría con ese nombre." — no crash                    |
| Same slug across different users                   | Allowed — partial unique index is per-user, not global                                  |
| Name with accents / whitespace-only / emoji        | `normalizeName` normalizes accents for slug; trim → if empty, rejected by zod           |
| Name > 40 chars                                    | Rejected by `createCategorySchema` (zod) and DB check constraint                        |
| User tries to edit/delete system category          | RLS blocks (policies are own-only); UI hides edit/delete actions on system rows         |
| Delete custom with linked expenses                 | FK `on delete set null` → linked `expenses.category_id` become null; caches invalidated |
| OCR `categories` param absent / empty              | Edge fn falls back to 9 system names; suggestion based on system taxonomy only          |
| AI suggests name that matches an existing category | Match fires first; `category_id` set; `suggestedCategoryName` not surfaced              |
| AI returns long/symbolic suggestion                | Edge fn truncates to ≤40 and trims; form schema validates again                         |
| Inline create + discard expense                    | Category persists independently of the expense — acceptable, category is its own entity |
| Offline on inline create confirm                   | Network error → "No se pudo guardar la categoría. Intentá nuevamente." Sheet stays open |
| Icon name not resolvable (legacy data)             | `<Icon>` returns null for unknown names; neutral visual fallback, no crash              |
| Two devices edit same category simultaneously      | Last-write-wins (direct update, no lock) — acceptable for MVP                           |

---

## Known limitations

- **`Home` icon on "Hogar" system seed** (pre-existing, not introduced by HU-16): the
  seeded "Hogar" row uses `icon = 'Home'`, which is not a valid export of
  `lucide-react-native` v1 (the correct export name is `House`). The icon renders blank.
  Tracked in AGENTS.md §10 "Still pending" for cleanup.
- **No drag-to-reorder.** `sort_order` for custom categories is fixed at 100; ordering
  within custom is alphabetical only.
- **No free-form icon/color.** Restricted to the curated set; full Lucide search and
  hex color input are out of scope.
- **No shared categories.** Custom categories are personal. Group-level taxonomy is a
  future HU.

---

## Microcopy

| Context                         | Copy                                                   |
| ------------------------------- | ------------------------------------------------------ |
| Create CTA (picker chip)        | `+ Categoría`                                          |
| Sheet title (create)            | `Nueva categoría`                                      |
| Sheet title (edit)              | `Editar categoría`                                     |
| Name field label                | `Nombre`                                               |
| Name validation error           | `Ingresá un nombre.`                                   |
| Duplicate name error            | `Ya tenés una categoría con ese nombre.`               |
| Delete confirmation             | `¿Confirmás que querés eliminar esta categoría?`       |
| Save error (create/edit)        | `No se pudo guardar la categoría. Intentá nuevamente.` |
| Empty state (Perfil Categorías) | `No hay categorías personalizadas.`                    |
| OCR suggestion CTA              | `Crear categoría "<nombre>"`                           |

---

## Related

- Decision record: `docs/decisions/2026-06-07-custom-categories-schema.md`
- HU spec: `docs/user-flows/HU-16-categorias-personalizadas.md`
- Migration: `supabase/migrations/20260607224119_custom_categories.sql`
- Foundation: `docs/features/expenses-crud.md`
- OCR pipeline: `docs/features/receipt-scan-ocr.md`
- Line items (same migration pattern): `docs/features/expense-line-items.md`
