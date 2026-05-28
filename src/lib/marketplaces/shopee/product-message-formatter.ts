// src/lib/marketplaces/shopee/product-message-formatter.ts

import { FactualData } from '@/lib/linkProcessor';
import { generatePricingInsight, ShopeePricingInsight } from './pricing-logic';

/**
 * Formata a mensagem final de um produto Shopee baseada no insight validado.
 * 
 * Regras:
 * - Pix heurístico nunca aparece.
 * - Parcelamento heurístico nunca aparece.
 * - "sem juros" só aparece se confirmado via factual_text.
 * - Preço com cupom só aparece se calculado e verificado.
 */
export function formatShopeeProductMessage(factual: FactualData, rawText?: string): string {
  // 1. Gerar o insight de confiança
  const insight = generatePricingInsight(factual, rawText);
  
  const lines: string[] = [];

  // 1. Header
  const emoji = '🛍️';
  lines.push(`${emoji} ${insight.productTitle}`);
  lines.push('');

  // 2. Formatação de Moeda
  const format = (v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  // 3. Preço Original "De:"
  if (insight.originalPrice.value) {
    lines.push(`~De: ${format(insight.originalPrice.value)}~`);
  }

  // 4. Preço Atual / Com Cupom / Pix
  const hasPixWithCoupon = insight.canDisplayPix && insight.canDisplayCouponPrice && insight.pixPrice.value;
  const hasCouponOnly = insight.canDisplayCouponPrice && insight.couponAdjustedPrice.value;

  if (hasPixWithCoupon && insight.pixPrice.value) {
    lines.push(`🔥 *Por: ${format(insight.pixPrice.value)} NO PIX com cupom*`);
  } else if (insight.canDisplayPix && insight.pixPrice.value) {
    lines.push(`🔥 *Por: ${format(insight.pixPrice.value)} NO PIX*`);
  } else if (hasCouponOnly && insight.couponAdjustedPrice.value) {
    lines.push(`🔥 *Por: ${format(insight.couponAdjustedPrice.value)} COM CUPOM*`);
    lines.push(`[Preço normal: ${format(insight.currentPrice.value!)}]`);
  } else if (insight.currentPrice.value) {
    lines.push(`🔥 *Por: ${format(insight.currentPrice.value)}*`);
  } else {
    // FASE 2I.2: Bloqueio de envio sem preço.
    return '[PRODUCT_PRICE_UNAVAILABLE]';
  }


  // 5. Parcelamento
  if (insight.canDisplayInstallments && insight.installmentCount.value && insight.installmentValue.value) {
    lines.push(`💳 ou ${insight.installmentCount.value}x de ${format(insight.installmentValue.value)} - sem juros`);
  }

  lines.push('');

  // 6. Link Principal
  lines.push('🛒 Garanta aqui:');
  lines.push(factual.finalLinkToSend);

  // 7. Bloco de Cupom (Instruções)
  if (insight.canDisplayCouponPrice && insight.couponAmount.value) {
    lines.push('');
    
    // Identificar a URL correta de resgate
    const couponUrl = factual.extraCouponLink || ((factual.coupons && factual.coupons.length > 0) 
      ? factual.coupons[0].redemptionUrl 
      : null);
      
    if (couponUrl) {
      lines.push(`Para chegar nesse valor, resgate aqui e aplique o cupom de R$ ${insight.couponAmount.value} OFF:`);
      lines.push(couponUrl);
    } else {
      lines.push(`🎟️ Cupom: R$ ${insight.couponAmount.value} OFF`);
    }
  }

  lines.push('');
  
  // 8. Disclaimer
  const disclaimer = insight.canDisplayCouponPrice 
    ? '⚠️ Preços e cupons sujeitos à disponibilidade da Shopee.'
    : '⚠️ Promoção sujeita a alteração a qualquer momento.';
  lines.push(disclaimer);

  return lines.join('\n').trim();
}
