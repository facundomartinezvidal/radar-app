# radar-app

Cross-platform mobile app built with Expo, React Native, TypeScript, and Supabase.

## Tech Stack

- **Expo SDK 54** (managed workflow) + **React Native 0.81**
- **TypeScript 5.9** strict mode
- **Expo Router 6** — file-based routing with typed routes
- **Supabase** — Auth, Postgres (with RLS), Storage, Edge Functions
- **Zustand** — client state
- **TanStack Query** — server state, caching, retries
- **react-hook-form + zod** — form handling and validation
- **jest-expo + RNTL** — testing
- **EAS Build + EAS Submit** — cloud builds and store submission

See [docs/decisions/2026-05-16-stack-choices.md](docs/decisions/2026-05-16-stack-choices.md) for rationale.

## Prerequisites

- **Node 24** (use [nvm](https://github.com/nvm-sh/nvm) with `.nvmrc` if you manage multiple versions)
- **pnpm 10+** (`npm install -g pnpm`)
- **Expo Go** app on a physical device for the quickest dev loop

Optional (for running on simulators):

- Xcode 16+ (iOS Simulator)
- Android Studio + Android SDK (Android Emulator)

> This project uses config plugins (`expo-notifications`, `expo-camera`, etc.) and **cannot run in Expo Go** — you need a [development build](#eas-build). Use a real device with Expo Go only for initial exploration without those plugins.

## Setup

1. Copy the example env file:

   ```bash
   cp .env.example .env.local
   ```

2. Create a Supabase project at [https://supabase.com](https://supabase.com) (free tier available).

3. Go to **Settings → API** in your Supabase dashboard. Copy the **Project URL** and **anon public** key into `.env.local`:

   ```
   EXPO_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=your_anon_public_key_here
   ```

4. Install dependencies:

   ```bash
   pnpm install
   ```

> **Regenerating TypeScript types from your DB schema:**
> After updating your database schema, regenerate `types/supabase.ts`:
>
> ```bash
> pnpm dlx supabase gen types typescript --project-id YOUR_PROJECT_REF > types/supabase.ts
> ```

## Run the App

```bash
pnpm start
```

Scan the QR code with **Expo Go** on your device (for basic exploration), or open your development build and scan with that.

Platform shortcuts:

```bash
pnpm ios       # Open in iOS Simulator (requires Xcode)
pnpm android   # Open in Android Emulator (requires Android Studio)
pnpm web       # Open in browser (web is opt-in / non-priority)
```

## Scripts

| Script                   | What it does                                               |
| ------------------------ | ---------------------------------------------------------- |
| `pnpm start`             | Start the Expo dev server                                  |
| `pnpm ios`               | Start dev server and open iOS Simulator                    |
| `pnpm android`           | Start dev server and open Android Emulator                 |
| `pnpm web`               | Start dev server and open browser                          |
| `pnpm lint`              | Run ESLint (expo + prettier rules)                         |
| `pnpm typecheck`         | Run `tsc --noEmit`                                         |
| `pnpm format`            | Format all files with Prettier                             |
| `pnpm format:check`      | Check formatting without writing                           |
| `pnpm test`              | Run all tests once                                         |
| `pnpm test:watch`        | Run tests in watch mode                                    |
| `pnpm test:coverage`     | Run tests with coverage report                             |
| `pnpm build:dev:ios`     | EAS development build for iOS Simulator                    |
| `pnpm build:dev:android` | EAS development build for Android device                   |
| `pnpm build:preview`     | EAS preview build (internal distribution, all platforms)   |
| `pnpm build:prod`        | EAS production build (store-ready, all platforms)          |
| `pnpm reset-project`     | Move starter code to `app-example/`, reset `app/` to blank |

## Project Structure

```
radar-app/
├── app/
│   ├── _layout.tsx              # Root layout — mounts <Providers> + <AuthBootstrap>
│   ├── (auth)/
│   │   ├── _layout.tsx          # Redirects to (protected) if already authenticated
│   │   ├── sign-in.tsx
│   │   └── sign-up.tsx
│   └── (protected)/
│       ├── _layout.tsx          # Redirects to /sign-in if unauthenticated
│       ├── modal.tsx
│       └── (tabs)/
│           ├── _layout.tsx      # Tab bar config
│           ├── index.tsx        # Home tab
│           ├── explore.tsx      # Explore tab
│           └── camera.tsx       # Camera / media upload tab
├── components/
│   ├── providers.tsx            # QueryClientProvider + Zustand root
│   └── ui/                      # Shared UI primitives
├── hooks/
│   ├── use-auth-listener.ts     # Supabase onAuthStateChange → Zustand
│   ├── use-register-push.ts     # Push token registration (protected only)
│   └── use-session.ts           # Read session from Zustand
├── lib/
│   ├── supabase.ts              # Supabase client (SecureStore adapter)
│   ├── notifications.ts         # Push token registration helper
│   ├── storage.ts               # Supabase Storage upload helper
│   └── query-client.ts          # TanStack QueryClient config
├── stores/
│   ├── auth-store.ts            # Zustand auth store (session, user, isLoading)
│   └── index.ts
├── types/
│   └── supabase.ts              # Generated Supabase TypeScript types
├── app.config.ts                # Expo config (typed)
├── eas.json                     # EAS Build profiles
└── jest.config.js               # Test config + coverage thresholds
```

## Push Notifications

Push tokens only work on real physical devices — the iOS Simulator cannot receive remote notifications. Registration requires an EAS project: run `eas init` to create or link one, then set `EAS_PROJECT_ID` in `.env.local` to the resulting UUID. Without this value the registration helper will return `null` silently. The token upload step also requires a `device_tokens` table in your Supabase database; until it is created the app will log a warning and continue operating normally. Create the table with the following SQL in your Supabase SQL editor:

```sql
create table public.device_tokens (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  token text not null unique,
  platform text not null,
  updated_at timestamptz default now()
);
alter table public.device_tokens enable row level security;
create policy "Users manage own tokens" on public.device_tokens for all using (auth.uid() = user_id);
```

## Storage

The Camera tab uploads media files to Supabase Storage.

**Default bucket:** `media`

**Setup:**

1. Go to your Supabase Dashboard → **Storage** → **New bucket**.
2. Name it `media`. Enable **Public bucket** if you want public URLs to resolve without authentication.
3. Apply the following RLS policies so authenticated users can only access their own folder:

```sql
create policy "Users upload to own folder"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'media'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "Users read own folder"
on storage.objects for select
to authenticated
using (
  bucket_id = 'media'
  and (storage.foldername(name))[1] = auth.uid()::text
);
```

> If the `media` bucket does not exist the app will log a warning and gracefully return without crashing.

## EAS Build

EAS (Expo Application Services) is used to build and submit iOS and Android binaries in the cloud. Three profiles are configured in `eas.json`: `development`, `preview`, and `production`.

> **Apple Developer ($99/yr) required for iOS App Store. Google Play ($25 one-time) required for Android.**

### Prerequisites

- An Expo account — sign up at [https://expo.dev](https://expo.dev)
- Log in with the EAS CLI (installed locally as a dev dep):
  ```bash
  pnpm exec eas login
  ```
  Or use the globally-installed CLI if you prefer:
  ```bash
  pnpm dlx eas-cli login
  ```

### Initialize the EAS project

Link this local project to an EAS project (only needs to be done once per project):

```bash
pnpm exec eas init
```

This writes the `EAS_PROJECT_ID` to your Expo account and may update `app.config.ts`. Copy the resulting project ID into `.env.local`:

```
EAS_PROJECT_ID=your-eas-project-uuid
```

### Set environment secrets for cloud builds

EAS cloud builds do not read `.env.local`. Register secrets in the EAS dashboard:

```bash
pnpm exec eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_URL --value 'https://your-project.supabase.co'
pnpm exec eas secret:create --scope project --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value 'your_anon_key'
```

### Development builds (first-time setup)

Development builds include the custom dev-client which supports config plugins (e.g. `expo-notifications`). You cannot use Expo Go for this project.

```bash
# iOS Simulator
pnpm run build:dev:ios

# Android real device
pnpm run build:dev:android
```

Install the resulting build on your device/simulator, then start the local bundler and scan the QR code with the **dev build** (not Expo Go):

```bash
pnpm start
```

### Preview build (internal distribution, real device)

Produces an IPA (Ad Hoc) and APK sharable internally without going through the stores:

```bash
pnpm run build:preview
```

### Production build (store-ready)

```bash
pnpm run build:prod
```

Submit to the stores after a successful production build:

```bash
pnpm exec eas submit -p ios
pnpm exec eas submit -p android
```

## Testing

Run the full test suite:

```bash
pnpm test
```

Watch mode (re-runs on file change):

```bash
pnpm test:watch
```

Coverage report:

```bash
pnpm test:coverage
```

Coverage thresholds enforced in `jest.config.js`:

| Metric     | Threshold |
| ---------- | --------- |
| Branches   | 50%       |
| Functions  | 50%       |
| Lines      | 60%       |
| Statements | 60%       |

Tests live next to their subjects in `__tests__/` sibling directories (e.g. `lib/__tests__/storage.test.ts`).

## Architecture Decisions

Key decisions are documented in [`docs/decisions/`](docs/decisions/):

- [ADR-001: Mobile stack choices](docs/decisions/2026-05-16-stack-choices.md)
- [ADR-002: Authentication and route protection strategy](docs/decisions/2026-05-16-auth-strategy.md)

Feature history: [docs/features/radar-app.md](docs/features/radar-app.md)

## License

TBD
