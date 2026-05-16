
/**
 * Formata um ou mais cupons para o Envio Rápido.
 */
export function formatCouponsForQuickSend(coupons: any[]): string {
  if (!coupons || coupons.length === 0) return '';

  const messages = coupons.map(c => {
    const link = c.effective_redemption_url || c.redemption_url || c.redemptionUrl;
    
    // REGRA RÍGIDA: Se não houver link, não podemos gerar mensagem.
    if (!link || link === 'undefined') {
      console.warn(`[COUPON-FORMATTER] Tentativa de formatar cupom ${c.id || 'sem-id'} sem link válido.`);
      return null;
    }

    const isCode = c.coupon_type === 'codigo' || !!c.code;
    const codeBlock = isCode ? `🎟️ Código: *${c.code}*\n` : '';
    const labelBlock = c.coupon_label || c.label ? `💸 ${c.coupon_label || c.label}\n` : '';
    
    return `🔥 CUPOM SHOPEE LIBERADO! 🔥\n\n${codeBlock}${labelBlock}\n⚡ Resgate antes que acabe.\n\n🔗 Resgate aqui:\n${link}\n\n⚠️ Cupom sujeito à disponibilidade e limite de uso na Shopee.`;
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
