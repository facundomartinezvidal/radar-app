## 1. Scaffold isolated workspace

- [x] 1.1 Create `promo/package.json` with `remotion`, `@remotion/cli`, `@remotion/google-fonts`, `react`, `react-dom` and `dev` / `render` scripts
- [x] 1.2 Add `promo/remotion.config.ts` (1080×1920, 30 fps, H.264) and `promo/tsconfig.json` isolated from root
- [x] 1.3 Add `promo/src/Root.tsx` (empty registry placeholder) and `promo/src/index.ts` entry
- [x] 1.4 Exclude `promo/` from root `tsconfig`, jest config, eslint, and prettier; `promo/.gitignore` ignores `node_modules` + `out`
- [x] 1.5 Install deps inside `promo/` and confirm root `pnpm typecheck` + `pnpm test` still pass (1871 baseline)

## 2. Theme + reusable primitives

- [x] 2.1 `theme/tokens.ts` — colors, type scale, spacing, radii, motion easings/durations from `desing-system/colors_and_type.css`
- [x] 2.2 `theme/fonts.ts` — load Inter + JetBrains Mono via `@remotion/google-fonts`
- [x] 2.3 `components/LogoSweep.tsx` — inline `logo-mark.svg` with 360° radar sweep (1.8s) + wordmark + Tagline
- [x] 2.4 `components/KineticText.tsx` — fade+slide entrance on `ease-out` (`theme/anim.ts`)
- [x] 2.5 `components/Money.tsx` — tabular-nums, `$ 12.500,00` + explicit currency, semantic colors
- [x] 2.6 `components/PhoneFrame.tsx` (+ `Card`), `components/Scene.tsx` (Stage/Hook/Demo/Payoff), `components/MusicSlot.tsx` (optional `<Audio>`)

## 3. Feature mockups

- [x] 3.1 `mockups/WhatsAppChat.tsx` — chat sends expense, bot confirms
- [x] 3.2 `mockups/GroupBalances.tsx` — who-owes-whom resolving (green credit / red debt)
- [x] 3.3 `mockups/ReceiptScan.tsx` — ticket photo → fields pre-fill
- [x] 3.4 `mockups/InsightsChart.tsx` — category bars growing in + AI insight line
- [x] 3.5 `mockups/CurrencyToggle.tsx` — ARS↔USD toggle with FX conversion

## 4. Compositions

- [x] 4.1 `compositions/WhatsAppBot.tsx` (Hook/Demo/Payoff)
- [x] 4.2 `compositions/SharedExpenses.tsx`
- [x] 4.3 `compositions/DocumentCapture.tsx`
- [x] 4.4 `compositions/Insights.tsx`
- [x] 4.5 `compositions/MultiCurrency.tsx`
- [x] 4.6 Register all five in `Root.tsx`

## 5. Copy pass + verification

- [x] 5.1 Review all on-screen copy against design-system voice rules (voseo, sentence case, number/currency format, no jargon, no emoji)
- [x] 5.2 `promo/README.md` — how to preview (`dev`) and render, where to drop music, dep-isolation note
- [x] 5.3 Verify all five register at 1080×1920 / 30fps / 540f via `remotion compositions` (Studio preview available via `pnpm dev`)
- [x] 5.4 Render all five to `promo/out/*.mp4`; confirmed 1080×1920 / 30 fps / 18.05s / H.264
