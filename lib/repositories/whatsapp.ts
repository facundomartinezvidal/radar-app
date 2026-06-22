/**
 * WhatsApp repository — thin layer over Supabase queries for linking/unlinking.
 *
 * Provides:
 *   - createLinkCode   → RPC create_link_code() (SECURITY INVOKER, keyed on auth.uid())
 *   - getWhatsappLink  → select own active link row from whatsapp_links
 *   - unlinkWhatsapp   → update own row to status='unlinked'
 */
import { supabase } from '@/lib/supabase';

// TODO: move to env/config for production
export const WHATSAPP_BOT_NUMBER = '+15556605570';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LinkCode {
  code: string;
  expiresAt: string;
}

export interface WhatsappLinkRow {
  waNumber: string;
  status: string;
}

// ---------------------------------------------------------------------------
// createLinkCode
// ---------------------------------------------------------------------------

/**
 * Calls the `create_link_code()` RPC (SECURITY INVOKER, keyed on auth.uid()).
 * Returns `{ code, expiresAt }` on success, or throws on error.
 *
 * Generating a new code invalidates any prior unconsumed codes for the user.
 */
export async function createLinkCode(): Promise<LinkCode> {
  // `create_link_code` is a new RPC not yet reflected in the generated types;
  // cast through unknown to satisfy the strict type checker until types are regenerated.
  const { data, error } = await (
    supabase.rpc as unknown as (fn: string) => Promise<{ data: unknown; error: unknown }>
  )('create_link_code');
  if (error) throw error;
  const row = data as { code: string; expires_at: string } | null;
  if (!row) throw new Error('No se pudo generar el código de vinculación.');
  return { code: row.code, expiresAt: row.expires_at };
}

// ---------------------------------------------------------------------------
// getWhatsappLink
// ---------------------------------------------------------------------------

/**
 * Returns the active (status='linked') WhatsApp binding for `userId`,
 * or `null` if no linked row exists.
 */
export async function getWhatsappLink(userId: string): Promise<WhatsappLinkRow | null> {
  const { data, error } = await supabase
    .from('whatsapp_links')
    .select('wa_number, status')
    .eq('user_id', userId)
    .eq('status', 'linked')
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const row = data as { wa_number: string; status: string };
  return { waNumber: row.wa_number, status: row.status };
}

// ---------------------------------------------------------------------------
// unlinkWhatsapp
// ---------------------------------------------------------------------------

/**
 * Unlinks the user's WhatsApp number by setting status='unlinked' and
 * recording unlinked_at on their own row (RLS allows this).
 */
export async function unlinkWhatsapp(userId: string): Promise<void> {
  const { error } = await supabase
    .from('whatsapp_links')
    .update({ status: 'unlinked', unlinked_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('status', 'linked');

  if (error) throw error;
}
