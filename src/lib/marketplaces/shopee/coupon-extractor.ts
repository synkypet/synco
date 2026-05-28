
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
 * Normaliza o texto removendo caracteres invisíveis, convertendo espaços especiais para normal,
 * e padronizando dois-pontos. Essencial para extrair cupons sujos de mensagens de WhatsApp.
 */
export function normalizeCouponText(input: string): string {
  return String(input ?? '')
    .normalize('NFKC')
    .replace(/[\u200B-\u200D\uFEFF]/g, '') // zero-width
    .replace(/\u00A0/g, ' ')              // NBSP
    .replace(/[\u1680\u180E\u2000-\u200A\u202F\u205F\u3000]/g, ' ') // outros espaços unicode
    .replace(/[ \t]+/g, ' ')              // colapsar espaços
    .replace(/[：]/g, ':')               // dois pontos fullwidth
    .trim();
}

/**
 * Remove pontuação final comum de uma URL.
 */
export function sanitizeUrl(url: string): string {
  return url.replace(/[.,\)!\]\}!]+$/, '');
}

/**
 * Verifica se uma URL da Shopee é um link de afiliado gerado pelo SYNCO ou oficial.
 */
export function isShopeeAffiliateUrl(url: string): boolean {
  if (!url) return false;
  const lower = url.toLowerCase();
  
  // Links curtos comuns de afiliados
  if (lower.includes('s.shopee.com.br') || lower.includes('shope.ee') || lower.includes('br.shp.ee')) {
    // Verificamos se tem parâmetros de tracking comuns de afiliados
    // Mas links curtos da Shopee quase sempre são afiliados se forem gerados para redirecionamento.
    return true;
  }
  
  // Links longos com utm_medium=affiliates ou mmp_pid
  if (lower.includes('utm_medium=affiliates') || lower.includes('mmp_pid=') || lower.includes('uls_trackid=')) {
    return true;
  }

  return false;
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

const BLACKLISTED_CODES = [
  'SHOPEE', 'CUPOM', 'CODIGO', 'OFF', 'PIX', 'FRETE', 'GRATIS', 'LINK', 
  'RESGATE', 'PROMO', 'TUDO', 'LOJAS', 'CONFIRA', 'APROVEITE', 'CLIQUE', 
  'AQUI', 'SITE', 'APP', 'VÁLIDO', 'VALIDO', 'GANHE', 'VOLTOU', 'TOP',
  'LIBERADO', 'DISPONIVEL', 'OFERTA', 'DESCONTO', 'ESPECIAL',
  'MASSAGEADOR', 'SILICONE', 'COOKTOP', 'BOLSA', 'PERFUME', 'PANINI', 
  'INFANTIL', 'FEMININA', 'MASCULINO', 'OFICIAL', 'KIT', 'JOGO', 
  'CONJUNTO', 'UNIDADES', 'PEÇAS', 'PECAS', 'ESCOVA', 'TENIS', 'TÊNIS'
];

/**
 * Limpa e formata labels de desconto.
 * Ex: "R$15 OFF em compras a partir de R$65" -> "💸 *R$15 OFF* em compras a partir de *R$65*"
 */
export function formatDiscountLabel(label: string): string {
  if (!label) return '';
  
  let formatted = label
    .replace(/[\u{1F300}-\u{1F9FF}]|[\u{2700}-\u{27BF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]|[\u{2600}-\u{26FF}]|[\u{1F1E6}-\u{1F1FF}]/gu, '') // Remove emojis
    .replace(/\*/g, '') // Remove asteriscos existentes para evitar duplicação
    .replace(/\s+/g, ' ')
    .trim();

  // Negritar valores monetários e porcentagens
  formatted = formatted.replace(/(R\$\s?\d+(?:[.,]\d+)?|(?:\d+)\s?%)\s?OFF/gi, '*$1 OFF*');
  
  // Negritar "a partir de R$ XX" ou "acima de R$ XX"
  formatted = formatted.replace(/(a partir de|acima de)\s?(R\$\s?\d+(?:[.,]\d+)?)/gi, '$1 *$2*');

  return formatted;
}

import { parseShopeeOfferContext } from './offer-parser';

/**
 * Motor de extração de cupons Shopee (Redirecionado para offer-parser.ts Fase 2)
 */
export function extractShopeeCoupons(rawText: string): ShopeeCoupon[] {
  const context = parseShopeeOfferContext(rawText);
  const coupons: ShopeeCoupon[] = context.coupons.map(c => ({
    marketplace: 'shopee',
    type: c.type as ShopeeCouponType,
    code: c.code || null,
    couponLabel: c.couponLabel || null,
    redemptionUrl: c.redemptionUrl || null,
    confidence: c.confidence,
    confidenceLevel: c.confidenceLevel,
    source: c.source as any,
    status: 'candidate',
    dedupeKey: generateDedupeKey(c as any)
  }));
  
  const uniqueCoupons = Array.from(new Map(coupons.map(c => [c.dedupeKey, c])).values());
  const detectedCount = uniqueCoupons.length;
  const codes = uniqueCoupons.map(c => c.code || 'monetary_or_link').join(',');
  
  // Debug log solicitado para acompanhar em produção
  console.log(`[SHOPEE-COUPON-EXTRACTOR] detected_count=${detectedCount} codes=${codes}`);
  
  return uniqueCoupons;
}

/**
 * Normaliza um cupom vindo do banco para o formato de mensagem,
 * corrigindo labels sujos e extraindo códigos que possam estar vazando no label.
 */
export function normalizeShopeeCouponForMessage(coupon: any): { 
  code: string | null; 
  discountLine: string;
  effectiveLink: string;
} {
  let code = (coupon.code || '').trim();
  let rawLabel = (coupon.coupon_label || coupon.label || '').trim();
  
  // 1. Tentar extrair código do label se o campo code estiver vazio
  if (!code && rawLabel) {
    // Procura por códigos no início do label ou isolados
    const standalonePattern = /(?:⚡|🔥|🎟️)?\s*\*?([A-Z0-9]{5,20})\*?/i;
    const match = rawLabel.match(standalonePattern);
    if (match) {
      const extracted = match[1].toUpperCase();
      if (!BLACKLISTED_CODES.includes(extracted) && !/^\d+$/.test(extracted) && !extracted.includes('OFF')) {
        code = extracted;
      }
    }
  }

  // 2. Limpar o label de desconto
  // Remover o código do label se ele estiver lá
  if (code && rawLabel.includes(code)) {
    rawLabel = rawLabel.replace(code, '').replace(/^\s*\*|\*\s*$/g, '').trim();
  }

  // Remover lixo comum: 👇, emojis de urgência, avisos de disponibilidade, links
  const urlRegex = /https?:\/\/(?:[a-zA-Z0-9-]+\.)?(?:shopee\.com\.br|shp\.ee|shope\.ee)[^\s]*/gi;
  
  let discountLine = rawLabel
    .replace(urlRegex, '') // Remove links do label
    .replace(/👇/g, '')
    .replace(/⚡|🔥|🎟️|✨|💥|⚠️|💸/g, '')
    .replace(/Corre porque esse cupom acaba rápido!/gi, '')
    .replace(/Cupom sujeito à disponibilidade.*/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  // Aplicar formatação de negrito
  discountLine = formatDiscountLabel(discountLine);
  
  if (discountLine) {
    // Garantir que começa com exatamente um emoji de dinheiro
    discountLine = `💸 ${discountLine}`;
  }

  return {
    code: code || null,
    discountLine,
    effectiveLink: coupon.redemption_url || coupon.redemptionUrl || ''
  };
}

