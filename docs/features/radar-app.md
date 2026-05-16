# radar-app — Feature Index

**Graduated**: 2026-05-16
**Source**: `.claude-dev-flow/radar-app/2026-05-16-1215-exec-progress.md`

## Overview

radar-app is a cross-platform mobile application (iOS + Android primary, web opt-in) built with Expo SDK 54, React Native 0.81, and Supabase. It provides authenticated user flows, camera/media capture with cloud storage, push notifications, and a tab-based navigation shell. Designed for solo development initially, with a clear path to team collaboration via EAS Build cloud CI and Supabase's managed infrastructure.

## Initial Scaffold — 14 Phases

| # | Phase | Summary |
|---|---|---|
| 1 | Pre-flight | Verified Node 24, pnpm 10.28, git 2.50. Chose Expo Go as initial dev loop (no local Xcode/Android Studio required). |
| 2 | Scaffold Expo + TS | `pnpm create expo-app@latest radar-app --template default`. Renamed `master` → `main`. Initial commit. |
| 3 | Config base | TypeScript strict mode + 4 extra flags, Prettier, `.editorconfig`, ESLint with expo + prettier plugins. |
| 4 | Core deps | Added Supabase JS client, Zustand, TanStack Query, react-hook-form, zod, expo-secure-store, expo-notifications, expo-camera, expo-image-picker. |
| 5 | Supabase client + env | `lib/supabase.ts` with `LargeSecureStore` adapter (SecureStore on native, AsyncStorage on web). `.env.example` and `.env.local` pattern. |
| 6 | Providers | `components/providers.tsx` wrapping `QueryClientProvider` + Zustand store. `lib/query-client.ts` with configured defaults. |
| 7 | Auth flow + protected routes | `stores/auth-store.ts` (Zustand). `hooks/use-auth-listener.ts`. Route groups: `app/(auth)/` and `app/(protected)/`. Sign-in and sign-up screens with zod validation. |
| 8 | Tab layout | `app/(protected)/(tabs)/` with Home, Explore, Camera tabs. Tab bar with SF Symbols (iOS) / Material icons (Android). |
| 9 | Push notifications | `lib/notifications.ts` (token registration, permission request). `hooks/use-register-push.ts`. `device_tokens` Supabase table + RLS. |
| 10 | Camera + media | `app/(protected)/(tabs)/camera.tsx`. `lib/storage.ts` (upload to `media` bucket). expo-image-picker and expo-camera integration. |
| 11 | Testing setup | jest-expo preset, RNTL, `jest.config.js` with coverage thresholds. Tests for `lib/storage.ts`, `stores/auth-store.ts`, `hooks/use-session.ts`. 29/29 passing. |
| 12 | EAS Build config | `eas.json` with `development`, `preview`, `production` profiles. `app.config.ts` typed. Build scripts in `package.json`. |
| 13 | CI workflow | (Placeholder — GitHub Actions workflow not yet created; repo has no remote.) |
| 14 | Docs + ADRs | This document; `docs/decisions/`; refined `README.md`; `CONTRIBUTING.md`. |

## Architecture Decisions

- Stack rationale: [ADR-001](../decisions/2026-05-16-stack-choices.md)
- Auth strategy: [ADR-002](../decisions/2026-05-16-auth-strategy.md)

## Commands

See the [Scripts table in README.md](../../README.md#scripts) for all `pnpm` commands.

## Next Steps for the Developer

These items were not completed during the scaffold session and require manual action:

- [ ] **Create Supabase project** at https://supabase.com and populate `.env.local` (`EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`)
- [ ] **Run `pnpm exec eas init`** to link to an EAS project, then set `EAS_PROJECT_ID` in `.env.local`
- [ ] **Create `device_tokens` table** in Supabase — SQL in the [Push Notifications section of README.md](../../README.md#push-notifications)
- [ ] **Create `media` bucket + RLS policies** in Supabase Storage — SQL in the [Storage section of README.md](../../README.md#storage)
- [ ] **Apple Developer account** ($99/yr) if targeting iOS App Store distribution
- [ ] **Google Play account** ($25 one-time) if targeting Android Play Store distribution
- [ ] **Set EAS secrets** for cloud builds (`EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`) — see [EAS Build section of README.md](../../README.md#eas-build)
- [ ] **Push remote + create GitHub repo** then wire up CI (Phase 13 — GitHub Actions workflow not yet created)
- [ ] **Regenerate Supabase TypeScript types** after finalizing DB schema: `pnpm dlx supabase gen types typescript --project-id YOUR_PROJECT_REF > types/supabase.ts`
- [ ] **Evaluate Expo SDK 55** — SDK 54 was installed as the stable release; 55 is available for upgrade after MVP
