
/**
 * Retorna o link principal de um cupom com fallback seguro (fonte absoluta de verdade).
 */
export function getCouponPrimaryUrl(coupon: { effective_redemption_url?: string | null; redemption_url?: string | null; source_url?: string | null } | any): string | null {
  if (!coupon) return null;
  return coupon.effective_redemption_url || coupon.redemption_url || coupon.source_url || null;
}

/**
 * Formata um ou mais cupons para o Envio Rápido.
 */
export function formatCouponsForQuickSend(coupons: any[]): string {
  if (!coupons || coupons.length === 0) return '';

  const messages = coupons.map(c => {
    const link = getCouponPrimaryUrl(c);
    
    // REGRA RÍGIDA: Se não houver link, não podemos gerar mensagem.
    if (!link || link === 'undefined') {
      console.warn(`[COUPON-FORMATTER] Tentativa de formatar cupom ${c.id || 'sem-id'} sem link válido.`);
      return null;
    }

    const couponType = c.couponType || c.coupon_type || c.type || '';
    const rawCode = c.code || c.couponCode || '';
    const codeValue = String(rawCode).trim();
    const hasCode = codeValue && codeValue !== 'null' && codeValue !== 'undefined';
    
    const isPromoPage = couponType === 'pagina_oferta' || !hasCode;
    
    const codeBlock = (!isPromoPage && hasCode) ? `🎟️ Código: *${codeValue}*\n` : '';
    
    const rawLabel = c.coupon_label || c.label || c.couponLabel || c.title || '';
    const labelValue = String(rawLabel).trim();
    const labelBlock = (labelValue && labelValue !== 'null' && labelValue !== 'undefined') ? `💸 *${labelValue}*\n` : '';
    
    const titleHeader = isPromoPage ? `🔥 PÁGINA DE OFERTAS SHOPEE! 🔥` : `🔥 CUPOM SHOPEE LIBERADO! 🔥`;
    const message = `${titleHeader}\n\n${codeBlock}${labelBlock}\n⚡ Aproveite as melhores ofertas antes que acabe.\n\n🔗 Resgate aqui:\n${link}\n\n⚠️ Sujeito à disponibilidade de estoque e limite de uso na Shopee.`;
    return message.replace(/\n{3,}/g, '\n\n').trim();
  }).filter(Boolean);

  return messages.join('\n\n---\n\n');
}

/**
 * Formata um único cupom para o Envio Rápido (Compatibilidade).
 */
export function formatShopeeCouponMessage(coupon: any): string | null {
  const result = formatCouponsForQuickSend([coupon]);
  return result || null;
}

/**
 * Formata uma mensagem específica para Páginas Promocionais Shopee.
 */
export function formatShopeePromoPageMessage({ title, affiliateUrl }: { title: string, affiliateUrl: string }): string | null {
  if (!affiliateUrl || affiliateUrl === 'undefined') {
    console.warn(`[SHOPEE-PROMO-FORMATTER] type=promo_page Tentativa de formatar pagina sem link válido.`);
    return null;
  }
  
  const safeTitle = title && title.trim() !== '' ? title.trim() : 'Super Ofertas Shopee';
  
  return `🔥 *OFERTA SHOPEE LIBERADA!* 🔥

🛍️ *Página:* ${safeTitle}

⚡ Acesse antes que acabe.

🔗 *Confira aqui:*
${affiliateUrl}

⚠️ Promoção sujeita à disponibilidade na Shopee.`;
}
