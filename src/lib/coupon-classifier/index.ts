import { ShopeeContentType, ShopeeClassificationResult, ShopeeClassifierInput } from './types';
import { analyzeUrlHints } from './url-hints';
import { detectStrongProductSignals, detectStrongCouponSignals, isGenericRejection } from './signals';
import { classifyShopeeContentForCoupon } from '../marketplaces/shopee/coupon-classifier';
import { COUPON_PATTERNS } from './text-patterns';

/**
 * Classificação Nível 1 (Leve / Signals Only)
 */
export function classifyShopeeCapturedContent(input: ShopeeClassifierInput): ShopeeClassificationResult {
  const { text = '', title, code, redemption_url, source_url, price } = input;
  
  const couponSignalsInitial = detectStrongCouponSignals(text, code);
  const urlHintsInitial = analyzeUrlHints(redemption_url || source_url);
  
  // --- ALINHAMENTO COM RADAR (FASE 2H.1B) ---
  // Se temos um link, usamos o classificador que já funciona no Radar.
  if (redemption_url || source_url) {
    const radarResult = classifyShopeeContentForCoupon(text, {
      title: title || input.coupon_label || '',
      canonical_url: redemption_url || source_url,
      price: price
    });

    if (radarResult.classification === 'verified_coupon') {
      const potentialCode = radarResult.reasons.find(r => r.includes('Código'))?.match(/\b([A-Z0-9]{5,20})\b/)?.[1] || code;
      
      return {
        content_type: 'verified_coupon',
        confidence: 85,
        reasons: radarResult.reasons,
        coupon_code: potentialCode,
        redemption_url: redemption_url || source_url,
        has_valid_link: true,
        validation_depth: 'signals_only',
        debug: {
          signals: couponSignalsInitial,
          hints: urlHintsInitial,
          explicit_code_accepted: false
        }
      };
    }

    if (radarResult.classification === 'product_offer' || radarResult.classification === 'product_with_coupon') {
      return {
        content_type: 'product_link',
        confidence: 95,
        reasons: radarResult.reasons,
        has_valid_link: true,
        validation_depth: 'signals_only',
        debug: {
          signals: couponSignalsInitial,
          hints: urlHintsInitial,
          explicit_code_accepted: false
        }
      };
    }
  }

  // 1. Extração de Código Explícito (Fase 2H.1A)
  let extractedCode: string | undefined;
  let rawExtracted: string | undefined;
  let normalizedExtracted: string | undefined;
  let rejectReason: string | undefined;

  for (const pattern of COUPON_PATTERNS) {
    const m = text.match(pattern);
    if (m && m[1]) {
      rawExtracted = m[1];
      // Normalização: remove markdown (*, **, _, ~, `) e espaços
      const norm = m[1].replace(/[*_`~]/g, '').trim().toUpperCase();
      
      if (!normalizedExtracted) normalizedExtracted = norm;

      if (norm && !isGenericRejection(norm)) {
        extractedCode = norm;
        break; // Achou um código válido por padrão explícito, para aqui.
      } else if (norm && !rejectReason) {
        rejectReason = `Palavra de produto/blacklist: ${norm}`;
      }
    }
  }

  const potentialCode = code || extractedCode;
  
  const productSignals = detectStrongProductSignals(text, title || '');
  const couponSignals = detectStrongCouponSignals(text, potentialCode);
  const urlHints = analyzeUrlHints(redemption_url || source_url);

  const hasValidLink = (!!redemption_url || !!source_url) && urlHints.hasShpEE;

  // Montar debug object
  const debugInfo = {
    signals: couponSignals,
    hints: urlHints,
    explicit_code_raw: rawExtracted,
    explicit_code_normalized: normalizedExtracted,
    explicit_code_accepted: !!extractedCode,
    explicit_code_reject_reason: !extractedCode ? rejectReason : undefined
  };

  // --- LÓGICA DE PRIORIDADE ---

  // R1: REJEIÇÃO (Palavras da blacklist sem contexto de cupom real)
  if (productSignals.hasProductKeywords && !couponSignals.hasCouponKeywords && !potentialCode && !urlHints.isVoucher) {
    return {
      content_type: 'rejected',
      confidence: 90,
      reasons: ['Palavras de produto detectadas sem contexto de cupom.'],
      has_valid_link: hasValidLink,
      validation_depth: 'signals_only',
      debug: debugInfo
    };
  }

  // R2: PRODUTO (Preço detectado + Palavras de produto)
  if (productSignals.hasPrice && productSignals.hasProductKeywords) {
    return {
      content_type: 'product_offer',
      confidence: 85,
      reasons: ['Preço e palavras de produto detectados.'],
      has_valid_link: hasValidLink,
      validation_depth: 'signals_only',
      debug: debugInfo
    };
  }

  // R3: PRODUTO SEM PREÇO (Link + Palavras de produto)
  if (productSignals.hasProductKeywords && hasValidLink && !couponSignals.hasCouponKeywords) {
    return {
      content_type: 'product_link',
      confidence: 70,
      reasons: ['Link e palavras de produto detectados.'],
      has_valid_link: true,
      validation_depth: 'signals_only',
      debug: debugInfo
    };
  }

  // R4: CUPOM VERIFICADO (Código Válido OU Benefício OFF + Link)
  // REGRA ESTRITA: Para ser VERIFIED, precisa de Código Válido OU Benefício OFF.
  // REFINADO: Aceita link de resgate (/user/voucher-wallet) se acompanhado de contexto de cupom (keywords)
  const hasStrongEvidence = !!potentialCode || couponSignals.hasBenefit || (urlHints.isVoucher && couponSignals.hasCouponKeywords);

  if (hasStrongEvidence && hasValidLink && (couponSignals.hasBenefit || potentialCode || (urlHints.isVoucher && couponSignals.hasCouponKeywords))) {
    return {
      content_type: 'verified_coupon',
      confidence: 80,
      reasons: [
        couponSignals.hasBenefit ? 'Benefício claro de cupom detectado (OFF/Desconto/Mínimo)' : '',
        potentialCode ? `Código de cupom detectado: ${potentialCode}` : '',
        urlHints.isVoucher ? 'URL de voucher/resgate detectada' : ''
      ].filter(Boolean),
      coupon_code: potentialCode,
      redemption_url: redemption_url || source_url,
      has_valid_link: true,
      validation_depth: 'signals_only',
      debug: debugInfo
    };
  }

  // R5: LANDING PAGE (Link /m/ ou /events/ sem sinais de cupom)
  if (urlHints.isLanding && hasValidLink) {
    return {
      content_type: 'promo_landing',
      confidence: 85,
      reasons: ['URL ou padrão de landing page promocional detectado sem contexto de cupom específico'],
      has_valid_link: true,
      validation_depth: 'signals_only',
      debug: debugInfo
    };
  }

  // R6: CANDIDATO (Sinais de cupom mas sem link ou link desconhecido)
  if (couponSignals.hasCouponKeywords || potentialCode) {
    return {
      content_type: 'candidate',
      confidence: 60,
      reasons: ['Sinais de cupom detectados, mas falta link de resgate válido ou evidência forte'],
      coupon_code: potentialCode,
      has_valid_link: hasValidLink,
      validation_depth: 'signals_only',
      debug: debugInfo
    };
  }

  // Default: Desconhecido
  return {
    content_type: 'unknown',
    confidence: 30,
    reasons: ['Nenhum sinal forte de produto ou cupom detectado'],
    has_valid_link: hasValidLink,
    validation_depth: 'signals_only',
    debug: debugInfo
  };
}
