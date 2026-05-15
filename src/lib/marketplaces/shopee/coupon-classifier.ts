
import { ShopeeCoupon } from '@/types/shopee-coupon';

export type ShopeeClassification = 
  | 'verified_coupon' 
  | 'product_offer' 
  | 'product_with_coupon' 
  | 'promo_landing' 
  | 'unknown' 
  | 'rejected';

/**
 * Classificador Rígido de Conteúdo Shopee para Cupons (RADAR-FACTUAL-V3)
 * Unifica a lógica do Envio Rápido e do Radar para evitar falsos positivos.
 */
export function classifyShopeeContentForCoupon(
  text: string, 
  factual: { 
    title?: string; 
    price?: number | null; 
    canonical_url?: string;
  } = {}
): { classification: ShopeeClassification; reasons: string[] } {
  const content = (text + ' ' + (factual.title || '')).toLowerCase();
  const reasons: string[] = [];

  // 1. Indicadores de Produto (BLOCKERS para cupom puro)
  // Ignoramos padrões comuns de cupom como "mínimo R$ 50", "acima de R$ 100" ou "R$ 15 OFF"
  const normalizedContent = content.replace(/(mínimo|a partir de|acima de|compras de|gaste)\s*r\$\s*\d+/gi, '')
                                   .replace(/r\$\s*\d+\s*off/gi, '');
  
  const hasPricePattern = /r\$\s*\d+/.test(normalizedContent) || /por:\s*r\$/i.test(normalizedContent) || /de:\s*r\$/i.test(normalizedContent);
  const hasInstallments = /\d+x\s*de\s*r\$/i.test(content) || /sem\s*juros/i.test(content);
  const hasStrongProductKeywords = ['frete grátis', 'estoque', 'vendedor', 'compra garantida'].some(k => content.includes(k));
  
  const hasStrongProductData = !!(
    (factual.price && factual.price > 0) || 
    hasPricePattern || 
    hasInstallments || 
    (hasStrongProductKeywords && content.includes('r$'))
  );

  // 2. Verificação de URL (BLOCKERS)
  if (factual.canonical_url) {
    const lowerUrl = factual.canonical_url.toLowerCase();
    const isProductUrl = lowerUrl.includes('/product/') || /-i\.\d+\.\d+/.test(lowerUrl) || lowerUrl.includes('/item/');
    
    if (isProductUrl) {
      return { 
        classification: hasStrongProductData ? 'product_offer' : 'rejected', 
        reasons: ['URL resolve para um produto específico'] 
      };
    }

    if (lowerUrl.includes('/m/super-ofertas')) {
      return { classification: 'promo_landing', reasons: ['Landing page de Super Ofertas'] };
    }
  }

  // 3. Verificação de Cupom (EVIDÊNCIAS)
  const hasCouponCode = /[A-Z0-9]{5,20}/.test(text) && (content.includes('cupom') || content.includes('🎟️') || content.includes('codigo') || content.includes('código'));
  const isCouponLanding = factual.canonical_url?.includes('/m/cupom') || factual.canonical_url?.includes('voucher') || content.includes('resgate seu cupom');

  if (hasCouponCode || isCouponLanding) {
    if (hasStrongProductData) {
      return { 
        classification: 'product_with_coupon', 
        reasons: ['Contém cupom, mas também possui dados claros de produto (preço/parcelas)'] 
      };
    }
    
    return { 
      classification: 'verified_coupon', 
      reasons: [hasCouponCode ? 'Código de cupom detectado' : 'Página de resgate detectada'] 
    };
  }

  // 4. Fallback
  if (hasStrongProductData) return { classification: 'product_offer', reasons: ['Identificado como oferta de produto'] };
  
  return { classification: 'unknown', reasons: ['Nenhuma evidência forte de cupom ou produto'] };
}
