/**
 * Zod schemas for custom category create / update operations.
 *
 * `z.enum` accepts a non-empty readonly string tuple — the `as const` arrays
 * in `category-options.ts` satisfy that constraint.
 */
import { z } from 'zod';

import { CATEGORY_COLORS, CATEGORY_ICONS } from '@/lib/category-options';

export const createCategorySchema = z.object({
  name: z.string().trim().min(1, 'Ingresá un nombre.').max(40, 'Máximo 40 caracteres.'),
  icon: z.enum(CATEGORY_ICONS),
  color: z.enum(CATEGORY_COLORS),
});

export const updateCategorySchema = createCategorySchema.partial();

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
