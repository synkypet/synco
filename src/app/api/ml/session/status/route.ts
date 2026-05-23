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
    .limit(1)
    .single();

  const { data: extensionToken } = await adminClient
    .from('extension_tokens')
    .select('id')
    .eq('user_id', userId)
    .is('revoked_at', null)
    .gt('expires_at', new Date().toISOString())
    .limit(1)
    .single();

  let status = 'not_paired';
  let hasExtensionToken = !!extensionToken;
  let hasValidSession = false;
  let lastSyncedAt = null;
  let expiresAt = null;

  if (mlSession) {
    hasExtensionToken = true;
    lastSyncedAt = mlSession.synced_at;
    expiresAt = mlSession.expires_at;

    const isExpired = new Date(mlSession.expires_at).getTime() <= Date.now();

    if (mlSession.is_valid && !isExpired) {
      status = 'session_ready';
      hasValidSession = true;
    } else if (mlSession.is_valid && isExpired) {
      status = 'session_expired';
      hasValidSession = false;
    } else {
      status = 'session_revoked';
      hasValidSession = false;
    }
  } else if (extensionToken) {
    status = 'paired_no_session';
    hasValidSession = false;
  }

  console.log('[SESSION-STATUS] userId:', userId.substring(0, 8), '— status:', status);

  return NextResponse.json({
    status,
    hasExtensionToken,
    hasValidSession,
    lastSyncedAt,
    expiresAt
  });
}
