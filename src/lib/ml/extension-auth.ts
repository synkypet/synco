import { createClient, SupabaseClient } from '@supabase/supabase-js';
import crypto from 'crypto';

export function createAdminClient(): SupabaseClient {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error('Supabase admin credentials are not set');
  }

  return createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}

export async function validateExtensionToken(
  authHeader: string | null,
  supabaseAdmin: SupabaseClient
): Promise<{ userId: string; tokenId: string } | null> {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const tokenString = authHeader.substring(7);
  const firstDotIndex = tokenString.indexOf('.');
  
  if (firstDotIndex === -1) return null;

  const tokenId = tokenString.substring(0, firstDotIndex);
  const tokenSecret = tokenString.substring(firstDotIndex + 1);

  if (!tokenId || !tokenSecret) return null;

  const hmacSecret = process.env.EXTENSION_TOKEN_HMAC_SECRET;
  if (!hmacSecret) {
    console.error('[EXTENSION-AUTH] EXTENSION_TOKEN_HMAC_SECRET is missing');
    return null;
  }

  const { data: row, error } = await supabaseAdmin
    .from('extension_tokens')
    .select('id, user_id, token_secret_hash')
    .eq('token_id', tokenId)
    .is('revoked_at', null)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle();

  if (error || !row) {
    return null;
  }

  const expectedHash = crypto.createHmac('sha256', hmacSecret)
    .update(tokenSecret)
    .digest('hex');

  const expectedBuffer = Buffer.from(expectedHash, 'hex');
  const actualBuffer = Buffer.from(row.token_secret_hash, 'hex');

  if (expectedBuffer.length !== actualBuffer.length) {
    return null;
  }

  const isValid = crypto.timingSafeEqual(expectedBuffer, actualBuffer);
  
  if (!isValid) {
    return null;
  }

  await supabaseAdmin
    .from('extension_tokens')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', row.id);

  return { userId: row.user_id, tokenId: tokenId };
}
