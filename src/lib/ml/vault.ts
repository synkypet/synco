import { createDecipheriv } from 'crypto';
import { SupabaseClient } from '@supabase/supabase-js';

export interface MLSessionSnapshot {
  csrf_token:    string;
  cookie_string: string;
  meli_user_id:  string;
  orgnickp?:     string;
}

export async function getDecryptedMLSession(
  userId: string,
  adminClient: SupabaseClient
): Promise<MLSessionSnapshot | null> {
  const { data: row } = await adminClient
    .from('ml_sessions')
    .select('encrypted_session, encryption_iv, encryption_tag, is_valid, expires_at')
    .eq('user_id', userId)
    .limit(1)
    .single();

  if (!row) return null;
  if (!row.is_valid) return null;
  
  if (new Date(row.expires_at).getTime() <= Date.now()) return null;

  const encKeyHex = process.env.ML_VAULT_ENCRYPTION_KEY;
  if (!encKeyHex || encKeyHex.length !== 64 || !/^[0-9a-fA-F]+$/.test(encKeyHex)) {
    throw new Error('vault_misconfigured');
  }

  try {
    const key = Buffer.from(encKeyHex, 'hex');
    const iv = Buffer.from(row.encryption_iv, 'base64');
    const tag = Buffer.from(row.encryption_tag, 'base64');
    const encrypted = Buffer.from(row.encrypted_session, 'base64');
    
    const decipher = createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    
    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final()
    ]);
    
    const plaintext = decrypted.toString('utf8');
    const snapshot = JSON.parse(plaintext) as MLSessionSnapshot;

    if (!snapshot.csrf_token || !snapshot.cookie_string || !snapshot.meli_user_id) {
      return null;
    }

    return snapshot;
  } catch (err) {
    return null;
  }
}
