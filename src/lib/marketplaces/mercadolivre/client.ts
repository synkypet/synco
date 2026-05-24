import { ProductMetadata } from '../BaseAdapter';
import { extractMLStaticMetadata } from './html-metadata-extractor';

export class MLClient {
  /**
   * Busca metadados do Mercado Livre de forma inteligente e performática.
   * Ordem do pipeline:
   * 1. Extrator estático ultra-rápido (HTML + JSON-LD + OG) -> early stop se pegar preço
   * 2. Render scraper (Playwright) com timeout curto e controlado (6s) como fallback
   * 3. API pública como salvaguarda rápida (3s)
   * 4. Fallback parcial por URL slug e imagem padrão se nada mais funcionar
   */
  async fetchItemMetadata(
    itemData: { id: string, type: 'catalog' | 'item' },
    richUrl?: string
  ): Promise<Partial<ProductMetadata> | null> {
    const startTime = performance.now();
    let staticMs = 0;
    let renderMs = 0;
    let totalMs = 0;

    let targetUrl = richUrl;
    if (!targetUrl) {
      if (itemData.type === 'catalog') {
        targetUrl = `https://www.mercadolivre.com.br/p/${itemData.id}`;
      } else {
        targetUrl = `https://produto.mercadolivre.com.br/MLB-${itemData.id.replace(/^MLB/i, '')}`;
      }
    }

    let name = 'Produto Mercado Livre';
    let currentPrice = 0;
    let originalPrice = 0;
    let discountPercent = 0;
    let imageUrl = '';
    let priceSource = 'fallback';
    let titleSource = 'fallback';
    let imageSource = 'fallback';
    let price_unavailable = true;
    let pipelineSource = 'none';

    // ─── PASSO 1: EXTRATOR ESTÁTICO RÁPIDO (OG / JSON-LD / HTML REGEX) ───
    const staticStart = performance.now();
    let staticResult = null;
    try {
      // Executa o fetch estático com timeout rigoroso de 4s
      staticResult = await extractMLStaticMetadata(targetUrl, 4000);
      staticMs = Math.round(performance.now() - staticStart);

      if (staticResult) {
        if (staticResult.title) {
          name = staticResult.title;
          titleSource = staticResult.titleSource || 'static_html';
        }
        if (staticResult.imageUrl) {
          imageUrl = staticResult.imageUrl;
          imageSource = staticResult.imageSource || 'static_html';
        }
        if (staticResult.price && staticResult.price > 0) {
          currentPrice = staticResult.price;
          originalPrice = staticResult.originalPrice || staticResult.price;
          priceSource = staticResult.priceSource || 'static_html';
          price_unavailable = false;
          pipelineSource = 'static_html';
        }
      }
    } catch (err: any) {
      staticMs = Math.round(performance.now() - staticStart);
      console.warn('[ML-METADATA-PIPELINE] Static extraction threw error:', err.message);
    }

    console.log('[ML-METADATA-PIPELINE] source=static_html success=' + Boolean(staticResult?.title || staticResult?.imageUrl));

    // ─── CRITÉRIO DE EARLY STOP ───
    // Se conseguimos título rico, imagem E preço via extrator estático rápido, paramos imediatamente!
    const gotAllStatic = name && name !== 'Produto Mercado Livre' && imageUrl && !price_unavailable;
    
    if (gotAllStatic) {
      totalMs = Math.round(performance.now() - startTime);
      
      console.log('[ML-METADATA-QUALITY]', {
        hasTitle: true,
        hasImage: true,
        hasPrice: true,
        priceSource,
        titleSource,
        imageSource
      });
      console.log('[ML-METADATA-PERF]', {
        static_ms: staticMs,
        render_ms: 0,
        total_ms: totalMs
      });

      if (originalPrice > currentPrice && originalPrice > 0) {
        discountPercent = Math.round(((originalPrice - currentPrice) / originalPrice) * 100);
      }

      return {
        name,
        currentPrice,
        originalPrice,
        discountPercent,
        imageUrl,
        marketplace: 'Mercado Livre',
        currentPriceFactual: currentPrice,
        currentPriceSource: 'scraper',
        commissionValueFactual: 0,
        commissionSource: 'fallback',
        itemId: itemData.id,
        price_unavailable: false,
        fetchedAt: new Date().toISOString()
      } as any;
    }

    // ─── PASSO 2: RENDER SCRAPER (PLAYWRIGHT) ───
    // Só tenta o scraper pesado em Render/Playwright local se falhar em pegar preço ou campos fundamentais
    const scraperUrl = process.env.SCRAPER_SERVICE_URL;
    let renderSuccess = false;
    let renderTimeout = false;

    if (scraperUrl) {
      const renderStart = performance.now();
      const renderTimeoutMs = 6000; // Timeout reduzido e controlado de 6s max
      
      try {
        console.log('[ML-METADATA-PIPELINE] Trying Render scraper as fallback...');
        const res = await fetch(`${scraperUrl}/scrape`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': process.env.SCRAPER_API_KEY || ''
          },
          body: JSON.stringify({ url: targetUrl }),
          signal: AbortSignal.timeout(renderTimeoutMs)
        });

        renderMs = Math.round(performance.now() - renderStart);

        if (res.ok) {
          const data = await res.json();
          if (data.success) {
            renderSuccess = true;
            pipelineSource = 'render';

            if (data.title) {
              name = data.title;
              titleSource = 'render';
            }
            if (data.image) {
              imageUrl = data.image;
              imageSource = 'render';
            }
            if (data.price && data.price > 0) {
              currentPrice = data.price;
              originalPrice = data.originalPrice || data.price;
              priceSource = 'render';
              price_unavailable = false;
            }
          }
        }
      } catch (err: any) {
        renderMs = Math.round(performance.now() - renderStart);
        if (err.name === 'TimeoutError' || err.message?.includes('timeout') || err.name === 'AbortError') {
          renderTimeout = true;
        } else {
          console.warn('[ML-METADATA-PIPELINE] Render scraper threw error:', err.message);
        }
      }
    }

    console.log('[ML-METADATA-PIPELINE] source=render success=' + renderSuccess + ' timeout=' + renderTimeout);

    // ─── PASSO 3: API PÚBLICA (ÚLTIMO RECURSO SE AINDA FALTAR TUDO) ───
    const needsPublicApi = (!name || name === 'Produto Mercado Livre' || !imageUrl) && !renderSuccess;
    if (needsPublicApi) {
      const apiUrl = `https://api.mercadolibre.com/items/${itemData.id}`;
      try {
        const response = await fetch(apiUrl, { signal: AbortSignal.timeout(3000) });
        if (response.ok) {
          const data = await response.json();
          
          if (data.title && (!name || name === 'Produto Mercado Livre')) {
            name = data.title;
            titleSource = 'public_api';
          }
          if (data.pictures && data.pictures.length > 0 && !imageUrl) {
            imageUrl = data.pictures[0].secure_url || data.pictures[0].url;
            imageSource = 'public_api';
          }
          if (data.price && data.price > 0 && price_unavailable) {
            currentPrice = data.price;
            originalPrice = data.original_price || currentPrice;
            priceSource = 'public_api';
            price_unavailable = false;
            pipelineSource = 'public_api';
          }
        }
      } catch (err: any) {
        console.warn('[ML-METADATA-PIPELINE] Public API fallback failed:', err.message);
      }
    }

    // ─── PASSO 4: FALLBACK POR SLUG SE TÍTULO AINDA FOR GENÉRICO ───
    if (!name || name === 'Produto Mercado Livre') {
      try {
        const parsed = new URL(targetUrl);
        const pathParts = parsed.pathname.split('/');
        const textPart = pathParts.find(part => part.length > 5 && !part.startsWith('MLB') && !part.startsWith('pdp_filters') && part !== 'p' && part !== 'up');
        if (textPart) {
          name = textPart
            .split('-')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
          titleSource = 'url_slug_fallback';
        }
      } catch {
        // Ignorar falhas no parsing de URL
      }
    }

    totalMs = Math.round(performance.now() - startTime);

    console.log('[ML-METADATA-QUALITY] hasTitle=' + Boolean(name && name !== 'Produto Mercado Livre') + ' hasImage=' + Boolean(imageUrl) + ' hasPrice=' + !price_unavailable + ' priceSource=' + priceSource);
    console.log('[ML-METADATA-PERF] static_ms=' + staticMs + ' render_ms=' + renderMs + ' total_ms=' + totalMs);

    if (originalPrice > currentPrice && originalPrice > 0) {
      discountPercent = Math.round(((originalPrice - currentPrice) / originalPrice) * 100);
    }

    return {
      name,
      currentPrice,
      originalPrice,
      discountPercent,
      imageUrl,
      marketplace: 'Mercado Livre',
      currentPriceFactual: currentPrice,
      currentPriceSource: price_unavailable ? 'fallback' : (priceSource === 'public_api' ? 'api.price' : 'scraper'),
      commissionValueFactual: 0,
      commissionSource: 'fallback',
      itemId: itemData.id,
      price_unavailable,
      fetchedAt: new Date().toISOString()
    } as any;
  }
}
