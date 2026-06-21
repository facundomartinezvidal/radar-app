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

| Layer          | Tech                            | Version                                            |
| -------------- | ------------------------------- | -------------------------------------------------- |
| Runtime        | Expo (managed)                  | SDK 54                                             |
| Lang           | TypeScript                      | 5.9, strict + 4 extra flags                        |
| Routing        | Expo Router                     | 6.x (file-based)                                   |
| UI             | React Native                    | 0.81                                               |
| State (client) | Zustand                         | 5.x                                                |
| State (server) | TanStack Query                  | 5.x                                                |
| Forms          | react-hook-form + zod           | latest                                             |
| Backend        | Supabase                        | 2.x                                                |
| Token storage  | expo-secure-store               | 15.x                                               |
| Push           | expo-notifications              | 0.32                                               |
| Media          | expo-camera + expo-image-picker | 17.x                                               |
| Tests          | jest-expo + RNTL                | jest@29 pinned (jest@30 incompatible with RN 0.81) |
| Lint/Format    | ESLint flat config + Prettier   |                                                    |
| Build/Submit   | EAS Build + EAS Submit          | CLI 18.x                                           |
| CI             | GitHub Actions                  |                                                    |

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
- **DB schema** → live in Supabase. Source of truth for history: `supabase/migrations/` (see `docs/conventions/database.md`). Regenerate types after every schema change via Supabase MCP `generate_typescript_types` (or `pnpm dlx supabase gen types typescript --project-id miiorhmqxdqsowqxnpii > types/supabase.ts`)

### DB schema (current)

- `profiles` — 1:1 with auth.users, first/last name → [`docs/decisions/2026-05-17-expenses-schema.md`](docs/decisions/2026-05-17-expenses-schema.md)
- `categories` — per-user expense + income defaults + custom rows; `kind` column (HU-16/20/21) → [`docs/decisions/2026-06-07-custom-categories-schema.md`](docs/decisions/2026-06-07-custom-categories-schema.md)
- `expenses` — core expense rows; extended with `group_id`/`paid_by_member_id` (HU-17), `source`/`recurrence_id`/`occurred_date` (HU-19) → [`docs/decisions/2026-05-17-expenses-schema.md`](docs/decisions/2026-05-17-expenses-schema.md)
- `expense_items` — receipt line items ≤50/expense (HU-18) → [`docs/decisions/2026-06-03-expense-line-items-schema.md`](docs/decisions/2026-06-03-expense-line-items-schema.md)
- `groups`, `group_members`, `expense_splits`, `group_settlements` — shared-expense groups, membership, per-member splits, debt settlements (HU-17) → [`docs/decisions/2026-06-07-shared-expenses-schema.md`](docs/decisions/2026-06-07-shared-expenses-schema.md)
- `income_recurrences`, `incomes` — recurring income rules + materialized occurrences (HU-20/21) → [`docs/decisions/2026-06-08-incomes-schema.md`](docs/decisions/2026-06-08-incomes-schema.md)
- `expense_recurrences` — recurring expense rules; occurrences materialized into `expenses` by pg_cron (HU-19) → [`docs/decisions/2026-06-08-recurring-expenses-schema.md`](docs/decisions/2026-06-08-recurring-expenses-schema.md)
- Insights aggregation RPCs — `get_expense_by_category`, `get_expense_by_period`, `get_income_by_period`; SECURITY INVOKER; share-aware CASE identical to `get_personal_totals` (HU-23/24) → [`docs/decisions/2026-06-20-insights-aggregation-rpcs.md`](docs/decisions/2026-06-20-insights-aggregation-rpcs.md)

Full schema, RLS policies, RPC signatures and column detail → see the linked `docs/decisions/*-schema.md`.

### Push notifications

- Registration happens **only after auth** (mounted in `(protected)/_layout.tsx`)
- Token saved to `device_tokens` table (table doesn't exist yet — uploader is no-op until table is created; SQL in README)
- Use Expo Push API initially; migrate to FCM/APNs direct only if needed

---

## 7. Conventions

**Database conventions** (migrations dual-ship rule, SECURITY DEFINER patterns, pg_cron materializers) → `docs/conventions/database.md` — read before any schema change.

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

Full DS — typography, spacing, motion, content/copy rules, microcopy table, iconography → `desing-system/README.md` + `desing-system/colors_and_type.css`. Read before any UI work.

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
pnpm test           # jest-expo + RNTL (1668 tests, 102 suites baseline)
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
- ❌ Don't apply DB changes without a matching file in `supabase/migrations/` (see `docs/conventions/database.md`)
- ❌ Don't finish a feature without updating this AGENTS.md — schema tables, business logic, conventions/practices, and §10 shipped/pending MUST reflect the new state before the final PR

### After every feature (MANDATORY)

Update **AGENTS.md** as part of the feature's final PR:

1. Edit `docs/conventions/database.md` + the relevant `docs/decisions/*-schema.md` / `docs/features/*.md`; in AGENTS.md add only a one-line §6 table-summary row + one-line §10 entry (keep AGENTS.md lean — detail goes in docs/).
2. §7 conventions if a new practice was introduced
3. §10 "Already shipped" (add one-line entry with doc links) + "Still pending" (prune/add)
4. Test baseline count in §9 quality gates

---

## 10. Pending / next steps for the human

### Already shipped

- `profiles` + `categories` + `expenses` tables with RLS → [`docs/decisions/2026-05-17-expenses-schema.md`](docs/decisions/2026-05-17-expenses-schema.md), [`docs/features/expenses-crud.md`](docs/features/expenses-crud.md)
- User identity capture at sign-up (first/last name), Perfil stack, `<Avatar />` primitive → [`docs/decisions/2026-05-17-user-profile-fields.md`](docs/decisions/2026-05-17-user-profile-fields.md), [`docs/features/user-name-capture.md`](docs/features/user-name-capture.md)
- Receipt scan → OCR → validate (HU-02/03/05/06): camera + gallery → Groq `llama-4-scout-17b` edge function → pre-filled `ExpenseForm` → [`docs/features/receipt-scan-ocr.md`](docs/features/receipt-scan-ocr.md), [`docs/decisions/2026-05-31-ocr-groq-edge-function.md`](docs/decisions/2026-05-31-ocr-groq-edge-function.md)
- Receipt line items (HU-18): `expense_items` + transactional RPCs, OCR per-line detail, `ExpenseItemsField` manual CRUD (tests +0 → baseline) → [`docs/features/expense-line-items.md`](docs/features/expense-line-items.md), [`docs/decisions/2026-06-03-expense-line-items-schema.md`](docs/decisions/2026-06-03-expense-line-items-schema.md), [`docs/user-flows/HU-18-items-detallados.md`](docs/user-flows/HU-18-items-detallados.md)
- Custom categories (HU-16): per-user CRUD, icon/color picker, `CategorySelectorSheet`, OCR category suggestion (tests 472 → 603) → [`docs/features/custom-categories.md`](docs/features/custom-categories.md), [`docs/decisions/2026-06-07-custom-categories-schema.md`](docs/decisions/2026-06-07-custom-categories-schema.md), [`docs/user-flows/HU-16-categorias-personalizadas.md`](docs/user-flows/HU-16-categorias-personalizadas.md)
- Shared expenses (HU-17): `groups`/`group_members`/`expense_splits`/`group_settlements` + 10 RPCs, consent flow, `SplitEditor`, per-currency balances (tests 603 → 996) → [`docs/features/shared-expenses.md`](docs/features/shared-expenses.md), [`docs/decisions/2026-06-07-shared-expenses-schema.md`](docs/decisions/2026-06-07-shared-expenses-schema.md), [`docs/user-flows/HU-17-gastos-compartidos.md`](docs/user-flows/HU-17-gastos-compartidos.md)
- Incomes (HU-20/21): `income_recurrences` + `incomes` tables, pg_cron materializer, Ingresos tab, net balance hero (tests 996 → 1276) → [`docs/features/incomes.md`](docs/features/incomes.md), [`docs/decisions/2026-06-08-incomes-schema.md`](docs/decisions/2026-06-08-incomes-schema.md), [`docs/user-flows/HU-20-ingresos-recurrentes.md`](docs/user-flows/HU-20-ingresos-recurrentes.md), [`docs/user-flows/HU-21-ingresos-ocasionales.md`](docs/user-flows/HU-21-ingresos-ocasionales.md)
- Recurring expenses (HU-19): `expense_recurrences` table, pg_cron materializer into `expenses`, "Gastos recurrentes" section + "Recurrente" badge (tests 1276 → 1432) → [`docs/features/recurring-expenses.md`](docs/features/recurring-expenses.md), [`docs/decisions/2026-06-08-recurring-expenses-schema.md`](docs/decisions/2026-06-08-recurring-expenses-schema.md), [`docs/user-flows/HU-19-gastos-recurrentes.md`](docs/user-flows/HU-19-gastos-recurrentes.md)
- Insights (HU-23/24): 3 SECURITY INVOKER RPCs, `generate-insights` Groq edge fn + local-heuristics fallback, 4 charts (`react-native-gifted-charts`), temporal filter + month selector + ARS/USD toggle, AI card, empty state (tests 1432 → 1668) → [`docs/features/insights.md`](docs/features/insights.md), [`docs/decisions/2026-06-20-insights-aggregation-rpcs.md`](docs/decisions/2026-06-20-insights-aggregation-rpcs.md), [`docs/user-flows/HU-23-filtros-temporales-insights.md`](docs/user-flows/HU-23-filtros-temporales-insights.md), [`docs/user-flows/HU-24-grafico-barras-gastos.md`](docs/user-flows/HU-24-grafico-barras-gastos.md)

### Still pending

1. Create `device_tokens` table with RLS for push notification registration; wire
   push reminders for shared expenses ("Recordar a X") — HU-17 deferred scope
2. Create Supabase Storage bucket `media` with RLS for per-user folders
3. Configure custom SMTP in Supabase (Resend recommended) — shared SMTP
   is capped at 2 emails/hour and breaks even basic testing
4. Run `pnpm exec eas init` → set `EAS_PROJECT_ID` in `.env.local`
5. Decide ARS/USD FX source (BCRA vs Bluelytics)
6. Decide WhatsApp Business API integration scope
7. Build the remaining screens from `prototipo-app-brief.md`
   (groups detail, settlement flow) — the Insights screen (Screen 7) is now shipped
8. Fix pre-existing security advisor lints: trigger functions
   (`handle_new_user`, `handle_user_metadata_update`, `set_updated_at`,
   `rls_auto_enable`) are SECURITY DEFINER and executable by anon/
   authenticated via PostgREST — revoke EXECUTE. Also enable leaked
   password protection in Auth settings.
9. Revisit `expense_items` update strategy (delete-all + reinsert rotates
   item ids) if a future HU needs stable per-item identity (e.g. AI
   insights keyed by item)

The expenses CRUD is the first feature with real persistence end-to-end.
Everything else still depends on the items above.
