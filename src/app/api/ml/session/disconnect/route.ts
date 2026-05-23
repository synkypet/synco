import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { createAdminClient } from '@/lib/ml/extension-auth';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    const cookieStore = cookies();
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    
    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        get(name: string) { return cookieStore.get(name)?.value; },
        set(name: string, value: string, options: CookieOptions) { try { cookieStore.set({ name, value, ...options }); } catch (e) {} },
        remove(name: string, options: CookieOptions) { try { cookieStore.set({ name, value: '', ...options }); } catch (e) {} },
      },
    });

    const { data: { session } } = await supabase.auth.getSession();

    if (!session || !session.user) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }

    const userId = session.user.id;
    const adminClient = createAdminClient();

    await adminClient
      .from('ml_sessions')
      .update({ is_valid: false })
      .eq('user_id', userId);

    await adminClient
      .from('extension_tokens')
      .update({ revoked_at: new Date().toISOString() })
      .eq('user_id', userId)
      .is('revoked_at', null);

    await adminClient
      .from('ml_pairing_codes')
      .update({ used: true })
      .eq('user_id', userId)
      .eq('used', false);

    console.log('[SESSION-DISCONNECT] userId:', userId.substring(0, 8), '— session and tokens revoked by panel');

    return NextResponse.json({ disconnected: true });
  } catch (error) {
    console.error('[SESSION-DISCONNECT] error:', error);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}
