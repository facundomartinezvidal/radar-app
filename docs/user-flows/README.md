# RADAR — User flows (Release 1)

Documented user flows for **Release 1 / MVP** of RADAR. Each flow maps one
user story (HU) to the concrete screens, components and back-end calls
that ship in the mobile app, with acceptance criteria a tester can use.

Source of truth for the user-story list is the SIPI 2026 deliverable
spreadsheet; this folder is the engineering interpretation of those rows.

---

## Inventory

| HU    | Historia                              | Estado | Relevancia | Release   | Documento                                              | Estado de implementación |
| ----- | ------------------------------------- | ------ | ---------- | --------- | ------------------------------------------------------ | ------------------------ |
| HU-01 | Iniciar sesión                        | MVP    | Alta       | Release 1 | [HU-01](./HU-01-iniciar-sesion.md)                     | Implementado             |
| HU-02 | Acceder a cámara                      | MVP    | Media      | Release 2 | [HU-02](./HU-02-acceder-camara.md)                     | Pendiente                |
| HU-03 | Acceder a fotografías del dispositivo | MVP    | Media      | Release 2 | [HU-03](./HU-03-acceder-fotografias.md)                | Pendiente                |
| HU-04 | Menú principal                        | MVP    | Alta       | Release 1 | [HU-04](./HU-04-menu-principal.md)                     | Implementado             |
| HU-05 | Extraer datos OCR                     | MVP    | Alta       | Release 2 | [HU-05](./HU-05-extraer-datos-ocr.md)                  | Pendiente                |
| HU-06 | Validar datos detectados              | MVP    | Media      | Release 2 | [HU-06](./HU-06-validar-datos-detectados.md)           | Pendiente                |
| HU-07 | Sección historial de gastos | MVP    | Alta       | Release 1 | [HU-07](./HU-07-historial-gastos.md)         | Implementado             |
| HU-08 | Mostrar gastos              | MVP    | Alto       | Release 1 | [HU-08](./HU-08-mostrar-gastos.md)           | Implementado             |
| HU-09 | Filtrar gastos              | MVP    | Baja       | Release 1 | [HU-09](./HU-09-filtrar-gastos.md)           | Implementado             |
| HU-10 | Conocer gasto registrado    | MVP    | Alto       | Release 1 | [HU-10](./HU-10-conocer-gasto-registrado.md) | Implementado             |
| HU-11 | Editar gasto                | MVP    | Bajo       | Release 1 | [HU-11](./HU-11-editar-gasto.md)             | Implementado             |
| HU-12 | Guardar gasto               | MVP    | Alto       | Release 1 | [HU-12](./HU-12-guardar-gasto.md)            | Implementado             |
| HU-13 | Sección registro nuevo      | MVP    | Alto       | Release 1 | [HU-13](./HU-13-registro-nuevo.md)           | Implementado             |
| HU-14 | Registrar cuenta            | MVP    | Alto       | Release 1 | [HU-14](./HU-14-registrar-cuenta.md)         | Implementado             |

---

## Document structure

Every flow document follows the same shape so they're easy to grep, audit
and present to stakeholders:

1. **Identificación** — ID, nombre, persona principal, relevancia, release
2. **Historia de usuario** — formato Cono. "Como _rol_, quiero _qué_ para
   _por qué_."
3. **Pre-condiciones / post-condiciones**
4. **Flujo principal** — pasos numerados, sin ambigüedad
5. **Flujos alternativos / de error**
6. **Diagrama** — Mermaid sequence o flowchart cuando aporta
7. **Pantallas involucradas**
8. **State matrix** — cada estado del UI (default, loading, empty, error,
   success, etc.) con su trigger y descripción visual. Necesario para que
   un agente de diseño pueda reproducir cada pantalla sin ambigüedades.
9. **Criterios de aceptación** — checklist verificable
10. **Notas técnicas** — archivos, hooks, tablas Supabase, tests

---

## Convenciones

- **Idioma** — español rioplatense voseo (mismo voice que la app).
- **Casing** — sentence case en títulos y CTAs.
- **Referencias técnicas** — rutas relativas al repositorio
  (`app/(protected)/expense/new.tsx`, no `~/Documents/...`).
- **Diagramas** — Mermaid; los renderiza Obsidian + GitHub.
- **No emoji** en UI; sí se permite en headings administrativos si ayuda.

---

## Trazabilidad

Cada HU referencia el / los commits que la implementan y los tests que
la cubren. Esto cierra el bucle: tester abre el doc → ve el criterio →
ejecuta el test → corre la app → valida la HU.

Más contexto:

- `docs/features/expenses-crud.md` — vista por feature, no por HU
- `docs/decisions/2026-05-17-expenses-schema.md` — ADR del modelo de datos
- `AGENTS.md` §6 — arquitectura de routing / state
- Vault Obsidian `seminario/user-flows/` — copia espejo para el
  entregable académico
