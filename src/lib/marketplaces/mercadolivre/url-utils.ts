import { UserMarketplaceConnection } from '@/types/marketplace';

export function canHandleUrl(url: string): boolean {
  const lowerUrl = url.toLowerCase();
  return lowerUrl.includes('mercadolivre.com.br') || 
         lowerUrl.includes('mercadolibre.com') || 
         lowerUrl.includes('meli.com') || 
         lowerUrl.includes('mercadol.in');
}

export function extractItemId(url: string): string | null {
  // Padrão 1: /p/MLB123456789
  const matchP = url.match(/\/p\/(MLB\d+)/i);
  if (matchP) return matchP[1].toUpperCase();

  // Padrão 2: /MLB-123456789-slug ou /MLB123456789
  const matchMLB = url.match(/(MLB)-?(\d+)/i);
  if (matchMLB) return `${matchMLB[1].toUpperCase()}${matchMLB[2]}`;

  // Padrão 3: itemId na querystring
  try {
    const parsed = new URL(url);
    const itemParam = parsed.searchParams.get('itemId') || parsed.searchParams.get('item_id');
    if (itemParam && itemParam.toUpperCase().startsWith('MLB')) {
      return itemParam.toUpperCase();
    }
  } catch (e) {
    // Ignore invalid url
  }

  return null;
}

export function buildCanonicalUrl(itemId: string): string {
  return `https://www.mercadolivre.com.br/p/${itemId}`;
}

export function buildAffiliateUrl(canonicalUrl: string, connection?: UserMarketplaceConnection): string {
  if (!connection) return canonicalUrl;
  
  if (connection.ml_matt_tool && connection.ml_partner_id) {
    const url = new URL(canonicalUrl);
    url.searchParams.set('matt_tool', connection.ml_matt_tool);
    url.searchParams.set('matt_word', '');
    url.searchParams.set('matt_element', '');
    url.searchParams.set('matt_campaign', '');
    url.searchParams.set('partner_id', connection.ml_partner_id);
    return url.toString();
  }

  if (connection.ml_affiliate_tag) {
    const url = new URL(canonicalUrl);
    url.searchParams.set('tag', connection.ml_affiliate_tag);
    return url.toString();
  }

  return canonicalUrl;
}
