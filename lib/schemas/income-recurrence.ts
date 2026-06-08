/**
 * Zod schemas for income recurrence input shapes.
 *
 * Recurrences define a repeating income pattern.
 * Computed fields (day_of_month, next_run_on) are NOT included — they are
 * derived server-side and must not be sent by the client.
 */
import { z } from 'zod';

export const FREQUENCIES = ['weekly', 'biweekly', 'monthly', 'yearly'] as const;
export type Frequency = (typeof FREQUENCIES)[number];

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

export const createRecurrenceSchema = z
  .object({
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
    frequency: z.enum(FREQUENCIES, { message: 'Seleccioná una frecuencia válida.' }),
    start_date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'La fecha de inicio debe tener formato YYYY-MM-DD.'),
    end_date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'La fecha de fin debe tener formato YYYY-MM-DD.')
      .nullable()
      .optional(),
  })
  .refine(
    (data) => data.end_date == null || data.end_date >= data.start_date,
    'La fecha de fin debe ser posterior o igual a la de inicio.',
  );

export type CreateRecurrenceInput = z.infer<typeof createRecurrenceSchema>;

// ---------------------------------------------------------------------------
// Update — all fields optional, end >= start refine still enforced when both present
// ---------------------------------------------------------------------------

export const updateRecurrenceSchema = z
  .object({
    amount: z
      .number({ message: 'Ingresá un monto válido.' })
      .positive('El monto tiene que ser mayor a cero.')
      .max(1_000_000_000, 'Monto demasiado grande.')
      .optional(),
    currency: z
      .enum(['ARS', 'USD'] as const, { message: 'Seleccioná ARS o USD.' })
      .optional(),
    category_id: z.string().uuid('Categoría inválida.').nullable().optional(),
    description: z
      .string()
      .max(240, 'Máximo 240 caracteres.')
      .transform((v) => v.trim())
      .nullable()
      .optional(),
    frequency: z
      .enum(FREQUENCIES, { message: 'Seleccioná una frecuencia válida.' })
      .optional(),
    start_date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'La fecha de inicio debe tener formato YYYY-MM-DD.')
      .optional(),
    end_date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'La fecha de fin debe tener formato YYYY-MM-DD.')
      .nullable()
      .optional(),
  })
  .refine(
    (data) =>
      data.end_date == null ||
      data.start_date == null ||
      data.end_date >= data.start_date,
    'La fecha de fin debe ser posterior o igual a la de inicio.',
  );

export type UpdateRecurrenceInput = z.infer<typeof updateRecurrenceSchema>;
