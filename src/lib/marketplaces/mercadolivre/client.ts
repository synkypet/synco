import { ProductMetadata } from '../BaseAdapter';
import { fetchOGMetadata } from './og-scraper';

export class MLClient {
  /**
   * Busca metadados do produto ML.
   *
   * Fast path (Envio Rápido): OG local primeiro. Se retornar título ou imagem,
   * retorna imediatamente com price_unavailable=true — sem aguardar Render ou API.
   *
   * Slow path (fallback): Render scraper (catalog) ou API pública (item), apenas
   * quando OG falhar completamente.
   */
  async fetchItemMetadata(
    itemData: { id: string, type: 'catalog' | 'item' },
    richUrl?: string
  ): Promise<Partial<ProductMetadata> | null> {
    const t0 = Date.now();
    return this.fetchMetadataParallel(itemData, richUrl, t0);
  }

  // ─── unified parallel path ───────────────────────────────────────────────

  private async fetchMetadataParallel(
    itemData: { id: string, type: 'catalog' | 'item' },
    richUrl: string | undefined,
    t0: number
  ): Promise<Partial<ProductMetadata> | null> {
    const targetUrl = richUrl || (itemData.type === 'catalog'
      ? `https://www.mercadolivre.com.br/p/${itemData.id}`
      : `https://produto.mercadolivre.com.br/MLB-${itemData.id.replace(/^MLB/i, '')}`);
    const scraperUrl = process.env.SCRAPER_SERVICE_URL;

    const ogStart = Date.now();
    let ogTime = 0;
    let renderTime = 0;

    const promises: [Promise<Partial<ProductMetadata> | null>, Promise<Partial<ProductMetadata> | null>] = [
      // 1. OG Scraper (local, timeout de 5s para garantia)
      (async () => {
        try {
          const res = await this.fetchViaOG(targetUrl, itemData);
          ogTime = Date.now() - ogStart;
          return res;
        } catch (e) {
          ogTime = Date.now() - ogStart;
          return null;
        }
      })(),
      // 2. Render Scraper (timeout curto de 7s)
      (async () => {
        if (!scraperUrl) return null;
        const rStart = Date.now();
        console.log('[ML-METADATA] original_url_scraper_start');
        try {
          const res = await this.fetchViaRender(scraperUrl, targetUrl, itemData, 7000);
          renderTime = Date.now() - rStart;
          return res;
        } catch (err: any) {
          renderTime = Date.now() - rStart;
          const isTimeout = err.name === 'TimeoutError' || err.name === 'AbortError' || err.message?.includes('timeout');
          if (isTimeout) {
            console.warn('[ML-METADATA] original_url_scraper_timeout');
          } else {
            console.warn('[ML-METADATA] original_url_scraper_failed:', err.message);
          }
          return null;
        }
      })()
    ];

    const [ogSettled, renderSettled] = await Promise.allSettled(promises);
    const totalTime = Date.now() - ogStart;

    const ogResult = ogSettled.status === 'fulfilled' ? ogSettled.value : null;
    const renderResult = renderSettled.status === 'fulfilled' ? renderSettled.value : null;

    // Logs de Performance requeridos
    console.log(`[ML-PERF] og_ms=${ogTime}`);
    console.log(`[ML-PERF] render_ms=${renderTime}`);
    console.log(`[ML-PERF] total_metadata_ms=${totalTime}`);

    // Combinar resultados de forma inteligente
    let name = 'Produto Mercado Livre';
    let titleSource = 'fallback';
    if (renderResult?.name && renderResult.name !== 'Produto Mercado Livre') {
      name = renderResult.name;
      titleSource = 'render';
    } else if (ogResult?.name && ogResult.name !== 'Produto Mercado Livre') {
      name = ogResult.name;
      titleSource = 'og';
    }
    console.log(`[ML-METADATA] title_source=${titleSource}`);

    let imageUrl = '';
    let imageSource = 'fallback';
    if (renderResult?.imageUrl) {
      imageUrl = renderResult.imageUrl;
      imageSource = 'render';
    } else if (ogResult?.imageUrl) {
      imageUrl = ogResult.imageUrl;
      imageSource = 'og';
    }
    console.log(`[ML-METADATA] image_source=${imageSource}`);

    let currentPrice = 0;
    let originalPrice = 0;
    let discountPercent = 0;
    let priceSource = 'unavailable';
    let priceUnavailable = true;

    if (renderResult?.currentPrice && renderResult.currentPrice > 0) {
      currentPrice = renderResult.currentPrice;
      originalPrice = renderResult.originalPrice || currentPrice;
      discountPercent = renderResult.discountPercent || 0;
      priceSource = 'render';
      priceUnavailable = false;
    }
    console.log(`[ML-METADATA] price_source=${priceSource}`);

    // Se conseguimos pelo menos título ou imagem dos scrapers, retornamos o resultado combinado
    const hasMetadata = titleSource !== 'fallback' || imageSource !== 'fallback';

    if (hasMetadata) {
      return {
        name,
        currentPrice,
        originalPrice,
        discountPercent,
        imageUrl,
        marketplace: 'Mercado Livre',
        currentPriceFactual: currentPrice,
        currentPriceSource: priceSource === 'render' ? 'scraper' : 'fallback',
        commissionValueFactual: 0,
        commissionSource: 'fallback',
        itemId: itemData.id,
        price_unavailable: priceUnavailable
      } as any;
    }

    // 3. API pública ML como último recurso (somente se não tiver título nem imagem)
    console.log('[ML-METADATA] trying_public_api');
    const apiUrl = `https://api.mercadolibre.com/items/${itemData.id}`;
    try {
      const response = await fetch(apiUrl, { signal: AbortSignal.timeout(2000) }); // Timeout curto de 2s
      if (!response.ok) {
        if (response.status === 403) {
          console.warn('[ML-METADATA] api_fallback_403');
        }
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      let apiImageUrl = data.thumbnail || '';
      if (data.pictures && data.pictures.length > 0) {
        apiImageUrl = data.pictures[0].secure_url || data.pictures[0].url;
      }

      const apiCurrentPrice = data.price || 0;
      const apiOriginalPrice = data.original_price || apiCurrentPrice;
      let apiDiscountPercent = 0;

      if (apiOriginalPrice > apiCurrentPrice && apiOriginalPrice > 0) {
        apiDiscountPercent = Math.round(((apiOriginalPrice - apiCurrentPrice) / apiOriginalPrice) * 100);
      }

      return {
        name: data.title || data.name,
        currentPrice: apiCurrentPrice,
        originalPrice: apiOriginalPrice,
        discountPercent: apiDiscountPercent,
        imageUrl: apiImageUrl,
        marketplace: 'Mercado Livre',
        currentPriceFactual: apiCurrentPrice,
        currentPriceSource: 'api.price',
        commissionValueFactual: 0,
        commissionSource: 'fallback',
        itemId: itemData.id,
        price_unavailable: !apiCurrentPrice
      };
    } catch (err: any) {
      console.warn('[ML-METADATA] api_fallback_failed:', err.message);
    }

    // 4. fallback_partial se tudo falhar
    console.log('[ML-METADATA] fallback_partial');
    return this.buildFallback(itemData);
  }

  // ─── helpers ─────────────────────────────────────────────────────────────

  private async fetchViaRender(
    scraperUrl: string,
    targetUrl: string,
    itemData: { id: string, type: 'catalog' | 'item' },
    timeoutMs: number
  ): Promise<Partial<ProductMetadata> | null> {
    const res = await fetch(`${scraperUrl}/scrape`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.SCRAPER_API_KEY || ''
      },
      body: JSON.stringify({ url: targetUrl }),
      signal: AbortSignal.timeout(timeoutMs)
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
    return null;
  }

  private buildFallback(
    itemData: { id: string, type: 'catalog' | 'item' },
    imageUrl = ''
  ): Partial<ProductMetadata> {
    return {
      name: 'Produto Mercado Livre',
      currentPrice: 0,
      originalPrice: 0,
      discountPercent: 0,
      imageUrl,
      marketplace: 'Mercado Livre',
      currentPriceFactual: 0,
      currentPriceSource: 'fallback',
      commissionValueFactual: 0,
      commissionSource: 'fallback',
      itemId: itemData.id,
      price_unavailable: true
    } as any;
  }

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
