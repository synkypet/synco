import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/ml/extension-auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = createClient();
    const { data: { session: authSession } } = await supabase.auth.getSession();
    
    if (!authSession?.user?.id) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
    const userId = authSession.user.id;

    const adminClient = createAdminClient();

    // 1. Fetch ML Session
    const { data: mlSession } = await adminClient
      .from('ml_sessions')
      .select('is_valid, synced_at, expires_at')
      .eq('user_id', userId)
      .limit(1)
      .maybeSingle();

    // 2. Fetch Extension Token (to know if paired)
    const { data: extensionToken } = await adminClient
      .from('extension_tokens')
      .select('id')
      .eq('user_id', userId)
      .is('revoked_at', null)
      .gt('expires_at', new Date().toISOString())
      .limit(1)
      .maybeSingle();

    let status = 'not_paired';
    let hasExtensionToken = false;
    let hasValidSession = false;
    let lastSyncedAt = null;
    let expiresAt = null;

    if (mlSession?.is_valid && new Date(mlSession.expires_at) > new Date()) {
      status = 'session_ready';
      hasExtensionToken = true;
      hasValidSession = true;
      lastSyncedAt = mlSession.synced_at;
      expiresAt = mlSession.expires_at;
    } else if (mlSession?.is_valid && new Date(mlSession.expires_at) <= new Date()) {
      status = 'session_expired';
      hasExtensionToken = true;
      hasValidSession = false;
      lastSyncedAt = mlSession.synced_at;
      expiresAt = mlSession.expires_at;
    } else if (mlSession && !mlSession.is_valid) {
      status = 'session_revoked';
      hasExtensionToken = true;
      hasValidSession = false;
      lastSyncedAt = mlSession.synced_at;
      expiresAt = mlSession.expires_at;
    } else if (!mlSession && extensionToken) {
      status = 'paired_no_session';
      hasExtensionToken = true;
      hasValidSession = false;
    }

    console.log(`[SESSION-STATUS] userId: ${userId.substring(0, 8)} — status: ${status}`);

    return NextResponse.json({
      status,
      hasExtensionToken,
      hasValidSession,
      lastSyncedAt,
      expiresAt
    });

  } catch (error) {
    console.error('[SESSION-STATUS] Error checking status:', error);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}
