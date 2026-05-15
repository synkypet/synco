
/**
 * Formata um ou mais cupons para o Envio Rápido.
 */
export function formatCouponsForQuickSend(coupons: any[]): string {
  if (!coupons || coupons.length === 0) return '';

  const messages = coupons.map(c => {
    const isCode = c.coupon_type === 'codigo' || !!c.code;
    const codeBlock = isCode ? `🎟️ Código: *${c.code}*\n` : '';
    const labelBlock = c.coupon_label ? `💸 ${c.coupon_label}\n` : '';
    
    return `🔥 CUPOM SHOPEE LIBERADO! 🔥\n\n${codeBlock}${labelBlock}\n⚡ Resgate antes que acabe.\n\n🔗 Resgate aqui:\n${c.redemption_url}\n\n⚠️ Cupom sujeito à disponibilidade e limite de uso na Shopee.`;
  });

  return messages.join('\n\n---\n\n');
}

/**
 * Formata um único cupom para o Envio Rápido (Compatibilidade).
 */
export function formatShopeeCouponMessage(coupon: any): string {
  return formatCouponsForQuickSend([coupon]);
}
