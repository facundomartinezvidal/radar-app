## Why

RADAR necesita piezas de marketing que muestren sus features diferenciales para
redes (Reels/Stories/TikTok) y para la presentación del Segundo Parcial (2026-06-22).
Hoy no hay tooling de video en el repo y la app está pre-product (sin screenshots),
pero el design system está completo. Producir los videos como código Remotion permite
recrear la UI con los tokens reales del DS, mantener consistencia de marca y
re-renderizar al cambiar copy o estilos.

## What Changes

- Nuevo workspace **aislado** `promo/` (su propio `package.json` + `node_modules`) con
  Remotion 4, separado del app Expo para evitar choques de peer-deps (React 19 / RN 0.81).
- Tooling del root (tsconfig, jest, eslint) **excluye** `promo/` — sin impacto en
  `pnpm typecheck` / `pnpm test` (baseline 1871 tests).
- **5 videos verticales 9:16 (1080×1920, 30fps, ~18s, h264)**, uno por feature
  diferencial: bot de WhatsApp, gastos compartidos, captura OCR/documentos, insights
  con IA, multi-moneda ARS/USD.
- Estética: **kinetic typography en español rioplatense + música** (sin voz en off);
  UI de la app recreada como **mockup animado** con los tokens del design system.
- Primitivos reutilizables (theme, fonts, logo con barrido radar, marco de teléfono,
  texto cinético, cifras con tabular-nums) y mockups de pantalla por feature.
- Música opcional vía slot de `<Audio>`; render silencioso por defecto.

## Capabilities

### New Capabilities
- `promo-video-pipeline`: workspace Remotion aislado, configuración de render
  (dimensiones/fps/codec), fuentes bundleadas, theme derivado del design system,
  primitivos de marca reutilizables, slot de audio y flujo de preview/render.
- `promo-video-content`: las 5 composiciones de video — estructura de escenas
  (Hook → Demo → Payoff), duración, copy es-AR conforme a las reglas de voz del DS,
  y los mockups animados por feature.

### Modified Capabilities
<!-- Ninguna. No cambian requisitos de specs existentes. -->

## Impact

- **Nuevo**: directorio `promo/` (workspace JS independiente), renders en `promo/out/`.
- **Dependencias**: `remotion`, `@remotion/cli`, `@remotion/google-fonts` (solo dentro
  de `promo/`; ninguna se agrega al `package.json` del app).
- **Config root**: añadir exclusiones de `promo/` en tsconfig/jest/eslint y entradas en
  `.gitignore` (`promo/node_modules`, `promo/out`).
- **Assets**: se reutilizan `desing-system/assets/logo-mark.svg` y `logo-wordmark.svg`.
- **App Expo**: sin cambios de runtime ni de schema; cero impacto en la app.
