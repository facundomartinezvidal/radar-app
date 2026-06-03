/**
 * Zod schemas for expense input + filter shapes.
 *
 * Single source of truth — components import `z.infer<typeof X>` instead of
 * redefining shapes. Mirrors the `public.expenses` DB schema.
 */
import { z } from 'zod';

export const CURRENCIES = ['ARS', 'USD'] as const;
export type Currency = (typeof CURRENCIES)[number];

// ---------------------------------------------------------------------------
// Expense item
// ---------------------------------------------------------------------------

export const expenseItemInputSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1, 'Ingresá un nombre.').max(120, 'Máximo 120 caracteres.'),
  quantity: z
    .number()
    .positive('La cantidad debe ser mayor a cero.')
    .max(1_000_000, 'Cantidad demasiado grande.'),
  unit_price: z
    .number()
    .min(0, 'Importe inválido.')
    .max(1_000_000_000, 'Monto demasiado grande.')
    .nullable(),
  line_total: z.number().min(0, 'Importe inválido.').max(1_000_000_000, 'Monto demasiado grande.'),
});

export type ExpenseItemInput = z.infer<typeof expenseItemInputSchema>;

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

export const createExpenseSchema = z.object({
  amount: z
    .number({ message: 'Ingresá un monto válido.' })
    .positive('El monto tiene que ser mayor a cero.')
    .max(1_000_000_000, 'Monto demasiado grande.'),
  currency: z.enum(CURRENCIES, { message: 'Seleccioná ARS o USD.' }),
  category_id: z.string().min(1, 'Categoría inválida.').nullable(),
  description: z
    .string()
    .max(240, 'Máximo 240 caracteres.')
    .transform((v) => v.trim())
    .nullable()
    .optional(),
  occurred_at: z.string().datetime({ offset: true }).optional(),
  items: z.array(expenseItemInputSchema).max(50, 'Máximo 50 ítems.').optional(),
});

export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;

// ---------------------------------------------------------------------------
// Update — all fields optional
// ---------------------------------------------------------------------------

export const updateExpenseSchema = createExpenseSchema.partial();
export type UpdateExpenseInput = z.infer<typeof updateExpenseSchema>;

// ---------------------------------------------------------------------------
// Filter / search
// ---------------------------------------------------------------------------

export const expenseFilterSchema = z.object({
  search: z.string().trim().optional(),
  categoryIds: z.array(z.string().min(1)).optional(),
  currencies: z.array(z.enum(CURRENCIES)).optional(),
  /** ISO timestamps. Inclusive lower bound, inclusive upper bound. */
  from: z.string().datetime({ offset: true }).optional(),
  to: z.string().datetime({ offset: true }).optional(),
  /** Page size. 1–200. */
  limit: z.number().int().min(1).max(200).optional(),
  /** Zero-based offset for pagination. */
  offset: z.number().int().min(0).optional(),
});

export type ExpenseFilter = z.infer<typeof expenseFilterSchema>;
