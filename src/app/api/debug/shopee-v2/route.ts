import { NextResponse } from 'next/server';
import { ShopeeAffiliateClient } from '@/lib/shopee-affiliate/client';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { decrypt } from '@/lib/encryption';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get('url') || 'https://shopee.com.br/Patinete-El%C3%A9trico-De-350w-Com-Uma-Bateria-De-Alta-Alcan%C3%A7a-Velocidades-De-25-30km-h-Com-Autonomia-De-4-5-Horas-i.1235724103.58204359689';

  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const supabaseAdmin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 1. Buscar a conexão
    const { data: connection } = await supabaseAdmin
      .from('user_marketplaces')
      .select('*, marketplaces!inner(name)')
      .eq('user_id', user.id)
      .eq('marketplaces.name', 'Shopee')
      .single();

    if (!connection) return NextResponse.json({ error: 'No connection in DB' });

    // 2. Buscar e descriptografar o segredo
    const { data: secretData } = await supabaseAdmin
      .from('user_marketplace_secrets')
      .select('*')
      .eq('user_id', user.id)
      .eq('marketplace_id', connection.marketplace_id)
      .single();

    let shopeeSecret = '';
    if (secretData) {
      shopeeSecret = decrypt({
        encryptedValue: secretData.encrypted_secret,
        iv: secretData.iv,
        authTag: secretData.auth_tag
      });
    }

    if (!connection.shopee_app_id || !shopeeSecret) {
      return NextResponse.json({ error: 'Credentials incomplete', appId: !!connection.shopee_app_id, secret: !!shopeeSecret });
    }

    const client = new ShopeeAffiliateClient({
      appId: connection.shopee_app_id,
      secret: shopeeSecret
    });

    const idMatch = url.match(/i\.(\d+)\.(\d+)/);
    const shopId = idMatch?.[1] || '';
    const itemId = idMatch?.[2] || '';
    const nodes = await client.getProductOfferV2(shopId, itemId);

    return NextResponse.json({
      query: 'productOfferV2',
      url,
      shopId,
      itemId,
      nodes,
      credentials_ok: true
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message });
  }
}
