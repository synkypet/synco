import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireOperationalAccess } from '@/lib/access/require-operational-access';
import { marketplaceService } from '@/services/supabase/marketplace-service';
import { ShopeeAffiliateClient } from '@/lib/shopee-affiliate/client';

export const revalidate = 60; // Cache 60s

export async function GET(request: Request) {
  try {
    const gate = await requireOperationalAccess();
    if (!gate.ok) return gate.response;
    const { user } = gate;

    const { searchParams } = new URL(request.url);
    const keyword = searchParams.get('keyword');
    const limit = parseInt(searchParams.get('limit') || '20', 10);

    if (!keyword) {
      return NextResponse.json({ error: 'Keyword é obrigatória' }, { status: 400 });
    }

    const supabaseAdmin = createAdminClient();
    const connections = await marketplaceService.getEnrichedConnections(user.id, supabaseAdmin);
    const connection = connections.find(c => c.marketplace_name === 'Shopee');

    if (!connection || !connection.shopee_app_id || !connection.shopee_app_secret) {
      return NextResponse.json({ error: 'Credenciais Shopee não configuradas' }, { status: 400 });
    }

    const client = new ShopeeAffiliateClient({
      appId: connection.shopee_app_id,
      secret: connection.shopee_app_secret
    });

    const products = await client.searchProducts({ 
      keyword, 
      limit: 20,
      sortType: 2,
      listType: 1
    });

    // Normalization
    const normalizedProducts = products.map(node => {
      let commissionPercent = 0;
      if (node.commissionRate) {
        commissionPercent = parseFloat(node.commissionRate as string) * 100;
        commissionPercent = Math.round(commissionPercent * 100) / 100;
      }
      
      const discountRate = typeof node.priceDiscountRate === 'number' ? node.priceDiscountRate : 
                           (typeof node.priceDiscountRate === 'string' ? parseInt(node.priceDiscountRate, 10) : 0);
      
      const priceParsed = node.price ? parseFloat(node.price as string) : 0;
      
      const originalPriceParsed = discountRate > 0 
        ? Math.round((priceParsed / (1 - discountRate / 100)) * 100) / 100 
        : 0;

      return {
        ...node,
        commissionPercent,
        priceParsed,
        originalPriceParsed,
        priceDiscountRate: discountRate,
        sales: typeof node.sales === 'string' ? parseInt(node.sales, 10) : (node.sales || 0)
      };
    });

    return NextResponse.json({
      status: 'SUCCESS',
      products: normalizedProducts
    });

  } catch (error: any) {
    console.error('[SHOPEE-CAMPAIGN-PRODUCTS] Error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
