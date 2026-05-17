
/**
 * Analisa uma URL (canonical ou raw) para extrair dicas sobre o conteúdo.
 */
export function analyzeUrlHints(url?: string): {
  isProduct: boolean;
  isLanding: boolean;
  isVoucher: boolean;
  isSuperOffers: boolean;
  hasShpEE: boolean;
} {
  if (!url) {
    return {
      isProduct: false,
      isLanding: false,
      isVoucher: false,
      isSuperOffers: false,
      hasShpEE: false,
    };
  }

  const lowerUrl = url.toLowerCase();
  
  return {
    isProduct: lowerUrl.includes('/product/') || /-i\.\d+\.\d+/.test(lowerUrl) || lowerUrl.includes('/item/'),
    isLanding: lowerUrl.includes('/m/') || lowerUrl.includes('/events/'),
    isVoucher: lowerUrl.includes('voucher') || 
               lowerUrl.includes('/user/voucher') || 
               lowerUrl.includes('/user/voucher-wallet') ||
               lowerUrl.includes('type=0418') ||
               lowerUrl.includes('/m/cupom'),
    isSuperOffers: lowerUrl.includes('/m/super-ofertas'),
    hasShpEE: lowerUrl.includes('shopee.com.br') || lowerUrl.includes('s.shopee') || lowerUrl.includes('br.shp.ee'),
  };
}
