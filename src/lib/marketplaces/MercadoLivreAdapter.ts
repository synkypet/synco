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
    const itemId = extractItemId(url);
    if (itemId) {
      return buildCanonicalUrl(itemId);
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
    const itemId = extractItemId(resolvedUrl);
    if (!itemId) {
      return {
        incoming_url: url,
        resolved_url: resolvedUrl,
        redirect_chain: redirectChain,
        reaffiliation_status: 'blocked',
        reaffiliation_error: 'item_id_not_found'
      };
    }

    // 4. Build canonical
    const canonicalUrl = buildCanonicalUrl(itemId);

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
    const itemId = extractItemId(url);
    const fallbackTitle = 'Produto Mercado Livre';

    if (!itemId) {
      return this.createFallback(fallbackTitle, 'item_id_not_found');
    }

    const client = new MLClient();
    const metadata = await client.fetchItemMetadata(itemId);

    if (!metadata) {
      return this.createFallback(fallbackTitle, 'api_fetch_failed');
    }

    const hasValidImage = !!metadata.imageUrl && metadata.imageUrl.length > 5;
    const hasValidTitle = !!metadata.name && metadata.name.length > 3 && metadata.name !== fallbackTitle;

    if (!hasValidImage || !hasValidTitle) {
      return this.createFallback(metadata.name || fallbackTitle, 'insufficient_metadata_quality');
    }

    return {
      ...metadata,
      marketplace: this.name,
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
      marketplace: this.name,
      metadata_failed: true,
      metadata_error: errorMsg
    };
  }

  private async resolveShortLink(url: string, maxRedirects = 10): Promise<{ resolvedUrl: string, chain: string[] }> {
    let currentUrl = url;
    const chain = [url];
    let redirects = 0;
    
    while (redirects < maxRedirects) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

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
            if (chain.includes(nextUrl)) break;
            currentUrl = nextUrl;
            chain.push(currentUrl);
            redirects++;
            continue;
          }
        }
        return { resolvedUrl: currentUrl, chain };
      } catch (error) {
        clearTimeout(timeout);
        throw error;
      }
    }
    return { resolvedUrl: currentUrl, chain };
  }
}
