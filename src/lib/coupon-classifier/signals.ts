
import { 
  STRONG_PRODUCT_PRICE_PATTERNS, 
  STRONG_PRODUCT_INSTALLMENT_PATTERNS, 
  STRONG_COUPON_BENEFIT_PATTERNS,
  GENERIC_PRODUCT_WORDS 
} from './text-patterns';

/**
 * Detecta sinais FORTES de que o conteúdo é um PRODUTO.
 */
export function detectStrongProductSignals(text: string, title?: string) {
  const combined = (text + ' ' + (title || '')).toLowerCase();
  
  const hasStrongPrice = STRONG_PRODUCT_PRICE_PATTERNS.some(p => p.test(combined));
  const hasStrongInstallments = STRONG_PRODUCT_INSTALLMENT_PATTERNS.some(p => p.test(combined));
  
  const hasProductKeywords = GENERIC_PRODUCT_WORDS.some(word => {
    const regex = new RegExp(`\\b${word.toLowerCase()}\\b`, 'i');
    return regex.test(combined);
  });

  return {
    hasStrongPrice,
    hasStrongInstallments,
    hasProductKeywords,
    hasPrice: hasStrongPrice,
    isDefinitelyProduct: hasStrongPrice || hasStrongInstallments
  };
}

/**
 * Detecta sinais FORTES de que o conteúdo é um CUPOM.
 * IMPORTANTE: Remove URLs do texto antes de checar keywords para evitar falsos positivos
 * como "voucher-wallet" na URL sendo confundido com menção textual de cupom.
 */
export function detectStrongCouponSignals(text: string, code?: string) {
  // Remove URLs do texto antes de analisar keywords — evita que /m/voucher-wallet
  // seja confundido com menção textual de cupom
  const textWithoutUrls = text.replace(/https?:\/\/[^\s]+/gi, '').trim();
  const combined = (textWithoutUrls + ' ' + (code || '')).toLowerCase();
  
  const hasBenefit = STRONG_COUPON_BENEFIT_PATTERNS.some(p => p.test(combined));
  const hasCouponKeywords = combined.includes('cupom') || 
                            combined.includes('🎟️') || 
                            combined.includes('codigo') || 
                            combined.includes('código') ||
                            combined.includes('voucher') ||
                            combined.includes('resgate');

  return {
    hasBenefit,
    hasCouponKeywords,
    isDefinitelyCoupon: hasBenefit || hasCouponKeywords
  };
}

/**
 * Palavras genéricas que indicam rejeição se usadas como código sem contexto.
 */
export function isGenericRejection(code?: string) {
  if (!code) return false;
  return GENERIC_PRODUCT_WORDS.includes(code.toUpperCase());
}
