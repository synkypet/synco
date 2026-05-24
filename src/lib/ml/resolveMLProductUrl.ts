export interface MLResolveResult {
  success: boolean
  sourceType: 'meli_short' | 'social_affiliate' | 'product_url' | 'unknown'
  productUrl: string | null
  itemId: string | null
  errorCode: string | null
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
      errorCode: 'scraper_not_configured'
    }
  }

  // 2. Se inputUrl já é URL de produto ML (não meli.la, não /social/)
  if ((inputUrl.includes('mercadolivre.com.br') || inputUrl.includes('mercadolibre.com')) &&
      !inputUrl.includes('/social/')) {
    return {
      success: true,
      sourceType: 'product_url',
      productUrl: inputUrl,
      itemId: null,
      errorCode: null
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
        errorCode: 'scraper_error'
      }
    }

    const data = await res.json()
    console.log('[ML-RESOLVE] sourceType:', data.sourceType, '— success:', data.success)
    
    return {
      success: data.success,
      sourceType: data.sourceType || 'unknown',
      productUrl: data.productUrl || null,
      itemId: data.itemId || null,
      errorCode: data.errorCode || null
    }

  } catch (err: any) {
    console.log('[ML-RESOLVE] Erro na requisição:', err.message)
    return {
      success: false,
      sourceType: 'unknown',
      productUrl: null,
      itemId: null,
      errorCode: 'scraper_error'
    }
  }
}
