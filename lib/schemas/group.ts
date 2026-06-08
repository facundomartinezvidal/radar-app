/**
 * Zod schemas for group + split + settlement input shapes.
 *
 * Single source of truth — components import `z.infer<typeof X>` instead of
 * redefining shapes. Mirrors the `public.groups`, `public.group_members`,
 * `public.expense_splits`, and `public.group_settlements` DB schemas.
 */
import { z } from 'zod';

import { CATEGORY_COLORS, CATEGORY_ICONS } from '@/lib/category-options';

// ---------------------------------------------------------------------------
// Split types
// ---------------------------------------------------------------------------

export const SPLIT_TYPES = ['equal', 'custom', 'percent'] as const;
export type SplitType = (typeof SPLIT_TYPES)[number];

// ---------------------------------------------------------------------------
// Group — create
// ---------------------------------------------------------------------------

export const createGroupSchema = z.object({
  name: z.string().trim().min(1, 'Ingresá un nombre.').max(60, 'Máximo 60 caracteres.'),
  icon: z.enum(CATEGORY_ICONS),
  color: z.enum(CATEGORY_COLORS),
  placeholders: z
    .array(
      z.string().trim().min(1, 'El nombre no puede estar vacío.').max(60, 'Máximo 60 caracteres.'),
    )
    .default([]),
});

export type CreateGroupInput = z.infer<typeof createGroupSchema>;

// ---------------------------------------------------------------------------
// Group member — add placeholder
// ---------------------------------------------------------------------------

export const addPlaceholderSchema = z.object({
  display_name: z.string().trim().min(1, 'Ingresá un nombre.').max(60, 'Máximo 60 caracteres.'),
});

export type AddPlaceholderInput = z.infer<typeof addPlaceholderSchema>;

// ---------------------------------------------------------------------------
// Group member — invite by email
// ---------------------------------------------------------------------------

export const inviteMemberSchema = z.object({
  email: z.string().trim().email('Ingresá un correo válido.'),
});

export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;

// ---------------------------------------------------------------------------
// Split
// ---------------------------------------------------------------------------

export const splitSchema = z.object({
  type: z.enum(SPLIT_TYPES),
  entries: z.array(
    z.object({
      member_id: z.string().min(1, 'El identificador del miembro es requerido.'),
      /** amount (custom) | percentage (percent) | ignored (equal) */
      value: z.number().min(0, 'El valor no puede ser negativo.'),
    }),
  ),
});

export type SplitInput = z.infer<typeof splitSchema>;

// ---------------------------------------------------------------------------
// Settlement
// ---------------------------------------------------------------------------

export const settlementSchema = z
  .object({
    from_member_id: z.string().min(1, 'Seleccioná el miembro que paga.'),
    to_member_id: z.string().min(1, 'Seleccioná el miembro que cobra.'),
    amount: z.number().positive('El monto debe ser mayor a cero.'),
    currency: z.enum(['ARS', 'USD'], { message: 'Seleccioná ARS o USD.' }),
  })
  .refine((data) => data.from_member_id !== data.to_member_id, {
    message: 'El miembro que paga y el que cobra no pueden ser el mismo.',
    path: ['to_member_id'],
  });

export type SettlementInput = z.infer<typeof settlementSchema>;
