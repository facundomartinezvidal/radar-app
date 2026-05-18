# RADAR — Email templates

HTML email templates for Supabase Auth flows. Dark-first, brand-faithful,
Spanish rioplatense. Every template is plain HTML + inline CSS — paste it
directly into the Supabase Dashboard.

## Templates

| File                  | Supabase template name | Trigger                             |
| --------------------- | ---------------------- | ----------------------------------- |
| `confirm-signup.html` | Confirm signup         | First-time email + password sign-up |

> Reset password, magic link, email change, and re-auth templates pending.

## Flow type — OTP (NOT email link)

The app uses **OTP codes** rather than confirmation links. Reason: in Expo
Go, custom deep-link schemes (`radar://`) don't resolve back to the app,
so a click-the-link confirmation flow is fragile in development. Instead:

1. App calls `supabase.auth.signUp({ email, password })` **without**
   `emailRedirectTo` → Supabase sends an email containing `{{ .Token }}`
   (6-digit code).
2. User reads the code from the email.
3. User types the code into the `verify-otp` screen in the app.
4. App calls `supabase.auth.verifyOtp({ email, token, type: 'signup' })`.
5. Supabase returns a session → `useAuthListener` flips the store →
   `(auth)/_layout` redirects to `(protected)/(tabs)`.

The template puts `{{ .Token }}` front-and-center as a JetBrains-Mono
display block. A `Confirmar en el navegador` link is kept as a fallback
for users who prefer the legacy URL flow.

## How to apply

Supabase exposes email-template editing **only through the Dashboard or the
Management API**, not via SQL. The MCP server in this repo can't change them
directly — paste manually:

1. Open **Supabase Dashboard** → project `miiorhmqxdqsowqxnpii`
2. Navigate to **Authentication → Email Templates**
3. Pick the row that matches the file (e.g. **Confirm signup**)
4. In the **Message (HTML)** field, replace the default with the file
   contents (everything from `<!doctype html>` to `</html>`)
5. (Optional) Set **Subject** to:
   - `Confirm signup` → `Confirmá tu cuenta · RADAR`
6. Click **Save changes**
7. Trigger a real signup from the app to verify rendering across:
   - Gmail (web + iOS app)
   - Apple Mail (iOS + macOS)
   - Outlook desktop (if relevant to your audience)

## Supabase template variables

The templates use these Go-template placeholders (Supabase resolves them
server-side before sending):

| Variable                 | Meaning                                                                                  |
| ------------------------ | ---------------------------------------------------------------------------------------- |
| `{{ .ConfirmationURL }}` | Single-use action link                                                                   |
| `{{ .Email }}`           | The recipient's email                                                                    |
| `{{ .SiteURL }}`         | Site URL configured in Auth                                                              |
| `{{ .Token }}`           | OTP token (alternative to URL)                                                           |
| `{{ .TokenHash }}`       | Hashed OTP token                                                                         |
| `{{ .Data.<key> }}`      | Any key from `auth.users.raw_user_meta_data` (set via `signUp({ options: { data } })`) — |
|                          | e.g. `{{ .Data.first_name }}` resolves to the name the user typed at sign-up.            |

Go-template control flow is supported, so templates can guard for legacy
accounts that never set the key:

```html
{{ if .Data.first_name }}Hola {{ .Data.first_name }},{{ else }}Hola,{{ end }}
```

Reference: https://supabase.com/docs/guides/auth/auth-email-templates

## Design rules

- **Inline CSS only** — Gmail strips `<head><style>`.
- **Table-based layout** — Outlook desktop ignores CSS flex/grid.
- **No remote images** — broken-image icons hurt trust; we build the logo
  with CSS shapes (`border-radius: 999px` discs + bold `R` glyph).
- **System font stack** — most clients block `@font-face`. Inter sits in the
  stack but falls through to SF / Segoe / Roboto cleanly.
- **600 px max width** — universal email-safe content width.
- **Dark `#0A0F1A` background** with brand `#0077B6` CTA — same tokens as
  the app DS (`desing-system/colors_and_type.css`).
- **Spanish rioplatense voseo** — _Confirmá · Registrá · Dividí · Sumate_.
  Sentence case. No emoji.
- **Preheader text** — the hidden snippet inbox clients show next to the
  subject. Sets expectation ("link vence en 24 hs.").
- **MSO conditional comments** — render a VML rounded button for Outlook
  desktop (no `border-radius` support there).

## Testing tips

- Send to yourself first; Litmus / Email on Acid are overkill at this stage.
- Open the raw `.html` file in a browser to preview the desktop render.
- Check both light- and dark-mode Apple Mail — `meta name="color-scheme"`
  hints that we ship dark.

## Audit trail

- 2026-05-16 — initial `confirm-signup.html`.
- 2026-05-17 — `confirm-signup.html` personalised: greeting now reads
  `Hola {{ .Data.first_name }},` when the sign-up form supplied a name.
  Falls back to `Hola,` for legacy accounts (no metadata) and for any
  future flow where the key isn't populated. Paste the updated file into
  Supabase Dashboard → Authentication → Email Templates → Confirm signup.
