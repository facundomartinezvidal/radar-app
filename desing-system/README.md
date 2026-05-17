# RADAR — Design System

> Gestor de gastos móvil para jóvenes adultos (18–35) en Argentina. Seguimiento personal + gastos compartidos + multi-moneda (ARS/USD). Tono moderno, confiable y simple. **Dark-first**.

---

## Tabla de contenido

| Archivo / Carpeta | Para qué sirve |
|---|---|
| `README.md` | Este documento — fundamentos visuales y de contenido |
| `SKILL.md` | Metadatos para usar este DS como Claude Skill |
| `colors_and_type.css` | Tokens CSS (colores, tipografía, radios, sombras, motion) |
| `assets/` | Logos (`logo-mark.svg`, `logo-wordmark.svg`) e iconografía |
| `preview/` | Tarjetas HTML que pueblan la pestaña **Design System** |
| `ui_kits/app/` | UI Kit móvil — JSX + `index.html` demo |

---

## Contexto del producto

RADAR resuelve tres problemas concretos de la vida financiera digital del joven argentino:

1. **Fragmentación** — saldos repartidos entre Mercado Pago, Ualá, bancos tradicionales y cuentas en USD. RADAR unifica la visión.
2. **Baja trazabilidad** — registros rápidos (< 5s), categorización opcional y resúmenes mensuales.
3. **Gastos compartidos informales** — reemplaza el *grupo de WhatsApp* con un "quién debe a quién" nativo, saldable por alias CBU/CVU, **sin requerir que el otro instale la app**.

Fuentes originales del equipo:

- Codebase adjunto: `seminario/` (File System Access — contiene brief, elevator pitch, matriz ERIC)
- Brief: `seminario/CLAUDE.md`
- Elevator pitch: `seminario/elevator-pitch.md`
- Estrategia (Océano Azul): `seminario/Matriz ERIC - Gestión de Gastos.excalidraw.md`

> El proyecto es **pre-producto** — no existe codebase de UI todavía. Este DS se construye a partir del brief, no como recreación de una app existente.

**Equipo — Grupo 02 SIPI 2026 (UADE):** Martinez Vidal Facundo · Mayán Jonathan · Moreno Inaki.

---

## Productos cubiertos

- **App móvil RADAR** (foco principal) — iOS + Android, dark-first. Ver `ui_kits/app/`.

La web/landing no está en el MVP de la primera entrega; se agregará más adelante.

---

## Content fundamentals

**Idioma:** Español rioplatense (voseo permitido, no obligatorio). Tono **cercano, directo, sin ser informal de más**.

**Persona del producto:** un amigo que entiende de plata pero no te habla como un banco.

### Reglas de copy

- **Verbos activos, frases cortas.** "Registrá un gasto", no "Proceder al registro de un gasto".
- **Voseo en CTAs principales:** *Registrá · Dividí · Saldá · Sumá · Agregá*.
- **Infinitivo en labels de navegación y menús:** *Gastos · Grupos · Perfil*.
- **Sentence case** en títulos y botones. `Nuevo gasto`, no `Nuevo Gasto`.
- **Números con separador local:** `$ 12.500,00` (punto miles, coma decimal).
- **Moneda explícita siempre:** `$ 12.500 ARS`, `US$ 85,00`. Nunca mezclar sin indicar.
- **No jerga financiera.** "Plata que te deben", no "Cuentas por cobrar".
- **Mensajes vacíos con humor moderado, no condescendientes.** "Sin gastos por acá. Por ahora." vs emoji-spam.
- **Errores empáticos.** "No pudimos guardar el gasto. Probá de nuevo." (no "Error 500").
- **Sin emoji en UI base.** Sí en notifs/push cuando aporta contexto emocional (raro).

### Tagline oficial

> **RADAR. Sabé a dónde va tu plata.**

### Microcopy de referencia

| Contexto | Copy |
|---|---|
| CTA primario "nuevo gasto" | `Registrar gasto` |
| Estado vacío home | `Todavía no cargaste nada este mes.` |
| Confirmación deuda saldada | `Listo. Deuda saldada.` |
| Push notification | `Juan te marcó un gasto de $ 4.200 en Pizza del viernes.` |
| Error genérico | `No pudimos conectar. Reintentamos en 5s.` |
| Onboarding (hook) | `¿Sabés en qué se te fue la plata este mes?` |
| Input placeholder monto | `0,00` |
| Confirm destructivo | `Seguro que querés borrar este gasto?` |

---

## Visual foundations

### Color

- **Primario `#0077B6`** (ocean blue). Usado para acciones principales, elementos activos y el sweep del radar.
- **Neutrals dark-first.** Fondo `#0A0F1A`; superficies apiladas `#0F1724` → `#17202F` → `#1F2A3D`. Se usan como *capas* que se apilan con `border: 1px solid rgba(255,255,255,0.06)`, no con sombras pesadas.
- **Semánticos de plata:**
  - Verde `#10B981` = ingreso / "te deben"
  - Rojo `#EF4444` = gasto / "debés"
  - Amber `#F59E0B` = alertas, dólares (USD pill)
- **Nunca** usar púrpura/rosa/gradientes "fintech-slop". Azul + neutrales + dos semánticos. Listo.

### Tipografía

- **Inter** (400/500/600/700/800). Sans-serif neutra, excelente legibilidad numérica.
- **Números tabulares activos** (`font-variant-numeric: tabular-nums`) en **todos** los montos — son la UI.
- **JetBrains Mono** solo para inputs de monto tipo "teclado numérico" y alias CBU.
- Jerarquía contenida: `display 44 / h1 32 / h2 24 / h3 20 / body 16 / body-sm 14 / caption 12`.
- Saldo hero = `display` (44px, peso 700, letter-spacing `-0.02em`).

### Layout y densidad

- Mobile-first. **Safe areas** respetadas (notch + home indicator).
- Padding externo `16px` default, `20px` en pantallas hero.
- Elementos tocables **mínimo 44px** de alto.
- Grid de 4px como base espacial. Usar `--s-1 … --s-10`.
- **Listados con divisores de 1px** (`--line-1`), no cards por cada fila.

### Bordes, radios y sombras

- **Radios generosos pero contenidos.** Cards = `20px`. Inputs y botones = `14px`. Pills = `999px`.
- **Sombras sutiles.** Dark UI necesita poca sombra; preferimos bordes `1px` con tintes alfa. Solo modales/sheets usan `--shadow-3`.
- **Inner-highlight** en botones y cards elevados: `inset 0 1px 0 rgba(255,255,255,0.05)`. Truco clave para que el dark mode tenga *piel*.
- Sin *left-border accent* coloreado (slop trope, prohibido).

### Animación

- **Easing por defecto:** `cubic-bezier(0.2, 0.8, 0.2, 1)` (suave, decisivo).
- **Spring** (`cubic-bezier(0.34, 1.56, 0.64, 1)`) solo en micro-celebraciones: deuda saldada, gasto guardado, confetti suave.
- **Duraciones:** 120 / 200 / 320ms. Nada más lento.
- **Radar sweep** del logo animado en loading states (rotación 360° en 1.8s ease-linear).
- Fades > slides. Slides solo en sheets bottom-up.

### Estados de interacción

- **Hover (desktop/trackpad):** background +6% lightness o `--bg-3` → `--bg-4`.
- **Press (mobile):** `transform: scale(0.97)` en 120ms + opacity 0.85. Sin ripple Material.
- **Focus visible:** ring `2px solid var(--radar-400)` offset `2px`. Siempre visible para accesibilidad.
- **Disabled:** opacity 0.4, no pointer-events.

### Imagery, ilustraciones, backgrounds

- **Sin fotos** en la app. Es una fintech utilitaria, no lifestyle.
- **Ilustraciones mínimas** para empty states: line-art monocromo en `--radar-300`, sin fills de color.
- **Avatares** = iniciales sobre círculo con color derivado por hash del nombre (paleta de 8 hues pre-aprobada).
- **Logos de billeteras** (MP, Ualá, etc.) con su color de marca dentro de un square `r-md` con fondo `--bg-2`. Nunca alterar.
- **Backgrounds:** plano. Sin gradientes salvo el *sweep* del radar en empty hero.

### Transparencia y blur

- **Tab bar inferior:** `background: rgba(15, 23, 36, 0.72); backdrop-filter: blur(20px)`. Se siente "encima" del contenido.
- **Sheets modales:** fondo completamente opaco (`--bg-2`) — no abusar del glass.
- **Overlays:** `rgba(10,15,26,0.6)` + blur 8px.

### Iconografía

Ver sección ICONOGRAPHY más abajo.

---

## ICONOGRAPHY

**Librería oficial: [Lucide](https://lucide.dev)** (CDN). Outline 1.5px, tamaño base 20px (24px en tab bar, 16px inline con texto).

Por qué Lucide:
- Set amplio (~1500 iconos), incluye `wallet`, `dollar-sign`, `trending-up`, `users`, `arrow-down-left`, etc. — todos los que una app de plata necesita.
- Estilo outline limpio que combina con Inter. Coherente con la sensación "radar / mapa / sonar".
- Disponible por CDN y como paquete NPM, sin licencias raras.

**Sustitución:** No usamos un icon-font propio ni SVGs custom (fuera de logo y un par de marcas). Si necesitamos un icono no presente en Lucide, lo componemos con primitivas Lucide (ej. pill + dólar) antes de dibujar SVG nuevo.

**Reglas**

- **Stroke 1.5** en todos. Si un tamaño necesita stroke distinto, es porque está mal escalado.
- **Color heredado:** `stroke="currentColor"`. Nunca hardcodear color.
- **Nunca rellenar** iconos Lucide (fills solo en `star` para favoritos y `check-circle` en confirmaciones).
- **Emoji:** solo en push notifications y en avatares fallback (nunca en botones ni labels).
- **Unicode:** sí para símbolos de moneda (`$`, `US$`, `€`). Nunca usar emoji de moneda (💵) en UI.

**Logos de marca/billetera** se copian como SVG o PNG oficiales en `assets/brands/` si existen; no los redibujamos.

---

## CAVEATS

- **Sin codebase de UI previo** → este DS es una propuesta, no una recreación. Los tokens son razonados a partir del brief; esperar iteración.
- **Sin archivos de marca reales** (logos oficiales de las billeteras que RADAR integra) → los "chips" de billetera en las mocks son genéricos.
- **Color primario**: el brief original pedía `#10B981` (esmeralda); el usuario lo sobreescribió a `#0077B6` (azul océano). Este DS usa el azul como marca y el verde como semántico de "ingreso/te deben".
- **Inter** se carga desde Google Fonts CDN. Si se necesita hosting local, bajar los `.woff2` a `fonts/` y reemplazar el `@import`.

---

## Uso rápido

```html
<link rel="stylesheet" href="colors_and_type.css">

<div class="card">
  <div class="label">Saldo total</div>
  <div class="display money">$ 248.500,00</div>
  <div class="caption">Abril 2026</div>
</div>
```
