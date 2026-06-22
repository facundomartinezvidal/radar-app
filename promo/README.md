# RADAR — Promo videos (Remotion)

Five vertical 9:16 promo videos, one per differentiating feature, built with
[Remotion](https://www.remotion.dev/). Kinetic typography in Spanish rioplatense +
optional music; app UI recreated as animated mockups using the design-system tokens.

> **Isolated workspace.** This folder has its **own** `package.json` / `node_modules`
> and is deliberately separate from the Expo app (React DOM here vs React Native in
> the root). The root `tsconfig`, `jest`, `eslint` and `prettier` all ignore `promo/`,
> so it never affects the app's typecheck/test/lint gates. Don't hoist these deps to
> the root.

## Compositions

| Id | Feature | 9:16 · 30fps · ~18s |
|---|---|---|
| `WhatsAppBot` | Cargar gastos por WhatsApp | ✓ |
| `SharedExpenses` | Gastos compartidos (quién-debe-a-quién) | ✓ |
| `DocumentCapture` | Captura OCR / foto al ticket | ✓ |
| `Insights` | Insights con IA | ✓ |
| `MultiCurrency` | Multi-moneda ARS/USD | ✓ |

Each video follows **Hook → Demo → Payoff** and closes on the mark + tagline
«RADAR. Sabé a dónde va tu plata.»

## Setup

```bash
cd promo
pnpm install
# esbuild's install script is skipped by pnpm by default; if a render complains
# about esbuild, run: pnpm rebuild esbuild   (or `pnpm approve-builds`)
```

Requires Node 24 + pnpm. First render downloads Chrome Headless Shell (~85 MB) and
uses Remotion's bundled ffmpeg.

## Preview

```bash
pnpm dev        # opens Remotion Studio — scrub all 5 compositions
```

## Render

```bash
# one video
pnpm render WhatsAppBot out/WhatsAppBot.mp4

# all five → promo/out/*.mp4 (1080x1920, 30fps, h264)
pnpm render:all
```

## Music (optional)

Renders are **silent by default**. To add a background track:

1. Drop a royalty-free `.mp3` in `promo/public/` (e.g. `music.mp3`).
2. Per video pass the prop, e.g.
   `pnpm render WhatsAppBot out/WhatsAppBot.mp4 --props='{"music":"music.mp3"}'`
   or render all with music: `PROMO_MUSIC=music.mp3 pnpm render:all`.

`MusicSlot` renders nothing when no `music` prop is given, so nothing breaks without a track.

## Structure

```
src/
├── Root.tsx              registers the 5 <Composition>s
├── theme/                tokens.ts · fonts.ts · anim.ts  (mirror of the design system)
├── components/           LogoSweep · KineticText · Money · PhoneFrame · Scene · MusicSlot
├── mockups/              one animated app screen per feature
└── compositions/         one Hook/Demo/Payoff video per feature
```

## Editing copy

All on-screen text lives in `src/compositions/*.tsx` (hook/payoff) and the matching
`src/mockups/*.tsx` (in-app strings). Keep it Spanish rioplatense per the design
system: voseo in CTAs, sentence case, amounts as `$ 12.500,00` with explicit currency
(`ARS` / `US$`), no fintech jargon, no emoji in the mockup UI.
