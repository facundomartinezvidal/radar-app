# Welcome to your Expo app

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

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

4. Start the app:

   ```bash
   pnpm start
   ```

> **Regenerating TypeScript types from your DB schema:**
> After updating your database schema, regenerate `types/supabase.ts`:
>
> ```bash
> pnpm dlx supabase gen types typescript --project-id YOUR_PROJECT_REF > types/supabase.ts
> ```

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

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Start the app

   ```bash
   npx expo start
   ```

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

You can start developing by editing the files inside the **app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

## Get a fresh project

When you're ready, run:

```bash
npm run reset-project
```

This command will move the starter code to the **app-example** directory and create a blank **app** directory where you can start developing.

## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.
