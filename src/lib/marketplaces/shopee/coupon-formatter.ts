
import { ShopeeCoupon } from '@/types/shopee-coupon';

/**
 * Formata um cupom Shopee para mensagem de WhatsApp.
 */
export function formatShopeeCouponMessage(coupon: ShopeeCoupon): string {
  switch (coupon.type) {
    case 'codigo':
      return [
        '🔥 *CUPOM DE DESCONTO LIBERADO!*',
        '',
        '> "Cupom Shopee disponível."',
        '',
        `\`🎟️ Use o código: ${coupon.code}\``,
        '',
        `🔗 Aplique aqui: ${coupon.redemptionUrl || 'https://shopee.com.br'}`,
        '',
        '⚠️ *Atenção:* Cupom sujeito à disponibilidade da Shopee.'
      ].join('\n');

    case 'link_resgate':
      return [
        '🔥 *CUPOM DE DESCONTO LIBERADO!*',
        '',
        '> "Cupom Shopee disponível para resgate."',
        '',
        `🎟️ *Desconto:* ${coupon.couponLabel}`,
        '',
        `🔗 Resgate aqui: ${coupon.redemptionUrl}`,
        '',
        '⚠️ *Atenção:* Cupom sujeito à disponibilidade e limite de uso na Shopee.'
      ].join('\n');

    case 'pagina_cupons':
      return [
        '🔥 *CUPONS SHOPEE LIBERADOS!*',
        '',
        '> "Confira os cupons disponíveis na Shopee."',
        '',
        `🔗 Resgate os cupons aqui: ${coupon.redemptionUrl}`,
        '',
        '⚠️ *Atenção:* Os cupons podem acabar ou mudar conforme disponibilidade da Shopee.'
      ].join('\n');

    default:
      return 'Cupom Shopee disponível!';
  }
}
