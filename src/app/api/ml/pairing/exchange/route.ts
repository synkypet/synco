import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { createAdminClient } from '@/lib/ml/extension-auth';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const pairing_code = body.pairing_code;

    // TODO(fase-3): adicionar rate limit por IP ou bloqueio após N falhas
    // para mitigar brute force nos 900.000 códigos possíveis
    if (!pairing_code || typeof pairing_code !== 'string' || !/^\d{6}$/.test(pairing_code)) {
      return NextResponse.json({ error: 'invalid_format' }, { status: 400 });
    }

    const hmacSecret = process.env.EXTENSION_TOKEN_HMAC_SECRET;
    if (!hmacSecret) {
      console.error('[PAIRING-EXCHANGE] EXTENSION_TOKEN_HMAC_SECRET is missing');
      return NextResponse.json({ error: 'internal_error' }, { status: 500 });
    }

    const codeHash = crypto.createHmac('sha256', hmacSecret)
      .update(pairing_code)
      .digest('hex');

    const adminClient = createAdminClient();

    const { data: codeRow, error: findError } = await adminClient
      .from('ml_pairing_codes')
      .select('id, user_id')
      .eq('code_hash', codeHash)
      .eq('used', false)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();

    if (findError || !codeRow) {
      return NextResponse.json({ error: 'invalid_or_expired_code' }, { status: 401 });
    }

    await adminClient
      .from('ml_pairing_codes')
      .update({ used: true })
      .eq('id', codeRow.id);

    const tokenId = crypto.randomUUID();
    const tokenSecret = crypto.randomBytes(32).toString('hex');
    const tokenSecretHash = crypto.createHmac('sha256', hmacSecret)
      .update(tokenSecret)
      .digest('hex');
    
    const expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString();

    await adminClient
      .from('extension_tokens')
      .insert({
        token_id: tokenId,
        token_secret_hash: tokenSecretHash,
        user_id: codeRow.user_id,
        expires_at: expiresAt
      });

    console.log('[PAIRING-EXCHANGE] userId:', codeRow.user_id.substring(0, 8), '— token emitido');

    return NextResponse.json({
      extension_token: `${tokenId}.${tokenSecret}`,
      expires_at: expiresAt
    });

  } catch (error) {
    console.error('[PAIRING-EXCHANGE] error:', error);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}
