import { ProductMetadata } from '../BaseAdapter';
import { fetchOGMetadata } from './og-scraper';

export class MLClient {
  /**
   * Busca metadados da API pública do ML.
   * Endpoint: GET https://api.mercadolibre.com/items/{MLB_ID} ou /products/{MLB_ID}
   * Timeout: 8s
   * Retry: 2 tentativas
   */
  async fetchItemMetadata(
    itemData: { id: string, type: 'catalog' | 'item' },
    canonicalUrl?: string
  ): Promise<Partial<ProductMetadata> | null> {
    if (itemData.type === 'catalog') {
      const targetUrl = canonicalUrl || `https://www.mercadolivre.com.br/p/${itemData.id}`;
      const scraperUrl = process.env.SCRAPER_SERVICE_URL;

      if (scraperUrl) {
        try {
          const res = await fetch(`${scraperUrl}/scrape`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': process.env.SCRAPER_API_KEY || ''
            },
            body: JSON.stringify({ url: targetUrl }),
            signal: AbortSignal.timeout(20000) // 20s — Render Free pode demorar (cold start)
          });

          if (res.ok) {
            const data = await res.json();
            if (data.success) {
              return {
                name: data.title ?? 'Produto Mercado Livre',
                currentPrice: data.price ?? 0,
                originalPrice: data.originalPrice ?? data.price ?? 0,
                discountPercent: data.discountPercent ?? 0,
                imageUrl: data.image ?? '',
                marketplace: 'Mercado Livre',
                currentPriceFactual: data.price ?? 0,
                currentPriceSource: data.price ? 'scraper' : 'fallback',
                commissionValueFactual: 0,
                commissionSource: 'fallback',
                itemId: itemData.id,
                price_unavailable: !data.price
              } as any;
            }
          }
        } catch (err) {
          console.warn('[ML-CLIENT] Render scraper failed, falling back to OG:', err);
        }
      }

      // Fallback: OG scraper local (sem preço mas funciona)
      return this.fetchViaOG(targetUrl, itemData);
    }

    const url = `https://api.mercadolibre.com/items/${itemData.id}`;
      
    const maxRetries = 2;
    const timeoutMs = 8000;
    
    for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const response = await fetch(url, { signal: controller.signal });
        clearTimeout(id);

        if (!response.ok) {
          throw new Error(`ML API error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        
        let imageUrl = data.thumbnail || '';
        if (data.pictures && data.pictures.length > 0) {
          imageUrl = data.pictures[0].secure_url || data.pictures[0].url;
        }

        const currentPrice = data.price || 0;
        const originalPrice = data.original_price || currentPrice;
        let discountPercent = 0;
        
        if (originalPrice > currentPrice && originalPrice > 0) {
          discountPercent = Math.round(((originalPrice - currentPrice) / originalPrice) * 100);
        }

        return {
          name: data.title || data.name,
          currentPrice: currentPrice,
          originalPrice: originalPrice,
          discountPercent,
          imageUrl,
          marketplace: 'Mercado Livre',
          currentPriceFactual: currentPrice,
          currentPriceSource: 'api.price',
          commissionValueFactual: 0,
          commissionSource: 'fallback',
          itemId: itemData.id
        };
      } catch (error: any) {
        clearTimeout(id);
        console.warn(`[ML-CLIENT] Attempt ${attempt} failed for ${itemData.id}: ${error.message}`);
        if (attempt > maxRetries) {
          // API exauriu retries — tentar fallback via scraper/OG
          console.log('[ML-METADATA] api_failed_trying_scraper');
          return this.fetchItemFallback(itemData, canonicalUrl);
        }
        await new Promise(resolve => setTimeout(resolve, 600));
      }
    }

    // Fallback final caso o loop termine sem retorno
    console.log('[ML-METADATA] api_failed_trying_scraper');
    return this.fetchItemFallback(itemData, canonicalUrl);
  }

  /**
   * Fallback de catálogo: extrai título + imagem das tags OpenGraph (sem preço).
   */
  private async fetchViaOG(
    targetUrl: string,
    itemData: { id: string, type: 'catalog' | 'item' }
  ): Promise<Partial<ProductMetadata> | null> {
    const ogData = await fetchOGMetadata(targetUrl);
    return {
      name: ogData.title ?? 'Produto Mercado Livre',
      currentPrice: 0,
      originalPrice: 0,
      discountPercent: 0,
      imageUrl: ogData.imageUrl ?? '',
      marketplace: 'Mercado Livre',
      currentPriceFactual: 0,
      currentPriceSource: 'fallback',
      commissionValueFactual: 0,
      commissionSource: 'fallback',
      itemId: itemData.id,
      price_unavailable: true
    } as any;
  }

  /**
   * Fallback para itens quando a API pública retorna 403/erro.
   * Tenta: 1) Render scraper, 2) OG scraper local.
   */
  private async fetchItemFallback(
    itemData: { id: string, type: 'catalog' | 'item' },
    canonicalUrl?: string
  ): Promise<Partial<ProductMetadata> | null> {
    const targetUrl = canonicalUrl || `https://www.mercadolivre.com.br/${itemData.id}`;
    const scraperUrl = process.env.SCRAPER_SERVICE_URL;

    // 1. Tentar Render scraper
    if (scraperUrl) {
      try {
        const res = await fetch(`${scraperUrl}/scrape`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': process.env.SCRAPER_API_KEY || ''
          },
          body: JSON.stringify({ url: targetUrl }),
          signal: AbortSignal.timeout(20000)
        });

        if (res.ok) {
          const data = await res.json();
          if (data.success && data.title) {
            console.log('[ML-METADATA] scraper_success');
            return {
              name: data.title ?? 'Produto Mercado Livre',
              currentPrice: data.price ?? 0,
              originalPrice: data.originalPrice ?? data.price ?? 0,
              discountPercent: data.discountPercent ?? 0,
              imageUrl: data.image ?? '',
              marketplace: 'Mercado Livre',
              currentPriceFactual: data.price ?? 0,
              currentPriceSource: data.price ? 'scraper' : 'fallback',
              commissionValueFactual: 0,
              commissionSource: 'fallback',
              itemId: itemData.id,
              price_unavailable: !data.price
            } as any;
          }
        }
      } catch (err) {
        console.warn('[ML-METADATA] scraper_failed');
      }
    }

    // 2. Fallback: OG scraper local
    console.log('[ML-METADATA] fallback_partial');
    return this.fetchViaOG(targetUrl, itemData);
  }
}
