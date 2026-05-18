# ADR: User identity fields (first_name + last_name)

**Date:** 2026-05-17
**Status:** Accepted
**Scope:** mobile app (`radar-app`) + Supabase Postgres + Auth + Email
templates

---

## Context

The original `profiles` schema (ADR `2026-05-17-expenses-schema.md`)
stored only `display_name`, defaulted by the trigger to the email
prefix. Home greeted users with `Hola, {emailPrefix}` and the header
avatar showed a single capital letter cut from that same prefix. Neither
was a real identity — the product had no way to say _Hola, Facundo_.

The user-flows mirror in `obsidian-vaults/uade/seminario/user-flows/`
(HU-04 menú principal) explicitly calls out _"Hola, {nombre derivado del
email}"_ as a known shortcut and points at a future HU-02 (registro con
nombre) which had never been written. Groups, push notifications, email
greetings, and any future shared-expense attribution all need real
names.

## Decision

### Capture point: sign-up form

`first_name` and `last_name` are collected as two required fields on the
existing `app/(auth)/sign-up.tsx` form, above the email. Validation
lives in `lib/schemas/profile.ts` (`nameSchema`): trim → min 2 → max
40 → regex `/^[A-Za-zÀ-ÿñÑ\s'-]+$/u`. The same schema is reused by the
onboarding profile-setup screen and the edit-name flow so all three
entry points share one source of truth.

Rejected alternatives:

- **Post-OTP onboarding only** — would add a screen for every new
  signup, hurts conversion, and doesn't help us personalise the OTP
  email (which is sent _before_ the user reaches any screen).
- **Profile screen only** — too easy to skip. Home would stay on the
  email-prefix fallback for users who never visit Perfil.

### Storage: dual write — `user_metadata` + `profiles`

The sign-up form passes `{ first_name, last_name }` to Supabase via
`supabase.auth.signUp({ options: { data } })`. Those keys land in
`auth.users.raw_user_meta_data`. A pair of triggers mirrors the data
into `public.profiles`:

- `handle_new_user()` (existing function, rewritten) reads
  `raw_user_meta_data->>'first_name'` and `'last_name'`, inserts a
  `profiles` row, and computes `display_name = nullif(trim(first || ' '
|| last), '')`.
- `handle_user_metadata_update()` (new) listens for
  `update of raw_user_meta_data on auth.users` and writes the same
  three columns into the existing `profiles` row. Guarded with
  `when (old.raw_user_meta_data is distinct from new.raw_user_meta_data)`
  so JWT refreshes that don't change metadata don't fire the function.

Why dual:

- `user_metadata` rides in the JWT, so the UI greets the user without a
  follow-up fetch to `profiles`. The auth store already holds it.
- `profiles.first_name` / `profiles.last_name` are queryable from RLS
  policies and joinable — they're what `groups`, future `expense
attribution`, and `AI insights` will read.

Single source of truth without dual-write coordination drift: the trigger
keeps them aligned and edits flow through
`supabase.auth.updateUser({ data })` — never a direct `profiles` write
from the client.

### `display_name`: computed by the trigger

Kept as a nullable column for backwards compatibility (the categories
ADR documents it as the user-facing label). Now computed as
`trim(first_name || ' ' || last_name)` with `nullif(_, '')` so callers
get `null` instead of an empty string when names aren't set. The home
screen reads `first_name` directly (not `display_name`) so the greeting
stays "Hola, {first_name}" rather than "Hola, {full name}".

### Validation regex — what's allowed

`/^[A-Za-zÀ-ÿñÑ\s'-]+$/u`:

- `À-ÿ` covers accented Latin glyphs including most Spanish, Portuguese,
  French names.
- `ñ` / `Ñ` are explicit because they sit outside `À-ÿ` in the basic
  Unicode block.
- Space, apostrophe, hyphen → "Del Río", "O'Brien", "Martinez-Vidal".

Rejected: digits, emojis, symbols. Names are not handles.

### Avatar fallback: 2 initials + hash colour

`<Avatar firstName={...} lastName={...} size={...} imageUrl={...} />` is
the new primitive in `components/ui/avatar.tsx`. When no `imageUrl` is
provided it renders a circle with 1–2 uppercase initials over a colour
sampled from `AVATAR_PALETTE` — eight DS tokens (blues + ambers +
emeralds, no purple/pink per design rules), keyed by a deterministic
sum-of-charCodes hash of the full name. Same input → same colour across
sessions and devices.

### Onboarding gate for legacy users

A third Expo Router group `app/(onboarding)/` hosts the
`profile-setup.tsx` screen. The gate predicate
`hasCompletedProfile(user)` (in `lib/profile/completion.ts`) reads the
JWT metadata; both `(auth)/_layout.tsx` and `(protected)/_layout.tsx`
redirect authenticated-but-nameless users into the onboarding stack
before mounting tabs. New signups already supply both names, so the
gate is a no-op for them; legacy accounts created before this feature
hit the screen once on their next login.

### OTP email greeting

`docs/auth/email-templates/confirm-signup.html` now opens with
`{{ if .Data.first_name }}Hola {{ .Data.first_name }},{{ else }}Hola,{{ end }}`.
The Go-template guard falls back gracefully if metadata is absent.
Template must be re-pasted into Supabase Dashboard → Authentication →
Email Templates → Confirm signup.

---

## Alternatives considered

### A. Single `full_name` column

Discarded. Splitting at write time loses the user's intent (which is
first vs. last). Personalising "Hola, X" needs the first half cleanly —
auto-splitting "Juan Pablo Pérez González" produces the wrong answer.

### B. `user_metadata` only, skip `profiles` columns

Discarded. `profiles` is the canonical record for everything joinable
(groups, attribution). Storing names only in `user_metadata` would force
every server-side query that wants a name to hit `auth.users`, which
RLS makes awkward.

### C. Per-screen auth guards for profile completion

Discarded. We already enforce auth gating in route group layouts; adding
the profile gate to the same place keeps the policy in one file per
group.

### D. Avatar background colour derived from email

Discarded. The 8-hue palette derived from the _name_ is stable for the
user across email changes, and the DS spec calls out "iniciales sobre
círculo con color por hash del nombre".

---

## Consequences

- Every new signup costs the user 2 extra inputs (~5 seconds). Worth it
  for the personalisation it unlocks across home, push, OTP email, and
  future groups.
- Legacy users created before 2026-05-17 hit the onboarding gate once on
  their next session. The migration backfills them with empty strings
  so the predicate correctly identifies them as incomplete.
- The `profiles.display_name` column is now computed by the trigger and
  should not be written to from the client. If a future UX wants
  manual nicknames separate from the legal name, we'll add a `nickname`
  column rather than reusing `display_name`.
- Avatar palette is intentionally narrow (8 hues). At ~64 users the
  birthday-paradox probability of two users with the same colour is
  about 99%. That's fine — the colour is decoration, not identity.

---

## How to evolve this

- **Avatar image upload**: `profiles.avatar_url` already exists. Wire a
  Supabase Storage bucket + image picker on the Perfil edit screen.
- **Real-name change rate-limiting**: if abuse appears, add a
  `name_changes_remaining` column or a `profile_change_audit` table.
- **Nickname**: add `profiles.nickname text` and let the user override
  the home greeting independently from the legal first name.
- **Multi-language**: input regex covers the Latin set today; if we
  ever ship beyond Latin scripts, broaden the regex and add NFKC
  normalisation in the schema's `.transform()`.
