import { NextResponse } from 'next/server';
import { ShopeeAffiliateClient } from '@/lib/shopee-affiliate/client';
import { productService } from '@/services/supabase/product-service';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { keyword } = await request.json();

    if (!keyword || typeof keyword !== 'string') {
      return NextResponse.json({ error: 'Keyword is required' }, { status: 400 });
    }

    const shopeeAppId = process.env.SHOPEE_APP_ID;
    const shopeeAppSecret = process.env.SHOPEE_APP_SECRET;

    if (!shopeeAppId || !shopeeAppSecret) {
      return NextResponse.json({ error: 'Shopee credentials not configured' }, { status: 500 });
    }

    const client = new ShopeeAffiliateClient({
      appId: shopeeAppId,
      secret: shopeeAppSecret,
    });

    const rawNodes = await client.searchProducts({ 
      keyword, 
      limit: 20, 
      sortType: 1
    });

    const validNodes = rawNodes.filter(n => n.imageUrl && n.productName && n.price);
    
    validNodes.sort((a, b) => {
      const rateA = parseFloat(String(a.commissionRate || 0));
      const rateB = parseFloat(String(b.commissionRate || 0));
      return rateB - rateA;
    });

    const topItems = validNodes.slice(0, 10);
    const supabaseAdmin = createAdminClient();
    const insertedProducts = [];

    for (const node of topItems) {
      const originalPrice = parseFloat(String(node.priceMax || node.price || 0)) / 100000;
      const currentPrice = parseFloat(String(node.priceMin || node.price || 0)) / 100000;
      const commissionRate = parseFloat(String(node.commissionRate || 0));
      
      let discountPercent = parseFloat(String(node.priceDiscountRate || 0));
      if (!discountPercent && originalPrice > currentPrice) {
        discountPercent = Math.round((1 - (currentPrice / originalPrice)) * 100);
      }

      // Base opportunity score, elevated if it has good commission
      const opportunityScore = Math.min(100, Math.round((discountPercent * 0.4) + (commissionRate * 100 * 0.6) + 50));
      const productLink = node.productLink || `https://shopee.com.br/product/${node.shopId}/${node.itemId}`;
      
      try {
        const inserted = await productService.insertFromAutomation({
          name: node.productName,
          marketplace: 'Shopee',
          category: keyword, // Tag the category with the searched keyword
          original_url: productLink,
          image_url: node.imageUrl,
          current_price: currentPrice,
          original_price: originalPrice,
          discount_percent: discountPercent,
          commission_percent: commissionRate * 100,
          commission_value: (currentPrice * commissionRate),
          opportunity_score: Math.min(100, opportunityScore),
          is_favorite: false,
          already_sent: false,
          free_shipping: false,
          official_store: false,
        }, supabaseAdmin);
        
        if (inserted) insertedProducts.push(inserted);
      } catch (err) {
        console.error('Falha ao inserir item garimpado:', err);
      }
    }

    return NextResponse.json({
      status: 'SUCCESS',
      message: `${insertedProducts.length} produtos encontrados e adicionados ao Radar.`,
      items: insertedProducts
    });

  } catch (error: any) {
    console.error('Erro no Garimpo Shopee:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
