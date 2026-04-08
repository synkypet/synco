// src/lib/marketplaces/ShopeeAdapter.ts
// Adapter para Shopee — limpeza de URL, resolução de short-links e geração de link de afiliado.

import { MarketplaceAdapter, ProductMetadata } from './BaseAdapter';
import { UserMarketplaceConnection } from '@/types/marketplace';
import { ShopeeAffiliateClient } from '@/lib/shopee-affiliate/client';

export class ShopeeAdapter extends MarketplaceAdapter {
  readonly name = 'Shopee';

  // ─── Detecção ───────────────────────────────────────────────────────────

  canHandle(url: string): boolean {
    const lower = url.toLowerCase();
    return lower.includes('shopee.com.br') || lower.includes('shope.ee');
  }

  // ─── Limpeza de URL ─────────────────────────────────────────────────────

  async cleanUrl(url: string): Promise<string> {
    let resolvedUrl = url;

    // Resolver short-links (shope.ee/xxx)
    if (url.includes('shope.ee')) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 4000);
        const res = await fetch(url, { method: 'HEAD', redirect: 'follow', signal: controller.signal });
        clearTimeout(timeout);
        resolvedUrl = res.url || url;
      } catch {
        // Se falhar a resolução, continuar com a URL original
        resolvedUrl = url;
      }
    }

    // Remover tracking params desnecessários
    try {
      const parsed = new URL(resolvedUrl);
      const paramsToRemove = [
        'sp_atk', 'xptdk', 'is_from_login', 'af_siteid',
        'pid', 'af_click_lookback', 'af_viewthrough_lookback',
        'is_retarget', 'af_reengagement_window', 'af_sub_siteid',
        'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'
      ];
      paramsToRemove.forEach(p => parsed.searchParams.delete(p));
      return parsed.toString();
    } catch {
      return resolvedUrl;
    }
  }

  // ─── Metadados ──────────────────────────────────────────────────────────

  async fetchMetadata(url: string, connection?: UserMarketplaceConnection): Promise<ProductMetadata | null> {
    // 1. Fallback Imediato: Extrair nome do slug da URL
    let nameFallback = 'Produto Shopee';
    try {
      const path = new URL(url).pathname;
      const parts = path.split('/');
      const lastPart = parts[parts.length - 1];
      if (lastPart.includes('-i.')) {
        const rawSlug = lastPart.split('-i.')[0];
        nameFallback = decodeURIComponent(rawSlug.replace(/-/g, ' '));
        nameFallback = nameFallback.charAt(0).toUpperCase() + nameFallback.slice(1);
      }
    } catch (e) {
      console.error('ShopeeAdapter: URL parse fallback failed:', e);
    }

    // 2. Extração robusta de IDs (ShopID, ItemID e ModelID)
    let shopId = '';
    let itemId = '';
    let modelId = '';

    // Regex 1: Formato clássico (...-i.SHOPID.ITEMID)
    const classicMatch = url.match(/i\.(\d+)\.(\d+)/);
    // Regex 2: Formato moderno (/product/SHOPID/ITEMID)
    const modernMatch = url.match(/\/product\/(\d+)\/(\d+)/);

    if (classicMatch) {
      shopId = classicMatch[1];
      itemId = classicMatch[2];
    } else if (modernMatch) {
      shopId = modernMatch[1];
      itemId = modernMatch[2];
    }

    // Extrair ModelId (se houver via query param)
    try {
      const urlObj = new URL(url);
      modelId = urlObj.searchParams.get('display_model_id') || '';
    } catch {
      // Ignora erro de parse de URL
    }

    // LOG DE AUDITORIA EXIGIDO (Passo 3 do pedido)
    console.log(`[SHOPEE AUDIT] Original URL: ${url}`);
    console.log(`[SHOPEE AUDIT] shopId=${shopId || 'N/A'} itemId=${itemId || 'N/A'} modelId=${modelId || 'N/A'}`);
    const scraperApiUrl = shopId && itemId ? `https://shopee.com.br/api/v4/item/get?shopid=${shopId}&itemid=${itemId}` : 'N/A';
    console.log(`[SHOPEE AUDIT] Scraper API URL: ${scraperApiUrl}`);

    // 3. Prioridade 1: Tentar via API v4 da Shopee (Scraper)
    if (shopId && itemId) {
      try {
        const apiUrl = `https://shopee.com.br/api/v4/item/get?shopid=${shopId}&itemid=${itemId}`;
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 4500);

        const res = await fetch(apiUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'application/json',
            'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
            'Referer': 'https://shopee.com.br/'
          },
          signal: controller.signal
        });
        clearTimeout(timeout);

        if (!res.ok) {
           console.warn(`[SHOPEE SCRAPER] HTTP Error ${res.status}: ${res.statusText}`);
        }

        const rawBody = await res.text();
        console.log(`[SHOPEE SCRAPER] Raw Body Length: ${rawBody.length}`);
        
        if (res.ok) {
          const data = JSON.parse(rawBody);
          const item = data.data || data.item;
          
          if (!item && data.error) {
            console.warn(`[SHOPEE SCRAPER] API Error ${data.error}: ${data.message || 'Unknown error'}`);
          }

          if (item) {
            const name = item.name || item.title || nameFallback;
            
            // 1. Preço Original (Before Discount) - Tenta múltiplas fontes
            const rawOriginal = item.price_before_discount || item.price_min_before_discount || item.price_max_before_discount || item.price || 0;
            const originalPrice = rawOriginal / 100000;
            
            // 2. Preço Promocional Regular (Antes do Pix)
            const rawPromo = item.price || item.price_min || 0;
            const promoPrice = rawPromo / 100000;
            
            // 3. Lógica de Desconto Pix (Shopee BR) - Tenta múltiplas fontes
            let pixPrice = promoPrice;
            let hasPixDiscount = false;
            let pixDiscountPercent = 0;

            const pixInfo = item.campaign_attribute?.pix_discount_info || 
                            item.offer_info?.pix_discount_info || 
                            item.pix_info ||
                            item.pix_discount_info;

            // Busca por taxa de desconto Pix
            const rawPixRate = pixInfo?.pix_discount_rate || item.campaign_attribute?.pix_discount_rate || item.pix_discount_rate;
            
            if (rawPixRate) {
              pixDiscountPercent = rawPixRate / 1000; // Shopee usa 1000 = 1% ou escala similar
              // Se for escala de 1000, 5000 = 5%. Se for escala de 10000, 500 = 5%.
              // Na Shopee BR normalmente 5000 = 5% (milésimos de 100%).
              // Mas aqui trataremos como percentual direto se for > 0.
              if (pixDiscountPercent > 100) pixDiscountPercent = pixDiscountPercent / 10; // Ajuste de escala se necessário
              
              pixPrice = promoPrice * (1 - (pixDiscountPercent / 100));
              hasPixDiscount = true;
            } else if (pixInfo?.price_after_pix_discount || item.offer_info?.price_after_pix_discount) {
              const rawPixPrice = pixInfo?.price_after_pix_discount || item.offer_info?.price_after_pix_discount;
              pixPrice = rawPixPrice / 100000;
              pixDiscountPercent = promoPrice > 0 ? Math.round(((promoPrice - pixPrice) / promoPrice) * 100) : 0;
              hasPixDiscount = true;
            } else if (item.campaign_attribute?.pix_discount_price) {
               pixPrice = item.campaign_attribute.pix_discount_price / 100000;
               pixDiscountPercent = promoPrice > 0 ? Math.round(((promoPrice - pixPrice) / promoPrice) * 100) : 0;
               hasPixDiscount = true;
            }

            // 4. Preço Final (Prioridade: Pix > Promo)
            const finalPrice = hasPixDiscount ? pixPrice : promoPrice;
            const totalDiscount = originalPrice > 0
              ? Math.round(((originalPrice - finalPrice) / originalPrice) * 100)
              : 0;

            // LOG DE AUDITORIA EXIGIDO PELO USUÁRIO
            console.log(`[SHOPEE ADAPTER] strategy=scraper original=${originalPrice.toFixed(2)} promo=${promoPrice.toFixed(2)} pix=${hasPixDiscount ? pixPrice.toFixed(2) : 'N/A'} final=${finalPrice.toFixed(2)}`);

            const imageUrl = item.image
              ? `https://cf.shopee.com.br/file/${item.image}`
              : '';

            return {
              name,
              originalPrice,
              currentPrice: finalPrice, 
              discountPercent: totalDiscount,
              imageUrl,
              marketplace: 'Shopee',
              pixPrice: hasPixDiscount ? pixPrice : undefined,
              promoPrice: promoPrice,
              hasPixDiscount,
              pixDiscountPercent: hasPixDiscount ? pixDiscountPercent : undefined
            };
          }
        }
      } catch (error) {
        console.warn('ShopeeAdapter: Public scraper failed:', error);
      }
    }

    // 4. Prioridade 2: Tentar via Shopee Affiliate Open API (GraphQL) - Para dados de comissão (se disponível)
    if (connection?.is_active && connection.shopee_app_id && connection.shopee_app_secret) {
      try {
        const client = new ShopeeAffiliateClient({
          appId: connection.shopee_app_id,
          secret: connection.shopee_app_secret
        });
        
        // const queryUrl = shopId && itemId ? `https://shopee.com.br/product/${shopId}/${itemId}` : url;
        const nodes = await client.getProductOfferV2(shopId, itemId);

        if (nodes && nodes.length > 0) {
          const node = nodes[0];
          const cPrice = node.price ? parseFloat(node.price) : 0;
          
          // LOG DE AUDITORIA EXIGIDO PELO USUÁRIO (FALLBACK)
          console.log(`[SHOPEE ADAPTER] strategy=graphql original=${cPrice.toFixed(2)} promo=${cPrice.toFixed(2)} pix=N/A final=${cPrice.toFixed(2)}`);

          return {
            name: node.productName || nameFallback,
            originalPrice: cPrice, 
            currentPrice: cPrice,
            discountPercent: 0, 
            imageUrl: node.imageUrl,
            marketplace: 'Shopee',
            commissionRate: node.commissionRate ? parseFloat(String(node.commissionRate)) : undefined,
            commissionValue: node.commission ? parseFloat(String(node.commission)) : undefined
          };
        }
      } catch (err) {
        console.warn('ShopeeAdapter: GraphQL metadata failed:', err);
      }
    }

    // 4. Último Recurso: Fallback visual com nome do slug
    return {
      name: nameFallback,
      originalPrice: 0,
      currentPrice: 0,
      discountPercent: 0,
      imageUrl: '',
      marketplace: 'Shopee',
      metadata_failed: true
    };
  }

  // ─── Link de Afiliado Oficial ──────────────────────────────────────────

  async generateAffiliateLink(cleanUrl: string, connection?: UserMarketplaceConnection): Promise<string> {
    // Prepara trackers internos pra conversões da Open API (subIds suporta até 5 strings)
    const subIds: string[] = [];
    if (connection?.is_active && connection.affiliate_id) subIds.push(connection.affiliate_id);
    if (connection?.is_active && connection.affiliate_code) subIds.push(connection.affiliate_code);

    try {
      // Cria instância descartável/isolada apenas com a credencial do banco de dados deste Affiliate
      if (connection?.is_active && connection.shopee_app_id && connection.shopee_app_secret) {
        const tenantClient = new ShopeeAffiliateClient({
          appId: connection.shopee_app_id,
          secret: connection.shopee_app_secret
        });
        
        return await tenantClient.generateShortLink(cleanUrl, subIds);
      }
      
      // Fallback pra tentar Client System-Global se o usuário ainda usa tracking legado (mmp_pid) mas a agência Synco roda a API Global
      const sysClient = new ShopeeAffiliateClient();
      return await sysClient.generateShortLink(cleanUrl, subIds);

    } catch (error: any) {
      console.error(`ShopeeAdapter: GQL Fallback Triggered - ${error.message}`);

      // Graceful Downgrade: Se a API oficial falhar pesadamente, tentamos o fallback url-based antigo
      const affiliateId = connection?.is_active ? connection.affiliate_id : null;
      const fallbackEnvId = process.env.SHOPEE_AFFILIATE_ID;
      const resolvedId = affiliateId || fallbackEnvId;

      if (resolvedId) {
        try {
          const encoded = encodeURIComponent(cleanUrl);
          let link = `https://shope.ee/redirect?url=${encoded}&af_id=${resolvedId}`;
          if (connection?.affiliate_code && connection.is_active) {
              link += `&utm_source=${connection.affiliate_code}`;
          }
          return link;
        } catch {
          return cleanUrl;
        }
      }

      console.warn('ShopeeAdapter: API Falhou e sem fallback config, returning raw URL');
      return cleanUrl;
    }
  }
}
