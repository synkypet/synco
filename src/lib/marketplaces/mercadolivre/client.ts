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

    if (itemData.type === 'catalog') {
      return this.fetchCatalogMetadata(itemData, richUrl, t0);
    }

    return this.fetchItemMetadataFast(itemData, richUrl, t0);
  }

  // ─── catalog ─────────────────────────────────────────────────────────────

  private async fetchCatalogMetadata(
    itemData: { id: string, type: 'catalog' | 'item' },
    richUrl: string | undefined,
    t0: number
  ): Promise<Partial<ProductMetadata> | null> {
    const targetUrl = richUrl || `https://www.mercadolivre.com.br/p/${itemData.id}`;

    // 1. OG local primeiro (rápido)
    try {
      const tOg = Date.now();
      const ogMetadata = await this.fetchViaOG(targetUrl, itemData);
      const ogMs = Date.now() - tOg;

      if (ogMetadata && ogMetadata.name && ogMetadata.name !== 'Produto Mercado Livre') {
        console.log('[ML-PERF] og_ms=' + ogMs + ' fast_path_used=true');
        console.log('[ML-METADATA] catalog_og_success');
        console.log('[ML-PERF] total_metadata_ms=' + (Date.now() - t0));
        return ogMetadata;
      }
      console.log('[ML-PERF] og_ms=' + ogMs + ' og_result=no_title');
    } catch (err: any) {
      console.warn('[ML-METADATA] catalog_og_failed:', err.message);
    }

    // 2. Render scraper apenas como fallback (catalog sem OG)
    const scraperUrl = process.env.SCRAPER_SERVICE_URL;
    if (scraperUrl) {
      const tRender = Date.now();
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

        const renderMs = Date.now() - tRender;
        console.log('[ML-PERF] render_scraper_ms=' + renderMs);

        if (res.ok) {
          const data = await res.json();
          if (data.success) {
            console.log('[ML-METADATA] catalog_render_success');
            console.log('[ML-PERF] total_metadata_ms=' + (Date.now() - t0));
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
      } catch (err: any) {
        const renderMs = Date.now() - tRender;
        console.warn('[ML-PERF] render_scraper_ms=' + renderMs + ' result=timeout_or_error');
        console.warn('[ML-CLIENT] Render scraper failed:', err.message);
      }
    }

    console.log('[ML-PERF] total_metadata_ms=' + (Date.now() - t0) + ' fast_path_used=false');
    return this.buildFallback(itemData);
  }

  // ─── item (fast path) ─────────────────────────────────────────────────────

  private async fetchItemMetadataFast(
    itemData: { id: string, type: 'catalog' | 'item' },
    richUrl: string | undefined,
    t0: number
  ): Promise<Partial<ProductMetadata> | null> {
    const targetUrl = richUrl || `https://produto.mercadolivre.com.br/MLB-${itemData.id.replace(/^MLB/i, '')}`;

    // 1. OG scraper local (rápido, < 2s na maioria dos casos)
    const tOg = Date.now();
    let ogMetadata: Partial<ProductMetadata> | null = null;
    try {
      const og = await this.fetchViaOG(targetUrl, itemData);
      const ogMs = Date.now() - tOg;
      console.log('[ML-PERF] og_ms=' + ogMs);

      if (og && og.name && og.name !== 'Produto Mercado Livre') {
        console.log('[ML-METADATA] original_url_og_success');
        console.log('[ML-PERF] fast_path_used=true total_metadata_ms=' + (Date.now() - t0));
        // Fast path: OG com título → retorna imediatamente, sem Render nem API
        return og;
      }

      // OG rodou mas sem título útil — guarda imagem se houver
      if (og?.imageUrl) {
        ogMetadata = og;
      }
    } catch (err: any) {
      const ogMs = Date.now() - tOg;
      console.warn('[ML-PERF] og_ms=' + ogMs + ' result=failed');
      console.warn('[ML-METADATA] original_url_og_failed:', err.message);
    }

    // 2. Render scraper — apenas 1 tentativa curta quando OG falhou completamente
    const scraperUrl = process.env.SCRAPER_SERVICE_URL;
    if (scraperUrl) {
      const tRender = Date.now();
      console.log('[ML-METADATA] original_url_scraper_start');
      try {
        const res = await fetch(`${scraperUrl}/scrape`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': process.env.SCRAPER_API_KEY || ''
          },
          body: JSON.stringify({ url: targetUrl }),
          signal: AbortSignal.timeout(4000)
        });

        const renderMs = Date.now() - tRender;
        console.log('[ML-PERF] render_scraper_ms=' + renderMs);

        if (res.ok) {
          const data = await res.json();
          if (data.success && data.title) {
            console.log('[ML-METADATA] original_url_scraper_success');
            console.log('[ML-PERF] fast_path_used=false total_metadata_ms=' + (Date.now() - t0));
            return {
              name: data.title,
              currentPrice: data.price ?? 0,
              originalPrice: data.originalPrice ?? data.price ?? 0,
              discountPercent: data.discountPercent ?? 0,
              imageUrl: data.image ?? ogMetadata?.imageUrl ?? '',
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
          console.warn('[ML-METADATA] original_url_scraper_failed status=' + res.status);
        }
      } catch (err: any) {
        const renderMs = Date.now() - tRender;
        const isTimeout = err.name === 'TimeoutError' || err.name === 'AbortError' || err.message?.includes('timeout');
        console.warn('[ML-PERF] render_scraper_ms=' + renderMs + ' result=' + (isTimeout ? 'timeout' : 'error'));
        if (!isTimeout) console.warn('[ML-METADATA] original_url_scraper_failed:', err.message);
      }
    }

    // 3. API pública ML: desativada no fast path — gera 403 repetidamente e bloqueia ~5s
    // Mantida apenas como referência comentada para reativar em modo debug.
    // const apiUrl = `https://api.mercadolibre.com/items/${itemData.id}`;

    console.log('[ML-PERF] fast_path_used=false total_metadata_ms=' + (Date.now() - t0));
    console.log('[ML-METADATA] fallback_partial');
    return this.buildFallback(itemData, ogMetadata?.imageUrl);
  }

  // ─── helpers ─────────────────────────────────────────────────────────────

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
