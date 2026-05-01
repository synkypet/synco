import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireOperationalAccess } from '@/lib/access/require-operational-access';
import { marketplaceService } from '@/services/supabase/marketplace-service';
import { ShopeeAffiliateClient } from '@/lib/shopee-affiliate/client';

export const revalidate = 60; // Cache 60s

export async function GET(request: Request) {
  try {
    // 1. Operations Gate & Auth
    const gate = await requireOperationalAccess();
    if (!gate.ok) return gate.response;
    const { user } = gate;

    const { searchParams } = new URL(request.url);
    const keyword = searchParams.get('keyword') || undefined;
    const sortType = parseInt(searchParams.get('sortType') || '1', 10);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);

    const supabaseAdmin = createAdminClient();
    const connections = await marketplaceService.getEnrichedConnections(user.id, supabaseAdmin);
    const connection = connections.find(c => c.marketplace_name === 'Shopee');

    if (!connection || !connection.shopee_app_id || !connection.shopee_app_secret) {
      return NextResponse.json({ error: 'Credenciais Shopee não configuradas' }, { status: 400 });
    }

    // 2. Acquisition
    const client = new ShopeeAffiliateClient({
      appId: connection.shopee_app_id,
      secret: connection.shopee_app_secret
    });

    const data = await client.fetchOffers({ keyword, sortType, page, limit });

    // 3. Normalization
    const offers = data.nodes.map(node => {
      // commissionRate is a string like "0.03" for 3%
      let commissionPercent = 0;
      if (node.commissionRate) {
        commissionPercent = parseFloat(node.commissionRate) * 100;
        // Fix potential floating point issues (e.g. 0.03 * 100 = 3.0000000000000004)
        commissionPercent = Math.round(commissionPercent * 100) / 100;
      }

      return {
        ...node,
        commissionPercent,
        periodEndFormatted: node.periodEndTime 
          ? new Date(node.periodEndTime * 1000).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
          : null
      };
    });

    return NextResponse.json({
      status: 'SUCCESS',
      queryUsed: 'shopeeOfferV2',
      offers,
      pageInfo: data.pageInfo,
      testedAt: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('[SHOPEE-OFFERS] Error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
