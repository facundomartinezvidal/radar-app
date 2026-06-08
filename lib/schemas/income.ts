/**
 * Zod schemas for income input + filter shapes.
 *
 * Single source of truth — components import `z.infer<typeof X>` instead of
 * redefining shapes. Mirrors the `public.incomes` DB schema.
 * Incomes do NOT have line items — see `expenses` for that pattern.
 */
import { z } from 'zod';

export { CURRENCIES } from './expense';
export type { Currency } from './expense';

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

export const createIncomeSchema = z.object({
  amount: z
    .number({ message: 'Ingresá un monto válido.' })
    .positive('El monto tiene que ser mayor a cero.')
    .max(1_000_000_000, 'Monto demasiado grande.'),
  currency: z.enum(['ARS', 'USD'] as const, { message: 'Seleccioná ARS o USD.' }),
  category_id: z.string().uuid('Categoría inválida.').nullable(),
  description: z
    .string()
    .max(240, 'Máximo 240 caracteres.')
    .transform((v) => v.trim())
    .nullable()
    .optional(),
  occurred_at: z.string().datetime({ offset: true }).optional(),
});

export type CreateIncomeInput = z.infer<typeof createIncomeSchema>;

// ---------------------------------------------------------------------------
// Update — all fields optional
// ---------------------------------------------------------------------------

export const updateIncomeSchema = createIncomeSchema.partial();
export type UpdateIncomeInput = z.infer<typeof updateIncomeSchema>;

// ---------------------------------------------------------------------------
// Filter / search
// ---------------------------------------------------------------------------

export const incomeFilterSchema = z.object({
  search: z.string().trim().optional(),
  categoryIds: z.array(z.string().min(1)).optional(),
  currencies: z.array(z.enum(['ARS', 'USD'] as const)).optional(),
  /** ISO timestamps. Inclusive lower bound, inclusive upper bound. */
  from: z.string().datetime({ offset: true }).optional(),
  to: z.string().datetime({ offset: true }).optional(),
  /** Page size. 1–200. */
  limit: z.number().int().min(1).max(200).optional(),
  /** Zero-based offset for pagination. */
  offset: z.number().int().min(0).optional(),
});

export type IncomeFilter = z.infer<typeof incomeFilterSchema>;
