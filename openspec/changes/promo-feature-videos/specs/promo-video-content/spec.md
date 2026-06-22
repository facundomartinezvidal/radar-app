# promo-video-content

## ADDED Requirements

### Requirement: One video per differentiating feature

There SHALL be exactly five compositions, one per differentiating feature: WhatsApp
bot, shared expenses, document/OCR capture, AI insights, and ARS/USD multi-currency.

#### Scenario: Five compositions registered

- **GIVEN** the promo workspace
- **WHEN** the Remotion Studio loads the root
- **THEN** five compositions are listed, one for each feature above
- **AND** each renders independently to its own MP4

### Requirement: Three-act scene structure

Each video SHALL follow a Hook → Demo → Payoff structure within ~18 seconds.

#### Scenario: Each video has hook, demo and payoff

- **GIVEN** any of the five compositions
- **WHEN** it plays start to finish
- **THEN** the first ~3s present a hook line, the middle ~10s show the feature mockup
  animating, and the final ~5s show a payoff line plus the RADAR wordmark and tagline
- **AND** the closing frame displays «RADAR. Sabé a dónde va tu plata.»

### Requirement: Animated app mockups

The Demo act of each video SHALL recreate the feature's UI as an animated mockup using
the design-system tokens, inside a phone frame.

#### Scenario: WhatsApp video shows a chat capturing an expense

- **GIVEN** the WhatsApp bot composition
- **WHEN** the Demo act plays
- **THEN** a phone frame shows a chat where the user sends an expense and the bot
  confirms it
- **AND** the confirmed amount renders with tabular-nums in `$ 12.500,00` format

#### Scenario: Shared-expenses video shows who-owes-whom resolving

- **GIVEN** the shared-expenses composition
- **WHEN** the Demo act plays
- **THEN** group balances animate into a settled state with credits in green and
  debts in red

### Requirement: Spanish rioplatense copy compliant with the design system

All on-screen text SHALL be in Spanish rioplatense and SHALL follow the design-system
voice rules.

#### Scenario: Copy follows voice and formatting rules

- **GIVEN** the rendered text of any video
- **WHEN** it is reviewed against the design-system content rules
- **THEN** CTAs use voseo (e.g. Registrá / Dividí / Saldá / Sumá), titles use sentence
  case, amounts use `$ 12.500,00` with explicit currency (`ARS` / `US$`)
- **AND** there is no fintech jargon and no emoji in the mockup UI

### Requirement: Legibility and contrast

On-screen text SHALL remain legible on the dark background for the duration it is shown.

#### Scenario: Hook and payoff text are readable

- **GIVEN** a video playing on the `#0A0F1A` background
- **WHEN** hook or payoff text is on screen
- **THEN** the text uses the high-emphasis foreground (`#F4F7FB`)
- **AND** it stays on screen long enough to be read at normal reel pace
