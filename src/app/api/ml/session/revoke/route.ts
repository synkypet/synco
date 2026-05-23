import { NextResponse } from 'next/server';
import { createAdminClient, validateExtensionToken } from '@/lib/ml/extension-auth';

export async function DELETE(request: Request) {
  try {
    const adminClient = createAdminClient();
    const authHeader = request.headers.get('authorization');
    
    const authResult = await validateExtensionToken(authHeader, adminClient);
    if (!authResult) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }

    const { userId, tokenId } = authResult;

    await adminClient
      .from('ml_sessions')
      .update({ is_valid: false })
      .eq('user_id', userId);

    await adminClient
      .from('extension_tokens')
      .update({ revoked_at: new Date().toISOString() })
      .eq('token_id', tokenId);

    console.log('[SESSION-REVOKE] userId:', userId.substring(0, 8), '— sessão revogada');

    return NextResponse.json({ revoked: true });

  } catch (error) {
    console.error('[SESSION-REVOKE] error:', error);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}
