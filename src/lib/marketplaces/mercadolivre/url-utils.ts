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

// ─── Metadata candidates ──────────────────────────────────────────────────────

export type MLMetadataCandidateKind =
  | 'direct_offer'
  | 'direct_item'
  | 'original_rich_clean'
  | 'catalog_clean';

export interface MLMetadataCandidate {
  kind: MLMetadataCandidateKind;
  url: string;
  confidence: 'high' | 'medium' | 'low';
}

const TRACKING_PARAMS = new Set([
  'matt_tool', 'matt_word', 'matt_source', 'matt_campaign', 'matt_medium',
  'matt_content', 'matt_term', 'matt_event_ts', 'matt_d2id', 'matt_tracing_id',
  'tracking_id', 'ad_click_id', 'ad_domain', 'ad_position', 'ad_id',
  'forceInApp', 'ref', 'backend_model', 'be_origin', 'position',
  'search_layout', 'type', 'sid', 'c_id', 'c_uid',
  'reco_backend', 'reco_client', 'reco_item_pos', 'source',
  'reco_backend_type', 'reco_id', 'wid',
]);

function buildDirectOfferUrl(offerItemId: string): string {
  const numeric = offerItemId.replace(/^MLB/i, '');
  return `https://produto.mercadolivre.com.br/MLB-${numeric}`;
}

function buildOriginalRichClean(inputUrl: string): string | null {
  try {
    const parsed = new URL(inputUrl);
    // Remover apenas rastreios; preservar pdp_filters, path e demais params contextuais
    for (const key of [...parsed.searchParams.keys()]) {
      if (TRACKING_PARAMS.has(key) || key.startsWith('matt_')) {
        parsed.searchParams.delete(key);
      }
    }
    // Remover fragment (hash) — contém rastreios como #is_advertising=true
    parsed.hash = '';
    return parsed.toString();
  } catch {
    return null;
  }
}

export function buildMercadoLivreMetadataCandidates(
  inputUrl: string,
  idData: MLItemIdData
): MLMetadataCandidate[] {
  const candidates: MLMetadataCandidate[] = [];

  if (idData.urlKind === 'catalog_with_offer' && idData.offerItemId) {
    // 1. URL direta da oferta — página de produto individual, renderizável via SSR
    candidates.push({
      kind: 'direct_offer',
      url: buildDirectOfferUrl(idData.offerItemId),
      confidence: 'high',
    });

    // 2. URL original com pdp_filters preservado, rastreios removidos
    const richClean = buildOriginalRichClean(inputUrl);
    if (richClean) {
      candidates.push({
        kind: 'original_rich_clean',
        url: richClean,
        confidence: 'medium',
      });
    }

    // 3. Catálogo limpo — último recurso
    candidates.push({
      kind: 'catalog_clean',
      url: `https://www.mercadolivre.com.br/p/${idData.catalogProductId}`,
      confidence: 'low',
    });

    return candidates;
  }

  if (idData.urlKind === 'item' || (idData.urlKind === 'catalog_with_offer' && !idData.offerItemId)) {
    candidates.push({
      kind: 'direct_item',
      url: buildDirectOfferUrl(idData.id),
      confidence: 'high',
    });
    return candidates;
  }

  // urlKind === 'catalog' sem offerItemId
  const richClean = buildOriginalRichClean(inputUrl);
  if (richClean) {
    candidates.push({
      kind: 'original_rich_clean',
      url: richClean,
      confidence: 'medium',
    });
  }
  candidates.push({
    kind: 'catalog_clean',
    url: `https://www.mercadolivre.com.br/p/${idData.id}`,
    confidence: 'low',
  });

  return candidates;
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
