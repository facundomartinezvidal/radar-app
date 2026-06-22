## ADDED Requirements

### Requirement: WhatsApp promo composition registration

The system SHALL register a Remotion composition with id `WhatsAppBot` in `promo/src/Root.tsx`, configured at 1080×1920, 30fps, and 750 frames (~25s), reusing the shared `base` props object, and SHALL include `WhatsAppBot` in the batch render list in `promo/scripts/render-all.mjs`.

#### Scenario: Composition appears in Remotion Studio
- **WHEN** a developer runs `pnpm dev` in `promo/` and opens Remotion Studio
- **THEN** a composition named `WhatsAppBot` is listed and scrubs across exactly 750 frames at 1080×1920, 30fps

#### Scenario: Composition renders to MP4
- **WHEN** a developer runs `pnpm render WhatsAppBot out/WhatsAppBot.mp4` in `promo/`
- **THEN** a 1080×1920 h264 MP4 of ~25s is produced without error

#### Scenario: Batch render includes the new video
- **WHEN** the batch render script `render-all.mjs` is executed
- **THEN** `WhatsAppBot` is among the composition ids it renders

### Requirement: Four-phase narrative structure

The composition SHALL present four sequential phases on a continuous timeline: (1) intro words, (2) in-app connect flow, (3) WhatsApp chat, (4) outro words with centered logo — with the in-app phase preceding the WhatsApp-chat phase.

#### Scenario: Intro hook
- **WHEN** the video plays from frame 0 to ~90 (first ~3s)
- **THEN** kinetic hook copy fades in centered (e.g. "Cargá un gasto" / "sin abrir la app.") and fades out before the next phase

#### Scenario: In-app connect flow
- **WHEN** playback reaches the in-app phase (~frames 90–360)
- **THEN** a phone `Device` frame shows the RADAR "Vincular WhatsApp" screen and the connect flow plays in order: "Generar código" press → linking code reveals → "Abrir WhatsApp" press

#### Scenario: WhatsApp chat phase
- **WHEN** playback reaches the chat phase (~frames 360–630)
- **THEN** the screen transitions into a WhatsApp-style chat that plays the query-then-load exchange

#### Scenario: Outro and logo
- **WHEN** playback reaches the final phase (~frames 630–750)
- **THEN** payoff copy (e.g. "Escribile a RADAR" / "por WhatsApp.") fades into a centered `LogoSweep` wordmark plus the `Tagline` "Sabé a dónde va tu plata."

### Requirement: In-app connect-flow mock

The system SHALL provide an animated `promo/src/screens/WhatsAppLink.tsx` that mirrors `app/(protected)/profile/whatsapp.tsx` in layout and copy, driven by `useCurrentFrame()`, using RADAR dark theme tokens inside the `Device` frame.

#### Scenario: Screen content matches the app
- **WHEN** the connect-flow mock is displayed
- **THEN** it shows the title "Vincular WhatsApp", the subtitle about linking the number, a primary "Generar código" button, a code card labeled "Tu código de vinculación" with a prominent tabular-nums code and "Vence en 10 minutos", a numbered instructions card, and a secondary "Abrir WhatsApp" button

#### Scenario: Flow animates in sequence
- **WHEN** the connect-flow phase plays
- **THEN** the code card and instructions are revealed only after the "Generar código" press is animated, and the "Abrir WhatsApp" press is animated last

### Requirement: WhatsApp chat mock — query then load

The system SHALL provide an animated `promo/src/screens/WhatsAppChat.tsx` rendering a WhatsApp-style chat (green header, RADAR contact name, in/out bubbles with staggered entrance and timestamps) that plays a query-then-load exchange in Spanish rioplatense (voseo).

#### Scenario: Message order and content
- **WHEN** the chat phase plays
- **THEN** messages appear in order: user "¿Cuánto gasté este mes?" → bot reply summarizing the month's total → user logging an expense (e.g. "Coto $38.500") → bot confirmation "✓ Gasto registrado · Comida · $38.500"

#### Scenario: WhatsApp visual styling
- **WHEN** the chat is shown
- **THEN** outgoing bubbles use the WhatsApp light-green fill and incoming (bot) bubbles use white, distinct from the RADAR in-app dark palette of the previous phase

#### Scenario: Bot reply is preceded by activity
- **WHEN** the bot is about to respond
- **THEN** a typing indicator or comparable delay precedes each bot bubble so the exchange reads as a real conversation

### Requirement: Brand and content rules

The composition SHALL follow RADAR brand and content rules: all on-screen copy in Spanish rioplatense (voseo, sentence case, no emoji in base UI beyond the confirmation check), and the video SHALL render silent by default with the `MusicSlot` wired so a track can be added later.

#### Scenario: Silent by default
- **WHEN** the composition is rendered without a `music` prop
- **THEN** it produces valid output with no audio and `MusicSlot` renders nothing

#### Scenario: Closing brand lockup
- **WHEN** the video ends
- **THEN** the RADAR wordmark is centered with the tagline "Sabé a dónde va tu plata."
