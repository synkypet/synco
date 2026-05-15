import { ShopeeCoupon } from '@/types/shopee-coupon';

/**
 * Formata um cupom Shopee para mensagem de WhatsApp.
 */
export function formatShopeeCouponMessage(coupon: ShopeeCoupon): string {
  const isLandingPageType = coupon.type === 'pagina_cupons';
  const isLandingUrl = !!(coupon.redemptionUrl && coupon.redemptionUrl.startsWith('http') && (coupon.redemptionUrl.includes('/m/') || coupon.redemptionUrl.includes('cupom')));
  const isLanding = isLandingPageType || isLandingUrl;

  // Títulos amigáveis (Regra 2E.1A)
  const title = isLanding ? '🚨 *CUPONS SHOPEE LIBERADOS!* 🚨' : '🔥 *CUPOM SHOPEE LIBERADO!* 🔥';
  
  // Limpeza de label para evitar "R$ OFF" ou valores vazios
  const rawLabel = (coupon.couponLabel || '').trim();
  const hasValidLabel = rawLabel.length > 0 && 
                        !rawLabel.includes('R$  OFF') && 
                        !rawLabel.includes('undefined') &&
                        !rawLabel.toLowerCase().includes('produto shopee');

  switch (coupon.type) {
    case 'codigo':
      return [
        title,
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
      const resgateLines = [
        title,
        '',
        '> "Cupom Shopee disponível para resgate."',
        ''
      ];
      
      if (hasValidLabel) {
        resgateLines.push(`🎟️ *Desconto:* ${rawLabel}`);
        resgateLines.push('');
      }

      resgateLines.push(`🔗 Resgate aqui: ${coupon.redemptionUrl}`);
      resgateLines.push('');
      resgateLines.push('⚠️ *Atenção:* Cupom sujeito à disponibilidade e limite de uso na Shopee.');
      
      return resgateLines.join('\n');

    case 'pagina_cupons':
    default:
      // FASE 2F.1: Especialização para Super Ofertas
      if (coupon.couponLabel === 'SUPER_OFERTAS') {
        return [
          '🚨 *ACESSO VIP SHOPEE LIBERADO!* 🚨',
          '',
          '🔥 Uma página especial de ofertas da Shopee acabou de ser liberada com promoções por tempo limitado.',
          '',
          '🛒 Produtos com descontos em várias categorias podem aparecer a qualquer momento.',
          '🎟️ Cupons, frete grátis e ofertas relâmpago ficam disponíveis conforme estoque e disponibilidade.',
          '',
          '⚡ Quem entra primeiro tem mais chance de aproveitar antes que os melhores achados acabem.',
          '',
          '🔗 *ENTRE NA ÁREA VIP DE OFERTAS:*',
          coupon.redemptionUrl || 'https://shopee.com.br/m/super-ofertas',
          '',
          '⚠️ *Atenção:* Os preços, cupons e descontos podem mudar ou acabar sem aviso prévio.'
        ].join('\n');
      }

      const landingLines = [
        '🚨 *CUPONS SHOPEE LIBERADOS!* 🚨',
        '',
        '🎟️ Confira os cupons disponíveis na Shopee.',
        '🚚 Aproveite cupons de desconto e frete grátis quando disponíveis.',
        ''
      ];

      if (hasValidLabel) {
        landingLines.push(`🎟️ *Destaque:* ${rawLabel}`);
        landingLines.push('');
      }

      landingLines.push('🔗 *RESGATE OS CUPONS AQUI:*');
      landingLines.push(coupon.redemptionUrl || 'https://shopee.com.br/m/cupom-de-desconto');
      landingLines.push('');
      landingLines.push('⚠️ *Atenção:* Os cupons podem acabar ou mudar conforme disponibilidade da Shopee.');

      return landingLines.join('\n');
  }
}
