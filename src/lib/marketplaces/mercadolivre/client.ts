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
          return null;
        }
        await new Promise(resolve => setTimeout(resolve, 600));
      }
    }
    
    return null;
  }
}
