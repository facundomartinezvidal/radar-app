# promo-video-pipeline

## ADDED Requirements

### Requirement: Isolated Remotion workspace

The promo videos SHALL live in a self-contained `promo/` workspace with its own
`package.json` and dependency tree, isolated from the Expo app's dependencies.

#### Scenario: Installing promo deps does not touch app deps

- **GIVEN** the repo root has the Expo app with React 19.1 and RN 0.81
- **WHEN** dependencies are installed inside `promo/`
- **THEN** `remotion`, `@remotion/cli` and `@remotion/google-fonts` resolve under
  `promo/node_modules`
- **AND** the root `package.json` gains no Remotion dependency

#### Scenario: Root tooling ignores the promo workspace

- **GIVEN** the `promo/` workspace exists with `.tsx` sources
- **WHEN** `pnpm typecheck` and `pnpm test` run from the repo root
- **THEN** both pass and report the 1871-test baseline unchanged
- **AND** no file under `promo/` is type-checked, linted, or tested by root tooling

### Requirement: Render configuration

Every composition SHALL render as a vertical 9:16 video at 1080×1920, 30 fps, H.264.

#### Scenario: Rendering a composition produces a conforming MP4

- **GIVEN** a registered composition
- **WHEN** it is rendered via the Remotion CLI to `promo/out/<name>.mp4`
- **THEN** the output is 1080×1920, 30 fps, H.264
- **AND** its duration is approximately 18 seconds (540 frames)

### Requirement: Bundled fonts and offline assets

Fonts and brand assets SHALL be bundled into the render with no external network fetch
at render time.

#### Scenario: Inter and JetBrains Mono are available without network

- **GIVEN** a composition that uses Inter for text and JetBrains Mono for amounts
- **WHEN** it renders with networking disabled
- **THEN** both typefaces display correctly
- **AND** no request is made to a font CDN

### Requirement: Brand-compliant theme

The workspace SHALL expose the design-system tokens (colors, type scale, spacing,
radii, motion easings/durations) so compositions reference tokens instead of literals.

#### Scenario: Compositions consume tokens

- **GIVEN** the theme module derived from `desing-system/colors_and_type.css`
- **WHEN** a composition renders a card, an amount, and an entrance animation
- **THEN** the background uses `#0A0F1A`, the primary accent uses `#0077B6`,
  income uses `#10B981`, expense uses `#EF4444`
- **AND** entrance motion uses the design-system `ease-out` curve

### Requirement: Optional audio slot

Compositions SHALL support an optional background-music track and SHALL render
silently when no track is provided.

#### Scenario: Render without a music file

- **GIVEN** no audio file is present in `promo/public/`
- **WHEN** any composition renders
- **THEN** the render succeeds and produces a silent video

#### Scenario: Render with a music file

- **GIVEN** a royalty-free track placed in `promo/public/`
- **WHEN** the audio slot is pointed at that file
- **THEN** the rendered video includes the background music
