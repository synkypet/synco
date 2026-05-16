
import { ShopeeCoupon } from '@/types/shopee-coupon';


export type ShopeeClassification = 
  | 'verified_coupon' 
  | 'product_offer' 
  | 'product_with_coupon' 
  | 'promo_landing' 
  | 'unknown' 
  | 'rejected'
  | 'candidate';

const GENERIC_PRODUCT_WORDS = [
  'massageador', 'silicone', 'cooktop', 'bolsa', 'perfume', 'panini', 
  'infantil', 'feminina', 'masculino', 'oficial', 'kit', 'jogo', 
  'conjunto', 'unidades', 'peças', 'pecas', 'escova', 'tenis', 'tênis'
];

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

  // Detectar link no texto se não houver canonical_url
  const hasLinkInText = /https?:\/\/[^\s]+/.test(text);
  const effectiveHasLink = !!factual.canonical_url || hasLinkInText;

  // 1. Indicadores de Produto (BLOCKERS para cupom puro)
  // Ignoramos padrões comuns de cupom como "mínimo R$ 50", "acima de R$ 100" ou "R$ 15 OFF"
  const normalizedContent = content.replace(/(mínimo|a partir de|acima de|compras de|gaste|ganhe)\s*r\$\s*\d+/gi, '')
                                   .replace(/r\$\s*\d+\s*off/gi, '');
  
  const hasPricePattern = /r\$\s*\d+/.test(normalizedContent) || /por:\s*r\$/i.test(normalizedContent) || /de:\s*r\$/i.test(normalizedContent);
  const hasInstallments = /\d+x\s*de\s*r\$/i.test(content) || /sem\s*juros/i.test(content);
  const hasStrongProductKeywords = ['frete grátis', 'estoque', 'vendedor', 'compra garantida', 'entrega rápida'].some(k => content.includes(k));
  
  // Detecção de palavras genéricas que indicam título de produto
  const hasGenericProductWord = GENERIC_PRODUCT_WORDS.some(word => {
    const regex = new RegExp(`\\b${word}\\b`, 'i');
    return regex.test(content);
  });

  const hasStrongProductData = !!(
    (factual.price && factual.price > 0) || 
    hasPricePattern || 
    hasInstallments || 
    (hasStrongProductKeywords && content.includes('r$')) ||
    (hasGenericProductWord && !content.includes('cupom') && !content.includes('🎟️'))
  );

  // 2. Verificação de URL e Cupom (EVIDÊNCIAS)
  const codeMatch = text.match(/\b([A-Z0-9]{5,20})\b/);
  const potentialCode = codeMatch ? codeMatch[1].toUpperCase() : null;
  const isGenericCode = potentialCode && GENERIC_PRODUCT_WORDS.some(word => word.toUpperCase() === potentialCode);
  const hasCouponContext = content.includes('cupom') || content.includes('🎟️') || content.includes('codigo') || content.includes('código');
  const hasCouponCode = potentialCode && !isGenericCode && hasCouponContext;
  
  const isCouponLanding = factual.canonical_url?.includes('/m/cupom') || 
                          factual.canonical_url?.includes('voucher') || 
                          factual.canonical_url?.includes('/user/voucher') ||
                          content.includes('resgate seu cupom');

  // REGRA DE OURO: verified_coupon EXIGE um link (canonical_url)
  const hasLink = !!factual.canonical_url;

  if (factual.canonical_url) {
    const lowerUrl = factual.canonical_url.toLowerCase();
    const isProductUrl = lowerUrl.includes('/product/') || /-i\.\d+\.\d+/.test(lowerUrl) || lowerUrl.includes('/item/');
    
    // Se for URL de produto e tiver cupom -> product_with_coupon
    if (isProductUrl && (hasCouponCode || isCouponLanding)) {
      return { 
        classification: 'product_with_coupon', 
        reasons: ['URL de produto detectada, mas contém cupom/voucher'] 
      };
    }

    // Se for URL de produto puro -> product_offer
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

  // 3. Verificação de Cupom Puro
  if ((hasCouponCode || isCouponLanding) && effectiveHasLink) {
    if (hasStrongProductData) {
      return { 
        classification: 'product_with_coupon', 
        reasons: ['Contém cupom, mas também possui dados claros de produto (preço/parcelas/título)'] 
      };
    }
    
    return { 
      classification: 'verified_coupon', 
      reasons: [hasCouponCode ? 'Código de cupom detectado' : 'Página de resgate detectada'] 
    };
  }

  // 4. Fallback
  if (hasStrongProductData) return { classification: 'product_offer', reasons: ['Identificado como oferta de produto'] };
  if (hasCouponCode || isCouponLanding) return { classification: 'candidate', reasons: ['Evidência de cupom encontrada, mas falta link de resgate'] };
  
  return { classification: 'unknown', reasons: ['Nenhuma evidência forte de cupom ou produto'] };
}
