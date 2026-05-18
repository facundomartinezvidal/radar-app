import type { User } from '@supabase/supabase-js';

/**
 * True when the user has provided both first_name and last_name in
 * auth.users.raw_user_meta_data (and therefore in profiles.first_name /
 * profiles.last_name via the sync trigger).
 *
 * Source of truth is the JWT user_metadata because it lands in the auth
 * store synchronously — no extra fetch to the `profiles` table required
 * for gating decisions.
 */
export function hasCompletedProfile(user: User | null | undefined): boolean {
  if (!user) return false;
  const md = user.user_metadata ?? {};
  const first = typeof md.first_name === 'string' ? md.first_name.trim() : '';
  const last = typeof md.last_name === 'string' ? md.last_name.trim() : '';
  return first.length > 0 && last.length > 0;
}
