## Why

RADAR's headline differentiator is registering and querying expenses straight from WhatsApp, yet there is no promo video for it. The existing `promo-feature-videos` change lists a `WhatsAppBot` clip as planned-but-unbuilt with only a thin hook → mock → payoff blueprint. We need a self-contained, narrative promo that actually shows the end-to-end story: link your number in-app, then chat with RADAR on WhatsApp to ask about your spend and log a new expense — for the 2026 deliverables and social distribution.

## What Changes

- Add a new Remotion composition `WhatsAppBot` (id `WhatsAppBot`) to the existing isolated `promo/` workspace: 1080×1920, 30fps, 750 frames (~25s), silent by default.
- Four-phase narrative: (1) intro kinetic words, (2) in-app "Vincular WhatsApp" connect flow (generate code → code reveals → "Abrir WhatsApp"), (3) WhatsApp-style chat simulating a query-then-load exchange, (4) outro words + centered RADAR logo lockup.
- Add two new animated screen mocks: `WhatsAppLink.tsx` (mirrors `app/(protected)/profile/whatsapp.tsx`) and `WhatsAppChat.tsx` (WhatsApp chat UI).
- Register the composition in `promo/src/Root.tsx` and add `WhatsAppBot` to the batch render list in `promo/scripts/render-all.mjs`.
- Reuse existing promo primitives unchanged: `Device`, `KineticText`, `LogoSweep`/`Tagline`, `MusicSlot`, theme `tokens`/`anim`/`fonts`.

## Capabilities

### New Capabilities
- `promo-whatsapp-video`: The WhatsApp-bot promo video composition — its narrative structure, scene timing, on-screen content (Spanish rioplatense), brand/visual rules, and the two screen mocks that drive it.

### Modified Capabilities
<!-- None. No existing spec requirements change. -->

## Impact

- **Workspace**: `promo/` only (isolated package; its own `package.json`/`node_modules`). No change to the mobile app source.
- **New files**: `promo/src/screens/WhatsAppLink.tsx`, `promo/src/screens/WhatsAppChat.tsx`, `promo/src/compositions/WhatsAppBot.tsx`.
- **Modified files**: `promo/src/Root.tsx`, `promo/scripts/render-all.mjs`.
- **Tests**: none — the promo workspace has no jest suite; verification is visual via Remotion Studio. The app's 1871-test baseline is untouched.
- **Dependencies**: none added; uses installed Remotion + existing promo components.
- **Reference (read-only)**: `app/(protected)/profile/whatsapp.tsx` for connect-flow copy.
