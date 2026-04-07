// src/lib/marketplaces/ShopeeAdapter.ts
// Adapter para Shopee — limpeza de URL, resolução de short-links e geração de link de afiliado.

import { MarketplaceAdapter, ProductMetadata } from './BaseAdapter';

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
        const res = await fetch(url, { method: 'HEAD', redirect: 'follow' });
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

  async fetchMetadata(url: string): Promise<ProductMetadata | null> {
    // Extração de IDs da URL da Shopee
    // Formato típico: shopee.com.br/product-name-i.{shopId}.{itemId}
    const match = url.match(/i\.(\d+)\.(\d+)/);

    if (!match) {
      console.warn(`ShopeeAdapter: Could not extract product IDs from URL: ${url}`);
      return null;
    }

    const [, shopId, itemId] = match;

    try {
      // Tentar via API pública da Shopee (pode ser bloqueada sem credenciais)
      const apiUrl = `https://shopee.com.br/api/v4/item/get?shopid=${shopId}&itemid=${itemId}`;
      const res = await fetch(apiUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'application/json',
          'Referer': 'https://shopee.com.br/'
        }
      });

      if (!res.ok) {
        console.warn(`ShopeeAdapter: API returned ${res.status} for item ${itemId}`);
        return null;
      }

      const data = await res.json();
      const item = data.data || data.item;

      if (!item) return null;

      const name = item.name || item.title || 'Produto Shopee';
      const originalPrice = (item.price_before_discount || item.price || 0) / 100000;
      const currentPrice = (item.price || item.price_min || 0) / 100000;
      const discount = originalPrice > 0
        ? Math.round(((originalPrice - currentPrice) / originalPrice) * 100)
        : 0;
      const imageUrl = item.image
        ? `https://cf.shopee.com.br/file/${item.image}`
        : '';

      return {
        name,
        originalPrice,
        currentPrice,
        discountPercent: discount,
        imageUrl,
        marketplace: 'Shopee'
      };

    } catch (error) {
      console.warn('ShopeeAdapter: Failed to fetch metadata:', error);
      return null;
    }
  }

  // ─── Link de Afiliado ───────────────────────────────────────────────────

  async generateAffiliateLink(cleanUrl: string): Promise<string> {
    // Se houver credenciais de API de Afiliado configuradas, usar
    const affiliateId = process.env.SHOPEE_AFFILIATE_ID;

    if (affiliateId) {
      // Formato básico do link de afiliado Shopee
      // A Shopee usa o padrão: https://shope.ee/an_affiliate_link
      // Mas para geração real via API, precisaríamos do Open Platform
      try {
        const encoded = encodeURIComponent(cleanUrl);
        return `https://shope.ee/redirect?url=${encoded}&af_id=${affiliateId}`;
      } catch {
        return cleanUrl;
      }
    }

    // Sem credenciais → retornar URL limpa (afiliação manual pelo usuário)
    console.warn('ShopeeAdapter: SHOPEE_AFFILIATE_ID not configured, returning clean URL');
    return cleanUrl;
  }
}
