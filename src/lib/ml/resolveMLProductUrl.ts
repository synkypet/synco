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

  // 3. Fazer POST para o Scraper
  try {
    const res = await fetch(`${scraperUrl}/scrape/resolve-social`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': scraperKey
      },
      body: JSON.stringify({ url: inputUrl }),
      // Timeout de 20 segundos pois o Playwright é lento
      signal: AbortSignal.timeout(20000)
    })

    if (!res.ok) {
      console.log(`[ML-RESOLVE] Scraper retornou status ${res.status}`)
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
    console.log('[ML-RESOLVE] Erro na requisição:', err.message)
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
}
