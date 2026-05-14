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
    // FASE 2H.1C: Removido strikethrough (~) para alinhar com o formato base solicitado
    lines.push(`De: ${format(insight.originalPrice.value)}`);
  }

  // 4. Preço Atual / Com Cupom / Pix
  const hasPixWithCoupon = insight.canDisplayPix && insight.canDisplayCouponPrice && insight.pixPrice.value;
  const hasCouponOnly = insight.canDisplayCouponPrice && insight.couponAdjustedPrice.value;

  if (hasPixWithCoupon && insight.pixPrice.value) {
    lines.push(`🔥 Por: ${format(insight.pixPrice.value)} NO PIX com cupom`);
  } else if (insight.canDisplayPix && insight.pixPrice.value) {
    lines.push(`🔥 Por: ${format(insight.pixPrice.value)} NO PIX`);
  } else if (hasCouponOnly && insight.couponAdjustedPrice.value) {
    lines.push(`🔥 Por: ${format(insight.couponAdjustedPrice.value)} com cupom aplicado`);
    lines.push(`(Preço normal: ${format(insight.currentPrice.value!)})`);
  } else if (insight.currentPrice.value) {
    lines.push(`🔥 Por: ${format(insight.currentPrice.value)}`);
  } else {
    lines.push(`🔥 Por: Preço sob consulta`);
  }

  // 5. Parcelamento
  if (insight.canDisplayInstallments && insight.installmentCount.value && insight.installmentValue.value) {
    lines.push(`💳 ou ${insight.installmentCount.value}x de ${format(insight.installmentValue.value)} - sem juros`);
  }

  lines.push('');

  // 6. Link Principal
  lines.push('📦 Compre aqui:');
  lines.push(factual.finalLinkToSend);

  // 7. Bloco de Cupom (Instruções)
  if (insight.canDisplayCouponPrice && insight.couponAmount.value) {
    lines.push('');
    lines.push(`Para chegar nesse valor, resgate aqui e aplique o cupom de R$ ${insight.couponAmount.value} OFF:`);
    // Se houver um cupom na lista com redemptionUrl, usamos ele, senão o link do produto
    const couponUrl = factual.extraCouponLink || ((factual.coupons && factual.coupons.length > 0) 
      ? factual.coupons[0].redemptionUrl 
      : factual.finalLinkToSend);
    lines.push(couponUrl || factual.finalLinkToSend);
  }

  lines.push('');
  
  // 8. Disclaimer
  const disclaimer = insight.canDisplayCouponPrice 
    ? '⚠️ Preços e cupons sujeitos à disponibilidade da Shopee.'
    : '⚠️ Promoção sujeita a alteração a qualquer momento.';
  lines.push(disclaimer);

  return lines.join('\n').trim();
}
