/**
 * _shared/cors.ts
 * Reusable CORS headers for Supabase Edge Functions.
 *
 * Usage:
 *   import { corsHeaders } from '../_shared/cors.ts'
 *   return new Response(null, { status: 204, headers: corsHeaders })
 */

export const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type, x-client-info, apikey',
};
