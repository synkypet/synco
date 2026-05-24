import { UserMarketplaceConnection } from '@/types/marketplace';

export function canHandleUrl(url: string): boolean {
  const lowerUrl = url.toLowerCase();
  return lowerUrl.includes('mercadolivre.com.br') || 
         lowerUrl.includes('mercadolibre.com') || 
         lowerUrl.includes('meli.com') || 
         lowerUrl.includes('mercadol.in');
}

export function extractItemId(url: string): { id: string, type: 'catalog' | 'item' } | null {
  // Padrão 1: /p/MLB123456789
  const matchP = url.match(/\/p\/(MLB\d+)/i);
  if (matchP) return { id: matchP[1].toUpperCase(), type: 'catalog' };

  // Padrão 2: /MLB-123456789-slug ou /MLB123456789
  const matchMLB = url.match(/(MLB)-?(\d+)/i);
  if (matchMLB) return { id: `${matchMLB[1].toUpperCase()}${matchMLB[2]}`, type: 'item' };

  // Padrão 3: itemId na querystring
  try {
    const parsed = new URL(url);
    const itemParam = parsed.searchParams.get('itemId') || parsed.searchParams.get('item_id');
    if (itemParam && itemParam.toUpperCase().startsWith('MLB')) {
      const type = parsed.pathname.startsWith('/p/') ? 'catalog' : 'item';
      return { id: itemParam.toUpperCase(), type };
    }
  } catch (e) {
    // Ignore invalid url
  }

  return null;
}

export function buildCanonicalUrl(itemData: { id: string, type: 'catalog' | 'item' }): string {
  if (itemData.type === 'catalog') {
    return `https://www.mercadolivre.com.br/p/${itemData.id}`;
  }
  const numericId = itemData.id.replace(/^MLB/i, '');
  return `https://produto.mercadolivre.com.br/MLB-${numericId}`;
}

export function buildAffiliateUrl(canonicalUrl: string, connection?: UserMarketplaceConnection): string | null {
  if (!connection) return null;
  
  if (!connection.ml_matt_tool || !connection.ml_partner_id) {
    return null;
  }

  const url = new URL(canonicalUrl);
  url.searchParams.set('matt_tool', connection.ml_matt_tool);
  url.searchParams.set('partner_id', connection.ml_partner_id);
  
  const finalUrl = url.toString();
  if (finalUrl === canonicalUrl) {
    return null;
  }

  if (!finalUrl.includes('matt_tool=') || !finalUrl.includes('partner_id=')) {
    return null;
  }

  return finalUrl;
}
