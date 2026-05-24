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
    richUrl?: string
  ): Promise<Partial<ProductMetadata> | null> {
    if (itemData.type === 'catalog') {
      const targetUrl = richUrl || `https://www.mercadolivre.com.br/p/${itemData.id}`;
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

    const targetUrl = richUrl || `https://produto.mercadolivre.com.br/MLB-${itemData.id.replace(/^MLB/i, '')}`;
    let finalMetadata: Partial<ProductMetadata> | null = null;

    // 1. OG scraper local com URL original completa primeiro (rápido, < 1s)
    try {
      const ogMetadata = await this.fetchViaOG(targetUrl, itemData);
      if (ogMetadata && ogMetadata.name && ogMetadata.name !== 'Produto Mercado Livre') {
        console.log('[ML-METADATA] original_url_og_success');
        finalMetadata = ogMetadata;
      }
    } catch (err: any) {
      console.warn('[ML-METADATA] original_url_og_failed:', err.message);
    }

    // 2. Render scraper com URL original completa, timeout curto (6s)
    const scraperUrl = process.env.SCRAPER_SERVICE_URL;
    if (scraperUrl) {
      console.log('[ML-METADATA] original_url_scraper_start');
      try {
        const res = await fetch(`${scraperUrl}/scrape`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': process.env.SCRAPER_API_KEY || ''
          },
          body: JSON.stringify({ url: targetUrl }),
          signal: AbortSignal.timeout(6000)
        });

        if (res.ok) {
          const data = await res.json();
          if (data.success && data.title) {
            console.log('[ML-METADATA] original_url_scraper_success');
            return {
              name: data.title ?? finalMetadata?.name ?? 'Produto Mercado Livre',
              currentPrice: data.price ?? 0,
              originalPrice: data.originalPrice ?? data.price ?? 0,
              discountPercent: data.discountPercent ?? 0,
              imageUrl: data.image ?? finalMetadata?.imageUrl ?? '',
              marketplace: 'Mercado Livre',
              currentPriceFactual: data.price ?? 0,
              currentPriceSource: data.price ? 'scraper' : 'fallback',
              commissionValueFactual: 0,
              commissionSource: 'fallback',
              itemId: itemData.id,
              price_unavailable: !data.price
            } as any;
          }
        } else {
          console.warn('[ML-METADATA] original_url_scraper_failed');
        }
      } catch (err: any) {
        if (err.name === 'TimeoutError' || err.message?.includes('timeout') || err.name === 'AbortError') {
          console.warn('[ML-METADATA] original_url_scraper_timeout');
        } else {
          console.warn('[ML-METADATA] original_url_scraper_failed:', err.message);
        }
      }
    }

    // Se o OG scraper já conseguiu título e imagem, retornamos diretamente para evitar bloqueios
    if (finalMetadata) {
      return finalMetadata;
    }

    // 3. API pública ML como último recurso
    console.log('[ML-METADATA] trying_public_api');
    const apiUrl = `https://api.mercadolibre.com/items/${itemData.id}`;
    try {
      const response = await fetch(apiUrl, { signal: AbortSignal.timeout(5000) });
      if (!response.ok) {
        if (response.status === 403) {
          console.warn('[ML-METADATA] api_fallback_403');
        }
        throw new Error(`API error: ${response.status}`);
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
        currentPrice,
        originalPrice,
        discountPercent,
        imageUrl,
        marketplace: 'Mercado Livre',
        currentPriceFactual: currentPrice,
        currentPriceSource: 'api.price',
        commissionValueFactual: 0,
        commissionSource: 'fallback',
        itemId: itemData.id
      };
    } catch (err: any) {
      console.warn('[ML-METADATA] api_fallback_failed:', err.message);
    }

    // 4. fallback_partial se tudo falhar
    console.log('[ML-METADATA] fallback_partial');
    return {
      name: 'Produto Mercado Livre',
      currentPrice: 0,
      originalPrice: 0,
      discountPercent: 0,
      imageUrl: '',
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
}
