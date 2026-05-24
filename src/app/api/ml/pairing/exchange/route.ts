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

    const userIdPrefix = codeRow.user_id.substring(0, 8);

    // Resolver nome de exibição: profiles.username > auth full_name > email prefix
    let displayName: string | null = null;
    try {
      const { data: profile } = await adminClient
        .from('profiles')
        .select('username, full_name')
        .eq('id', codeRow.user_id)
        .maybeSingle();

      if (profile?.username) {
        displayName = profile.username;
      } else if (profile?.full_name) {
        displayName = profile.full_name;
      } else {
        const { data: authUser } = await adminClient.auth.admin.getUserById(codeRow.user_id);
        const meta = authUser?.user?.user_metadata;
        if (meta?.full_name) {
          displayName = meta.full_name;
        } else if (authUser?.user?.email) {
          displayName = authUser.user.email.split('@')[0];
        }
      }
    } catch {
      // Não bloquear o pareamento por falha na busca do nome
    }

    const idSuffix = `•••${codeRow.user_id.substring(codeRow.user_id.length - 2)}`;
    const accountLabel = displayName
      ? `${displayName} ${idSuffix}`
      : `Conta Synco ${idSuffix}`;

    console.log('[ML-EXT-PAIRING-DIAG]', {
      userIdPrefix,
      hasToken: true,
      hasDisplayName: Boolean(displayName),
    });

    return NextResponse.json({
      extension_token: `${tokenId}.${tokenSecret}`,
      expires_at: expiresAt,
      user_id_prefix: userIdPrefix,
      account_label: accountLabel,
    });

  } catch (error) {
    console.error('[PAIRING-EXCHANGE] error:', error);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}
