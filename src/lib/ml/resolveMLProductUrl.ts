export interface MLResolveResult {
  success: boolean
  sourceType: 'meli_short' | 'social_affiliate' | 'product_url' | 'unknown'
  productUrl: string | null
  itemId: string | null
  errorCode: string | null
  rawProductUrl?: string | null
  resolutionSource?: 'meli_redirect' | 'social_cta_href' | 'social_cta_click' | 'dom_fallback' | 'already_product' | 'unknown'
}

export async function resolveMLProductUrl(inputUrl: string): Promise<MLResolveResult> {
  const scraperUrl = process.env.SCRAPER_SERVICE_URL
  const scraperKey = process.env.SCRAPER_API_KEY

  if (!scraperUrl || !scraperKey) {
    return {
      success: false,
      sourceType: 'unknown',
      productUrl: null,
      itemId: null,
      errorCode: 'scraper_not_configured',
      rawProductUrl: null,
      resolutionSource: 'unknown'
    }
  }

  // 2. Se inputUrl já é URL de produto ML (não meli.la, não /social/)
  const lowerUrl = inputUrl.toLowerCase()
  if ((lowerUrl.includes('mercadolivre.com.br') || lowerUrl.includes('mercadolibre.com')) &&
      !lowerUrl.includes('/social/') && !lowerUrl.includes('meli.la')) {
    return {
      success: true,
      sourceType: 'product_url',
      productUrl: inputUrl,
      itemId: null,
      errorCode: null,
      rawProductUrl: inputUrl,
      resolutionSource: 'already_product'
    }
  }

  // 3. Fast-path HTTP redirect para links meli.la simples (evita Playwright timeout em fila)
  if (lowerUrl.includes('meli.la')) {
    try {
      const fastPathStart = Date.now();
      console.log(`[ML-RESOLVE-FASTPATH] start inputKind=meli_short`);
      
      const getRes = await fetch(inputUrl, { 
        method: 'GET', 
        redirect: 'follow', 
        signal: AbortSignal.timeout(4000) 
      });
      
      const finalUrl = getRes.url;
      const lowerFinal = finalUrl.toLowerCase();
      
      // Se não caiu em /social/ e chegou num domínio ML, assumimos sucesso no fast-path
      if ((lowerFinal.includes('mercadolivre.com.br') || lowerFinal.includes('mercadolibre.com')) && 
          !lowerFinal.includes('/social/')) {
        console.log(`[ML-RESOLVE-FASTPATH] success=true finalKind=product durationMs=${Date.now() - fastPathStart}`);
        return {
          success: true,
          sourceType: 'meli_short',
          productUrl: finalUrl,
          itemId: null,
          errorCode: null,
          rawProductUrl: finalUrl,
          resolutionSource: 'meli_redirect'
        }
      } else {
        console.log(`[ML-RESOLVE-FASTPATH] success=false fallback=render reason=non_product_url`);
      }
    } catch (e: any) {
      console.log(`[ML-RESOLVE-FASTPATH] success=false fallback=render reason=error_or_timeout msg="${e.message}"`);
    }
  }

  // 4. Fazer POST para o Scraper
  const resolveStart = Date.now();
  console.log(`[ML-RESOLVE] start timeoutMs=35000 inputKind=${lowerUrl.includes('meli.la') ? 'meli_short' : 'social'}`);
  try {
    const res = await fetch(`${scraperUrl}/scrape/resolve-social`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': scraperKey
      },
      body: JSON.stringify({ url: inputUrl }),
      // Timeout aumentado para 35 segundos para suportar filas no Render
      signal: AbortSignal.timeout(35000)
    })

    if (!res.ok) {
      console.log(`[ML-RESOLVE] failed durationMs=${Date.now() - resolveStart} status=${res.status}`)
      return {
        success: false,
        sourceType: 'unknown',
        productUrl: null,
        itemId: null,
        errorCode: 'scraper_error',
        rawProductUrl: null,
        resolutionSource: 'unknown'
      }
    }

    const data = await res.json()
    console.log('[ML-RESOLVE] sourceType:', data.sourceType, '— success:', data.success)
    
    // Mapear resolutionSource
    let resolutionSource: 'meli_redirect' | 'social_cta_href' | 'social_cta_click' | 'dom_fallback' | 'already_product' | 'unknown' = 'unknown'
    if (data.sourceType === 'product_url') {
      resolutionSource = 'already_product'
    } else if (data.sourceType === 'meli_short') {
      resolutionSource = 'meli_redirect'
    } else if (data.sourceType === 'social_affiliate') {
      // Como o scraper usa várias heurísticas, podemos deduzir por aproximação ou colocar um default razoável.
      // Se não conseguimos saber ao certo, usamos social_cta_click como padrão para social_affiliate resolvida com sucesso.
      resolutionSource = 'social_cta_click'
    }

    console.log(`[ML-RESOLVE] done durationMs=${Date.now() - resolveStart} success=${data.success}`);

    return {
      success: data.success,
      sourceType: data.sourceType || 'unknown',
      productUrl: data.productUrl || null,
      itemId: data.itemId || null,
      errorCode: data.errorCode || null,
      rawProductUrl: data.rawProductUrl || data.productUrl || null,
      resolutionSource
    }

  } catch (err: any) {
    const isTimeout = err.name === 'TimeoutError' || err.name === 'AbortError';
    if (isTimeout) {
      console.log(`[ML-RESOLVE] timeout durationMs=${Date.now() - resolveStart}`);
    } else {
      console.log(`[ML-RESOLVE] failed durationMs=${Date.now() - resolveStart} msg="${err.message}"`);
    }

    return {
      success: false,
      sourceType: 'unknown',
      productUrl: null,
      itemId: null,
      errorCode: isTimeout ? 'timeout' : 'scraper_error',
      rawProductUrl: null,
      resolutionSource: 'unknown'
    }
  }
}
