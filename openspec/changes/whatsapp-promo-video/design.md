## Context

The `promo/` workspace is an isolated Remotion package (own `package.json`, `node_modules`, `remotion.config.ts`) with three shipped vertical promos — `Home`, `Tickets`, `Insights` — all 1080×1920 @ 30fps. They share a mature toolkit: `Device` (phone bezel + status bar + tab bar), `KineticText`, `LogoSweep`/`Tagline`, `MusicSlot`, theme `tokens.ts`/`anim.ts`/`fonts.ts`, and animated React-DOM screen mocks under `src/screens/`. Each composition is a single function reading `useCurrentFrame()` and `interpolate()`-ing element opacity/transform off the global timeline.

This change adds the WhatsApp-bot promo. The in-app connect flow has a real source screen to mirror (`app/(protected)/profile/whatsapp.tsx`); the WhatsApp chat is a net-new synthetic UI.

## Goals / Non-Goals

**Goals:**
- A 750-frame (~25s) `WhatsAppBot` composition following the established pattern, requiring zero new dependencies.
- Tell the full differentiator story: link in-app → chat to query spend and log an expense.
- Faithful in-app screen (mirrors real copy/layout) and a believable WhatsApp chat UI.
- Reuse every shared primitive; only add two screens + one composition + two registration edits.

**Non-Goals:**
- No real Supabase/Twilio data — chat content is hardcoded synthetic copy.
- No audio track (silent; `MusicSlot` wired for later).
- No changes to the mobile app source or the other promo compositions.
- Not folding into `promo-feature-videos` (separate, richer change by decision).

## Decisions

- **New change, not extending `promo-feature-videos`.** That change's `WhatsAppBot` blueprint is hook→mock→payoff; the requested narrative adds a full in-app connect flow and a two-turn chat. A dedicated change keeps the richer spec clean. *Alternative:* edit the existing blueprint — rejected as it muddies an in-flight multi-video change.
- **750 frames (~25s).** Budget: intro 0–90, connect flow 90–360, chat 360–630, outro+logo 630–750. Enough to read four phases without dragging. *Alternative:* 18s (too cramped for connect flow + 2-turn chat), 35s (slower than peers).
- **Two screen mocks vs. one combined.** `WhatsAppLink.tsx` lives inside `Device` with RADAR dark tokens; `WhatsAppChat.tsx` is its own WhatsApp-styled surface (green header, chat wallpaper, light-green/white bubbles). Splitting keeps each visually coherent and independently scrubbable. *Alternative:* one screen with a mode flag — rejected, the two palettes/chromes are too different.
- **Mirror the real app screen for copy.** Pull exact strings from `app/(protected)/profile/whatsapp.tsx` ("Vincular WhatsApp", "Tu código de vinculación", "Vence en 10 minutos", numbered steps, "Abrir WhatsApp") so the promo matches production. *Alternative:* invent copy — rejected, drifts from the shipped UX.
- **Query-then-load chat order.** User asks total → bot summarizes → user logs "Coto $38.500" → bot confirms "✓ Gasto registrado · Comida · $38.500". Shows both read and write value props in one exchange.
- **Phase transition by scale/slide + crossfade**, reusing `enter()`/`exit()` from `anim.ts`, consistent with how existing comps move between phone and overlay states.

## Risks / Trade-offs

- **WhatsApp green clashing with RADAR dark palette mid-video** → intentional and scoped to the chat phase; the transition crossfade and returning to RADAR logo at the end re-anchor the brand.
- **Timing too tight to read 4 messages in the chat window** → mitigate by staggering bubble entrances and using typing indicators; tune in Remotion Studio during `/build`.
- **`render-all.mjs` currently omits `Tickets`** → add both `WhatsAppBot` and `Tickets` so batch render is complete (minor, flagged in plan).
- **No automated tests in `promo/`** → acceptable; verification is visual scrub + sample render, and the app test baseline is untouched.

## Migration Plan

Additive only. New files + two registration edits; no schema, API, or app changes. Rollback = delete the three new files and revert the two edits. No deploy step — promos are rendered on demand.

## Open Questions

- Final exact intro/outro wording (placeholders proposed) — can be finalized visually during `/build`.
- Whether to deep-link-animate the WhatsApp app icon on the "Abrir WhatsApp" press or hard-cut into the chat — decide in Studio.
