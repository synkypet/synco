import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { createAdminClient } from '@/lib/ml/extension-auth';
import { getDecryptedMLSession } from '@/lib/ml/vault';
import { generateMeliShortLink } from '@/lib/ml/createLink';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
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
    const body = await request.json().catch(() => ({}));
    const { canonical_url, tag: bodyTag } = body;

    if (!canonical_url || typeof canonical_url !== 'string' || !canonical_url.startsWith('https://')) {
      return NextResponse.json({ error: 'invalid_url' }, { status: 400 });
    }
    
    if (!canonical_url.includes('mercadolivre.com.br') && !canonical_url.includes('mercadolibre.com')) {
      return NextResponse.json({ error: 'invalid_url' }, { status: 400 });
    }

    const adminClient = createAdminClient();

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count } = await adminClient
      .from('ml_link_generation_log')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gt('created_at', oneHourAgo);

    if (count !== null && count >= 30) {
      return NextResponse.json({ error: 'rate_limit_exceeded' }, { status: 429 });
    }

    let resolvedTag: string | null = null;
    const tagRegex = /^\w{3,30}$/;

    if (bodyTag && tagRegex.test(bodyTag)) {
      resolvedTag = bodyTag;
    } else {
      const { data: conn } = await adminClient
        .from('user_marketplace_connections')
        .select('ml_partner_id')
        .eq('user_id', userId)
        .limit(1)
        .single();
        
      if (conn?.ml_partner_id && tagRegex.test(conn.ml_partner_id)) {
        resolvedTag = conn.ml_partner_id;
      }
    }

    if (!resolvedTag) {
      return NextResponse.json({ 
        error: 'missing_affiliate_tag',
        message: 'Informe a tag de afiliado no body ou configure nas credenciais ML.'
      }, { status: 400 });
    }

    let sessionSnapshot;
    try {
      sessionSnapshot = await getDecryptedMLSession(userId, adminClient);
    } catch (err: any) {
      if (err.message === 'vault_misconfigured') {
        return NextResponse.json({ error: 'vault_misconfigured' }, { status: 500 });
      }
      return NextResponse.json({ error: 'internal_error' }, { status: 500 });
    }

    if (!sessionSnapshot) {
      return NextResponse.json({
        error: 'no_valid_session',
        message: 'Sincronize sua sessão ML pela extensão Chrome.',
        fallback: true
      }, { status: 404 });
    }

    const result = await generateMeliShortLink({
      canonicalUrl: canonical_url,
      tag: resolvedTag,
      sessionSnapshot
    });

    await adminClient
      .from('ml_link_generation_log')
      .insert({
        user_id: userId,
        status: result.success ? 'success' : 'failed',
        error_code: result.error_code
      });

    console.log('[GENERATE-SHORT-LINK] userId:', userId.substring(0, 8), '— status:', result.success ? 'success' : result.error_code);

    if (result.error_code === 'ml_unauthorized') {
      await adminClient
        .from('ml_sessions')
        .update({ is_valid: false })
        .eq('user_id', userId);
        
      console.warn('[GENERATE] userId:', userId.substring(0, 8), '— sessão ML invalidada por 401/403');
      
      return NextResponse.json({
        error: 'session_invalid',
        message: 'Sessão ML expirada ou incompleta. Sincronize novamente.',
        fallback: true
      }, { status: 401 });
    }

    if (result.success) {
      return NextResponse.json({ success: true, short_url: result.short_url, fallback: false }, { status: 200 });
    }

    return NextResponse.json({ success: false, fallback: true, error_code: result.error_code }, { status: 200 });

  } catch (error) {
    console.error('[GENERATE-SHORT-LINK] error:', error);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}
