import { ProductMetadata } from '../BaseAdapter';
import { extractMLStaticMetadata } from './html-metadata-extractor';
import {
  MLItemIdData,
  MLMetadataCandidate,
  buildMercadoLivreMetadataCandidates,
} from './url-utils';

// ─── Internal types ───────────────────────────────────────────────────────────

interface PartialResult {
  name: string;
  currentPrice: number;
  originalPrice: number;
  imageUrl: string;
  priceSource: string;
  titleSource: string;
  imageSource: string;
  price_unavailable: boolean;
  pipelineSource: string;
  offerItemId?: string | null;
  catalogProductId?: string | null;
}

function emptyPartial(): PartialResult {
  return {
    name: 'Produto Mercado Livre',
    currentPrice: 0,
    originalPrice: 0,
    imageUrl: '',
    priceSource: 'fallback',
    titleSource: 'fallback',
    imageSource: 'fallback',
    price_unavailable: true,
    pipelineSource: 'none',
    offerItemId: null,
    catalogProductId: null,
  };
}

function isInvalidTitle(title: string): boolean {
  if (!title) return true;
  const t = title.toLowerCase().trim();
  return t === 'produto mercado livre' || 
         t === 'mercado libre' || 
         t === 'mercado livre' || 
         t === 'mercado livre brasil' || 
         t === 'mercadolibre';
}

function isComplete(r: PartialResult): boolean {
  return (
    !isInvalidTitle(r.name) &&
    !!r.imageUrl &&
    !r.price_unavailable
  );
}

function hasTitle(r: PartialResult): boolean {
  return !isInvalidTitle(r.name);
}

// ─── MLClient ────────────────────────────────────────────────────────────────

export class MLClient {
  /**
   * Busca metadados do Mercado Livre usando múltiplos candidatos de URL.
   *
   * Para links do tipo catalog_with_offer (ex: /p/MLB67376199?pdp_filters=item_id:MLB6737772730)
   * o pipeline tenta primeiro a URL direta da oferta (produto.mercadolivre.com.br/MLB-xxx),
   * que é renderizável via SSR e contém preço/imagem reais da variação específica.
   *
   * Ordem geral:
   *   1. static_html por candidato (early stop se completo)
   *   2. Render scraper no melhor candidato ainda não completo
   *   3. API pública (itemData.id) se ainda faltar título ou imagem
   *   4. Slug fallback para título
   */
  async fetchItemMetadata(
    itemData: MLItemIdData,
    richUrl?: string
  ): Promise<Partial<ProductMetadata> | null> {
    const candidates = buildMercadoLivreMetadataCandidates(richUrl || '', itemData);

    console.info('[ML-METADATA-CANDIDATES]', {
      count: candidates.length,
      urlKind: itemData.urlKind,
      hasOfferItem: Boolean(itemData.offerItemId),
      offerItemId: itemData.offerItemId || null,
      catalogProductId: itemData.catalogProductId || null,
    });

    // ─── FASE 1: static_html por candidato ───────────────────────────────────
    let best = emptyPartial();
    let bestCandidateKind: string = 'none';
    let bestCandidateIndex = -1;

    const staticTimeoutMs = 4000;

    for (let i = 0; i < candidates.length; i++) {
      const candidate = candidates[i];
      const partial = await this.tryStaticHtml(candidate, i + 1, staticTimeoutMs);

      // Merge: preencher campos que best ainda não tem
      this.mergeBetter(best, partial);

      const complete = isComplete(best);

      console.info('[ML-METADATA-CANDIDATE]', {
        index: i + 1,
        kind: candidate.kind,
        source: 'static_html',
        hasTitle: hasTitle(partial),
        hasImage: Boolean(partial.imageUrl),
        hasPrice: !partial.price_unavailable,
        complete,
      });

      if (complete) {
        bestCandidateKind = candidate.kind;
        bestCandidateIndex = i;
        console.info('[ML-METADATA-FINAL]', {
          quality: 'complete',
          titleSource: best.titleSource,
          imageSource: best.imageSource,
          priceSource: best.priceSource,
          candidateKind: bestCandidateKind,
        });
        return this.buildResult(best, itemData, {
          quality: 'complete',
          titleSource: best.titleSource,
          imageSource: best.imageSource,
          priceSource: best.priceSource,
          candidateKind: bestCandidateKind,
        });
      }

      // Manter rastreio do melhor candidato estático até agora
      if (bestCandidateIndex === -1 || hasTitle(partial)) {
        bestCandidateKind = candidate.kind;
        bestCandidateIndex = i;
      }
    }

    // ─── FASE 2: Render scraper — tenta candidatos por prioridade ────────────
    const scraperUrl = process.env.SCRAPER_SERVICE_URL;
    if (scraperUrl && (!hasTitle(best) || !best.imageUrl || best.price_unavailable)) {
      // Remover candidatos duplicados no contexto de scraper pesado (normalizando hash e params)
      const renderSeenUrls = new Set<string>();
      const renderCandidates = [];
      for (const c of candidates) {
        try {
          const parsed = new URL(c.url);
          parsed.hash = '';
          const keys = Array.from(parsed.searchParams.keys());
          for (const key of keys) {
            if (key.startsWith('matt_') || key === 'tracking_id') {
              parsed.searchParams.delete(key);
            }
          }
          if (Array.from(parsed.searchParams.keys()).length === 0) parsed.search = '';
          let norm = parsed.toString().toLowerCase();
          if (norm.endsWith('?')) norm = norm.slice(0, -1);
          if (norm.endsWith('/')) norm = norm.slice(0, -1);
          
          if (!renderSeenUrls.has(norm)) {
            renderSeenUrls.add(norm);
            renderCandidates.push(c);
          }
        } catch {
          if (!renderSeenUrls.has(c.url)) {
            renderSeenUrls.add(c.url);
            renderCandidates.push(c);
          }
        }
      }

      if (renderCandidates.length < candidates.length) {
        console.info('[ML-METADATA-CANDIDATES]', { 
          deduped: true, 
          before: candidates.length, 
          after: renderCandidates.length, 
          reason: 'normalized_same_product'
        });
      }

      // Escolher apenas O MELHOR candidato para não floodar o Render
      let bestRenderCandidate = renderCandidates.find(c => c.kind === 'direct_item' || c.kind === 'direct_offer') ||
                                renderCandidates.find(c => c.kind === 'original_rich_clean') ||
                                renderCandidates[0]; // fallback (ex: catalog_clean)
                                
      if (bestRenderCandidate) {
        console.info('[ML-METADATA-SELECTED-FOR-RENDER]', {
          selected_for_render: bestRenderCandidate.kind,
          url: bestRenderCandidate.url
        });
        
        // Sobrescreve o array para o for loop abaixo iterar apenas 1 vez
        renderCandidates.length = 0;
        renderCandidates.push(bestRenderCandidate);
      }

      // Tentar Render nos candidatos em ordem, parando no primeiro completo
      for (let i = 0; i < renderCandidates.length; i++) {
        const candidate = renderCandidates[i];

        console.info('[ML-METADATA-RENDER-TARGET]', {
          candidateKind: candidate.kind,
          candidateIndex: i + 1,
        });

        const renderPartial = await this.tryRender(candidate, i + 1, scraperUrl, 25000);
        this.mergeBetter(best, renderPartial);

        if (!hasTitle(renderPartial) && !renderPartial.imageUrl && renderPartial.price_unavailable) {
          console.info('[ML-METADATA-RENDER-EMPTY]', {
            candidateKind: candidate.kind,
            urlKind: itemData.urlKind,
            reason: 'no_selectors_matched'
          });
        }

        console.info('[ML-METADATA-CANDIDATE]', {
          index: i + 1,
          kind: candidate.kind,
          source: 'render',
          hasTitle: hasTitle(renderPartial),
          hasImage: Boolean(renderPartial.imageUrl),
          hasPrice: !renderPartial.price_unavailable,
          complete: isComplete(best),
        });

        if (isComplete(best)) {
          bestCandidateKind = candidate.kind;
          console.info('[ML-METADATA-FINAL]', {
            quality: 'complete',
            titleSource: best.titleSource,
            imageSource: best.imageSource,
            priceSource: best.priceSource,
            candidateKind: bestCandidateKind,
          });
          return this.buildResult(best, itemData, {
            quality: 'complete',
            titleSource: best.titleSource,
            imageSource: best.imageSource,
            priceSource: best.priceSource,
            candidateKind: bestCandidateKind,
          });
        }
      }
    }

    // ─── FASE 3: API pública — fallback final opcional ─────────
    if (!hasTitle(best) || !best.imageUrl || best.price_unavailable) {
      const enablePublicApiFallback =
        process.env.ML_ENABLE_PUBLIC_API_FALLBACK === 'true' ||
        process.env.ML_ENABLE_PUBLIC_API_FALLBACK === '1';

      if (enablePublicApiFallback) {
        await this.tryPublicApi(best, itemData);
      } else {
        console.info('[ML-PUBLIC-API] skipped reason=disabled_by_env');
      }
    }

    // ─── FASE 4: Slug fallback para título ───────────────────────────────────
    if (!hasTitle(best) && candidates.length > 0) {
      this.applySlugFallback(best, candidates[0].url);
    }

    const quality = isComplete(best) ? 'complete' : (hasTitle(best) ? 'partial' : 'minimal');
    console.info('[ML-METADATA-FINAL]', {
      quality,
      titleSource: best.titleSource,
      imageSource: best.imageSource,
      priceSource: best.priceSource,
      candidateKind: bestCandidateKind || 'none',
    });

    return this.buildResult(best, itemData, {
      quality,
      titleSource: best.titleSource,
      imageSource: best.imageSource,
      priceSource: best.priceSource,
      candidateKind: bestCandidateKind || 'none',
    });
  }

  // ─── Helpers privados ─────────────────────────────────────────────────────

  private async tryStaticHtml(
    candidate: MLMetadataCandidate,
    index: number,
    timeoutMs: number
  ): Promise<PartialResult> {
    const r = emptyPartial();
    try {
      const staticResult = await extractMLStaticMetadata(candidate.url, timeoutMs, candidate.kind);
      if (staticResult) {
        if (staticResult.title) {
          r.name = staticResult.title;
          r.titleSource = staticResult.titleSource || 'static_html';
        }
        if (staticResult.imageUrl) {
          r.imageUrl = staticResult.imageUrl;
          r.imageSource = staticResult.imageSource || 'static_html';
        }
        if (staticResult.price && staticResult.price > 0) {
          r.currentPrice = staticResult.price;
          r.originalPrice = staticResult.originalPrice || staticResult.price;
          r.priceSource = staticResult.priceSource || 'static_html';
          r.price_unavailable = false;
          r.pipelineSource = 'static_html';
        }
        if (staticResult.offerItemId) {
          r.offerItemId = staticResult.offerItemId;
        }
        if (staticResult.catalogProductId) {
          r.catalogProductId = staticResult.catalogProductId;
        }
      }
    } catch (err: any) {
      console.warn(`[ML-METADATA-PIPELINE] static_html error on candidate ${index}:`, err.message);
    }
    return r;
  }

  private async tryRender(
    candidate: MLMetadataCandidate,
    index: number,
    scraperUrl: string,
    timeoutMs: number
  ): Promise<PartialResult> {
    const r = emptyPartial();
    try {
      const res = await fetch(`${scraperUrl}/scrape`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.SCRAPER_API_KEY || '',
        },
        body: JSON.stringify({ url: candidate.url }),
        signal: AbortSignal.timeout(timeoutMs),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          r.pipelineSource = 'render';
          if (data.title) { r.name = data.title; r.titleSource = 'render'; }
          if (data.image) { r.imageUrl = data.image; r.imageSource = 'render'; }
          if (data.price && data.price > 0) {
            r.currentPrice = data.price;
            r.originalPrice = data.originalPrice || data.price;
            r.priceSource = 'render';
            r.price_unavailable = false;
          }
        }
      }
    } catch (err: any) {
      const isTimeout = err.name === 'TimeoutError' || err.name === 'AbortError' || err.message?.includes('timeout');
      if (!isTimeout) {
        console.warn(`[ML-METADATA-PIPELINE] render error on candidate ${index}:`, err.message);
      }
    }
    return r;
  }

  private async tryPublicApi(best: PartialResult, itemData: MLItemIdData): Promise<void> {
    const isCatalog = itemData.type === 'catalog' || itemData.urlKind === 'catalog';
    const idToUse = isCatalog ? (itemData.catalogProductId || itemData.id) : (itemData.offerItemId || itemData.id);
    const endpointStr = isCatalog ? 'products' : 'items';
    const apiUrl = `https://api.mercadolibre.com/${endpointStr}/${idToUse}`;

    console.info(`[ML-PUBLIC-API] start endpoint=${endpointStr} id=${idToUse} urlKind=${itemData.urlKind}`);

    try {
      const response = await fetch(apiUrl, { signal: AbortSignal.timeout(7000) });
      if (response.ok) {
        const data = await response.json();
        const hasName = !!(data.name || data.title);
        const hasImage = !!(data.pictures?.length > 0);
        
        let priceValue = 0;
        let originalPriceValue = 0;

        if (data.price) {
          priceValue = data.price;
          originalPriceValue = data.original_price || data.price;
        } else if (data.buy_box_winner && data.buy_box_winner.price) {
          priceValue = data.buy_box_winner.price;
          originalPriceValue = data.buy_box_winner.original_price || data.buy_box_winner.price;
        }

        const hasPrice = priceValue > 0;
        console.info(`[ML-PUBLIC-API] response endpoint=${endpointStr} status=${response.status} hasName=${hasName} hasImage=${hasImage} hasPrice=${hasPrice}`);
        
        if (data.name && !hasTitle(best)) {
          best.name = data.name;
          best.titleSource = isCatalog ? 'catalog_api' : 'public_api';
        } else if (data.title && !hasTitle(best)) {
          best.name = data.title;
          best.titleSource = isCatalog ? 'catalog_api' : 'public_api';
        }

        if (data.pictures?.length > 0 && !best.imageUrl) {
          best.imageUrl = data.pictures[0].secure_url || data.pictures[0].url;
          best.imageSource = isCatalog ? 'catalog_api' : 'public_api';
        }

        if (priceValue > 0 && best.price_unavailable) {
          best.currentPrice = priceValue;
          best.originalPrice = originalPriceValue;
          best.priceSource = isCatalog ? 'catalog_api' : 'public_api';
          best.price_unavailable = false;
          best.pipelineSource = isCatalog ? 'catalog_api' : 'public_api';
        }
      } else {
        console.warn(`[ML-PUBLIC-API] failed endpoint=${endpointStr} status=${response.status} reason=${response.statusText}`);
      }
    } catch (err: any) {
      console.warn(`[ML-PUBLIC-API] failed endpoint=${endpointStr} status=error reason=${err.message}`);
    }
  }

  private applySlugFallback(best: PartialResult, url: string): void {
    try {
      const parsed = new URL(url);
      const pathParts = parsed.pathname.split('/');
      const textPart = pathParts.find(
        part =>
          part.length > 5 &&
          !/^(MLB|MLA|MLU|MLC|MLM|MLBU)/i.test(part) &&
          part !== 'p' &&
          part !== 'up'
      );
      if (textPart) {
        best.name = textPart
          .split('-')
          .map(w => w.charAt(0).toUpperCase() + w.slice(1))
          .join(' ');
        best.titleSource = 'url_slug_fallback';
      }
    } catch {
      // Ignorar falhas no parsing
    }
  }

  // Preenche best com campos de partial somente quando best ainda não os tem
  private mergeBetter(best: PartialResult, partial: PartialResult): void {
    if (!hasTitle(best) && hasTitle(partial)) {
      best.name = partial.name;
      best.titleSource = partial.titleSource;
    }
    if (!best.imageUrl && partial.imageUrl) {
      best.imageUrl = partial.imageUrl;
      best.imageSource = partial.imageSource;
    }
    if (best.price_unavailable && !partial.price_unavailable) {
      best.currentPrice = partial.currentPrice;
      best.originalPrice = partial.originalPrice;
      best.priceSource = partial.priceSource;
      best.price_unavailable = false;
      best.pipelineSource = partial.pipelineSource;
    }
    if (!best.offerItemId && partial.offerItemId) {
      best.offerItemId = partial.offerItemId;
    }
    if (!best.catalogProductId && partial.catalogProductId) {
      best.catalogProductId = partial.catalogProductId;
    }
  }

  private buildResult(
    r: PartialResult,
    itemData: MLItemIdData,
    extra?: {
      quality?: string;
      titleSource?: string;
      imageSource?: string;
      priceSource?: string;
      candidateKind?: string;
    }
  ): Partial<ProductMetadata> {
    let discountPercent = 0;
    if (r.originalPrice > r.currentPrice && r.originalPrice > 0) {
      discountPercent = Math.round(((r.originalPrice - r.currentPrice) / r.originalPrice) * 100);
    }

    return {
      name: r.name,
      currentPrice: r.currentPrice,
      originalPrice: r.originalPrice,
      discountPercent,
      imageUrl: r.imageUrl,
      marketplace: 'Mercado Livre',
      currentPriceFactual: r.currentPrice,
      currentPriceSource: r.price_unavailable
        ? 'fallback'
        : r.priceSource === 'public_api'
          ? 'api.price'
          : 'scraper',
      commissionValueFactual: 0,
      commissionSource: 'fallback',
      itemId: itemData.id,
      price_unavailable: r.price_unavailable,
      fetchedAt: new Date().toISOString(),
      quality: extra?.quality,
      titleSource: extra?.titleSource || r.titleSource,
      imageSource: extra?.imageSource || r.imageSource,
      priceSource: extra?.priceSource || r.priceSource,
      candidateKind: extra?.candidateKind,
      metadataOfferItemId: r.offerItemId,
      metadataCatalogProductId: r.catalogProductId,
    } as any;
  }
}
