## 1. In-app connect-flow screen

- [x] 1.1 Create `promo/src/screens/WhatsAppLink.tsx` mirroring `app/(protected)/profile/whatsapp.tsx` layout/copy, using RADAR dark `tokens` + `ds/Text`/`primitives` inside content area
- [x] 1.2 Render the not-linked state: title "Vincular WhatsApp", subtitle, primary "Generar código" button, code card ("Tu código de vinculación" → tabular-nums code e.g. `4F2K9X` → "Vence en 10 minutos"), numbered instructions card, secondary "Abrir WhatsApp" button
- [x] 1.3 Animate the sequence off `useCurrentFrame()`: "Generar código" press → code/instructions reveal (via `enter()`) → "Abrir WhatsApp" press

## 2. WhatsApp chat screen

- [x] 2.1 Create `promo/src/screens/WhatsAppChat.tsx` with WhatsApp chrome: green header (`#075E54`/`#128C7E`), "RADAR" contact name, chat-wallpaper background
- [x] 2.2 Build in/out bubble components (out = `#DCF8C6`, in = white) with timestamps and staggered fade+slide entrance; add a typing indicator before each bot reply
- [x] 2.3 Script the query-then-load exchange (voseo): user "¿Cuánto gasté este mes?" → bot month summary → user "Coto $38.500" → bot "✓ Gasto registrado · Comida · $38.500"

## 3. Composition

- [x] 3.1 Create `promo/src/compositions/WhatsAppBot.tsx` (750 frames) with `AbsoluteFill` base, ambient radial glow, and `MusicSlot src={music}` wired
- [x] 3.2 Phase 1 (0–90): intro `KineticText` hook, fades out
- [x] 3.3 Phase 2 (~90–360): `Device` + `<WhatsAppLink/>`, connect flow plays
- [x] 3.4 Phase 3 (~360–630): transition (scale/slide crossfade via `anim.ts`) into `Device` + `<WhatsAppChat/>`
- [x] 3.5 Phase 4 (~630–750): outro `KineticText` payoff → centered `LogoSweep variant="wordmark"` + `Tagline`

## 4. Register and render

- [x] 4.1 Register `<Composition id="WhatsAppBot" component={WhatsAppBot} {...base} durationInFrames={750} />` in `promo/src/Root.tsx`
- [x] 4.2 Add `'WhatsAppBot'` (and the currently-missing `'Tickets'`) to the `comps` array in `promo/scripts/render-all.mjs`

## 5. Verify

- [x] 5.1 `cd promo && pnpm dev` → scrub `WhatsAppBot`: confirm four phases read clearly, voseo copy, RADAR dark in-app + WhatsApp green chat, logo centered at end
- [x] 5.2 `cd promo && pnpm render WhatsAppBot out/WhatsAppBot.mp4` → confirm 1080×1920 h264 ~25s MP4
- [x] 5.3 Confirm `Home`/`Insights`/`Tickets` still render (no regression)
