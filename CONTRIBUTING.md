# Contributing

## Branching

`main` is the integration branch. Create feature branches from `main`:

```bash
git checkout -b feat/<topic>
```

PR back to `main` after CI passes. Direct commits to `main` are only for trivial one-liners (typos, version bumps).

## Commit Style

Use [Conventional Commits](https://www.conventionalcommits.org/):

| Prefix   | Use for                  |
| -------- | ------------------------ |
| `feat:`  | New feature or screen    |
| `fix:`   | Bug fix                  |
| `chore:` | Tooling, deps, config    |
| `docs:`  | Documentation only       |
| `test:`  | Adding or fixing tests   |
| `build:` | Build system, EAS config |
| `ci:`    | CI/CD pipeline changes   |

Example: `feat: add sign-out button to profile tab`

## Before Opening a PR

Run these checks locally — CI will also run them:

```bash
pnpm format       # Auto-fix formatting
pnpm lint         # ESLint
pnpm typecheck    # TypeScript
pnpm test         # Full test suite (29 tests, all must pass)
```

## Adding a New Screen

Drop a `.tsx` file in the appropriate route group — Expo Router registers it automatically:

```
app/(auth)/forgot-password.tsx        # public screen
app/(protected)/(tabs)/profile.tsx    # authenticated tab screen
app/(protected)/settings.tsx          # authenticated stack screen
```

No manual route registration needed.

## Adding a Dependency

For Expo SDK packages, always use `expo install` so the version is pinned to match the SDK:

```bash
pnpm dlx expo install expo-av
```

For non-Expo runtime packages:

```bash
pnpm add <pkg>
```

For dev-only packages:

```bash
pnpm add -D <pkg>
```

## Tests

- Place tests in `__tests__/` sibling to the file under test (e.g. `lib/__tests__/storage.test.ts`)
- Aim for unit coverage on logic in `lib/`, `stores/`, `hooks/`
- Screen-level tests use RNTL (`@testing-library/react-native`)
- Coverage thresholds are enforced — see `jest.config.js`
