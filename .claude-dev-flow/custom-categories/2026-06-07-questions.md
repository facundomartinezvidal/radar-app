# Open Questions: Categorías personalizadas (HU-16)

Date: 2026-06-07

## Resueltas en la entrevista

| Pregunta | Decisión |
|----------|----------|
| ¿Cómo elige ícono/color? | Set curado (~24 íconos Lucide + ~8 colores DS) |
| ¿Dónde gestiona el CRUD? | Inline desde el picker + pantalla "Categorías" en Perfil |
| ¿OCR sin match? | IA sugiere nombre → CTA "Crear categoría 'X'" (confirmación manual) |
| ¿Borrar con gastos? | Gastos quedan sin categoría (`category_id → null`) |

## Decididas por defecto (no requieren al usuario, documentadas)

1. **Límite de categorías por usuario**: sin límite duro en MVP. Si hace falta, agregar check. Riesgo bajo (uso personal).
2. **slug**: autogenerado en el repo desde el nombre (`normalizeName`); no editable por el usuario.
3. **Categorías de sistema en la pantalla de Perfil**: mostrarlas read-only (sin editar/borrar) para contexto, o omitirlas. Recomendación: omitir o sección "Predefinidas" deshabilitada. Decidir en `-category-ui`.
4. **sort_order de custom**: fijo en 100 (debajo de sistema); sin reordenar por usuario (out of scope).
5. **Hook de categorías**: extender `hooks/use-expenses.ts` vs nuevo `hooks/use-categories.ts`. Recomendación: nuevo archivo `use-categories.ts` para no inflar el de expenses. Decidir en `-data-layer`.

## Pendientes para futuras HU (no bloquean)

- Compartir categorías en grupos.
- Reordenar / favoritos.
- Color/ícono libre si el set curado queda corto.
