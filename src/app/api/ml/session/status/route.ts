import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { createAdminClient } from '@/lib/ml/extension-auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  const cookieStore = cookies();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  
  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value;
      },
      set(name: string, value: string, options: CookieOptions) {
        try { cookieStore.set({ name, value, ...options }); } catch (e) {}
      },
      remove(name: string, options: CookieOptions) {
        try { cookieStore.set({ name, value: '', ...options }); } catch (e) {}
      },
    },
  });

  const { data: { session } } = await supabase.auth.getSession();

  if (!session || !session.user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const userId = session.user.id;
  const adminClient = createAdminClient();

  const { data: mlSession } = await adminClient
    .from('ml_sessions')
    .select('is_valid, synced_at, expires_at')
    .eq('user_id', userId)
    .order('synced_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: extensionToken } = await adminClient
    .from('extension_tokens')
    .select('id')
    .eq('user_id', userId)
    .is('revoked_at', null)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  let status = 'not_paired';
  let hasExtensionToken = !!extensionToken;
  let hasValidSession = false;
  let lastSyncedAt = mlSession?.synced_at || null;
  let expiresAt = mlSession?.expires_at || null;

  if (mlSession) {
    const isExpired = new Date(mlSession.expires_at).getTime() <= Date.now();

    // 1. Se existe ml_session com is_valid=true e expires_at > now: session_ready
    if (mlSession.is_valid && !isExpired) {
      status = 'session_ready';
      hasValidSession = true;
      hasExtensionToken = true;
    }
    // 2. Senão, se existe extension_token ativo e não revogado: paired_no_session
    else if (extensionToken) {
      status = 'paired_no_session';
      hasValidSession = false;
      hasExtensionToken = true;
    }
    // 3. Senão, se existe ml_session com is_valid=false: session_revoked
    else if (!mlSession.is_valid) {
      status = 'session_revoked';
      hasValidSession = false;
    }
    // 4. Senão, se existe ml_session expirada: session_expired
    else if (isExpired) {
      status = 'session_expired';
      hasValidSession = false;
    }
    // 5. Senão: not_paired (no_session)
    else {
      status = 'not_paired';
      hasValidSession = false;
    }
  } else if (extensionToken) {
    status = 'paired_no_session';
    hasValidSession = false;
    hasExtensionToken = true;
  }

  let validSessionsCount = 0;
  let revokedSessionsCount = 0;

  try {
    const { count: validCount } = await adminClient
      .from('ml_sessions')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_valid', true)
      .gt('expires_at', new Date().toISOString());
    validSessionsCount = validCount || 0;

    const { count: revokedCount } = await adminClient
      .from('ml_sessions')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_valid', false);
    
    const { count: expiredCount } = await adminClient
      .from('ml_sessions')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_valid', true)
      .lte('expires_at', new Date().toISOString());

    revokedSessionsCount = (revokedCount || 0) + (expiredCount || 0);
  } catch (err) {
    // Silently ignore counting errors
  }

  console.log('[SESSION-STATUS-DIAG]', {
    userIdPrefix: userId.substring(0, 8),
    validSessionsCount,
    revokedSessionsCount,
    selectedStatus: status,
    selectedIsValid: mlSession ? mlSession.is_valid : false,
    selectedExpiresAtExists: mlSession ? Boolean(mlSession.expires_at) : false
  });

  return NextResponse.json({
    status,
    hasExtensionToken,
    hasValidSession,
    lastSyncedAt,
    expiresAt
  });
}
