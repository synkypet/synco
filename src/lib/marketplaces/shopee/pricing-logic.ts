// src/lib/marketplaces/shopee/pricing-logic.ts

import { FactualData } from '@/lib/linkProcessor';
import { ShopeeCoupon } from '@/types/shopee-coupon';

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
 * Motor de Inteligência de Preço Shopee.
 * Transforma metadados brutos e texto em insights validados e seguros.
 */
export function generatePricingInsight(
  factual: FactualData, 
  rawText?: string
): ShopeePricingInsight {
  const warnings: string[] = [];
  
  // 0. Validação de Entidade (Anti-Mismatch)
  // Se houver rawText, verificamos se o título do produto na API tem tokens comuns com o texto.
  const apiTitle = (factual.title || '').toLowerCase();
  let effectiveRawText = rawText;
  
  if (effectiveRawText && apiTitle) {
    const textLower = effectiveRawText.toLowerCase();
    // Extraímos tokens significativos (comprimento > 3)
    const apiTokens = apiTitle.split(/[\s,.-]+/).filter(t => t.length > 3);
    const matches = apiTokens.filter(t => textLower.includes(t));
    
    // Se não houver nenhum token comum significativo, suspeitamos de divergência.
    if (matches.length === 0 && apiTokens.length > 0) {
      console.warn(`[PRICING-LOGIC] Divergência de produto detectada. API: "${apiTitle}" vs TEXT: "${textLower.substring(0, 50)}..."`);
      warnings.push('product_entity_mismatch');
      effectiveRawText = undefined; // Ignoramos o texto para extração factual
    }
  }

  const text = (effectiveRawText || '').toLowerCase();

  // 1. Preço Atual (Factual)
  const currentPrice: ShopeePriceEvidence = {
    value: factual.price || null,
    source: factual.currentPriceSource?.startsWith('api') ? 'factual_api' : 'unavailable',
    field: 'currentPrice',
    confidence: factual.currentPriceSource?.startsWith('api') ? 1.0 : 0,
    warnings: []
  };

  // 2. Preço Original (Factual)
  const originalPriceValue = factual.originalPrice || null;
  const isOriginalValid = !!(originalPriceValue && currentPrice.value && originalPriceValue > currentPrice.value);
  
  const originalPrice: ShopeePriceEvidence = {
    value: isOriginalValid ? originalPriceValue : null,
    source: (isOriginalValid && factual.currentPriceSource?.startsWith('api')) ? 'factual_api' : 'unavailable',
    field: 'originalPrice',
    confidence: isOriginalValid ? 1.0 : 0,
    warnings: !isOriginalValid && originalPriceValue ? ['original_price_inconsistent_or_equal'] : []
  };

  // 3. Extração de Cupom do Texto
  const couponAmount: ShopeePriceEvidence = { value: null, source: 'unavailable', field: 'couponAmount', confidence: 0, warnings: [] };
  const couponMinSpend: ShopeePriceEvidence = { value: null, source: 'unavailable', field: 'couponMinSpend', confidence: 0, warnings: [] };
  let couponScope: string | null = null;

  if (factual.coupons && factual.coupons.length > 0) {
    const bestCoupon = factual.coupons[0];
    const label = (bestCoupon.couponLabel || '').toLowerCase();
    
    // Parsing numérico do label e do texto original
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

  // 4. Cálculo de Preço com Cupom (Validado)
  const couponAdjustedPrice: ShopeePriceEvidence = { value: null, source: 'unavailable', field: 'couponAdjustedPrice', confidence: 0, warnings: [] };
  
  if (currentPrice.value && couponAmount.value && couponAmount.source === 'factual_text') {
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
  
  // Tentar achar no texto: "R$ 537,64 no pix"
  const pixTextMatch = text.match(/(?:por:?\s*)?(?:r\$\s*)?([\d.,]+)\s*(?:no\s+)?pix/i);
  if (pixTextMatch) {
    // Limpamos pontos de milhar e convertemos vírgula decimal
    const rawVal = pixTextMatch[1];
    const val = parseFloat(rawVal.replace(/\./g, '').replace(',', '.'));
    
    // Validação de Limites (Anti-Absurdo)
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
    
    // Validação de Sanidade Matemática (Tolerância 15%)
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

  // 7. Decisões de Exibição (Guardrails de Segurança)
  const canDisplayPix = pixPrice.source === 'factual_text';
  const canDisplayInstallments = installmentCount.source === 'factual_text' && installmentNoInterest;
  const canDisplayCouponPrice = couponAdjustedPrice.source === 'calculated_verified';

  let displayMode: ShopeePricingInsight['displayMode'] = 'base_only';
  if (canDisplayPix && canDisplayCouponPrice && canDisplayInstallments) displayMode = 'full_verified';
  else if (canDisplayPix && canDisplayCouponPrice) displayMode = 'pix_coupon_verified';
  else if (canDisplayCouponPrice) displayMode = 'coupon_verified';

  return {
    productTitle: factual.title,
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
 */
export function formatSmartMessage(insight: ShopeePricingInsight, affiliateLink: string, couponLink?: string): string {
  const lines: string[] = [];

  // 1. Header
  lines.push(`🛍️ ${insight.productTitle}`);
  lines.push('');

  // 2. Preços
  const format = (v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  if (insight.originalPrice.value) {
    lines.push(`~De: ${format(insight.originalPrice.value)}~`);
  }

  if (insight.canDisplayPix && insight.canDisplayCouponPrice && insight.pixPrice.value) {
    lines.push(`🔥 Por: ${format(insight.pixPrice.value)} NO PIX com cupom`);
  } else if (insight.canDisplayPix && insight.pixPrice.value) {
    lines.push(`🔥 Por: ${format(insight.pixPrice.value)} NO PIX`);
  } else if (insight.canDisplayCouponPrice && insight.couponAdjustedPrice.value) {
    lines.push(`🔥 Por: ${format(insight.couponAdjustedPrice.value)} com cupom aplicado`);
    lines.push(`(Preço normal: ${format(insight.currentPrice.value!)})`);
  } else if (insight.currentPrice.value) {
    lines.push(`🔥 Por: ${format(insight.currentPrice.value)}`);
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
