import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { ShopeeAdapter } from '@/lib/marketplaces/ShopeeAdapter';
import { isBrazilFriendlyProduct } from '@/lib/filters/brazil-friendly';
import { marketplaceService } from '@/services/supabase/marketplace-service';
import { productService } from '@/services/supabase/product-service';
import { hasKeywordMatch } from '@/lib/automation/keyword-utils';
import { requireOperationalAccess } from '@/lib/access/require-operational-access';

export async function POST(request: Request) {
  try {
    // --- STEP 1: Operations Gate ---
    const gate = await requireOperationalAccess();
    if (!gate.ok) return gate.response;
    const { user, access } = gate;

    const { 
      keyword, 
      aliases = [],
      page = 1, 
      sortType = 1,
      listType = 0,
      limit = 20,
      minPrice,
      maxPrice,
      minCommission
    } = await request.json();

    console.log(`[RADAR-FETCH] keyword="${keyword}" sortType=${sortType} listType=${listType} page=${page} limit=${limit} minPrice=${minPrice} maxPrice=${maxPrice}`);

    const supabaseAdmin = createAdminClient();
    const connections = await marketplaceService.getEnrichedConnections(user.id, supabaseAdmin);
    const connection = connections.find(c => c.marketplace_name === 'Shopee');

    if (!connection) {
      return NextResponse.json({ error: 'Shopee credentials not configured' }, { status: 500 });
    }

    // --- STEP 2: Acquisition ---
    const shopeeAdapter = new ShopeeAdapter();
    const rawNodes = await shopeeAdapter.discoverProducts({
      limit,
      sortType,
      listType,
      keyword: keyword || undefined,
      minPrice,
      maxPrice,
      minCommission,
      page,
      connection
    });

    const metrics = {
      raw_from_shopee: rawNodes.length,
      dropped_keyword_filter: 0,
      dropped_missing_fields: 0,
      dropped_cjk: 0,
      dropped_low_quality: 0,
      dropped_duplicate_item_id: 0,
      dropped_duplicate_shop_prefix: 0,
      dropped_price_filter: 0,
      dropped_commission_filter: 0,
      final_returned: 0
    };

    const dropExamples: any[] = [];
    const pushDropExample = (reason: string, node: any) => {
      if (dropExamples.length < 5) {
        dropExamples.push({ reason, itemId: node.itemId, shopId: node.shopId, name: node.name?.substring(0, 30) });
      }
    };

    // --- STEP 3: Pipeline (Integrity, Dedup, Mapping) ---
    const searchTokens: string[] = keyword
      ? keyword.toLowerCase().split(/\s+/).filter((t: string) => t.length > 2)
      : [];

    const seenItemIds = new Set<string>();
    const seenShopTitles = new Set<string>();

    // 3.1. Mapeamento Inicial (Conversão Factual)
    const allMapped = rawNodes
      .map((node, index) => {
        let relevanceScore = 50;
        if (searchTokens.length > 0) {
          const title = node.name.toLowerCase();
          const hits = searchTokens.filter((t: string) => title.includes(t)).length;
          relevanceScore = Math.round((hits / searchTokens.length) * 50) + 50; 
        }

        const commissionPct = Math.round((node.commissionRate || 0) * 100);

        return {
          id: `temp_shopee_${node.itemId || Math.random().toString(36).substring(7)}`,
          name: node.name,
          original_url: node.productLink,
          image_url: node.imageUrl,
          current_price: node.currentPrice,
          original_price: node.originalPrice,
          discount_percent: node.discountPercent,
          marketplace: 'Shopee',
          category: node.category,
          commission_percent: commissionPct,
          commission_value: node.commissionValueFactual,
          opportunity_score: relevanceScore,
          sales_count: node.sales,
          rating: node.ratingStar,
          brazil_friendly: node.brazil_friendly,
          metadata: {
            itemId: node.itemId,
            shopId: node.shopId,
            shopName: node.shopName,
            shopType: node.shopType,
            fetchedAt: new Date().toISOString(),
            shopee_index: index,
            price_scale_used: node.price_scale_used,
            rawPrice: node.rawPrice,
            rawPriceMin: node.rawPriceMin,
            rawPriceMax: node.rawPriceMax,
            rawOriginalPrice: node.rawOriginalPrice,
            rawCommission: node.rawCommission,
            rawCommissionRate: node.rawCommissionRate
          }
        };
      });

    // 3.2. Filtragem Técnica e Integridade (Geral)
    const baseIntegrityProducts = allMapped.filter((node) => {
      // A. Integridade Básica
      const hasTitle = !!node.name && node.name.length > 5;
      const hasImage = !!node.image_url && node.image_url.length > 10;
      const hasPrice = node.current_price > 0;
      
      if (!hasTitle || !hasImage || !hasPrice) {
        metrics.dropped_missing_fields++;
        return false;
      }

      // B. Keyword Hard Filter (NOVO)
      if (keyword && !hasKeywordMatch(node.name, keyword, aliases)) {
        metrics.dropped_keyword_filter++;
        return false;
      }

      // C. Integridade Semântica (CJK Veto)
      if (node.brazil_friendly === 'reject') {
        metrics.dropped_cjk++;
        return false;
      }

      // C. Deduplicação por itemId
      const sid = String(node.metadata.itemId);
      if (seenItemIds.has(sid)) {
        metrics.dropped_duplicate_item_id++;
        return false;
      }
      seenItemIds.add(sid);

      // D. Deduplicação por Loja + Título
      const shopTitleKey = `${node.metadata.shopId}_${node.name.substring(0, 25).toLowerCase()}`;
      if (seenShopTitles.has(shopTitleKey)) {
        metrics.dropped_duplicate_shop_prefix++;
        return false;
      }
      seenShopTitles.add(shopTitleKey);

      return true;
    });

    // 3.3. Aplicação de Filtros de Curadoria (Fiel à Referência)
    const filteredProducts = baseIntegrityProducts.filter((node) => {
      if (minPrice && node.current_price < minPrice) {
        metrics.dropped_price_filter++;
        return false;
      }
      if (maxPrice && node.current_price > maxPrice) {
        metrics.dropped_price_filter++;
        return false;
      }
      if (minCommission && node.commission_value < minCommission) {
        metrics.dropped_commission_filter++;
        return false;
      }
      return true;
    });

    // 3.4. Detecção de Fallback (P2: Status de Observabilidade)
    const filters_zeroed_results = filteredProducts.length === 0 && baseIntegrityProducts.length > 0;
    
    let pageStatus: 'ok' | 'few' | 'zero' | 'fallback' = 'ok';
    if (filters_zeroed_results) pageStatus = 'fallback';
    else if (filteredProducts.length === 0) pageStatus = 'zero';
    else if (filteredProducts.length < 5) pageStatus = 'few';

    metrics.final_returned = filteredProducts.length;

    // --- STEP 4: Audit Logs ---
    console.log(`--- [RADAR-AUDIT-PIPELINE] keyword="${keyword}" ---`);
    console.log(`  > RAW FROM SHOPEE: ${metrics.raw_from_shopee}`);
    console.log(`  > [FETCH-SHOPEE-FILTER] Dropped by keyword: ${metrics.dropped_keyword_filter}`);
    console.log(`  > STATUS: ${pageStatus.toUpperCase()}`);
    console.log(`  > FINAL RETURNED:   ${metrics.final_returned}`);
    console.log('------------------------------------------');

    // --- STEP 5: Persistence ---
    const productsToPersist = filteredProducts;
    const persistenceErrors: string[] = [];
    let persistedCount = 0;

    const persistencePromises = productsToPersist.map(async (productData) => {
      try {
        const { id, metadata, brazil_friendly, ...dbPayload } = productData;
        const persisted = await productService.upsertFromAutomation(dbPayload, supabaseAdmin);
        if (persisted && persisted.id) {
          productData.id = persisted.id;
          persistedCount++;
        }
      } catch (err: any) {
        persistenceErrors.push(err.message);
      }
    });

    await Promise.allSettled(persistencePromises);

    // --- STEP 6: Response ---
    return NextResponse.json({
      status: 'SUCCESS',
      pageStatus,
      products: filteredProducts,
      rawCount: metrics.raw_from_shopee,
      filteredCount: metrics.final_returned,
      hasNextPage: metrics.raw_from_shopee === limit, // Se veio menos que o limite, não tem próxima
      page,
      persisted: persistedCount,
      metrics,
      errors: persistenceErrors.length > 0 ? persistenceErrors : undefined
    });

  } catch (error: any) {
    console.error('[FETCH-SHOPEE] Error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
