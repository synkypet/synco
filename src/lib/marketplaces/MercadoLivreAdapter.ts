import { MarketplaceAdapter, ProductMetadata, AffiliateResult } from './BaseAdapter';
import { UserMarketplaceConnection } from '@/types/marketplace';
import { MLClient } from './mercadolivre/client';
import { canHandleUrl, extractItemId, buildCanonicalUrl, buildAffiliateUrl } from './mercadolivre/url-utils';

export class MercadoLivreAdapter extends MarketplaceAdapter {
  readonly name = 'mercadolivre';

  canHandle(url: string): boolean {
    return canHandleUrl(url);
  }

  async cleanUrl(url: string): Promise<string> {
    const itemData = extractItemId(url);
    if (itemData) {
      return buildCanonicalUrl(itemData);
    }
    try {
      const parsed = new URL(url);
      parsed.search = ''; // Remove params for fallback
      return parsed.toString();
    } catch {
      return url;
    }
  }

  async preProcessIncomingLink(url: string, connection?: UserMarketplaceConnection): Promise<Partial<AffiliateResult>> {
    const isShortLink = url.includes('meli.com') || url.includes('mercadol.in');
    let resolvedUrl = url;
    let redirectChain: string[] = [url];

    // 1. Resolve short links
    if (isShortLink) {
      try {
        const resolution = await this.resolveShortLink(url);
        resolvedUrl = resolution.resolvedUrl;
        redirectChain = resolution.chain;
      } catch (error: any) {
        return {
          incoming_url: url,
          reaffiliation_status: 'failed',
          reaffiliation_error: `Falha ao resolver short link ML: ${error.message}`,
          redirect_chain: redirectChain
        };
      }
    }

    // 2. Extract itemId
    const itemData = extractItemId(resolvedUrl);
    if (!itemData) {
      return {
        incoming_url: url,
        resolved_url: resolvedUrl,
        redirect_chain: redirectChain,
        reaffiliation_status: 'blocked',
        reaffiliation_error: 'item_id_not_found'
      };
    }

    // 4. Build canonical
    const canonicalUrl = buildCanonicalUrl(itemData);

    // 5. Build affiliate
    let affiliateUrl = canonicalUrl;
    let status: any = 'not_needed';

    if (connection && (connection.ml_matt_tool || connection.ml_affiliate_tag)) {
      affiliateUrl = buildAffiliateUrl(canonicalUrl, connection);
      if (affiliateUrl === canonicalUrl) {
        status = 'failed';
        return {
          incoming_url: url,
          resolved_url: resolvedUrl,
          canonical_url: canonicalUrl,
          redirect_chain: redirectChain,
          reaffiliation_status: 'failed',
          reaffiliation_error: 'no_affiliate_params'
        };
      } else {
        status = 'reaffiliated';
      }
    } else if (connection) {
       // Possui connection, mas sem credenciais válidas do ML
       status = 'failed';
       return {
          incoming_url: url,
          resolved_url: resolvedUrl,
          canonical_url: canonicalUrl,
          redirect_chain: redirectChain,
          reaffiliation_status: 'failed',
          reaffiliation_error: 'no_affiliate_params'
        };
    } else {
       status = 'canonicalized';
    }

    return {
      incoming_url: url,
      resolved_url: resolvedUrl,
      canonical_url: canonicalUrl,
      generated_affiliate_url: affiliateUrl,
      redirect_chain: redirectChain,
      reaffiliation_status: status
    };
  }

  async fetchMetadata(url: string, connection?: UserMarketplaceConnection, sourceText?: string): Promise<ProductMetadata | null> {
    const itemData = extractItemId(url);
    const fallbackTitle = 'Produto Mercado Livre';

    if (!itemData) {
      return this.createFallback(fallbackTitle, 'item_id_not_found');
    }

    const canonicalUrl = buildCanonicalUrl(itemData);
    const client = new MLClient();
    const metadata = await client.fetchItemMetadata(itemData, canonicalUrl);

    if (!metadata) {
      return this.createFallback(fallbackTitle, 'api_fetch_failed');
    }

    const isCatalog = itemData.type === 'catalog';
    const hasValidImage = isCatalog ? true : (!!metadata.imageUrl && metadata.imageUrl.length > 5);
    const hasValidTitle = !!metadata.name && metadata.name.length > 3 && metadata.name !== fallbackTitle;

    if (!hasValidImage || !hasValidTitle) {
      return this.createFallback(metadata.name || fallbackTitle, 'insufficient_metadata_quality');
    }

    return {
      ...metadata,
      marketplace: 'Mercado Livre',
      fetchedAt: new Date().toISOString()
    } as ProductMetadata;
  }

  async generateAffiliateLink(cleanUrl: string, connection?: UserMarketplaceConnection, metadata?: ProductMetadata | null): Promise<string> {
    if (!connection) return cleanUrl;
    return buildAffiliateUrl(cleanUrl, connection);
  }

  private createFallback(name: string, errorMsg: string): ProductMetadata {
    return {
      name,
      originalPrice: 0,
      currentPrice: 0,
      currentPriceFactual: 0,
      currentPriceSource: 'fallback',
      commissionValueFactual: 0,
      commissionSource: 'fallback',
      discountPercent: 0,
      imageUrl: '',
      marketplace: 'Mercado Livre',
      metadata_failed: true,
      metadata_error: errorMsg
    };
  }

  private async resolveShortLink(url: string, maxRedirects = 10): Promise<{ resolvedUrl: string, chain: string[] }> {
    let currentUrl = url;
    const chain = [url];
    let redirects = 0;
    
    const maxRetries = 2;
    const timeoutMs = 8000;
    
    while (redirects < maxRedirects) {
      let attemptSuccess = false;
      let lastError: any;
      
      for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), timeoutMs);

        try {
          const res = await fetch(currentUrl, {
            method: 'GET',
            redirect: 'manual',
            signal: controller.signal
          });
          clearTimeout(timeout);

          if (res.status >= 300 && res.status < 400) {
            const location = res.headers.get('location');
            if (location) {
              const nextUrl = new URL(location, currentUrl).toString();
              if (chain.includes(nextUrl)) {
                return { resolvedUrl: currentUrl, chain };
              }
              currentUrl = nextUrl;
              chain.push(currentUrl);
              redirects++;
              attemptSuccess = true;
              break; // go to outer while loop for the next redirect
            }
          }
          
          // Se não houver redirect ou cair aqui, é o fim da chain
          return { resolvedUrl: currentUrl, chain };
          
        } catch (error) {
          clearTimeout(timeout);
          lastError = error;
          if (attempt <= maxRetries) {
            await new Promise(resolve => setTimeout(resolve, 600));
          }
        }
      }
      
      if (!attemptSuccess) {
        throw lastError;
      }
    }
    
    return { resolvedUrl: currentUrl, chain };
  }
}
