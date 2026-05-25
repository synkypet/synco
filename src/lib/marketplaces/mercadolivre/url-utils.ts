import { UserMarketplaceConnection } from '@/types/marketplace';

export function canHandleUrl(url: string): boolean {
  const lowerUrl = url.toLowerCase();
  return lowerUrl.includes('mercadolivre.com.br') || 
         lowerUrl.includes('mercadolibre.com') || 
         lowerUrl.includes('meli.com') || 
         lowerUrl.includes('mercadol.in');
}

export interface MLItemIdData {
  id: string;
  type: 'catalog' | 'item';
  catalogProductId?: string;
  offerItemId?: string;
  urlKind: 'catalog' | 'item' | 'catalog_with_offer';
}

export function extractItemId(url: string): MLItemIdData | null {
  try {
    const decodedUrl = decodeURIComponent(url);

    // 1. Extrair offerItemId de pdp_filters ou query string
    let offerItemId: string | undefined = undefined;
    const pdpFilterMatch = decodedUrl.match(/pdp_filters=item_id:((?:MLB|MLA|MLU|MLC|MLM|MLBU)\d+)/i) ||
                           decodedUrl.match(/pdp_filters=item_id%3D((?:MLB|MLA|MLU|MLC|MLM|MLBU)\d+)/i);
    
    if (pdpFilterMatch) {
      offerItemId = pdpFilterMatch[1].toUpperCase();
    } else {
      const parsed = new URL(url);
      const wid = parsed.searchParams.get('wid') || parsed.searchParams.get('itemId') || parsed.searchParams.get('item_id');
      if (wid && /^(?:MLB|MLA|MLU|MLC|MLM|MLBU)\d+$/i.test(wid)) {
        offerItemId = wid.toUpperCase();
      }
    }

    // 2. Extrair catalogProductId de /p/ ou /up/
    let catalogProductId: string | undefined = undefined;
    const matchP = decodedUrl.match(/\/(p|up)\/((?:MLB|MLA|MLU|MLC|MLM|MLBU)\d+)/i);
    if (matchP) {
      catalogProductId = matchP[2].toUpperCase();
    }

    // 3. Extrair item ID tradicional (/MLB-123456... ou /MLB123456)
    let basicItemId: string | undefined = undefined;
    const matchMLB = decodedUrl.match(/(MLB|MLA|MLU|MLC|MLM|MLBU)-?(\d+)/i);
    if (matchMLB) {
      basicItemId = `${matchMLB[1].toUpperCase()}${matchMLB[2]}`;
    }

    // Determinar o kind e o ID de metadados prioritário
    if (catalogProductId && offerItemId) {
      return {
        id: offerItemId, // Priorizar a oferta/item real para metadados!
        type: 'item',
        catalogProductId,
        offerItemId,
        urlKind: 'catalog_with_offer'
      };
    }

    if (catalogProductId) {
      return {
        id: catalogProductId,
        type: 'catalog',
        catalogProductId,
        urlKind: 'catalog'
      };
    }

    if (offerItemId) {
      return {
        id: offerItemId,
        type: 'item',
        offerItemId,
        urlKind: 'item'
      };
    }

    if (basicItemId) {
      return {
        id: basicItemId,
        type: 'item',
        urlKind: 'item'
      };
    }
  } catch (e) {
    // Fallback para regex simples se falhar na URL
    const matchP = url.match(/\/(p|up)\/((?:MLB|MLA|MLU|MLC|MLM|MLBU)\d+)/i);
    if (matchP) {
      return {
        id: matchP[2].toUpperCase(),
        type: 'catalog',
        catalogProductId: matchP[2].toUpperCase(),
        urlKind: 'catalog'
      };
    }
    const matchMLB = url.match(/(MLB|MLA|MLU|MLC|MLM|MLBU)-?(\d+)/i);
    if (matchMLB) {
      const basicId = `${matchMLB[1].toUpperCase()}${matchMLB[2]}`;
      return {
        id: basicId,
        type: 'item',
        urlKind: 'item'
      };
    }
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
