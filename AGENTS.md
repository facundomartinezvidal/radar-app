# AGENTS.md — radar-app

Guidance for AI coding agents working in this repository.

---

## 1. Project — what RADAR is

**RADAR** is a mobile + web platform that centralizes personal and shared expense tracking for digitally-active young adults (18–35) in Argentina.

**Tagline:** _Sabé a dónde va tu plata._

This repository implements the **mobile app** (iOS + Android via Expo). The web app lives elsewhere; this repo is mobile-only for now.

### The problem RADAR solves

Young adults in Argentina manage money across multiple wallets (Mercado Pago, Ualá, banks, USD platforms) and split costs informally via WhatsApp. The result: **no visibility, no traceability, untracked debts**. Existing apps are either too complex (Excel-style) or single-purpose (Splitwise = only shared, Fintonic = only personal).

### Three solution pillars

1. **Personal tracking unified** — fast capture + categorization + monthly view, regardless of payment source
2. **Shared expenses** — groups, automatic "who-owes-whom" math, simple settlement (replaces WhatsApp chaos)
3. **Multi-currency + AI** — ARS/USD support with auto FX conversion; AI insights on spending patterns; WhatsApp conversational capture

### User personas

- **El estudiante** (21): shares apartment, divides rent + groceries with roommates via WhatsApp, accumulates pending debts
- **El joven profesional** (28): stable income, frequent social spending, multiple payment methods, tried Excel and abandoned it
- **El independiente multi-moneda** (32): freelancer with USD + ARS income, needs to track spend per currency

---

## 2. Business context — where it lives

**Business logic, requirements, BMC, market research, user research, deliverables** all live in the Obsidian vault:

```
/Users/fmartinezvidal/Documents/github/obsidian-vaults/uade/seminario/
```

Key files:

| File                        | What's in it                                                            |
| --------------------------- | ----------------------------------------------------------------------- |
| `CLAUDE.md`                 | Project overview, team, problem framing, hypotheses                     |
| `business-model-canvas.md`  | BMC: segments, value props, channels, revenue, cost structure, partners |
| `elevator-pitch.md`         | 1-min pitch + storytelling structure                                    |
| `prototipo-app-brief.md`    | UI design brief — 8 screens, design system, dark-first                  |
| `segmentacion-usuarios.md`  | Detailed user segmentation                                              |
| `presentacion-parcial-1.md` | Class deliverable content                                               |
| `user-flows/`               | One MD per HU — main flow, alt flows, diagrams, acceptance, tech notes  |
| `content/`                  | Class PDFs (SIPI curriculum)                                            |

The `user-flows/` directory is **mirrored** between the Obsidian vault
(business-side reference) and the repo at `docs/user-flows/`
(engineering-side reference). Both copies must stay in sync; the
canonical edit-target is the repo copy.

**Before adding a feature or changing UX:**

1. Read `prototipo-app-brief.md` (design system + screen specs)
2. Read `business-model-canvas.md` (what value pillars to honor)
3. Verify against user personas

---

## 3. Academic context

This project is the SIPI (Seminario de Integración Profesional) deliverable at UADE — but the goal is to build a production-grade app, not just a class artifact.

- **Team — Grupo 02:** Facundo Martinez Vidal (this repo owner), Jonathan Mayán, Iñaki Moreno
- **Course:** 565668 · Year 2026

Key delivery dates (from `seminario/CLAUDE.md`):

| Date       | Deliverable                                                     |
| ---------- | --------------------------------------------------------------- |
| 2026-04-20 | First Parcial — Problem, Research, Pitch                        |
| 2026-06-01 | Second Delivery — **Prototype v1**, documentation, release plan |
| 2026-06-22 | Second Parcial — Storytelling presentation                      |
| 2026-07-13 | Final Regular — The Pitch                                       |
| 2026-07-20 | Final Desdoblado — The Pitch                                    |

The mobile app scaffolded in this repo targets the **2026-06-01 Second Delivery (Prototype v1)**.

---

## 4. Tech stack

| Layer          | Tech                            | Version                                            | Why                                                     |
| -------------- | ------------------------------- | -------------------------------------------------- | ------------------------------------------------------- |
| Runtime        | Expo (managed)                  | SDK 54                                             | EAS Build cloud → no local Xcode/Android Studio for dev |
| Lang           | TypeScript                      | 5.9, strict + 4 extra flags                        | type safety from day 0                                  |
| Routing        | Expo Router                     | 6.x (file-based)                                   | deep linking, web-compat free                           |
| UI             | React Native                    | 0.81                                               | New Architecture enabled                                |
| State (client) | Zustand                         | 5.x                                                | tiny, no boilerplate                                    |
| State (server) | TanStack Query                  | 5.x                                                | cache, retries, optimistic updates                      |
| Forms          | react-hook-form + zod           | latest                                             | schema sharing with Supabase Edge Functions             |
| Backend        | Supabase                        | 2.x                                                | Postgres + Auth + Storage + RLS + Edge Functions        |
| Token storage  | expo-secure-store               | 15.x                                               | Keychain (iOS) / Keystore (Android)                     |
| Push           | expo-notifications              | 0.32                                               | Expo Push Service initially; FCM/APNs direct if needed  |
| Media          | expo-camera + expo-image-picker | 17.x                                               | CameraView v17 API (not deprecated Camera)              |
| Tests          | jest-expo + RNTL                | jest@29 pinned (jest@30 incompatible with RN 0.81) |                                                         |
| Lint/Format    | ESLint flat config + Prettier   |                                                    | integrated, pre-commit not enforced (yet)               |
| Build/Submit   | EAS Build + EAS Submit          | CLI 18.x                                           | 3 profiles: development, preview, production            |
| CI             | GitHub Actions                  |                                                    | runs on push/PR to main+develop                         |

See `docs/decisions/2026-05-16-stack-choices.md` for rationale + alternatives considered.

---

## 5. Infrastructure

### Hosting / SaaS

| Service         | Purpose                                              | Free tier?                     |
| --------------- | ---------------------------------------------------- | ------------------------------ |
| Supabase        | Postgres DB, Auth, Storage, Realtime, Edge Functions | yes (pauses after 7d inactive) |
| Expo / EAS      | Build cloud, Submit, OTA Updates                     | yes (30 builds/mo)             |
| GitHub          | Repo + Actions CI                                    | yes (public repo, 2000 min/mo) |
| Apple Developer | iOS App Store                                        | $99/yr                         |
| Google Play     | Android Play Store                                   | $25 one-time                   |

### Project IDs / Refs

- **GitHub:** https://github.com/facundomartinezvidal/radar-app (public)
- **Supabase project ref:** `miiorhmqxdqsowqxnpii` → https://miiorhmqxdqsowqxnpii.supabase.co
- **EAS project ID:** not yet initialized (run `pnpm exec eas init`)
- **iOS bundle ID:** `com.radarapp.app`
- **Android package:** `com.radarapp.app`

### Environment variables

`.env.local` (gitignored):

```
EXPO_PUBLIC_SUPABASE_URL=https://miiorhmqxdqsowqxnpii.supabase.co
EXPO_PUBLIC_SUPABASE_KEY=<sb_publishable_...>
EAS_PROJECT_ID=<uuid after eas init>
```

Read via `Constants.expoConfig.extra` — see `lib/supabase.ts`. Naming follows the Supabase Connect dialog convention (`_KEY` not `_ANON_KEY`).

---

## 6. Architecture

### Routing (Expo Router file-based)

```
app/
├── _layout.tsx              Root: Providers > ThemeProvider > Stack
├── (auth)/                  Group: redirects to (protected) if authenticated
│   ├── _layout.tsx
│   ├── sign-in.tsx
│   └── sign-up.tsx
└── (protected)/             Group: redirects to /sign-in if unauthenticated
    ├── _layout.tsx          Mounts useRegisterPush + useNotificationObserver
    ├── modal.tsx
    └── (tabs)/
        ├── _layout.tsx      Tabs: Home, Camera, Explore
        ├── index.tsx
        ├── camera.tsx
        └── explore.tsx
```

Route gating happens **in one place per group** — do NOT add per-screen guards.

### State split

- **Client state** (UI toggles, draft forms, current route data) → Zustand stores in `stores/`
- **Server state** (everything from Supabase) → TanStack Query in components/hooks
- **Auth session** → `useAuthStore` (Zustand), hydrated by `useAuthListener()` mounted in `<AuthBootstrap />` at root

Don't mix the two. Don't put server data in Zustand. Don't put pure UI flags in TanStack Query.

### Auth flow

1. `AuthBootstrap` (in `app/_layout.tsx`) runs `useAuthListener`
2. `useAuthListener` calls `supabase.auth.getSession()` → flips `isLoading: false` in `useAuthStore`
3. Subscribes to `supabase.auth.onAuthStateChange` → syncs store
4. Route group `_layout.tsx` files check `useSession()` and redirect

See `docs/decisions/2026-05-16-auth-strategy.md`.

### Storage

- **Tokens** → expo-secure-store (Keychain/Keystore)
- **Media uploads** → Supabase Storage bucket `media`, path `{userId}/{timestamp}-{rand}.{ext}`, ArrayBuffer (not base64)
- **DB schema** → live in Supabase (`profiles`, `categories`, `expenses`, `expense_items` + RPCs). Source of truth for history: `supabase/migrations/` (see §7 "Database migrations"). Regenerate types after every schema change via Supabase MCP `generate_typescript_types` (or `pnpm dlx supabase gen types typescript --project-id miiorhmqxdqsowqxnpii > types/supabase.ts`)

### DB schema (current)

| Table           | Purpose                                                                              | RLS                                                            |
| --------------- | ------------------------------------------------------------------------------------ | -------------------------------------------------------------- |
| `profiles`      | 1:1 with auth.users, first/last name                                                 | owner select/insert/update                                     |
| `categories`    | system (user_id null) + per-user custom (user_id = auth.uid()); 9 seeded system rows | SELECT = system ∪ own; INSERT/UPDATE/DELETE = own only (HU-16) |
| `expenses`      | core expense rows, numeric(14,2)                                                     | owner CRUD (`(select auth.uid()) = user_id`)                   |
| `expense_items` | receipt line items (HU-18), ≤50/gasto                                                | owner CRUD, denormalized `user_id`                             |

`expense_items`: `name` (1–120), `quantity numeric(14,3) > 0` (kg OK, default 1), `unit_price numeric(14,2)` nullable, `line_total numeric(14,2) >= 0` required (source of truth — OCR often lacks unit price), `position` preserves order, cascade-deletes with the expense.

**Writes with items go through transactional RPCs** (`security invoker`, run under caller RLS):

- `create_expense_with_items(p_amount, p_currency, p_category_id, p_description, p_occurred_at, p_items jsonb)`
- `update_expense_with_items(p_id, p_patch jsonb, p_items jsonb)` — `p_patch` only-present-keys-updated; `p_items` null = items untouched, array (incl. `[]`) = replace full set (delete-all + reinsert → item ids rotate on every save, known limitation)

Reads use the nested select `'*, category:categories(*), items:expense_items(*)'` sorted client-side by `position`. See `docs/decisions/2026-06-03-expense-line-items-schema.md`.

`categories` (HU-16): `user_id` nullable — `null` = system (globally readable), `auth.uid()` = user-owned (full CRUD under RLS). `updated_at` + trigger. Global slug unique replaced by two partial unique indexes (`slug WHERE user_id IS NULL` and `(user_id, slug) WHERE user_id IS NOT NULL`). Name check `btrim(name)` length 1–40. No RPC — direct single-table CRUD. `expenses.category_id` FK is `on delete set null` (unchanged). List order: system (sort_order asc) → custom (name asc). See `docs/decisions/2026-06-07-custom-categories-schema.md`.

### Push notifications

- Registration happens **only after auth** (mounted in `(protected)/_layout.tsx`)
- Token saved to `device_tokens` table (table doesn't exist yet — uploader is no-op until table is created; SQL in README)
- Use Expo Push API initially; migrate to FCM/APNs direct only if needed

---

## 7. Conventions

### Database migrations (MANDATORY practice)

Every schema change ships as **both**:

1. A SQL file in `supabase/migrations/<version>_<name>.sql` (committed to the repo), AND
2. The same SQL applied to the remote project via Supabase MCP `apply_migration` with the **same name** — the MCP assigns the version timestamp; rename the local file to match it (`list_migrations` to confirm).

Remote migration history and local files must always be 1:1. The two pre-existing migrations (`20260517025226`, `20260518005107`) are baseline reconstructions — documented in-file, never re-applied. After applying: run `get_advisors` (security) and regenerate `types/supabase.ts`.

### File naming

- TS/TSX files: kebab-case (e.g., `use-session.ts`, `auth-store.ts`)
- Components: default export named in PascalCase (`Providers`, `AuthBootstrap`)
- Route files: lowercase (`sign-in.tsx`, `index.tsx`) — Expo Router rule
- Test files: `__tests__/<name>.test.ts(x)` sibling to source

### Imports

- Always use `@/` alias for in-repo imports: `import { supabase } from '@/lib/supabase'`
- Group order: react/RN, third-party, `@/` internal, relative

### Commits

Conventional Commits + Skater Elephant signature. See `CONTRIBUTING.md`.

**Types:** `feat`, `fix`, `chore`, `docs`, `test`, `build`, `ci`, `refactor`, `style`, `perf`

### Branching

- `main` is integration; CI runs on push
- Feature work: `feat/<topic>` branches → PR to `main` after CI passes
- No `develop` tier yet (single-dev project)
- Branch protection NOT enabled yet (planned)

### Permissions strings (iOS / Android)

Always in **Spanish** (target market is Argentina). See `app.config.ts` for camera, photos, microphone, notifications.

### Currency / amounts

- Format with `font-variant-numeric: tabular-nums` style
- Default currency: ARS
- Multi-currency: ARS + USD with FX rate from BCRA or Bluelytics (TBD)
- Red for expenses, green for income or "te deben"

### Design system

Canonical source for visual + content rules is the **`desing-system/`** folder at repo root (sic — folder name has a typo, don't rename without coordination). Always consult before building any UI.

See section 8 for full details.

---

## 8. Design system (`desing-system/`)

**Folder structure:**

```
desing-system/
├── README.md                  fundamentals (visual + content)
├── SKILL.md                   Claude Skill metadata for design generation
├── colors_and_type.css        CSS tokens — drop-in
├── assets/                    logos (mark + wordmark) + brand SVGs
├── preview/                   token specimen cards (HTML)
└── ui_kits/app/               mobile UI Kit (JSX primitives + screens + live demo)
```

When building screens, **start by reading `desing-system/README.md`**, then `colors_and_type.css` for the exact CSS token names. The `ui_kits/app/` folder contains JSX primitives that should be translated to React Native components.

### Non-negotiables (from `SKILL.md`)

- **Dark-first** (`#0A0F1A` base). Light mode is a fallback only.
- **Primary `#0077B6`** (ocean blue). Green `#10B981` = ingreso/te deben · Red `#EF4444` = gasto/debés · Amber `#F59E0B` = USD/alerta.
- **Inter** font everywhere. **Tabular-nums on every currency figure** — the numbers ARE the UI.
- **Spanish rioplatense** (voseo OK): _Registrá · Dividí · Saldá · Sumá · Agregá_. Sentence case. No emoji in UI base.
- **Lucide** icons only — stroke `1.5`, `currentColor`. No hand-rolled SVG icons.
- **Tagline:** _RADAR. Sabé a dónde va tu plata._

### Color tokens

| Token            | Hex                      | Use                            |
| ---------------- | ------------------------ | ------------------------------ |
| Background       | `#0A0F1A`                | App base                       |
| Surface (card)   | `#0F1724`                | Cards, sheets                  |
| Surface (raised) | `#17202F`                | Elevated rows, secondary cards |
| Surface (hover)  | `#1F2A3D`                | Pressed/hover states           |
| Brand primary    | `#0077B6`                | Primary actions, active tab    |
| Brand accent     | `#4FB3DC`                | Links, insights, secondary     |
| Brand mid        | `#1E99CC`                | In-between                     |
| Income/credit    | `#10B981`                | Ingresos, "te deben"           |
| Expense/debt     | `#EF4444`                | Gastos, "debés"                |
| Alert/USD        | `#F59E0B`                | Warnings, dólares              |
| Text high        | `#F4F7FB`                | Titles, amounts                |
| Text secondary   | `#B8C3D4`                | Subtitles, captions            |
| Text tertiary    | `#7E8AA0`                | Helpers, labels                |
| Text disabled    | `#4B566B`                | Disabled state                 |
| Border subtle    | `rgba(255,255,255,0.06)` | Default card border            |
| Border visible   | `rgba(255,255,255,0.10)` | Inputs, dividers               |

**Forbidden:** purple, pink, gradient "fintech-slop", left-border accent colors. Just blue + neutrals + two semantics.

### Typography

- **Inter** 400/500/600/700/800 (Google Fonts CDN — local in `fonts/` if needed)
- **JetBrains Mono** only for amount inputs (numeric keypad) and CBU/CVU alias
- Scale: `display 44 / h1 32 / h2 24 / h3 20 / body 16 / body-sm 14 / caption 12`
- Hero balance = `display` (44px, weight 700, letter-spacing `-0.02em`)
- **All amounts** use `font-variant-numeric: tabular-nums` — non-negotiable

### Spacing / layout

- Mobile-first, safe areas respected (44px top, 34px bottom)
- Default padding: `16px` (screens), `20px` (hero pantallas)
- Tap targets ≥ `44px` height
- 4px grid base → `--s-1` ... `--s-10`
- Lists use 1px dividers (`--line-1`), not card-per-row

### Radii / shadows / motion

- Radii: cards `20px` · inputs/buttons `14px` · pills/avatars `999px`
- Shadows: subtle, prefer 1px borders with alpha tint; modals/sheets use `--shadow-3`
- Inner-highlight: `inset 0 1px 0 rgba(255,255,255,0.05)` on elevated buttons/cards
- Easing default: `cubic-bezier(0.2, 0.8, 0.2, 1)` · spring `cubic-bezier(0.34, 1.56, 0.64, 1)` (micro-celebrations only)
- Durations: 120 / 200 / 320ms · no slower
- Press (mobile): `transform: scale(0.97)` 120ms + opacity 0.85 · NO Material ripple
- Focus visible: `2px solid var(--radar-400)` offset `2px`

### Content fundamentals (copy rules)

- **Idioma:** español rioplatense, voseo permitido no obligatorio. Tono formal-cercano, claro, sin slang.
- **Persona del producto:** profesional, claro, respetuoso. Tono formal sin ser frío. Voseo argentino como estándar regional, sin slang ("un toque", "che", "joya", "por acá" → fuera).
- **Verbs:** active + short. "Registrá un gasto", NOT "Proceder al registro de un gasto". Verbos formales en voseo (`Ingresá`, `Aguardá`, `Intentá`, `Modificá`, `Confirmá`); evitar `probá`, `mandate`, `dale`.
- **CTAs principales:** voseo formal — _Registrá · Dividí · Saldá · Agregá_. CTAs de cuenta en infinitivo — _Iniciar sesión · Crear cuenta · Verificar código · Continuar_.
- **Navigation labels:** infinitivo — _Gastos · Grupos · Perfil_.
- **Title/button casing:** sentence case. `Nuevo gasto`, NOT `Nuevo Gasto`.
- **Numbers:** local format — `$ 12.500,00` (punto miles, coma decimal).
- **Currency:** always explicit — `$ 12.500 ARS`, `US$ 85,00`. Never mix without indicating.
- **Email convention:** "correo electrónico" en copy formal (labels, errores); "email" sólo en logs/dev/console.
- **No financial jargon coloquial:** "Plata que te deben" sigue siendo OK en marketing, pero microcopy de errores e instrucciones usa "dinero", "monto", "saldo", "gasto".
- **Empty states:** claros y descriptivos, sin humor. "No hay gastos registrados." NOT "Sin gastos por acá. Por ahora."
- **Errors:** impersonales, formales. "No se pudo guardar el gasto. Intentá nuevamente." NOT "No pudimos guardar el gasto. Probá de nuevo." NOT "Error 500".
- **No emoji in UI base.** Emoji OK in push notifs when emotional context adds (rarely).

### Microcopy reference (use these verbatim)

| Context                   | Copy                                                             |
| ------------------------- | ---------------------------------------------------------------- |
| CTA primary "new expense" | `Registrar gasto`                                                |
| Empty state home          | `Aún no se registraron gastos este mes.`                         |
| Empty state list          | `No hay gastos registrados`                                      |
| Debt settled confirmation | `Deuda saldada correctamente.`                                   |
| Push notification         | `Juan registró un gasto de $ 4.200 en Pizza del viernes.`        |
| Generic error             | `No se pudo establecer la conexión. Reintentando en 5 segundos.` |
| Onboarding hook           | `Visualizá en qué se invirtió tu dinero este mes.`               |
| Amount input placeholder  | `0,00`                                                           |
| Destructive confirm       | `¿Confirmás que querés eliminar este gasto?`                     |
| Resend rate-limited       | `Aguardá unos minutos antes de solicitar un nuevo código.`       |

### Iconography

- **Lucide** library only (https://lucide.dev). ~1500 icons including all fintech essentials.
- Stroke `1.5`, base size `20px` (`24px` tab bar, `16px` inline with text).
- `stroke="currentColor"` — never hardcode color.
- Never fill Lucide icons (except `star` for favorites + `check-circle` for confirmations).
- Wallet brand logos (MP, Ualá, etc.) in `desing-system/assets/brands/` if available — never redraw.
- For RN: use `lucide-react-native` package when implementing.

### Imagery rules

- **No photos** in app — utility fintech, not lifestyle
- Empty-state illustrations: monochrome line-art in `--radar-300`, no fills
- Avatars: initials on hash-derived color circle (8-hue approved palette)
- Backgrounds: flat. Gradients only for the radar sweep on empty hero.

### Caveats (from `desing-system/README.md`)

- DS is a proposal, not recreation — pre-product, expect iteration
- Original brief had `#10B981` (esmerald) as primary; was overridden to `#0077B6` (ocean blue). Green is now semantic only ("ingreso/te deben").
- Folder name typo (`desing-system` instead of `design-system`) — preserved to avoid breaking references. Rename only as a coordinated atomic change.

---

## 9. Working effectively in this repo

### Before writing code

1. Read `prototipo-app-brief.md` for UX context
2. Read `docs/decisions/*` for architecture rationale
3. Read `README.md` for setup + scripts
4. Check `pnpm run` to see available scripts (don't assume `test:unit`, `test:e2e` exist — they don't)

### Expo SDK 54 specifics — IMPORTANT

> **Expo HAS CHANGED.** Read the exact versioned docs at https://docs.expo.dev/versions/v54.0.0/ before writing any Expo-related code.

Gotchas in SDK 54:

- `Notifications.setNotificationHandler` uses `shouldShowBanner` + `shouldShowList`, NOT the deprecated `shouldShowAlert`
- `ImagePicker.launchImageLibraryAsync` uses array syntax `mediaTypes: ['images']`, NOT `MediaTypeOptions.Images`
- `expo-camera` v17 exposes `CameraView` (functional component), NOT the deprecated `Camera` class
- `app.config.ts` is the source of truth (no `app.json`) — dynamic env via `process.env`

### When in doubt

- For Supabase RLS / schema: invoke `/supabase-postgres-best-practices` skill
- For Supabase Auth / client: invoke `/supabase` skill
- For RN perf / patterns: invoke `/react-native-expert` skill
- For form work: invoke `/react-hook-form-zod` skill
- For UI / mobile design: invoke `/sleek-design-mobile-apps` skill
- For EAS CI: invoke `/expo-cicd-workflows` skill

### Quality gates (all must pass before merge)

```bash
pnpm format:check   # Prettier
pnpm lint           # ESLint flat config
pnpm typecheck      # tsc --noEmit strict
pnpm test           # jest-expo + RNTL (572 tests baseline)
```

CI enforces these on every push/PR via `.github/workflows/ci.yml`.

### Things to NOT do

- ❌ Don't downgrade TS strictness or remove the 4 extra strict flags
- ❌ Don't use `app.json` — it was migrated to `app.config.ts`
- ❌ Don't use AsyncStorage for tokens — use SecureStore (web is the only allowed AsyncStorage path)
- ❌ Don't add per-screen auth guards — gating is in `(auth)`/`(protected)` `_layout.tsx`
- ❌ Don't bypass Prettier or ESLint
- ❌ Don't commit `.env.local`, `.env`, or any secret
- ❌ Don't put server data in Zustand
- ❌ Don't write English permission strings — the market is Argentina
- ❌ Don't add native modules without checking Expo SDK 54 compatibility (Expo Go vs dev build)
- ❌ Don't apply DB changes without a matching file in `supabase/migrations/` (see §7 "Database migrations")
- ❌ Don't finish a feature without updating this AGENTS.md — schema tables, business logic, conventions/practices, and §10 shipped/pending MUST reflect the new state before the final PR

### After every feature (MANDATORY)

Update **AGENTS.md** as part of the feature's final PR:

1. §6 DB schema table if the schema changed
2. §7 conventions if a new practice was introduced
3. §10 "Already shipped" (add entry with doc links) + "Still pending" (prune/add)
4. Test baseline count in §9 quality gates

---

## 10. Pending / next steps for the human

### Already shipped

- `profiles` + `categories` + `expenses` tables with RLS — see
  `docs/decisions/2026-05-17-expenses-schema.md`
- Categories seeded (9 rows) for the default Argentine taxonomy
- Trigger `handle_new_user()` auto-creates profile rows on signup
- Expenses CRUD UI + list + filter + search — see
  `docs/features/expenses-crud.md`
- Custom OTP email template for sign-up — `docs/auth/email-templates/`
- User identity capture (first_name + last_name) at sign-up, persisted
  via `auth.users.raw_user_meta_data` + synced into `profiles` by a
  pair of triggers. Onboarding gate for legacy users. New Perfil stack
  with edit + sign-out. Reusable `<Avatar />` primitive. See
  `docs/decisions/2026-05-17-user-profile-fields.md` and
  `docs/features/user-name-capture.md`.
- Receipt scan → OCR → validate (HU-02/03/05/06): camera capture +
  gallery pick → `compressForOcr` → `extract-receipt` Supabase Edge
  Function (Groq vision `llama-4-scout-17b`) → pre-filled `ExpenseForm`
  → save. Date picker (`DateField`) shipped as part of this feature.
  See `docs/features/receipt-scan-ocr.md` and
  `docs/decisions/2026-05-31-ocr-groq-edge-function.md`.
- Receipt line items (HU-18): `expense_items` table + transactional RPCs,
  OCR extraction of per-line detail (name/qty/unit price/line total, cap 50),
  full manual CRUD in `ExpenseItemsField` (collapsible "Detalle" section),
  non-blocking mismatch warning when Σitems ≠ total. Versioned
  `supabase/migrations/` introduced with this feature. See
  `docs/features/expense-line-items.md`,
  `docs/decisions/2026-06-03-expense-line-items-schema.md` and
  `docs/user-flows/HU-18-items-detallados.md`.
- Custom categories (HU-16): `categories` extended with nullable `user_id`
  (null = system, own = CRUD), `updated_at`, partial unique slug indexes, and
  4 ownership-aware RLS policies. Curated icon/color picker, `CategoryForm`
  with live preview, `CategoryCreateSheet` for inline creation from the
  expense picker, Perfil → Categorías screen. OCR edge fn v3 accepts dynamic
  category list and returns `suggestedNewCategory` when no match; review
  screen surfaces a "Crear categoría '<nombre>'" CTA with manual confirm.
  Tests: 472 → 572. See `docs/features/custom-categories.md`,
  `docs/decisions/2026-06-07-custom-categories-schema.md` and
  `docs/user-flows/HU-16-categorias-personalizadas.md`.

### Still pending

1. Create Supabase tables for shared / groups (`groups`, `group_members`,
   `splits`, `device_tokens`) with RLS
2. Create Supabase Storage bucket `media` with RLS for per-user folders
3. Configure custom SMTP in Supabase (Resend recommended) — shared SMTP
   is capped at 2 emails/hour and breaks even basic testing
4. Run `pnpm exec eas init` → set `EAS_PROJECT_ID` in `.env.local`
5. Decide ARS/USD FX source (BCRA vs Bluelytics)
6. Decide WhatsApp Business API integration scope
7. Build the remaining screens from `prototipo-app-brief.md`
   (groups detail, settlement flow, AI insights detail)
8. Wire AI/insights pipeline (model choice + edge function)
9. Fix pre-existing security advisor lints: trigger functions
   (`handle_new_user`, `handle_user_metadata_update`, `set_updated_at`,
   `rls_auto_enable`) are SECURITY DEFINER and executable by anon/
   authenticated via PostgREST — revoke EXECUTE. Also enable leaked
   password protection in Auth settings.
10. Revisit `expense_items` update strategy (delete-all + reinsert rotates
    item ids) if a future HU needs stable per-item identity (e.g. AI
    insights keyed by item)
11. Fix system seed: "Hogar" category uses `icon = 'Home'` but
    `lucide-react-native` v1 exports `House` — icon renders blank. Update
    the seeded row (direct UPDATE or new migration).

The expenses CRUD is the first feature with real persistence end-to-end.
Everything else still depends on the items above.
