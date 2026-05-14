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
  const text = (rawText || factual.title || '').toLowerCase();

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
    
    // Parsing numérico do label
    const amountMatch = label.match(/(?:r\$\s*)?(\d+)\s*(?:off|%)/i);
    const minSpendMatch = text.match(/(?:acima de|mínimo|min|compra\s+de)\s*(?:r\$\s*)?(\d+)/i);
    
    if (amountMatch) {
      const isPercentage = label.includes('%');
      if (!isPercentage) {
        couponAmount.value = parseInt(amountMatch[1]);
        couponAmount.source = 'factual_text';
        couponAmount.confidence = 0.90;
      } else {
        couponAmount.warnings.push('percentage_coupons_not_supported_for_calculation');
      }
    }

    if (minSpendMatch) {
      couponMinSpend.value = parseInt(minSpendMatch[1]);
      couponMinSpend.source = 'factual_text';
      couponMinSpend.confidence = 0.90;
    }

    if (label.includes('todas as lojas') || label.includes('site todo')) {
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
  const pixTextMatch = text.match(/(?:r\$\s*)?(\d+(?:[.,]\d{2})?)\s*(?:no\s+)?pix/i);
  if (pixTextMatch) {
    const val = parseFloat(pixTextMatch[1].replace(',', '.'));
    pixPrice.value = val;
    pixPrice.source = 'factual_text';
    pixPrice.confidence = 0.95;
  } else if (factual.estimatedPixPrice && factual.estimatedPixSource === 'heuristic.pix_0_92') {
    // Mantemos o valor mas marcamos como estimado (não exibível)
    pixPrice.value = factual.estimatedPixPrice;
    pixPrice.source = 'estimated';
    pixPrice.confidence = 0.50;
  }

  // 6. Parcelamento (Factual vs Heurístico)
  const installmentCount: ShopeePriceEvidence = { value: null, source: 'unavailable', field: 'installmentCount', confidence: 0, warnings: [] };
  const installmentValue: ShopeePriceEvidence = { value: null, source: 'unavailable', field: 'installmentValue', confidence: 0, warnings: [] };
  let installmentNoInterest = false;

  const instMatch = text.match(/(\d+)x\s*(?:de\s*)?(?:r\$\s*)?(\d+(?:[.,]\d{2})?)\s*(sem\s+juros)?/i);
  if (instMatch) {
    installmentCount.value = parseInt(instMatch[1]);
    installmentValue.value = parseFloat(instMatch[2].replace(',', '.'));
    installmentNoInterest = !!instMatch[3];
    installmentCount.source = 'factual_text';
    installmentValue.source = 'factual_text';
    installmentCount.confidence = 0.95;
  } else if (factual.installments) {
    // Heurística do adapter (ex: "3x de R$ ...")
    installmentCount.source = 'estimated';
    installmentValue.source = 'estimated';
    installmentCount.confidence = 0.40;
  }

  // 7. Decisões de Exibição (Guardrails de Segurança)
  const canDisplayPix = pixPrice.source === 'factual_api' || pixPrice.source === 'factual_text';
  const canDisplayInstallments = (installmentCount.source === 'factual_api' || installmentCount.source === 'factual_text') && installmentNoInterest;
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
    lines.push(`de ${format(insight.originalPrice.value)}`);
  }

  if (insight.canDisplayPix && insight.canDisplayCouponPrice && insight.pixPrice.value) {
    // Caso especial: Pix com Cupom (Factual)
    lines.push(`🔥 Por: ${format(insight.pixPrice.value)} NO PIX com cupom`);
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
    lines.push(`Para chegar nesse valor, resgate aqui e aplique o cupom de R$ ${insight.couponAmount.value} OFF:`);
    lines.push(couponLink || affiliateLink);
  }

  lines.push('');
  lines.push('⚠️ Preços e cupons sujeitos à disponibilidade da Shopee.');

  return lines.join('\n').trim();
}
