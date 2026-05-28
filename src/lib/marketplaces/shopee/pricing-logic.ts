// src/lib/marketplaces/shopee/pricing-logic.ts

import { FactualData } from '@/lib/linkProcessor';
import { ShopeeCoupon } from '@/types/shopee-coupon';
import { normalizeCouponText } from '@/lib/marketplaces/shopee/coupon-extractor';
import { parseShopeeOfferContext } from './offer-parser';

export type PriceSource = 'factual_api' | 'factual_text' | 'calculated_verified' | 'estimated' | 'unavailable';

export interface ShopeePriceEvidence {
  value: number | null;
  source: PriceSource;
  field: string;
  confidence: number;
  raw?: string;
  warnings: string[];
}

export interface ShopeePricingInsight {
  productTitle: string;
  originalPrice: ShopeePriceEvidence;
  currentPrice: ShopeePriceEvidence;
  couponAmount: ShopeePriceEvidence;
  couponMinSpend: ShopeePriceEvidence;
  couponScope: string | null;
  couponAdjustedPrice: ShopeePriceEvidence;
  pixPrice: ShopeePriceEvidence;
  installmentCount: ShopeePriceEvidence;
  installmentValue: ShopeePriceEvidence;
  installmentNoInterest: boolean;
  displayMode: 'base_only' | 'coupon_verified' | 'pix_coupon_verified' | 'full_verified';
  warnings: string[];
  canDisplayPix: boolean;
  canDisplayInstallments: boolean;
  canDisplayCouponPrice: boolean;
}

/**
 * Normaliza títulos em CAIXA ALTA para Title Case de forma inteligente.
 */
export function smartTitleCase(text: string): string {
  if (!text) return text;
  
  // Se não estiver tudo em maiúsculas (pelo menos 3 letras maiúsculas e nenhuma minúscula), 
  // não mexemos para preservar camelCase ou formatos mistos intencionais.
  const hasMinLetters = (text.match(/[A-Z]/g) || []).length >= 3;
  const hasNoLower = !/[a-z]/.test(text);
  
  if (!hasMinLetters || !hasNoLower) return text;
  
  const words = text.toLowerCase().split(' ');
  const normalized = words.map((word, index) => {
    // Siglas e medidas comuns - manter maiúsculo
    const upperCaseWords = ['led', 'off', 'vip', 'rgb', 'usb', 'ssd', 'ram', 'hd', 'bt', '4k', 'uhd'];
    if (upperCaseWords.includes(word)) return word.toUpperCase();
    
    // Números com unidades (45x62cm, 100%algodão)
    if (/\d+/.test(word)) {
      // Se for apenas número, ignora. Se tiver letras (unidades), põe em maiúsculo
      if (/[a-z]/.test(word)) return word.toUpperCase();
      return word;
    }
    
    // Palavras curtas - manter minúsculo se não for a primeira
    const shortWords = ['de', 'com', 'em', 'para', 'da', 'do', 'das', 'dos', 'por', 'ou', 'no', 'na', 'nos', 'nas', 'um', 'uma'];
    if (index > 0 && shortWords.includes(word)) return word;
    
    // Primeira letra maiúscula
    return word.charAt(0).toUpperCase() + word.slice(1);
  });
  
  return normalized.join(' ');
}

/**
 * Motor de Inteligência de Preço Shopee.
 * Transforma metadados brutos e texto em insights validados e seguros.
 */
export function generatePricingInsight(
  factual: FactualData, 
  rawText?: string
): ShopeePricingInsight {
  const warnings: string[] = [];
  
  // Normalização do Título (Fase 2H.1C - Polish)
  const productTitle = smartTitleCase(factual.title || 'Produto sem título');

  // 0. Validação de Entidade (Anti-Mismatch)
  const apiTitleForMatch = productTitle.toLowerCase();
  let effectiveRawText = rawText;
  
  if (effectiveRawText && apiTitleForMatch) {
    const textLower = effectiveRawText.toLowerCase();
    const apiTokens = apiTitleForMatch.split(/[\s,.-]+/).filter(t => t.length > 3);
    const matches = apiTokens.filter(t => textLower.includes(t));
    
    if (matches.length === 0 && apiTokens.length > 0) {
      const isOnlyUrl = /^https?:\/\/\S+$/.test(textLower.trim());
      if (isOnlyUrl) {
        console.info(`[PRICING-LOGIC] Comparação textual ignorada: sourceText é URL pura.`);
      } else {
        console.warn(`[PRICING-LOGIC] Divergência de produto detectada. API: "${apiTitleForMatch}" vs TEXT: "${textLower.substring(0, 50)}..."`);
      }
      warnings.push('product_entity_mismatch');
      effectiveRawText = undefined;
    }
  }

  const context = parseShopeeOfferContext(effectiveRawText || '');
  const normalizedRaw = context.normalizedText;
  const text = normalizedRaw.toLowerCase();

  // ... (Resto da lógica de currentPrice, originalPrice, coupon, Pix e parcelamento permanece idêntica)
  // [CÓDIGO OMITIDO PARA PRESERVAR LÓGICA DE PREÇO - SERÁ MANTIDO NO ARQUIVO FINAL]
  
  // 1. Preço Atual (Factual)
  const currentPrice: ShopeePriceEvidence = {
    value: factual.price || null,
    source: factual.currentPriceSource?.startsWith('api') ? 'factual_api' : 'unavailable',
    field: 'currentPrice',
    confidence: factual.currentPriceSource?.startsWith('api') ? 1.0 : 0,
    warnings: []
  };

  // 1A. Extração de Cupom do Texto (Necessário para validar preço)
  const couponAmount: ShopeePriceEvidence = { value: null, source: 'unavailable', field: 'couponAmount', confidence: 0, warnings: [] };
  const couponMinSpend: ShopeePriceEvidence = { value: null, source: 'unavailable', field: 'couponMinSpend', confidence: 0, warnings: [] };
  let couponScope: string | null = null;

  if (factual.coupons && factual.coupons.length > 0) {
    const bestCoupon = factual.coupons[0];
    const label = (bestCoupon.couponLabel || '').toLowerCase();
    
    const amountMatch = label.match(/(?:r\$\s*)?(\d+)\s*(?:off|%)/i);
    const minSpendMatch = text.match(/(?:acima de|mínimo|min|compra\s+de|a partir de)\s*(?:r\$\s*)?(\d+)/i);
    
    if (amountMatch) {
      const isPercentage = label.includes('%');
      if (!isPercentage) {
        couponAmount.value = parseInt(amountMatch[1]);
        couponAmount.source = 'factual_text';
        couponAmount.confidence = 0.90;
      }
    }

    if (minSpendMatch) {
      couponMinSpend.value = parseInt(minSpendMatch[1]);
      couponMinSpend.source = 'factual_text';
      couponMinSpend.confidence = 0.90;
    }

    if (label.includes('todas as lojas') || label.includes('site todo') || text.includes('todas as lojas')) {
      couponScope = 'global';
    } else if (label.includes('loja oficial') || label.includes('shopee oficial')) {
      couponScope = 'official_store';
    }
  }

  // Ajuste de Preço com Cupom do Texto (Validação de Plausibilidade)
  // Ajuste de Preço com Cupom do Texto (Validação de Plausibilidade)
  const hasExplicitCoupon = context.hasExplicitCouponSignal || (factual.coupons && factual.coupons.length > 0);
  let textPorPrice: number | null = context.prices.currentPrice || null;
  let plausibleTextPrice: number | null = null;

  if (hasExplicitCoupon && textPorPrice && currentPrice.value && textPorPrice < currentPrice.value) {
    const difference = currentPrice.value - textPorPrice;
    
    // Regra de Plausibilidade: A diferença deve ser explicável por cupom + possível pix (~10-15%)
    let plausibleDifference = (couponAmount.value || 0) + (currentPrice.value * 0.15); 
    
    // Margem de erro de arredondamento ou pequenos cupons extras (ex: moedas)
    plausibleDifference += 10;

    if (difference <= plausibleDifference) {
      console.log(`[SHOPEE-PRICING] coupon_text_price_selected=true reason=plausible_coupon_pix textPrice=${textPorPrice} apiPrice=${currentPrice.value} couponAmount=${couponAmount.value || 0}`);
      plausibleTextPrice = textPorPrice;
    } else {
      console.log(`[SHOPEE-PRICING] text_coupon_price_rejected reason=not_plausible textPrice=${textPorPrice} apiPrice=${currentPrice.value} couponAmount=${couponAmount.value || 0}`);
    }
  } else {
    console.log(`[SHOPEE-PRICING] coupon_text_price_selected=false hasExplicitCoupon=${hasExplicitCoupon} textPorPrice=${textPorPrice} apiPrice=${currentPrice.value}`);
  }

  // 2. Preço Original (Factual, Textual ou Calculado via Desconto)
  let opValue: number | null = null;
  let opSource: PriceSource = 'unavailable';
  let opConfidence = 0;
  const opWarnings: string[] = [];

  // Prioridade A: Factual Text (da mensagem original "De: ...")
  if (context.prices.originalPrice) {
    const val = context.prices.originalPrice;
    if (currentPrice.value && val > currentPrice.value) {
      opValue = val;
      opSource = 'factual_text';
      opConfidence = 0.95;
    }
  }

  // Prioridade B: Factual API (se não tiver no texto)
  if (!opValue && factual.originalPrice) {
    const val = factual.originalPrice;
    if (currentPrice.value && val > currentPrice.value) {
      opValue = val;
      opSource = 'factual_api';
      opConfidence = 1.0;
    }
  }

  // Prioridade C: Calculado via Percentual de Desconto (calculated_verified)
  // Fórmula: originalPrice = currentPrice / (1 - discountPercent / 100)
  // AJUSTE: Shopee aceita descontos agressivos. Permitimos até 98% para evitar bloqueio de ofertas reais (-95%).
  if (!opValue && currentPrice.value && factual.discountPercent && factual.discountPercent > 0 && factual.discountPercent <= 98) {
    const derived = currentPrice.value / (1 - factual.discountPercent / 100);
    // Só aceitamos se o preço original calculado for maior que o atual
    if (derived > currentPrice.value) {
      opValue = Math.round(derived * 100) / 100;
      opSource = 'calculated_verified';
      opConfidence = 0.90;
    }
  }

  const originalPrice: ShopeePriceEvidence = {
    value: opValue,
    source: opSource,
    field: 'originalPrice',
    confidence: opConfidence,
    warnings: opWarnings
  };



  // 4. Cálculo de Preço com Cupom (Validado)
  const couponAdjustedPrice: ShopeePriceEvidence = { value: null, source: 'unavailable', field: 'couponAdjustedPrice', confidence: 0, warnings: [] };
  
  if (plausibleTextPrice) {
    // Se o preço do texto foi considerado plausível, ele JÁ tem o cupom (e possível Pix) embutido!
    couponAdjustedPrice.value = plausibleTextPrice;
    couponAdjustedPrice.source = 'factual_text';
    couponAdjustedPrice.confidence = 0.95;
  } else if (currentPrice.value && couponAmount.value && couponAmount.source === 'factual_text') {
    const meetsMinSpend = !couponMinSpend.value || currentPrice.value >= couponMinSpend.value;
    
    if (meetsMinSpend) {
      couponAdjustedPrice.value = Math.max(0, currentPrice.value - couponAmount.value);
      couponAdjustedPrice.source = 'calculated_verified';
      couponAdjustedPrice.confidence = 0.95;
    } else {
      couponAdjustedPrice.warnings.push('product_below_coupon_min_spend');
      warnings.push('coupon_min_spend_not_met');
    }
  }

  // 5. Pix (Factual vs Heurístico)
  const pixPrice: ShopeePriceEvidence = { value: null, source: 'unavailable', field: 'pixPrice', confidence: 0, warnings: [] };
  
  const pixTextMatch = context.prices.pixPrice;
  if (pixTextMatch) {
    const val = pixTextMatch;
    
    const minReasonable = (currentPrice.value || 0) * 0.4;
    if (currentPrice.value && val < minReasonable) {
      console.warn(`[PRICING-LOGIC] Rejeitado Preço Pix Absurdo: ${val} (API: ${currentPrice.value})`);
      warnings.push('pix_price_unreasonable');
    } else {
      pixPrice.value = val;
      pixPrice.source = 'factual_text';
      pixPrice.confidence = 0.95;
    }
  } else if (factual.estimatedPixPrice && factual.estimatedPixSource === 'heuristic.pix_0_92') {
    pixPrice.value = factual.estimatedPixPrice;
    pixPrice.source = 'estimated';
    pixPrice.confidence = 0.50;
  }

  // 6. Parcelamento (Factual vs Heurístico)
  const installmentCount: ShopeePriceEvidence = { value: null, source: 'unavailable', field: 'installmentCount', confidence: 0, warnings: [] };
  const installmentValue: ShopeePriceEvidence = { value: null, source: 'unavailable', field: 'installmentValue', confidence: 0, warnings: [] };
  let installmentNoInterest = false;

  const instMatch = text.match(/(\d+)x\s*(?:de\s*)?(?:r\$\s*)?([\d.,]+)[\s-]*(sem\s+juros)?/i);
  if (instMatch) {
    const count = parseInt(instMatch[1]);
    const val = parseFloat(instMatch[2].replace(/\./g, '').replace(',', '.'));
    const total = count * val;
    
    const targetPrice = couponAdjustedPrice.value || currentPrice.value || 0;
    const diff = Math.abs(total - targetPrice);
    const maxDiff = targetPrice * 0.15;

    if (targetPrice > 0 && diff > maxDiff) {
      console.warn(`[PRICING-LOGIC] Rejeitado Parcelamento Inconsistente: ${count}x${val}=${total} (Target: ${targetPrice})`);
      warnings.push('installments_inconsistent');
    } else {
      installmentCount.value = count;
      installmentValue.value = val;
      installmentNoInterest = !!instMatch[3];
      installmentCount.source = 'factual_text';
      installmentValue.source = 'factual_text';
      installmentCount.confidence = 0.95;
    }
  } else if (factual.installments) {
    installmentCount.source = 'estimated';
    installmentValue.source = 'estimated';
    installmentCount.confidence = 0.40;
  }

  const canDisplayPix = pixPrice.source === 'factual_text';
  const canDisplayInstallments = installmentCount.source === 'factual_text' && installmentNoInterest;
  const canDisplayCouponPrice = couponAdjustedPrice.source === 'calculated_verified' || couponAdjustedPrice.source === 'factual_text';

  let displayMode: ShopeePricingInsight['displayMode'] = 'base_only';
  if (canDisplayPix && canDisplayCouponPrice && canDisplayInstallments) displayMode = 'full_verified';
  else if (canDisplayPix && canDisplayCouponPrice) displayMode = 'pix_coupon_verified';
  else if (canDisplayCouponPrice) displayMode = 'coupon_verified';

  return {
    productTitle,
    originalPrice,
    currentPrice,
    couponAmount,
    couponMinSpend,
    couponScope,
    couponAdjustedPrice,
    pixPrice,
    installmentCount,
    installmentValue,
    installmentNoInterest,
    displayMode,
    warnings,
    canDisplayPix,
    canDisplayInstallments,
    canDisplayCouponPrice
  };
}

/**
 * Formata a mensagem final baseada no insight validado.
 * AJUSTE FASE 2H.1C: Spacing polido e labels limpos.
 */
export function formatSmartMessage(insight: ShopeePricingInsight, affiliateLink: string, couponLink?: string): string {
  const lines: string[] = [];

  // 1. Header (Espaçamento fixo conforme Task 2)
  lines.push(`🛍️ ${insight.productTitle}`);
  lines.push('');

  // 2. Preços
  const format = (v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  if (insight.originalPrice.value) {
    lines.push(`~De: ${format(insight.originalPrice.value)}~`);
  }

  if (insight.canDisplayPix && insight.canDisplayCouponPrice && insight.pixPrice.value) {
    lines.push(`🔥 *Por: ${format(insight.pixPrice.value)} NO PIX com cupom*`);
  } else if (insight.canDisplayPix && insight.pixPrice.value) {
    lines.push(`🔥 *Por: ${format(insight.pixPrice.value)} NO PIX*`);
  } else if (insight.canDisplayCouponPrice && insight.couponAdjustedPrice.value) {
    lines.push(`🔥 *Por: ${format(insight.couponAdjustedPrice.value)} com cupom aplicado*`);
    lines.push(`(Preço normal: ${format(insight.currentPrice.value!)})`);
  } else if (insight.currentPrice.value) {
    lines.push(`🔥 *Por: ${format(insight.currentPrice.value)}*`);
  }

  // 3. Parcelamento
  if (insight.canDisplayInstallments && insight.installmentCount.value && insight.installmentValue.value) {
    lines.push(`💳 ou ${insight.installmentCount.value}x de ${format(insight.installmentValue.value)} - sem juros`);
  }

  lines.push('');

  // 4. Link Principal
  lines.push('📦 Compre aqui:');
  lines.push(affiliateLink);

  // 5. Bloco de Cupom
  if (insight.canDisplayCouponPrice && insight.couponAmount.value) {
    lines.push('');
    lines.push(`Para chegar nesse valor, resgate aqui e aplique o cupom de R$ ${insight.couponAmount.value} OFF${insight.couponScope === 'global' ? ' em TODAS AS LOJAS' : ''}:`);
    lines.push(couponLink || affiliateLink);
  }

  lines.push('');
  lines.push('⚠️ Preços e cupons sujeitos à disponibilidade da Shopee.');

  return lines.join('\n').trim();
}
