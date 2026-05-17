import { classifyShopeeCapturedContent } from '../coupon-classifier';
import { detectStrongCouponSignals } from '../coupon-classifier/signals';
import { resolveShopeeUrl, extractIds } from './resolve';
import { classifyShopeeContentForCoupon } from '../marketplaces/shopee/coupon-classifier';

export interface ShopeeResolverInput {
  text: string;
  source_url?: string;
  force_deep_audit?: boolean;
}

export interface ShopeeResolverOutput {
  content_type: 'verified_coupon' | 'product_offer' | 'product_link' | 'promo_landing' | 'unknown' | 'rejected' | 'candidate';
  accepted_target: 'coupons' | 'promo_pages' | 'products' | 'none';
  coupon_code?: string;
  original_url?: string;
  resolved_url?: string;
  canonical_url?: string;
  has_valid_link: boolean;
  confidence: number;
  reasons: string[];
  validation_depth: 'signals_only' | 'url_resolved' | 'deep_audit';
  redirect_chain?: string[];
  debug?: {
    explicit_code_raw?: string;
    explicit_code_normalized?: string;
    explicit_code_accepted: boolean;
    explicit_code_reject_reason?: string;
  };
}

export async function resolveShopeeCapturedContent(input: ShopeeResolverInput): Promise<ShopeeResolverOutput> {
  // 1. Extrair possível link do texto (se source_url não fornecido)
  const urlMatch = input.text.match(/https?:\/\/[^\s]+/);
  const targetUrl = input.source_url || (urlMatch ? urlMatch[0] : undefined);

  // 2. Classificação Nível 1 (Leve / Signals Only)
  const l1Result = classifyShopeeCapturedContent({
    text: input.text,
    redemption_url: targetUrl
  });

  const baseOutput: ShopeeResolverOutput = {
    content_type: l1Result.content_type,
    accepted_target: getAcceptedTarget(l1Result.content_type),
    coupon_code: l1Result.coupon_code,
    original_url: targetUrl,
    has_valid_link: l1Result.has_valid_link,
    confidence: l1Result.confidence,
    reasons: [...l1Result.reasons],
    validation_depth: l1Result.validation_depth,
    debug: l1Result.debug
  };

  // Se não tem link ou se não for forçado, e o L1 já é definitivo, retorna.
  // "Definitivo" = product_link ou rejected ou verified_coupon (se não for shortlink)
  const isShortLink = targetUrl ? (targetUrl.includes('s.shopee') || targetUrl.includes('br.shp.ee')) : false;
  
  const isDefinitive = 
    l1Result.content_type === 'rejected' || 
    (l1Result.content_type === 'product_link' && !isShortLink);

  if (!input.force_deep_audit && isDefinitive) {
    return baseOutput;
  }

  // Se não temos link para resolver, ficamos com o resultado L1
  if (!targetUrl) {
    if (l1Result.content_type === 'candidate') {
       baseOutput.reasons.push('Falta link para confirmar auditoria profunda.');
    }
    return baseOutput;
  }

  // 3. Classificação Nível 2 (Deep Audit / Link Resolution)
  try {
    const { resolvedUrl, chain, canonicalUrl } = await resolveShopeeUrl(targetUrl);
    
    baseOutput.resolved_url = resolvedUrl;
    baseOutput.canonical_url = canonicalUrl;
    baseOutput.redirect_chain = chain;
    baseOutput.validation_depth = 'url_resolved';

    // --- ALINHAMENTO COM RADAR (FASE 2H.1B) ---
    // Usamos o classificador rígido que o Radar usa para persistência.
    const radarResult = classifyShopeeContentForCoupon(input.text, {
      canonical_url: canonicalUrl
    });

    if (radarResult.classification === 'verified_coupon') {
      baseOutput.content_type = 'verified_coupon';
      baseOutput.accepted_target = 'coupons';
      baseOutput.confidence = Math.max(baseOutput.confidence, 90);
      baseOutput.reasons = radarResult.reasons;
      
      // Tentar extrair código se o radar result não trouxe (mas geralmente ele traz)
      if (!baseOutput.coupon_code) {
        const codeMatch = input.text.match(/\b([A-Z0-9]{5,20})\b/);
        if (codeMatch) baseOutput.coupon_code = codeMatch[1].toUpperCase();
      }
    } else if (radarResult.classification === 'product_offer' || radarResult.classification === 'product_with_coupon') {
      baseOutput.content_type = 'product_link';
      baseOutput.accepted_target = 'products';
      baseOutput.confidence = 99;
      baseOutput.reasons = radarResult.reasons;
    } else if (radarResult.classification === 'promo_landing') {
      baseOutput.content_type = 'promo_landing';
      baseOutput.accepted_target = 'promo_pages';
      baseOutput.reasons = radarResult.reasons;
    } else {
      // Fallback para lógica anterior se o radarResult for inconclusivo
      const { shopId, itemId } = extractIds(canonicalUrl);
      const isProduct = !!(shopId && itemId);
      
      if (isProduct) {
        baseOutput.content_type = 'product_link';
        baseOutput.accepted_target = 'products';
        baseOutput.confidence = 99;
        baseOutput.reasons.push('Link resolve para um produto específico.');
      } else {
        baseOutput.content_type = 'promo_landing';
        baseOutput.accepted_target = 'promo_pages';
        baseOutput.reasons.push('Link resolve para página promocional Shopee (Super Ofertas, Eventos). Sem sinais de cupom específico.');
      }
      baseOutput.confidence = 90;
    }

    baseOutput.accepted_target = getAcceptedTarget(baseOutput.content_type);
    return baseOutput;
  } catch (err: any) {
    baseOutput.content_type = 'unknown';
    baseOutput.reasons.push(`Falha na resolução profunda do link: ${err.message}`);
    baseOutput.has_valid_link = false; // Link quebrado
    return baseOutput;
  }
}

function getAcceptedTarget(contentType: string): 'coupons' | 'promo_pages' | 'products' | 'none' {
  switch (contentType) {
    case 'verified_coupon':
      return 'coupons';
    case 'promo_landing':
      return 'promo_pages';
    case 'product_offer':
    case 'product_link':
      return 'products';
    default:
      return 'none';
  }
}
