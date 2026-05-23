import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { createAdminClient, validateExtensionToken } from '@/lib/ml/extension-auth';

export async function PUT(request: Request) {
  const encKeyHex = process.env.ML_VAULT_ENCRYPTION_KEY;
  if (!encKeyHex || encKeyHex.length !== 64 || !/^[0-9a-fA-F]+$/.test(encKeyHex)) {
    console.error('[SESSION-SYNC] ML_VAULT_ENCRYPTION_KEY inválida ou ausente');
    return NextResponse.json({ error: 'vault_misconfigured' }, { status: 500 });
  }

  try {
    const adminClient = createAdminClient();
    const authHeader = request.headers.get('authorization');
    
    const authResult = await validateExtensionToken(authHeader, adminClient);
    if (!authResult) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }

    const { userId } = authResult;
    const body = await request.json();
    const session_snapshot = body.session_snapshot;

    if (!session_snapshot || 
        typeof session_snapshot.csrf_token !== 'string' || !session_snapshot.csrf_token.length ||
        typeof session_snapshot.cookie_string !== 'string' || !session_snapshot.cookie_string.length ||
        typeof session_snapshot.meli_user_id !== 'string' || !session_snapshot.meli_user_id.length) {
      return NextResponse.json({ error: 'invalid_payload' }, { status: 400 });
    }

    const iv = crypto.randomBytes(12);
    const key = Buffer.from(encKeyHex, 'hex');
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    
    let plaintext = JSON.stringify(session_snapshot);
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();

    // Clear plaintext from memory
    plaintext = '';

    const hmacSecret = process.env.EXTENSION_TOKEN_HMAC_SECRET;
    if (!hmacSecret) {
      console.error('[SESSION-SYNC] EXTENSION_TOKEN_HMAC_SECRET is missing');
      return NextResponse.json({ error: 'internal_error' }, { status: 500 });
    }

    const sessionFingerprint = crypto.createHmac('sha256', hmacSecret)
      .update(session_snapshot.meli_user_id)
      .digest('hex');

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    await adminClient
      .from('ml_sessions')
      .upsert({
        user_id: userId,
        encrypted_session: encrypted.toString('base64'),
        encryption_iv: iv.toString('base64'),
        encryption_tag: tag.toString('base64'),
        session_fingerprint: sessionFingerprint,
        is_valid: true,
        synced_at: new Date().toISOString(),
        expires_at: expiresAt
      }, { onConflict: 'user_id' });

    console.log('[SESSION-SYNC] userId:', userId.substring(0, 8), '— vault atualizado');

    return NextResponse.json({ synced: true, expires_at: expiresAt });

  } catch (error) {
    console.error('[SESSION-SYNC] error:', error);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}
