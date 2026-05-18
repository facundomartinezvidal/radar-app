# User name capture

Capture the user's first name and last name at sign-up, persist them in
both `auth.users.raw_user_meta_data` and `public.profiles`, and use them
across the app — home greeting, avatar, Perfil screen, and the OTP
confirmation email.

---

## What ships

| Capability                       | Surface                                         | Notes                                                           |
| -------------------------------- | ----------------------------------------------- | --------------------------------------------------------------- |
| Capture at sign-up               | `app/(auth)/sign-up.tsx`                        | 2 inputs above the email, validated with shared `nameSchema`    |
| Onboarding gate for legacy users | `app/(onboarding)/profile-setup.tsx`            | Redirects authenticated-but-nameless users before they hit tabs |
| Edit name from Perfil            | `app/(protected)/profile/edit-name.tsx`         | Pre-populated form, `supabase.auth.updateUser({ data })`        |
| Perfil screen (view + sign-out)  | `app/(protected)/profile/index.tsx`             | Avatar 96px + full name + email + Cuenta/Sesión sections        |
| Home greeting + avatar           | `app/(protected)/(tabs)/index.tsx`              | "Hola, {first_name}" + pressable `<Avatar />` → Perfil          |
| Personalised OTP email           | `docs/auth/email-templates/confirm-signup.html` | `Hola {{ .Data.first_name }},` with legacy fallback             |
| Reusable Avatar primitive        | `components/ui/avatar.tsx`                      | Image / initials / `?` fallback with hash-color palette         |

---

## Architecture

```
sign-up.tsx ──► supabase.auth.signUp({ options: { data: { first_name, last_name } } })
                       │
                       ▼
auth.users.raw_user_meta_data { first_name, last_name }
                       │  on insert
                       ▼
trigger handle_new_user() ─► profiles { first_name, last_name, display_name }

profile-setup.tsx
edit-name.tsx        ──► supabase.auth.updateUser({ data: { first_name, last_name } })
                       │  on update of raw_user_meta_data
                       ▼
trigger handle_user_metadata_update() ─► profiles (same three columns synced)

useAuthListener (onAuthStateChange) ─► useAuthStore rehydrates ─► UI re-renders
```

Single source of truth: triggers — never write `profiles.first_name` or
`profiles.last_name` directly from the client.

### Schema (`lib/schemas/profile.ts`)

```ts
export const nameSchema = z
  .string({ message: 'Ingresá un nombre válido.' })
  .trim()
  .min(2, 'Mínimo 2 caracteres.')
  .max(40, 'Máximo 40 caracteres.')
  .regex(/^[A-Za-zÀ-ÿñÑ\s'-]+$/u, 'Solo letras, espacios, guiones o apóstrofes.');

export const profileUpdateSchema = z.object({
  firstName: nameSchema,
  lastName: nameSchema,
});
```

Shared by sign-up, profile-setup, edit-name. One copy of the rules, one
copy of the Spanish microcopy.

### Onboarding gate (`lib/profile/completion.ts`)

```ts
export function hasCompletedProfile(user: User | null | undefined): boolean {
  if (!user) return false;
  const md = user.user_metadata ?? {};
  const first = typeof md.first_name === 'string' ? md.first_name.trim() : '';
  const last = typeof md.last_name === 'string' ? md.last_name.trim() : '';
  return first.length > 0 && last.length > 0;
}
```

Both `(auth)/_layout.tsx` and `(protected)/_layout.tsx` redirect to
`/(onboarding)/profile-setup` when the predicate returns false. The
onboarding group's own layout redirects back to tabs once the names
land.

### Avatar primitive (`components/ui/avatar.tsx`)

Three render branches, decided in order:

1. `imageUrl` provided → `<Image />` clipped to a circle.
2. Initials available → circle with 1–2 uppercase initials over a colour
   sampled from the 8-hue `AVATAR_PALETTE` using a deterministic hash of
   the full name.
3. Neither → `?` over a neutral surface.

`getInitials(first, last)` is grapheme-safe (handles surrogate pairs)
and uses `.toLocaleUpperCase('es-AR')` so accented Spanish names like
"Álvaro" / "Ñúñez" round-trip correctly.

---

## DB schema

Migration `add_first_last_name_to_profiles` (applied via Supabase MCP on
2026-05-17).

### `profiles` (columns added by this feature)

| Column         | Type              | Notes                                                                    |
| -------------- | ----------------- | ------------------------------------------------------------------------ |
| `first_name`   | `text not null`   | Default `''`; the gate treats empty as "not yet completed"               |
| `last_name`    | `text not null`   | Same                                                                     |
| `display_name` | `text` (nullable) | Now computed by triggers as `nullif(trim(first \|\| ' ' \|\| last), '')` |

The trigger pair (`handle_new_user`, `handle_user_metadata_update`) is
the only writer. Both are `security definer` with `search_path = ''`
per the existing convention.

### Backfill

Every `auth.users` row without a matching `profiles` row got one
inserted by the migration, with empty strings in both name fields. The
in-flight user count was 1 at the time of the migration; they'll hit
the onboarding gate once on their next session.

---

## Test coverage

| Suite                                                  | Tests | What it pins                                                                                                          |
| ------------------------------------------------------ | ----- | --------------------------------------------------------------------------------------------------------------------- |
| `lib/schemas/__tests__/profile.test.ts`                | 20    | Schema accept/reject for accents, ñ, hyphens, apostrophes, digits, emojis, length bounds, Spanish copy of every error |
| `lib/avatar/__tests__/initials.test.ts`                | 12    | Grapheme safety, accent preservation, partial-input fallbacks                                                         |
| `lib/avatar/__tests__/hash-color.test.ts`              | 8     | Determinism, palette membership, no purple/pink leakage                                                               |
| `components/ui/__tests__/avatar.test.tsx`              | 22    | All three render branches + a11y label shape                                                                          |
| `lib/profile/__tests__/completion.test.ts`             | 11    | Predicate semantics — empty/null/whitespace/non-string metadata                                                       |
| `app/(auth)/__tests__/sign-up.test.tsx`                | 25    | Form validation + exact `supabase.auth.signUp` payload shape + nav                                                    |
| `app/(onboarding)/__tests__/profile-setup.test.tsx`    | 13    | Validation, exact `updateUser` payload, error rendering, no manual nav                                                |
| `app/(protected)/profile/__tests__/index.test.tsx`     | 5     | Name + email render, navigation to edit-name, sign-out wiring                                                         |
| `app/(protected)/profile/__tests__/edit-name.test.tsx` | 5     | Pre-populated form, `updateUser` shape, success → `router.back()`                                                     |
| `app/(protected)/(tabs)/__tests__/index.test.tsx`      | 14    | Home reads name from `user_metadata`, no sign-out on home, avatar press → Perfil                                      |

Full suite: 303/303 pass.

---

## Out of scope (deliberate)

- **Avatar image upload** — `profiles.avatar_url` column already exists;
  no UI for it yet.
- **Cambio de email** — separate sensitive flow.
- **Auto-split** of `"Juan Pablo Pérez"` into first/last fields — the
  user picks the split themselves.
- **Push notifications with first_name** — hooks have access to
  `user.user_metadata`; payloads still need the groups feature before
  there's anything meaningful to send.
- **Group membership UI** — schema is friendly to it; UI is a follow-up
  feature.

---

## How to evolve this

- Avatar image picker → reuse the existing media upload pattern from
  the camera tab; write to `profiles.avatar_url`, propagate via the
  same trigger.
- Multi-language input → broaden the regex and add NFKC normalisation
  inside `nameSchema`'s validation pipeline.
- Real-name change audit → either rate-limit at the trigger (count
  recent metadata updates in a window) or move to an explicit
  `profile_change_audit` table.
