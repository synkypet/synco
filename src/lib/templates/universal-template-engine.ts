// src/lib/templates/universal-template-engine.ts
import { FactualData, OfferType } from '../linkProcessor';
import { formatShopeeProductMessage } from '../marketplaces/shopee/product-message-formatter';
import { formatShopeeCouponMessage } from '../marketplaces/shopee/coupon-formatter';
import { generatePricingInsight } from '../marketplaces/shopee/pricing-logic';
import { templateService } from '@/services/supabase/template-service';
import { SupabaseClient } from '@supabase/supabase-js';

export interface SmartTemplateContext {
  product_name: string;
  affiliate_link: string;
  smart_price_block: string;
  original_price_line: string;
  current_price_line: string;
  coupon_block: string;
  disclaimer: string;
  
  // Variáveis para Cupons
  coupon_code?: string | null;
  coupon_discount_line?: string;
  coupon_link?: string | null;
  coupon_warning?: string;
  
  // Variáveis para Promo Landings
  promo_title?: string;
  promo_link?: string;
  promo_warning?: string;
  
  // Metadados
  marketplace: string;
  offer_type: OfferType;
  source_name?: string;
}

/**
 * Templates Padrão do Sistema (Hardcoded como Fallback Seguro e Seed)
 */
export const DEFAULT_TEMPLATES = {
  shopee_product: `🛍️ {{product_name}}

{{smart_price_block}}

📦 Compre aqui:
{{affiliate_link}}

{{disclaimer}}`,

  shopee_product_premium: `🛍️ {{product_name}}

{{smart_price_block}}

📦 Compre aqui:
{{affiliate_link}}

{{coupon_block}}

⚠️ Preços e cupons sujeitos à disponibilidade da Shopee.`,

  shopee_coupon: `🔥 *CUPOM DE DESCONTO LIBERADO!*

{{coupon_discount_line}}
🎟️ *Código:* {{coupon_code}}

🔗 Resgate aqui:
{{coupon_link}}

⚠️ Cupom sujeito à disponibilidade e limite de uso na Shopee.`,


  shopee_promo: `🚨 *ACESSO VIP SHOPEE LIBERADO!* 🚨

🔥 Uma página especial de ofertas da Shopee acabou de ser liberada com promoções por tempo limitado.

🛒 Produtos com descontos em várias categorias podem aparecer a qualquer momento.
🎟️ Cupons, frete grátis e ofertas relâmpago ficam disponíveis conforme estoque e disponibilidade.

⚡ Quem entra primeiro tem mais chance de aproveitar antes que os melhores achados acabem.

🔗 *ENTRE NA ÁREA VIP DE OFERTAS:*
{{promo_link}}

⚠️ Os preços, cupons e descontos podem mudar ou acabar sem aviso prévio.`
};

/**
 * Constrói o contexto seguro de template a partir dos dados factuais.
 */
export function buildSmartContext(data: FactualData, sourceName?: string): SmartTemplateContext {
  const isShopee = data.marketplace === 'Shopee';
  const offerType = data.eligibility?.offer_type || 'product_offer';

  // 1. Gerar blocos inteligentes via formatadores especializados
  let smartPriceBlock = '';
  let couponBlock = '';
  let originalPriceLine = '';
  let currentPriceLine = '';
  let disclaimer = '⚠️ Promoção sujeita a alteração a qualquer momento.';

  if (isShopee) {
    const insight = generatePricingInsight(data, data.source_text || undefined);
    
    // Gerar blocos individuais para flexibilidade do usuário
    const format = (v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    
    if (insight.originalPrice.value) {
      originalPriceLine = `~De: ${format(insight.originalPrice.value)}~`;
    }
    
    if (insight.currentPrice.value) {
      currentPriceLine = `🔥 *Por: ${format(insight.currentPrice.value)}*`;
    }

    // O smart_price_block é o "coração" do formatador
    smartPriceBlock = formatShopeeProductMessage(data, data.source_text || undefined)
      .split('\n\n')[1] || ''; // Pegar apenas o miolo de preço se possível? 
      // Na verdade, vamos deixar o formatador gerar o bloco completo de preço e disclaimer.
    
    // Ajuste: Vamos extrair as partes do formatador Shopee para não duplicar lógica
    const fullMsg = formatShopeeProductMessage(data, data.source_text || undefined);
    const lines = fullMsg.split('\n');
    
    // smart_price_block = tudo entre o título e o link
    const titleIndex = 0;
    const linkIndex = lines.findIndex(l => l.includes('📦 Compre aqui'));
    if (linkIndex > 2) {
      smartPriceBlock = lines.slice(2, linkIndex).join('\n').trim();
    }

    // coupon_block
    if (insight.canDisplayCouponPrice && insight.couponAmount.value) {
      const couponUrl = data.extraCouponLink || ((data.coupons && data.coupons.length > 0) 
        ? data.coupons[0].redemptionUrl 
        : data.finalLinkToSend);
      couponBlock = `Para chegar nesse valor, resgate aqui e aplique o cupom de R$ ${insight.couponAmount.value} OFF:\n${couponUrl}`;
    }

    if (insight.canDisplayCouponPrice) {
      disclaimer = '⚠️ Preços e cupons sujeitos à disponibilidade da Shopee.';
    }
  }

  // 2. Variáveis de Cupom
  const bestCoupon = (data.coupons && data.coupons.length > 0) ? data.coupons[0] : null;
  const couponDiscountLine = bestCoupon ? `🎟️ *Desconto:* ${bestCoupon.couponLabel}` : '';

  return {
    product_name: data.title || '',
    affiliate_link: data.finalLinkToSend || '',
    smart_price_block: smartPriceBlock,
    original_price_line: originalPriceLine,
    current_price_line: currentPriceLine,
    coupon_block: couponBlock,
    disclaimer: disclaimer,
    
    coupon_code: bestCoupon?.code,
    coupon_discount_line: couponDiscountLine,
    coupon_link: bestCoupon?.redemptionUrl || data.finalLinkToSend,
    
    promo_title: data.title,
    promo_link: data.finalLinkToSend,
    
    marketplace: data.marketplace,
    offer_type: offerType,
    source_name: sourceName
  };
}

/**
 * Motor Universal de Renderização
 */
export function renderSmartTemplate(template: string, context: SmartTemplateContext): string {
  if (!template) return '';

  let result = template;

  // 1. Mapeamento de variáveis novas (Smart)
  const smartMappings: Record<string, string> = {
    'product_name': context.product_name,
    'affiliate_link': context.affiliate_link,
    'smart_price_block': context.smart_price_block,
    'original_price_line': context.original_price_line,
    'current_price_line': context.current_price_line,
    'coupon_block': context.coupon_block,
    'disclaimer': context.disclaimer,
    'coupon_code': context.coupon_code || '',
    'coupon_discount_line': context.coupon_discount_line || '',
    'coupon_link': context.coupon_link || '',
    'promo_link': context.promo_link || '',
    'source_name': context.source_name || ''
  };

  // 2. Mapeamento de variáveis legadas (Compatibilidade)
  const legacyMappings: Record<string, string> = {
    'titulo': context.product_name,
    'titulo_maiusculo': context.product_name.toUpperCase(),
    'link': context.affiliate_link,
    'preco': context.current_price_line.replace('🔥 *Por: ', '').replace('*', ''),
    'preco_original': context.original_price_line.replace('~De: ', '').replace('~', ''),
    'pix': context.smart_price_block.includes('NO PIX') ? context.smart_price_block : '', // Seguro: só preenche se o smart block validou Pix
    'loja': context.marketplace,
    'codigo': context.coupon_code || ''
  };

  const allMappings = { ...legacyMappings, ...smartMappings };

  Object.entries(allMappings).forEach(([key, value]) => {
    const regex = new RegExp(`{{${key}}}`, 'g');
    result = result.replace(regex, value);
  });

  // 3. Limpeza de Placeholders Orfãos
  result = result.replace(/\{\{[a-z0-9_]+\}\}/gi, '');

  // 4. Limpeza de Labels Viúvas (SEGURANÇA)
  const widowLabels = /^(?:Pix:|Por:|De:|🔥 Por:|💥 Por:|💳 ou)\s*$/gmi;
  result = result.replace(widowLabels, '');

  // 5. Normalização de Quebras de Linha
  return result.replace(/\n{3,}/g, '\n\n').trim();
}

/**
 * Normaliza o tipo de oferta para o tipo de template do banco.
 */
export function mapOfferTypeToTemplateType(offerType: OfferType, hasCoupon: boolean): string {
  switch (offerType) {
    case 'coupon_offer': return 'shopee_coupon';
    case 'promo_landing': return 'shopee_promo_landing';
    case 'product_with_coupon': return 'shopee_product_premium';
    case 'product_offer':
      return hasCoupon ? 'shopee_product_premium' : 'shopee_product';
    default: return 'shopee_product';
  }
}

/**
 * Resolve e renderiza o melhor template para um produto.
 */
export async function resolveAndRenderTemplate(
  supabase: SupabaseClient,
  data: FactualData,
  userId?: string
): Promise<{ content: string; isSystem: boolean }> {
  const context = buildSmartContext(data);
  const templateType = mapOfferTypeToTemplateType(
    data.eligibility?.offer_type || 'product_offer',
    !!context.coupon_block
  );

  // 1. Tentar resolver do banco (Gerenciado)
  try {
    const { content, isSystem } = await templateService.resolveEffectiveTemplate(supabase, userId, templateType);
    if (content) {
      return {
        content: renderSmartTemplate(content, context),
        isSystem
      };
    }
  } catch (err) {
    console.error('[TEMPLATE-ENGINE] Error resolving from DB:', err);
  }

  // 2. Fallback para Hardcoded
  const fallbackKey = templateType.includes('premium') ? 'shopee_product_premium' : 
                     templateType.includes('coupon') ? 'shopee_coupon' :
                     templateType.includes('promo') ? 'shopee_promo' : 'shopee_product';
  
  const fallbackTemplate = (DEFAULT_TEMPLATES as any)[fallbackKey] || DEFAULT_TEMPLATES.shopee_product;
  
  return {
    content: renderSmartTemplate(fallbackTemplate, context),
    isSystem: true
  };
}

