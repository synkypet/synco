import { NextResponse } from 'next/server';
import { ShopeeAffiliateClient } from '@/lib/shopee-affiliate/client';
import { productService } from '@/services/supabase/product-service';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  // Authorization matching Vercel Cron pattern
  const authHeader = request.headers.get('authorization');
  if (
    process.env.CRON_SECRET &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    console.warn('[CRON] Unauthorized hit');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  console.log('[CRON] Inciando busca do Top 5 Mensal da Shopee...');

  try {
    const shopeeAppId = process.env.SHOPEE_APP_ID;
    const shopeeAppSecret = process.env.SHOPEE_APP_SECRET;

    if (!shopeeAppId || !shopeeAppSecret) {
      return NextResponse.json({ error: 'Shopee credentials not configured server-side' }, { status: 500 });
    }

    const client = new ShopeeAffiliateClient({
      appId: shopeeAppId,
      secret: shopeeAppSecret,
    });

    // Searching a generic massive term to fetch popular affiliate products
    const keyword = 'Promoção'; 
    
    // Fetch a batch of 20 products
    const rawNodes = await client.searchProducts({ 
      keyword, 
      limit: 20, 
      sortType: 1 // SortType usually helps rank best sellers/commissions
    });

    // Filter valid nodes 
    const validNodes = rawNodes.filter(n => n.imageUrl && n.productName && n.price);
    
    // Sort descending strictly by commissionRate (Garimpo local)
    validNodes.sort((a, b) => {
      const rateA = parseFloat(String(a.commissionRate || 0));
      const rateB = parseFloat(String(b.commissionRate || 0));
      return rateB - rateA;
    });

    // Take top 5
    const top5 = validNodes.slice(0, 5);
    const supabaseAdmin = createAdminClient();
    const insertedProducts = [];

    for (const node of top5) {
      // Shopee returns price in multiples of 100000
      const originalPrice = parseFloat(String(node.priceMax || node.price || 0)) / 100000;
      const currentPrice = parseFloat(String(node.priceMin || node.price || 0)) / 100000;
      const commissionRate = parseFloat(String(node.commissionRate || 0));
      
      let discountPercent = parseFloat(String(node.priceDiscountRate || 0));
      if (!discountPercent && originalPrice > currentPrice) {
        discountPercent = Math.round((1 - (currentPrice / originalPrice)) * 100);
      }

      // Hardcoded high opportunity score to dominate 'Em Alta'
      const opportunityScore = 99;
      const productLink = node.productLink || `https://shopee.com.br/product/${node.shopId}/${node.itemId}`;
      
      try {
        const inserted = await productService.upsertFromAutomation({
          name: `[TOP SHOPEE] ${node.productName}`,
          marketplace: 'Shopee',
          original_url: productLink,
          image_url: node.imageUrl,
          current_price: currentPrice,
          original_price: originalPrice,
          discount_percent: discountPercent,
          commission_percent: commissionRate * 100,
          commission_value: (currentPrice * commissionRate),
          opportunity_score: opportunityScore,
          is_favorite: true, // Auto-favorite the top picks of the day
          already_sent: false,
          free_shipping: false,
          official_store: false,
        }, supabaseAdmin);
        
        if (inserted) insertedProducts.push(inserted);
      } catch (err) {
        console.error('[CRON] Erro ao inserir produto:', err);
      }
    }

    console.log(`[CRON] Sucesso: ${insertedProducts.length} itens injetados no Radar.`);

    return NextResponse.json({
      status: 'SUCCESS',
      message: `Ingested ${insertedProducts.length} top products.`,
      items: insertedProducts
    });

  } catch (error: any) {
    console.error('[CRON] Erro Crítico:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
