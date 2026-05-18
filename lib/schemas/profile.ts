/**
 * Zod schemas for profile name input.
 *
 * Single source of truth shared between the sign-up form, the profile-setup
 * screen, and the profile-edit screen. Mirrors `profiles.first_name` and
 * `profiles.last_name` in the DB (text not null, max 40 chars).
 */
import { z } from 'zod';

// ---------------------------------------------------------------------------
// Single-name field
// ---------------------------------------------------------------------------

export const nameSchema = z
  .string({ message: 'Ingresá un nombre válido.' })
  .trim()
  .min(2, 'Mínimo 2 caracteres.')
  .max(40, 'Máximo 40 caracteres.')
  .regex(/^[A-Za-zÀ-ÿñÑ\s'-]+$/u, 'Solo letras, espacios, guiones o apóstrofes.');

export type Name = z.infer<typeof nameSchema>;

// ---------------------------------------------------------------------------
// Profile update
// ---------------------------------------------------------------------------

export const profileUpdateSchema = z.object({
  firstName: nameSchema,
  lastName: nameSchema,
});

export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>;
