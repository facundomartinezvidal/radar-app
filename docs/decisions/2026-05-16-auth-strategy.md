# ADR-002: Authentication and route protection strategy

## Status

Accepted — 2026-05-16

## Context

Need email/password auth (with a future OAuth path), session persistence across cold starts, secure token storage, and a clean way to gate the entire app behind authentication without sprinkling guards into every screen component.

## Decision

**Supabase Auth** as the identity provider.
Email/password initially. Google/Apple OAuth can be added later through the same `supabase.auth.signInWithOAuth` API surface with no architectural change.

**expo-secure-store for token storage**, not AsyncStorage.
Keychain on iOS, Keystore on Android. AsyncStorage is unencrypted plain text and is not appropriate for auth tokens.

**Session hydration on cold start** via a single `<AuthBootstrap />` component mounted inside `<Providers>` at the root layout (`app/_layout.tsx`).
It calls `supabase.auth.getSession()` on mount, then subscribes to `onAuthStateChange` for the lifetime of the app. The listener drives all subsequent session state transitions.

**Zustand auth store** (`useAuthStore`) owns `{ session, user, isLoading }`.
The `onAuthStateChange` listener updates this store. Screens and hooks consume `useAuthStore` — no prop drilling, no Context gymnastics.

**Two Expo Router route groups:**

- `app/(auth)/` — public screens (sign-in, sign-up). The `_layout.tsx` redirects to `/(protected)` when the user is already authenticated.
- `app/(protected)/` — all post-login screens. The `_layout.tsx` redirects to `/sign-in` when `session` is `null` and `isLoading` is `false`. The push-registration hook (`useRegisterPush`) is mounted here so it fires only for authenticated users.

**Form validation with zod** at the screen level.
Schemas are co-located with their forms today; they can be extracted to a shared `lib/schemas/` module later to share with Edge Functions for server-side validation.

## Alternatives Considered

| Alternative             | Reason not chosen                                                                           |
| ----------------------- | ------------------------------------------------------------------------------------------- |
| Clerk / Auth0           | Extra vendor + monthly cost; Supabase Auth is built-in and covers all planned auth flows    |
| Custom JWT backend      | More control but more ops burden; Supabase RLS handles per-row authorization out of the box |
| Per-screen auth guards  | Scales poorly — easy to forget one screen; route group layout is a single enforcement point |
| AsyncStorage for tokens | Unencrypted; fails secure-storage requirements                                              |

## Consequences

**Benefits:**

- Zero per-screen auth boilerplate — a single layout component enforces each boundary
- Clean client-state split: `session/user` in Zustand, server data in TanStack Query
- expo-secure-store keeps tokens out of JS-accessible storage on both platforms
- Adding OAuth providers requires only a new button + `signInWithOAuth` call

**Tradeoffs:**

- `expo-secure-store` has a ~2 KB soft limit per item (sessions fit comfortably; be mindful if storing large JWTs)
- Web target requires an AsyncStorage fallback (already wired in `lib/supabase.ts` via the `LargeSecureStore` adapter), which degrades the security posture for web users
- Supabase free tier pauses projects after 7 days of inactivity — cold-start will briefly see a loading state while the DB wakes
