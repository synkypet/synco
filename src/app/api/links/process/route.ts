import { NextResponse } from 'next/server';
import { processLinks } from '@/lib/linkProcessor';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { decrypt, EncryptedData } from '@/lib/encryption';

export async function POST(request: Request) {
  try {
    // Basic auth check
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { links = [], tone = 'auto' } = body;

    if (!Array.isArray(links) || links.length === 0) {
      return NextResponse.json({ error: 'No links provided' }, { status: 400 });
    }

    // Buscar conexões do usuário de forma segura no server-side usando o token atual
    const { data: userConnections } = await supabase
      .from('user_marketplaces')
      .select('*, marketplaces(name)')
      .eq('user_id', user.id);

    const supabaseAdmin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!, 
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const enrichedConnections = await Promise.all((userConnections || []).map(async (conn) => {
      let appSecret = '';
      if (conn.has_secret) {
        const { data: secretRow } = await supabaseAdmin
          .from('user_marketplace_secrets')
          .select('encrypted_secret, iv, auth_tag')
          .eq('user_id', user.id)
          .eq('marketplace_id', conn.marketplace_id)
          .single();
          
        if (secretRow) {
          try {
            appSecret = decrypt({
              encryptedValue: secretRow.encrypted_secret,
              iv: secretRow.iv,
              authTag: secretRow.auth_tag
            });
          } catch (cryptoErr) {
            console.error('Falha ao descriptografar segredo para o tenant:', cryptoErr);
          }
        }
      }

      return {
        ...conn,
        marketplace_name: conn.marketplaces?.name || '',
        shopee_app_id: conn.shopee_app_id, 
        affiliate_id: conn.affiliate_id,
        affiliate_code: conn.affiliate_code,
        shopee_app_secret: appSecret
      };
    }));

    // Server-side processing with tone support
    const snapshots = await processLinks(links, enrichedConnections, tone);

    return NextResponse.json({ 
      status: 'SUCCESS',
      results: snapshots 
    });
  } catch (error: any) {
    console.error('Error processing links via API:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
