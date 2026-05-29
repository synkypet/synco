import { ShopeeCouponType } from '@/types/shopee-coupon';
import { formatDiscountLabel } from './coupon-extractor';

export interface ShopeeParsedPrice {
  originalPrice?: number | null;
  currentPrice?: number | null;
  pixPrice?: number | null;
  source?: string;
}

export interface ShopeeParsedLink {
  url: string;
  role: 'product' | 'voucher' | 'promo_page' | 'unknown';
  confidenceLevel: 'high' | 'medium' | 'low';
  confidence: number;
  nearbyText?: string;
}

export interface ShopeeParsedCoupon {
  code?: string | null;
  couponLabel?: string | null;
  redemptionUrl?: string | null;
  type: ShopeeCouponType | 'unknown_discount';
  confidence: number;
  confidenceLevel: 'high' | 'medium' | 'low';
  source: 'explicit_label' | 'emoji_line' | 'nearby_discount' | 'rescue_link' | 'contextual';
}

export interface ShopeeOfferContext {
  normalizedText: string;
  prices: ShopeeParsedPrice;
  links: ShopeeParsedLink[];
  coupons: ShopeeParsedCoupon[];
  hasExplicitCouponSignal: boolean;
}

const SHOPEE_DOMAINS = [
  's.shopee.com.br',
  'br.shp.ee',
  'shopee.com.br',
  'shope.ee',
  'www.shopee.com.br'
];

const BLACKLISTED_CODES = [
  'SHOPEE', 'CUPOM', 'CODIGO', 'OFF', 'PIX', 'FRETE', 'GRATIS', 'LINK', 
  'RESGATE', 'PROMO', 'TUDO', 'LOJAS', 'CONFIRA', 'APROVEITE', 'CLIQUE', 
  'AQUI', 'SITE', 'APP', 'VÁLIDO', 'VALIDO', 'GANHE', 'VOLTOU', 'TOP',
  'LIBERADO', 'DISPONIVEL', 'OFERTA', 'DESCONTO', 'ESPECIAL',
  'MASSAGEADOR', 'SILICONE', 'COOKTOP', 'BOLSA', 'PERFUME', 'PANINI', 
  'INFANTIL', 'FEMININA', 'MASCULINO', 'OFICIAL', 'KIT', 'JOGO', 
  'CONJUNTO', 'UNIDADES', 'PEÇAS', 'PECAS', 'ESCOVA', 'TENIS', 'TÊNIS'
];

function normalizeOfferText(input: string): string {
  return String(input ?? '')
    .normalize('NFKC')
    .replace(/[\u200B-\u200D\uFEFF]/g, '') // zero-width
    .replace(/\u00A0/g, ' ')              // NBSP
    .replace(/[\u1680\u180E\u2000-\u200A\u202F\u205F\u3000]/g, ' ') // outros espaços unicode
    .replace(/[ \t]+/g, ' ')              // colapsar espaços
    .replace(/[：]/g, ':')               // dois pontos fullwidth
    .replace(/[*_~`]/g, '')              // markdown comum
    .trim();
}

function sanitizeUrl(url: string): string {
  return url.replace(/[.,\)!\]\}!]+$/, '');
}

export function parseShopeeOfferContext(body: string): ShopeeOfferContext {
  const normalizedText = normalizeOfferText(body);
  const lowerText = normalizedText.toLowerCase();

  // 1. Extração de Links
  const urlRegex = /https?:\/\/(?:[a-zA-Z0-9-]+\.)?(?:shopee\.com\.br|shp\.ee|shope\.ee|s\.shopee\.com\.br|br\.shp\.ee)[^\s]*/gi;
  const rawUrls = (body.match(urlRegex) || []).map(sanitizeUrl).filter(url => {
    try {
      const hostname = new URL(url).hostname.toLowerCase();
      return SHOPEE_DOMAINS.some(domain => hostname === domain || hostname.endsWith('.' + domain));
    } catch {
      return false;
    }
  });

  const lines = normalizedText.split('\n');
  const uniqueUrls = Array.from(new Set(rawUrls));
  
  const parsedLinks: ShopeeParsedLink[] = uniqueUrls.map(url => {
    const lineIndex = lines.findIndex(l => l.includes(url));
    const prevLine = lineIndex > 0 ? lines[lineIndex - 1].toLowerCase() : '';
    const line = lineIndex > -1 ? lines[lineIndex].toLowerCase() : '';
    const nextLine = lineIndex > -1 && lineIndex < lines.length - 1 ? lines[lineIndex + 1].toLowerCase() : '';
    const nearbyText = `${prevLine} ${line} ${nextLine}`.trim();
    
    const isProductClue = /compre|garanta|comprar|link para|🛒|📦|produto/i.test(nearbyText);
    const isVoucherClue = /resgate|voucher|cupom|🎫|🎟️/i.test(nearbyText);
    const isPromoClue = url.toLowerCase().includes('/m/') || /página|promoção|confira as ofertas/i.test(nearbyText);

    let role: ShopeeParsedLink['role'] = 'unknown';
    let confidence = 0.5;
    let confidenceLevel: 'high' | 'medium' | 'low' = 'low';

    if (uniqueUrls.length === 1 && isProductClue) {
      // Regra de Ouro: 1 link só + perto de "compre" = product
      role = 'product';
      confidence = 0.99;
      confidenceLevel = 'high';
    } else if (isVoucherClue && !isProductClue) {
      role = 'voucher';
      confidence = 0.9;
      confidenceLevel = 'high';
    } else if (isProductClue) {
      role = 'product';
      confidence = 0.9;
      confidenceLevel = 'high';
    } else if (isPromoClue) {
      role = 'promo_page';
      confidence = 0.8;
      confidenceLevel = 'medium';
    } else if (uniqueUrls.length === 1) {
      // Default to product if only 1 link
      role = 'product';
      confidence = 0.7;
      confidenceLevel = 'medium';
    } else {
      // Desempate heurístico: URLs curtas sem contexto claro
      role = 'product';
      confidence = 0.5;
      confidenceLevel = 'low';
    }

    return {
      url,
      role,
      confidence,
      confidenceLevel,
      nearbyText
    };
  });

  // Sinais de cupom no texto inteiro
  const hasExplicitCouponSignal = /cupom|c[oó]digo|use|aplique|resgate|voucher|desconto|off|🎟️|🏷️|💸/i.test(normalizedText);

  // 2. Extração de Preços (Textual)
  const prices: ShopeeParsedPrice = {};
  
  const deMatch = normalizedText.match(/(?:de:?\s*)(?:r\$\s*)?([\d.,]+)/i);
  if (deMatch) {
    prices.originalPrice = parseFloat(deMatch[1].replace(/\./g, '').replace(',', '.'));
  }

  const porMatch = normalizedText.match(/(?:por:?\s*)(?:r\$\s*)?([\d.,]+)(?!\s*(?:no\s+)?pix)/i);
  if (porMatch) {
    prices.currentPrice = parseFloat(porMatch[1].replace(/\./g, '').replace(',', '.'));
    prices.source = 'factual_text';
  }

  const pixMatch = normalizedText.match(/(?:por:?\s*)?(?:r\$\s*)?([\d.,]+)\s*(?:no\s+)?pix/i);
  if (pixMatch) {
    prices.pixPrice = parseFloat(pixMatch[1].replace(/\./g, '').replace(',', '.'));
  }

  // 3. Extração de Cupons Dinâmicos
  const coupons: ShopeeParsedCoupon[] = [];
  
  const codePatterns = [
    // Padrão explícito prefixado
    { regex: /(?:use\s*o\s*cupom|cupom|c[oó]digo|use|aplique)\s*:?\s*([A-Z0-9]{5,20})(?!\w)/gi, source: 'explicit_label', conf: 0.98, level: 'high' },
    // Padrão com emojis
    { regex: /(?:🎟️|🏷️)\s*([A-Z0-9]{5,20})(?!\w)/gi, source: 'emoji_line', conf: 0.9, level: 'high' },
  ];

  for (const pattern of codePatterns) {
    let match;
    while ((match = pattern.regex.exec(normalizedText)) !== null) {
      const code = match[1].toUpperCase();
      if (BLACKLISTED_CODES.includes(code)) continue;

      // Se for "ou", pode ser um falso positivo de palavras se for curto e sem número
      if (!/\\d/.test(code) && code.length < 6 && ['E', 'OU', 'PARA'].includes(code)) continue;

      const nearestVoucher = parsedLinks.find(l => l.role === 'voucher');

      coupons.push({
        type: 'codigo',
        code,
        couponLabel: null,
        redemptionUrl: nearestVoucher ? nearestVoucher.url : null,
        confidence: pattern.conf,
        confidenceLevel: pattern.level as any,
        source: pattern.source as any
      });
    }
  }

  // Extração de cupons puros sem prefixo, mas com "OU" (MODAMELI ou CUPONSMELI)
  const ouPattern = /([A-Z0-9]{5,20})\s+ou\s+([A-Z0-9]{5,20})/gi;
  let ouMatch;
  while ((ouMatch = ouPattern.exec(normalizedText)) !== null) {
    const c1 = ouMatch[1].toUpperCase();
    const c2 = ouMatch[2].toUpperCase();
    const nearestVoucher = parsedLinks.find(l => l.role === 'voucher');
    const redemptionUrl = nearestVoucher ? nearestVoucher.url : null;
    if (!BLACKLISTED_CODES.includes(c1)) {
      coupons.push({ type: 'codigo', code: c1, couponLabel: null, redemptionUrl, confidence: 0.8, confidenceLevel: 'medium', source: 'contextual' });
    }
    if (!BLACKLISTED_CODES.includes(c2)) {
      coupons.push({ type: 'codigo', code: c2, couponLabel: null, redemptionUrl, confidence: 0.8, confidenceLevel: 'medium', source: 'contextual' });
    }
  }

  // Extração Monetária (R$ 20 OFF)
  const monetaryPattern = /((?:R\$\s?\d+|(?:\d+)\s?%)\s?OFF(?:[^\n|]*))/gi;
  let monMatch;
  while ((monMatch = monetaryPattern.exec(normalizedText)) !== null) {
    const rawLabel = monMatch[1].trim();
    // formatDiscountLabel expects rawLabel but we can just use simple formatting for now to not break test
    // We will use formatDiscountLabel from coupon-extractor since it's already there
    const formatted = formatDiscountLabel(rawLabel);
    
    // Tentar achar o redemptionUrl mais próximo (voucher role)
    const nearestVoucher = parsedLinks.find(l => l.role === 'voucher');
    
    coupons.push({
      type: 'monetary_discount',
      code: null,
      couponLabel: formatted,
      redemptionUrl: nearestVoucher ? nearestVoucher.url : null,
      confidence: nearestVoucher ? 0.95 : 0.85,
      confidenceLevel: nearestVoucher ? 'high' : 'medium',
      source: 'nearby_discount'
    });
  }

  // Deduplicação final por código ou url
  const uniqueCoupons: ShopeeParsedCoupon[] = [];
  const seenCodes = new Set<string>();
  const seenUrls = new Set<string>();

  for (const c of coupons.sort((a, b) => b.confidence - a.confidence)) {
    if (c.code) {
      if (seenCodes.has(c.code)) continue;
      seenCodes.add(c.code);
    } else if (c.redemptionUrl) {
      if (seenUrls.has(c.redemptionUrl)) continue;
      seenUrls.add(c.redemptionUrl);
    }
    uniqueCoupons.push(c);
  }

  return {
    normalizedText,
    prices,
    links: parsedLinks,
    coupons: uniqueCoupons,
    hasExplicitCouponSignal
  };
}
