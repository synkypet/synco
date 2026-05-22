import { ProductMetadata } from '../BaseAdapter';

export class MLClient {
  /**
   * Busca metadados da API pública do ML.
   * Endpoint: GET https://api.mercadolibre.com/items/{MLB_ID}
   * Timeout: 8s
   * Retry: 2 tentativas
   */
  async fetchItemMetadata(itemId: string): Promise<Partial<ProductMetadata> | null> {
    const url = `https://api.mercadolibre.com/items/${itemId}`;
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
        
        let imageUrl = data.thumbnail;
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
          name: data.title,
          currentPrice: currentPrice,
          originalPrice: originalPrice,
          discountPercent,
          imageUrl,
          marketplace: 'mercadolivre',
          currentPriceFactual: currentPrice,
          currentPriceSource: 'api.price',
          commissionValueFactual: 0,
          commissionSource: 'fallback',
          itemId: itemId
        };
      } catch (error: any) {
        clearTimeout(id);
        console.warn(`[ML-CLIENT] Attempt ${attempt} failed for ${itemId}: ${error.message}`);
        if (attempt > maxRetries) {
          return null;
        }
        await new Promise(resolve => setTimeout(resolve, 600));
      }
    }
    
    return null;
  }
}
