---
name: radar-design
description: Use this skill to generate well-branded interfaces and assets for RADAR (gestor de gastos móvil para jóvenes adultos argentinos, 18–35, ARS + USD), either for production or throwaway prototypes/mocks/etc. Contains essential design guidelines, colors, type, fonts, assets, and UI kit components for prototyping.
user-invocable: true
---

Read the README.md file within this skill, and explore the other available files.

If creating visual artifacts (slides, mocks, throwaway prototypes, etc), copy assets out and create static HTML files for the user to view. If working on production code, you can copy assets and read the rules here to become an expert in designing with this brand.

If the user invokes this skill without any other guidance, ask them what they want to build or design, ask some questions, and act as an expert designer who outputs HTML artifacts _or_ production code, depending on the need.

## Quick orientation

- `colors_and_type.css` — drop-in CSS tokens (colors, type, radii, shadows, motion).
- `assets/logo-mark.svg` + `assets/logo-wordmark.svg` — brand marks.
- `ui_kits/app/` — mobile UI kit (JSX primitives + screens + live `index.html`).
- `preview/` — individual token specimen cards (colors, type, spacing, components).

## Non-negotiables

- **Dark-first** (`#0A0F1A` base). Light mode is only a fallback.
- **Primary `#0077B6`** (ocean blue). Green = ingreso, red = gasto, amber = USD/alerta.
- **Inter** everywhere. **Tabular-nums** on every currency figure — the numbers are the UI.
- **Spanish rioplatense** (voseo OK): *Registrá · Dividí · Saldá*. Sentence case. No emoji in UI base.
- **Lucide** icons only, stroke 1.5, `currentColor`. No hand-rolled SVG icons.
- Tagline: *RADAR. Sabé a dónde va tu plata.*
