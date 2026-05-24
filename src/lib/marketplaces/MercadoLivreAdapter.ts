import { MarketplaceAdapter, ProductMetadata, AffiliateResult } from './BaseAdapter';
import { UserMarketplaceConnection } from '@/types/marketplace';
import { MLClient } from './mercadolivre/client';
import { canHandleUrl, extractItemId, buildCanonicalUrl, buildAffiliateUrl } from './mercadolivre/url-utils';
import { selectShortLinkInputUrl } from '../ml/shortLinkUrl';
import { getDecryptedMLSession } from '@/lib/ml/vault';
import { generateMeliShortLink } from '@/lib/ml/createLink';
import { createAdminClient } from '@/lib/ml/extension-auth';

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

    // 5. Build affiliate fallback (Long link)
    const affiliateUrlOrNull = buildAffiliateUrl(canonicalUrl, connection);

    // Tentativa de geração de meli.la (apenas se sessão válida existir)
    let shortUrl: string | null = null;
    let shortGenerationStatus: 'success' | 'fallback' | 'no_session' | 'skipped' = 'skipped';
    
    let hasValidMLVaultSession = false;

    if (connection?.user_id) {
      try {
        const adminClient = createAdminClient();
        const sessionSnapshot = await getDecryptedMLSession(connection.user_id, adminClient);

        if (sessionSnapshot) {
          hasValidMLVaultSession = true;
          
          let tagSource = 'missing';
          let tag = connection?.ml_partner_id || null;
          if (tag) {
            tagSource = 'connection_partner_id';
          } else if (sessionSnapshot.orgnickp) {
            tag = sessionSnapshot.orgnickp.toLowerCase();
            tagSource = 'vault_orgnickp';
          }
          const shortLinkInputUrl = selectShortLinkInputUrl({
            resolved_url: resolvedUrl,
            incoming_url: url,
            canonical_url: canonicalUrl
          });

          if (shortLinkInputUrl) {
            if (!tag) {
              shortGenerationStatus = 'fallback';
              console.warn('[ML-ADAPTER] missing_affiliate_tag — impossível gerar meli.la sem tag explícita ou orgnickp');
            } else {
              console.info('[ML-CREATE-LINK-DIAG]', {
                urlKind: shortLinkInputUrl.includes('/up/') ? 'full_permalink' : (shortLinkInputUrl.includes('/p/') ? 'canonical_p' : 'other'),
                hasTag: Boolean(tag),
                tagLength: tag?.length ?? 0,
                tagSource,
                hasVaultSession: Boolean(sessionSnapshot),
              });

              const result = await generateMeliShortLink({
                canonicalUrl: shortLinkInputUrl,
                tag,
                sessionSnapshot
              });

            if (result.success && result.short_url) {
              shortUrl = result.short_url;
              shortGenerationStatus = 'success';
            } else {
              shortGenerationStatus = 'fallback';
              if (result.error_code === 'ml_unauthorized') {
                await adminClient
                  .from('ml_sessions')
                  .update({ is_valid: false })
                  .eq('user_id', connection.user_id);
                console.warn('[ML-ADAPTER] userId:', connection.user_id.substring(0, 8), '— sessão ML invalidada por 401/403');
                hasValidMLVaultSession = false;
              }
            }
            }
          } else {
            shortGenerationStatus = 'fallback';
          }
        } else {
          shortGenerationStatus = 'no_session';
        }
      } catch (_) {
        shortGenerationStatus = 'fallback';
      }
    } else {
      shortGenerationStatus = 'skipped';
    }

    // 6. Validar Elegibilidade Final
    const hasValidLongAffiliateCredentials = !!affiliateUrlOrNull && affiliateUrlOrNull !== canonicalUrl;

    if (shortUrl) {
      console.log('[ML-ADAPTER] status: ml_short_link_success');
    } else if (hasValidLongAffiliateCredentials) {
      console.log('[ML-ADAPTER] status: ml_short_link_fallback');
    }

    if (!shortUrl && !hasValidLongAffiliateCredentials) {
      console.warn(`[ML-ADAPTER] status: ml_no_valid_affiliate_link. userId: ${(connection?.user_id || 'unknown').substring(0, 8)}`);
      return {
        incoming_url: url,
        resolved_url: resolvedUrl,
        canonical_url: canonicalUrl,
        generated_affiliate_url: undefined,
        redirect_chain: redirectChain,
        reaffiliation_status: 'blocked',
        reaffiliation_error: 'Não foi possível gerar o link afiliado Mercado Livre. Sincronize novamente a extensão ou configure credenciais de fallback.'
      };
    }

    return {
      incoming_url: url,
      resolved_url: resolvedUrl,
      canonical_url: canonicalUrl,
      generated_affiliate_url: shortUrl || affiliateUrlOrNull || undefined,
      redirect_chain: redirectChain,
      reaffiliation_status: 'reaffiliated',
      short_url: shortUrl || undefined,
      shortGenerationStatus
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
    const hasValidTitle = isCatalog
      ? (!!metadata.name && metadata.name.length > 3)
      : (!!metadata.name && metadata.name.length > 3 && metadata.name !== fallbackTitle);

    if (!hasValidImage || !hasValidTitle) {
      return this.createFallback(metadata.name || fallbackTitle, 'insufficient_metadata_quality');
    }

    return {
      ...metadata,
      marketplace: 'Mercado Livre',
      fetchedAt: new Date().toISOString()
    } as ProductMetadata;
  }

  // TODO: generateAffiliateLink retorna cleanUrl como fallback apenas para satisfazer
  // o contrato do BaseAdapter. O fluxo real do ML passa por preProcessIncomingLink.
  // Este método não é o caminho ativo no pipeline principal.
  async generateAffiliateLink(cleanUrl: string, connection?: UserMarketplaceConnection, metadata?: ProductMetadata | null): Promise<string> {
    const link = buildAffiliateUrl(cleanUrl, connection);
    return link || cleanUrl;
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
