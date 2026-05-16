# ADR-001: Mobile stack choices for radar-app

## Status

Accepted — 2026-05-16

## Context

We need to ship a production-grade cross-platform mobile app (iOS + Android) with auth, push notifications, camera/media upload, and offline-tolerant UX. Solo developer at start, no native team. Need fast iteration but also a clear path to App Store/Play Store distribution.

## Decision

**Expo SDK 54 (managed workflow)** over bare React Native, Flutter, or native.
Fastest scaffolding; EAS Build cloud removes need for local Xcode/Android Studio in early phases; OTA updates via expo-updates; large ecosystem of config plugins.

**TypeScript strict mode + 4 additional flags**: `noUncheckedIndexedAccess`, `noImplicitOverride`, `noFallthroughCasesInSwitch`, `forceConsistentCasingInFileNames`.
Type-safety from day 0 is cheaper than retrofitting on a live codebase.

**Expo Router 6 (file-based routing)** over React Navigation directly.
Deep linking out of the box, web-compat free, mirrors familiar Next.js file-system patterns, typed routes via `experiments.typedRoutes`.

**Supabase** over Firebase.
Postgres is relational — better fit than NoSQL for our domain. RLS enforces per-row authorization at the DB layer. Open-source, generous free tier. One platform for Auth + Storage + Realtime + Edge Functions.

**Zustand for client state** over Redux Toolkit.
~1 KB, no boilerplate, simple selectors. Scales fine for the scope expected at MVP.

**TanStack Query for server state** alongside Zustand.
Caching, retries, optimistic updates, Suspense-friendly. Clean split: Zustand owns ephemeral client state; TanStack Query owns all server-derived data.

**react-hook-form + zod** for forms.
Schema sharing between screen-level forms and Supabase Edge Functions (server-side validation). Best DX for controlled forms in React Native.

**jest-expo + React Native Testing Library (RNTL v13)**.
Official Expo test preset; RNTL v13 targets React 19. Coverage thresholds enforced in `jest.config.js`.

## Alternatives Considered

| Alternative                  | Reason not chosen                                                                     |
| ---------------------------- | ------------------------------------------------------------------------------------- |
| Flutter                      | Dart ramp-up; less React/JS ecosystem leverage                                        |
| Bare React Native + Firebase | More native control but heavier ops; no free EAS cloud tier; NoSQL fits domain poorly |
| Redux Toolkit                | More boilerplate than MVP scope requires                                              |
| Clerk / Auth0                | Extra vendor + cost; Supabase Auth is built-in and free                               |

## Consequences

**Benefits:**

- Fast iteration loop via Expo Go or dev client
- Cloud builds (EAS) — no local Xcode/Android Studio required for CI
- OTA updates via expo-updates without a full App Store re-submission
- Supabase RLS enforces authorization at DB layer — less custom middleware

**Tradeoffs:**

- Bound to Expo's release cadence; some native modules require config plugins or dev builds (Expo Go will not work for this project)
- Supabase free tier pauses inactive projects after 7 days (upgrade to Pro when active)
- `noUncheckedIndexedAccess` increases type verbosity for array access patterns
