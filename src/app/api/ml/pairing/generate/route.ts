import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { createAdminClient } from '@/lib/ml/extension-auth';
// Assumindo uso de createClient do @supabase/ssr ou auth-helpers
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
    const adminClient = createAdminClient();

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count } = await adminClient
      .from('ml_pairing_codes')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gt('created_at', oneHourAgo);

    if (count !== null && count >= 5) {
      return NextResponse.json({ error: 'rate_limit_exceeded' }, { status: 429 });
    }

    await adminClient
      .from('ml_pairing_codes')
      .update({ used: true })
      .eq('user_id', userId)
      .eq('used', false);

    const hmacSecret = process.env.EXTENSION_TOKEN_HMAC_SECRET;
    if (!hmacSecret) {
      console.error('[PAIRING-GENERATE] EXTENSION_TOKEN_HMAC_SECRET is missing');
      return NextResponse.json({ error: 'internal_error' }, { status: 500 });
    }

    const code = crypto.randomInt(100000, 999999);
    const codeStr = String(code).padStart(6, '0');
    const codeHash = crypto.createHmac('sha256', hmacSecret)
      .update(codeStr)
      .digest('hex');

    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    await adminClient
      .from('ml_pairing_codes')
      .insert({
        user_id: userId,
        code_hash: codeHash,
        expires_at: expiresAt
      });

    console.log('[PAIRING-GENERATE] userId:', userId.substring(0, 8), '— code gerado');

    return NextResponse.json({ code: codeStr, expires_at: expiresAt });

  } catch (error) {
    console.error('[PAIRING-GENERATE] error:', error);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}
