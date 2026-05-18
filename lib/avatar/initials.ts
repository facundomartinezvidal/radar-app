/**
 * RADAR Design System — Avatar initials utility
 *
 * Compute up to 2 uppercase initials from a first + last name pair.
 *
 * Trims, picks first grapheme of each, then upper-cases. Designed for the
 * `<Avatar />` fallback when no `avatar_url` is set.
 */

/**
 * Returns up to 2 uppercase initials derived from firstName and lastName.
 *
 * - Both null/undefined/empty → returns `''`
 * - Only firstName present → 1 letter
 * - Only lastName present → 1 letter
 * - Both present → 2 letters concatenated
 *
 * Uses `Array.from` to safely slice the first grapheme (avoids splitting
 * surrogate pairs). Uses `.toLocaleUpperCase('es-AR')` for correct Spanish
 * letter handling (ñ, á, etc.).
 */
export function getInitials(
  firstName: string | null | undefined,
  lastName: string | null | undefined,
): string {
  const first = firstName?.trim() ?? '';
  const last = lastName?.trim() ?? '';

  const firstChar = first.length > 0 ? (Array.from(first)[0] ?? '') : '';
  const lastChar = last.length > 0 ? (Array.from(last)[0] ?? '') : '';

  return (firstChar + lastChar).toLocaleUpperCase('es-AR');
}
