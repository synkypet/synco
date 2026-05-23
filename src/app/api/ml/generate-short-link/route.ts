import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/ml/extension-auth';
// Assumindo uso de createClient do @supabase/ssr
import { cookies } from 'next/headers';
import { createServerClient, type CookieOptions } from '@supabase/ssr';

export async function POST(request: Request) {
  try {
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
    const body = await request.json();
    const canonical_url = body.canonical_url;

    if (!canonical_url || typeof canonical_url !== 'string' || !canonical_url.startsWith('https://')) {
      return NextResponse.json({ error: 'invalid_url' }, { status: 400 });
    }

    const adminClient = createAdminClient();

    const { data: validSession, error } = await adminClient
      .from('ml_sessions')
      .select('id')
      .eq('user_id', userId)
      .eq('is_valid', true)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();

    if (error || !validSession) {
      return NextResponse.json({ error: 'no_valid_session', fallback: true }, { status: 404 });
    }

    console.log('[GENERATE-SHORT-LINK] userId:', userId.substring(0, 8), '— stub');

    // STUB for Phase 3
    return NextResponse.json({ error: 'not_implemented', fallback: true }, { status: 501 });

  } catch (error) {
    console.error('[GENERATE-SHORT-LINK] error:', error);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}
