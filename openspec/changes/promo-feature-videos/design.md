# Design: promo-feature-videos

## Context

Marketing pieces for RADAR's differentiating features, due alongside the 2026-06-22
Segundo Parcial. No video tooling exists; the app is pre-product (no screenshots) but
the design system is complete (tokens, brand SVGs, es-AR voice rules). Output: 5
vertical 9:16 videos, kinetic typography + music (no VO), app UI recreated as animated
mockups in Remotion.

## Goals

- Brand-accurate videos driven by the real design-system tokens.
- Re-renderable from source (copy/style changes = re-render, no manual editing).
- Zero impact on the Expo app (deps, typecheck, tests).

## Non-goals

- Real screen recordings (app not shippable yet) — mockups only.
- Voice-over / TTS narration.
- A shared "sizzle" reel — five separate per-feature videos.
- Music licensing/sourcing — user supplies a royalty-free track; default render is silent.

## Key decisions

1. **Isolated `promo/` workspace.** Remotion runs on React DOM; the root has React 19.1
   + RN 0.81 + react-native-web. A nested package with its own `node_modules` avoids
   peer-dep conflicts. Trade-off: a second dependency tree to maintain — acceptable for
   a standalone marketing artifact.
2. **Exclude `promo/` from root tooling.** Add ignores in root `tsconfig`, `jest`
   config, and `eslint` so the 1871-test baseline and typecheck are unaffected.
3. **Fonts via `@remotion/google-fonts`.** Inter (text) + JetBrains Mono (amounts) are
   bundled into the render — deterministic, no CDN fetch, no CSP issues.
4. **Tokens module mirrors `colors_and_type.css`.** Single `theme/tokens.ts` re-exports
   colors/type/spacing/radii/motion so compositions never hardcode hex/px.
5. **Reusable primitives over per-video code.** `PhoneFrame`, `LogoSweep` (radar mark
   360° sweep in 1.8s + wordmark), `KineticText` (fade+slide on `ease-out`), `Money`
   (tabular-nums, `$ 12.500,00`), `Scene` (Hook/Demo/Payoff `Sequence` wrappers),
   `MusicSlot` (optional `<Audio>`). Each video = composition wiring primitives + its mockup.
6. **Optional audio.** `MusicSlot` renders nothing when no file in `promo/public/`,
   so renders work out of the box; pointing it at a track adds music.
7. **18s @ 30fps (540 frames).** Reel-friendly length; acts ≈ 3s / 10s / 5s.

## Scene blueprint (per video)

- **Hook (0–3s):** pain/question in `KineticText` on `#0A0F1A`.
- **Demo (3–13s):** `PhoneFrame` + feature mockup animating.
- **Payoff (13–18s):** benefit line + `LogoSweep` wordmark + tagline.

## Copy (es-AR drafts)

| Video | Hook | Payoff |
|---|---|---|
| WhatsApp | «Cargá un gasto sin abrir la app.» | «Escribile a RADAR por WhatsApp.» |
| Compartidos | «Basta de "después arreglamos".» | «Dividí y saldá en segundos.» |
| OCR/Docs | «Sacale una foto al ticket.» | «El gasto se carga solo.» |
| Insights | «¿Sabés en qué se te fue la plata?» | «RADAR te lo muestra claro.» |
| Multi-moneda | «Pesos y dólares, sin cuentas a mano.» | «Tu plata, en cualquier moneda.» |

All closings end on «RADAR. Sabé a dónde va tu plata.»

## Risks / trade-offs

- **Render env:** Remotion downloads Chrome Headless Shell + bundles ffmpeg on first
  render; needs disk + a working render host. Mitigation: documented in `promo/README`.
- **Second dep tree:** divergence from root React version is fine (isolated) but must
  be remembered when upgrading. Mitigation: README note.
- **Mockup ≠ real UI:** mockups may drift from the shipped app. Acceptable for promo;
  built from the same tokens to stay close.

## Testing

Motion-graphics videos have no meaningful unit tests. Verification = Remotion Studio
visual review of all 5 + successful render of all 5 to conforming MP4s. No artificial
Jest tests are added to the root suite.
