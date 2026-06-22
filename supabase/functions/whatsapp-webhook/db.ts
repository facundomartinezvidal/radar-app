/**
 * db.ts
 * Service-role data access layer for the whatsapp-webhook edge function.
 *
 * All helpers use the Supabase service-role key so they bypass RLS.
 * This is intentional: the webhook has no Supabase user JWT (Meta calls it),
 * and all privilege escalation is confined to this module + DEFINER RPCs.
 *
 * Env vars consumed (injected by Supabase runtime):
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ---------------------------------------------------------------------------
// Client singleton
// ---------------------------------------------------------------------------

let _client: SupabaseClient | null = null;

/**
 * Returns a cached service-role Supabase client.
 * Using a module-level singleton avoids re-constructing the client on every
 * message while keeping the creation lazy (avoids startup cost when the env
 * vars haven't been set yet, e.g. during GET handshake).
 */
export function serviceClient(): SupabaseClient {
  if (_client) return _client;

  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!url || !key) {
    throw new Error('[db] SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set');
  }

  _client = createClient(url, key, {
    auth: { persistSession: false },
  });

  return _client;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type MessageDirection = 'inbound' | 'outbound';
export type MessageStatus = 'processing' | 'processed' | 'failed';
export type PendingActionKind = 'expense' | 'income' | 'multi_import';

export interface InboundMessage {
  /** Meta Cloud API message id (e.g. "wamid.xxx") */
  providerMessageId: string;
  /** E.164 sender number (e.g. "+541112345678") */
  waNumber: string;
  /** Text body (null for media-only messages) */
  body: string | null;
  /** Number of media attachments */
  numMedia: number;
}

export interface PendingAction {
  kind: PendingActionKind;
  payload: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// recordInbound — idempotency guard (D5 in design.md)
// ---------------------------------------------------------------------------

/**
 * Inserts a new `whatsapp_messages` row for the inbound message.
 *
 * Uses `.upsert` with `ignoreDuplicates: true` so a duplicate Meta message id
 * (retry delivery) produces no insert and the function returns `false`, letting
 * the caller short-circuit without re-processing.
 *
 * Returns `true` if this is the first time we see this message id (proceed),
 * `false` if it was already recorded (skip).
 */
export async function recordInbound(msg: InboundMessage): Promise<boolean> {
  const db = serviceClient();

  // Plain insert; rely on the UNIQUE(provider_message_id) constraint for
  // idempotency. A unique-violation (23505) means Meta re-delivered this
  // message — return false so the caller skips re-processing.
  //
  // NOTE: do NOT use upsert({ignoreDuplicates:true}) + an HTTP-status check —
  // supabase-js returns 200 (not 201) for a successful ignore-duplicates insert,
  // which made every fresh message look like a duplicate and silently skip.
  const { error } = await db.from('whatsapp_messages').insert({
    provider_message_id: msg.providerMessageId,
    wa_number: msg.waNumber,
    direction: 'inbound' satisfies MessageDirection,
    body: msg.body,
    num_media: msg.numMedia,
    status: 'processing' satisfies MessageStatus,
  });

  if (error) {
    if (error.code === '23505') {
      console.info('[db] recordInbound: duplicate message skipped', msg.providerMessageId);
      return false;
    }
    throw new Error(`[db] recordInbound insert failed: ${error.message}`);
  }

  return true;
}

// ---------------------------------------------------------------------------
// resolveUser — identity bridge
// ---------------------------------------------------------------------------

/**
 * Resolves a WhatsApp E.164 number to a RADAR user_id via the
 * `resolve_wa_user` SECURITY DEFINER RPC (Pattern 1).
 *
 * Returns the user's UUID string if the number has an active binding,
 * or null if the number is unlinked.
 */
export async function resolveUser(waNumber: string): Promise<string | null> {
  const db = serviceClient();

  const { data, error } = await db.rpc('resolve_wa_user', { p_wa: waNumber });

  if (error) {
    throw new Error(`[db] resolveUser RPC failed: ${error.message}`);
  }

  // RPC returns a uuid scalar or null
  return typeof data === 'string' ? data : null;
}

// ---------------------------------------------------------------------------
// markProcessed — update message status
// ---------------------------------------------------------------------------

/**
 * Updates the status of a `whatsapp_messages` row after processing completes.
 *
 * @param providerMessageId  The Meta Cloud API message id.
 * @param status             'processed' | 'failed'
 * @param intent             Optional classified intent tag (added in later task).
 */
export async function markProcessed(
  providerMessageId: string,
  status: Extract<MessageStatus, 'processed' | 'failed'>,
  intent?: string,
): Promise<void> {
  const db = serviceClient();

  const patch: Record<string, unknown> = { status };
  if (intent !== undefined) patch['intent'] = intent;

  const { error } = await db
    .from('whatsapp_messages')
    .update(patch)
    .eq('provider_message_id', providerMessageId);

  if (error) {
    // Non-fatal: log but don't throw — the message was already processed;
    // failing to update the status row shouldn't fail the overall handler.
    console.error('[db] markProcessed update failed:', error.message, providerMessageId);
  }
}

// ---------------------------------------------------------------------------
// redeemLinkCode — link-code redemption (HU-26)
// ---------------------------------------------------------------------------

export type RedeemStatus = 'linked' | 'expired' | 'reused' | 'invalid' | 'already_linked';

export interface RedeemResult {
  status: RedeemStatus;
  user_id: string | null;
}

/**
 * Calls the `redeem_link_code` SECURITY DEFINER RPC (Pattern 1) with the
 * supplied 6-char code (already uppercased) and the E.164 sender number.
 *
 * Returns the discrete outcome from the RPC:
 *   'linked'        — number bound to the code's user; success
 *   'expired'       — code TTL elapsed; no binding created
 *   'reused'        — code already consumed; no binding created
 *   'invalid'       — no matching code row found
 *   'already_linked'— number already bound to a different user
 *
 * Throws on unexpected DB errors so the caller's catch-all can handle them.
 */
export async function redeemLinkCode(code: string, waNumber: string): Promise<RedeemResult> {
  const db = serviceClient();

  const { data, error } = await db.rpc('redeem_link_code', { p_code: code, p_wa: waNumber });

  if (error) {
    throw new Error(`[db] redeemLinkCode RPC failed: ${error.message}`);
  }

  const result = data as { status: RedeemStatus; user_id: string | null };
  return result;
}

// ---------------------------------------------------------------------------
// Conversation state helpers (D4 in design.md)
// ---------------------------------------------------------------------------

export interface ConversationRow {
  userId: string;
  pendingAction: PendingAction | null;
  pendingKind: PendingActionKind | null;
  expiresAt: string | null;
  waNumber: string;
}

/**
 * Retrieves the current conversation row for a user.
 * Returns null if no row exists yet.
 */
export async function getConversation(userId: string): Promise<ConversationRow | null> {
  const db = serviceClient();

  const { data, error } = await db
    .from('whatsapp_conversations')
    .select('user_id, pending_action, pending_kind, expires_at, wa_number')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    throw new Error(`[db] getConversation query failed: ${error.message}`);
  }

  if (!data) return null;

  return {
    userId: data.user_id as string,
    pendingAction: data.pending_action !== null ? (data.pending_action as PendingAction) : null,
    pendingKind: data.pending_kind !== null ? (data.pending_kind as PendingActionKind) : null,
    expiresAt: data.expires_at as string | null,
    waNumber: data.wa_number as string,
  };
}

/**
 * Upserts a pending action for a user conversation.
 *
 * The conversation row is keyed by user_id (pk = user_id in
 * `whatsapp_conversations`). Upserting replaces any previous pending action,
 * which implements the "one pending action at a time" constraint from D4.
 *
 * @param userId    RADAR user UUID.
 * @param waNumber  Sender E.164 number (used to update or create the row).
 * @param action    The pending action payload.
 * @param kind      The kind of pending action.
 * @param expiresAt ISO-8601 timestamp when the pending action expires.
 */
export async function setPendingAction(
  userId: string,
  waNumber: string,
  action: PendingAction,
  kind: PendingActionKind,
  expiresAt: string,
): Promise<void> {
  const db = serviceClient();

  const { error } = await db.from('whatsapp_conversations').upsert(
    {
      user_id: userId,
      wa_number: waNumber,
      pending_action: action,
      pending_kind: kind,
      expires_at: expiresAt,
    },
    { onConflict: 'user_id' },
  );

  if (error) {
    throw new Error(`[db] setPendingAction upsert failed: ${error.message}`);
  }
}

/**
 * Clears the pending action for a user, either after it is consumed
 * (confirmed/cancelled) or because it expired.
 */
export async function clearPending(userId: string): Promise<void> {
  const db = serviceClient();

  const { error } = await db
    .from('whatsapp_conversations')
    .update({ pending_action: null, pending_kind: null, expires_at: null })
    .eq('user_id', userId);

  if (error) {
    // Non-fatal: log but don't throw
    console.error('[db] clearPending update failed:', error.message, userId);
  }
}

// ---------------------------------------------------------------------------
// countRecentInbound — rate-limit helper
// ---------------------------------------------------------------------------

/**
 * Counts how many inbound `whatsapp_messages` rows exist for `waNumber`
 * within the last `windowSeconds` seconds.
 *
 * Used by the per-number rate limiter in dispatch.ts to reject bursts before
 * any expensive downstream work (Groq / Graph API) is performed.
 */
export async function countRecentInbound(waNumber: string, windowSeconds: number): Promise<number> {
  const db = serviceClient();

  const since = new Date(Date.now() - windowSeconds * 1000).toISOString();

  const { count, error } = await db
    .from('whatsapp_messages')
    .select('id', { count: 'exact', head: true })
    .eq('wa_number', waNumber)
    .eq('direction', 'inbound' satisfies MessageDirection)
    .gte('received_at', since);

  if (error) {
    // Non-fatal: on query failure, err on the side of caution by returning 0
    // so a transient DB hiccup doesn't block legitimate messages.
    console.error('[db] countRecentInbound query failed:', error.message);
    return 0;
  }

  return count ?? 0;
}

// ---------------------------------------------------------------------------
// unlinkUser — remove WhatsApp binding for a user (HU-27)
// ---------------------------------------------------------------------------

/**
 * Unlinks the WhatsApp number from a RADAR user account by calling the
 * `unlink_wa` SECURITY DEFINER RPC (Pattern 1).
 *
 * The RPC removes the wa_number binding from `whatsapp_linked_numbers` and
 * clears the conversation row so the number goes back to the unlinked state.
 *
 * @param userId  RADAR user UUID whose WhatsApp binding should be removed.
 */
export async function unlinkUser(userId: string): Promise<void> {
  const db = serviceClient();

  const { error } = await db.rpc('unlink_wa', { p_user_id: userId });

  if (error) {
    throw new Error(`[db] unlinkUser RPC failed: ${error.message}`);
  }
}
