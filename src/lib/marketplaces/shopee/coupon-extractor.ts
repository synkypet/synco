
import { ShopeeCoupon, ShopeeCouponType } from '@/types/shopee-coupon';

const SHOPEE_DOMAINS = [
  's.shopee.com.br',
  'br.shp.ee',
  'shopee.com.br',
  'www.shopee.com.br'
];

/**
 * Normaliza o texto removendo emojis, espaços duplicados e padronizando quebras de linha.
 */
export function normalizeText(text: string): string {
  return text
    .replace(/[\u{1F300}-\u{1F9FF}]|[\u{2700}-\u{27BF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]|[\u{2600}-\u{26FF}]|[\u{1F1E6}-\u{1F1FF}]/gu, '') // Remove emojis
    .replace(/\s+/g, ' ') // Espaços e quebras duplicados
    .trim();
}

/**
 * Remove pontuação final comum de uma URL.
 */
export function sanitizeUrl(url: string): string {
  return url.replace(/[.,\)!\]\}!]+$/, '');
}

/**
 * Gera uma chave de deduplicação pura.
 */
export function generateDedupeKey(coupon: Partial<ShopeeCoupon>): string {
  if (coupon.type === 'codigo' && coupon.code) {
    return `shopee:coupon:code:${coupon.code.toUpperCase()}`;
  }
  if (coupon.redemptionUrl) {
    return `shopee:coupon:url:${coupon.redemptionUrl}`;
  }
  return `shopee:coupon:unknown:${Date.now()}`;
}

/**
 * Motor de extração de cupons Shopee.
 */
export function extractShopeeCoupons(rawText: string): ShopeeCoupon[] {
  const coupons: ShopeeCoupon[] = [];
  
  // 1. Identificar URLs Shopee no texto (Garantindo que o domínio seja Shopee)
  const urlRegex = /https?:\/\/(?:[a-zA-Z0-9-]+\.)?(?:shopee\.com\.br|shp\.ee|shope\.ee)[^\s]*/gi;
  const foundUrls = (rawText.match(urlRegex) || []).map(sanitizeUrl).filter(url => {
    try {
      const hostname = new URL(url).hostname.toLowerCase();
      return SHOPEE_DOMAINS.some(domain => hostname === domain || hostname.endsWith('.' + domain));
    } catch {
      return false;
    }
  });

  // 2. Extração de Código Explícito
  // Procura por "cupom", "código", etc seguido de um código alfanumérico
  const codePatterns = /(?:use\s+o\s+)?(?:cupom|código|codigo):\s*([A-Z0-9]{5,20})/gi;
  let match;
  while ((match = codePatterns.exec(rawText)) !== null) {
    const code = match[1].toUpperCase();
    
    // Evitar capturar labels de desconto como "R$50 OFF" no lugar do código
    if (/^\d+$/.test(code) || code.includes('OFF')) continue;

    const coupon: ShopeeCoupon = {
      marketplace: 'shopee',
      type: 'codigo',
      code: code,
      couponLabel: null,
      redemptionUrl: foundUrls.length > 0 ? foundUrls[0] : null,
      confidence: 0.95,
      status: 'candidate',
      dedupeKey: ''
    };
    coupon.dedupeKey = generateDedupeKey(coupon);
    coupons.push(coupon);
  }

  // 3. Extração de Desconto + Link de Resgate (Padrão 1: Explícito)
  const rescuePatterns = /(?:use\s+o\s+)?(?:cupom|código|codigo):\s*([^|]+)\|?\s*(?:resgate\s+aqui|confira|aproveite|clique aqui):\s*(https?:\/\/[^\s]+)/gi;
  while ((match = rescuePatterns.exec(rawText)) !== null) {
    const label = match[1].trim();
    const url = sanitizeUrl(match[2]);

    if (SHOPEE_DOMAINS.some(domain => url.includes(domain))) {
      const coupon: ShopeeCoupon = {
        marketplace: 'shopee',
        type: 'link_resgate',
        code: null,
        couponLabel: label,
        redemptionUrl: url,
        confidence: 0.90,
        status: 'candidate',
        dedupeKey: ''
      };
      coupon.dedupeKey = generateDedupeKey(coupon);
      coupons.push(coupon);
    }
  }

  // 3.1 Extração de Desconto + Link (Padrão 2: Flexível)
  // Detecta: R$50 OFF: https://... ou Cupom 50%: https://...
  const flexiblePatterns = /(?:🎟️)?\s*([^:\n]+OFF|Cupom[^:\n]+):\s*(https?:\/\/[^\s]+)/gi;
  while ((match = flexiblePatterns.exec(rawText)) !== null) {
    const label = match[1].trim();
    const url = sanitizeUrl(match[2]);

    // Evitar duplicar se já foi pego pelo padrão explícito
    if (coupons.some(c => c.redemptionUrl === url)) continue;

    if (SHOPEE_DOMAINS.some(domain => url.includes(domain))) {
      const coupon: ShopeeCoupon = {
        marketplace: 'shopee',
        type: 'link_resgate',
        code: null,
        couponLabel: label,
        redemptionUrl: url,
        confidence: 0.85,
        status: 'candidate',
        dedupeKey: ''
      };
      coupon.dedupeKey = generateDedupeKey(coupon);
      coupons.push(coupon);
    }
  }

  // 4. Página Central de Cupons (Fallback se não for nenhum dos anteriores)
  if (coupons.length === 0) {
    const centralKeywords = ['cupom de desconto shopee', 'resgate os cupons', 'confira os cupons'];
    const lowerText = rawText.toLowerCase();
    
    for (const url of foundUrls) {
      const isCentral = centralKeywords.some(k => lowerText.includes(k)) || 
                        url.includes('/m/cupom-de-desconto');
      
      if (isCentral) {
        const coupon: ShopeeCoupon = {
          marketplace: 'shopee',
          type: 'pagina_cupons',
          code: null,
          couponLabel: 'Cupom de Desconto Shopee',
          redemptionUrl: url,
          confidence: 0.80,
          status: 'candidate',
          dedupeKey: ''
        };
        coupon.dedupeKey = generateDedupeKey(coupon);
        coupons.push(coupon);
      }
    }
  }

  // Remover duplicatas internas no mesmo texto
  return Array.from(new Map(coupons.map(c => [c.dedupeKey, c])).values());
}
