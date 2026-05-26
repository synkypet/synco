
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

/**
 * Motor de extração de cupons Shopee.
 */
export function extractShopeeCoupons(rawText: string): ShopeeCoupon[] {
  const coupons: ShopeeCoupon[] = [];
  const lines = rawText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  
  // 1. Identificar URLs Shopee no texto
  const urlRegex = /https?:\/\/(?:[a-zA-Z0-9-]+\.)?(?:shopee\.com\.br|shp\.ee|shope\.ee|s\.shopee\.com\.br|br\.shp\.ee)[^\s]*/gi;
  const foundUrls = (rawText.match(urlRegex) || []).map(sanitizeUrl).filter(url => {
    try {
      const hostname = new URL(url).hostname.toLowerCase();
      return SHOPEE_DOMAINS.some(domain => hostname === domain || hostname.endsWith('.' + domain));
    } catch {
      return false;
    }
  });

  // Helper para verificar se uma URL é claramente um produto (sem resolver)
  const isLikelyProductUrl = (url: string) => {
    const lower = url.toLowerCase();
    // Padrões comuns de produto: -i.shop.item ou /product/shop/item ou /slug-i.shop.item
    return lower.includes('-i.') || lower.includes('/product/') || /\/\d+\/\d+/.test(lower);
  };

  // 2. Extração de Código (Estratégia A: Com Prefixos)
  const explicitCodePatterns = /(?:use\s+o\s+)?(?:cupom|código|codigo):\s*([A-Z0-9]{8,20})(?!\w)/gi;
  let match;
  while ((match = explicitCodePatterns.exec(rawText)) !== null) {
    const code = match[1].toUpperCase();
    if (BLACKLISTED_CODES.includes(code)) continue;

    const currentPos = match.index;
    const remainingText = rawText.substring(currentPos);
    const nearUrlMatch = remainingText.match(urlRegex);
    const url = nearUrlMatch ? sanitizeUrl(nearUrlMatch[0]) : (foundUrls.length > 0 ? foundUrls[foundUrls.length - 1] : null);

    coupons.push({
      marketplace: 'shopee',
      type: 'codigo',
      code: code,
      couponLabel: null,
      redemptionUrl: url,
      confidence: 0.98, // Aumentado por ser explícito
      status: 'candidate',
      dedupeKey: generateDedupeKey({ type: 'codigo', code })
    });
  }

  // 3. Extração de Código (Estratégia B: Primeira Linha ou Linhas com Símbolos)
  if (coupons.length === 0) {
    for (let i = 0; i < Math.min(lines.length, 3); i++) {
      let line = lines[i];
      const lineUrlRegex = /https?:\/\/[^\s]+/gi;
      line = line.replace(lineUrlRegex, '').trim();
      
      const standalonePattern = /(?:⚡|🔥|🎟️)?\s*(?<!\w)([A-Z0-9]{8,15})(?!\w)/i;
      const isolatedMatch = line.match(standalonePattern);
        
        if (isolatedMatch) {
          const code = isolatedMatch[1].toUpperCase();
          // Heurística extra: Para estratégia B (sem prefixo), exigimos que o código contenha pelo menos um número
          // ou seja explicitamente não uma palavra comum de produto para evitar falsos positivos como "MASSAGEADOR"
          const hasNumber = /\d/.test(code);
          const isGeneric = BLACKLISTED_CODES.includes(code);
          
          if (!isGeneric && !/^\d+$/.test(code) && !code.includes('OFF') && !code.includes('HTTP') && hasNumber) {
            const currentPos = line.indexOf(isolatedMatch[0]);
            const remainingText = line.substring(currentPos);
            const nearUrlMatch = remainingText.match(urlRegex);
            const url = nearUrlMatch ? sanitizeUrl(nearUrlMatch[0]) : (foundUrls.length > 0 ? foundUrls[foundUrls.length - 1] : null);

            coupons.push({
              marketplace: 'shopee',
              type: 'codigo',
              code: code,
              couponLabel: null,
              redemptionUrl: url,
              confidence: 0.85,
              status: 'candidate',
              dedupeKey: generateDedupeKey({ type: 'codigo', code })
            });
            break;
          }
        }
      }
    }

  // 4. Extração de Desconto + Link
  const discountLinePattern = /((?:R\$\s?\d+|(?:\d+)\s?%)\s?OFF(?:[^\n|]*))/gi;
  while ((match = discountLinePattern.exec(rawText)) !== null) {
    const rawLabel = match[1].trim();
    const formattedLabel = formatDiscountLabel(rawLabel);
    
    const currentPos = match.index;
    const remainingText = rawText.substring(currentPos);
    const nearUrlMatch = remainingText.match(urlRegex);
    const url = nearUrlMatch ? sanitizeUrl(nearUrlMatch[0]) : (foundUrls.length > 0 ? foundUrls[0] : null);

    if (url && SHOPEE_DOMAINS.some(domain => url.includes(domain))) {
      // Se a URL for claramente um produto e não houver palavra "cupom" próxima, ignoramos ou baixamos confiança
      const isProduct = isLikelyProductUrl(url);
      const hasCouponWord = rawText.toLowerCase().includes('cupom') || rawText.toLowerCase().includes('voucher');
      
      if (isProduct && !hasCouponWord) {
        console.log(`[EXTRACTOR] Ignorando provável link de produto disfarçado de cupom: ${url}`);
        continue; 
      }

      const existingCodeCoupon = coupons.find(c => c.type === 'codigo');
      if (existingCodeCoupon && !existingCodeCoupon.couponLabel) {
        existingCodeCoupon.couponLabel = formattedLabel;
        existingCodeCoupon.redemptionUrl = url;
        continue;
      }

      if (coupons.some(c => c.redemptionUrl === url)) continue;

      coupons.push({
        marketplace: 'shopee',
        type: 'link_resgate',
        code: null,
        couponLabel: formattedLabel,
        redemptionUrl: url,
        confidence: isProduct ? 0.40 : 0.85, // Confiança baixa se for produto
        status: 'candidate',
        dedupeKey: generateDedupeKey({ type: 'link_resgate', redemptionUrl: url })
      });
    }
  }

  // 5. Página Central de Cupons (Fallback)
  if (coupons.length === 0) {
    const centralKeywords = ['cupom de desconto shopee', 'resgate os cupons', 'confira os cupons', 'meus cupons', 'carteira de cupons'];
    const lowerText = rawText.toLowerCase();
    
    for (const url of foundUrls) {
      const lowerUrl = url.toLowerCase();
      const isCentral = centralKeywords.some(k => lowerText.includes(k)) || 
                        lowerUrl.includes('/m/cupom-de-desconto') ||
                        lowerUrl.includes('/voucher-wallet') ||
                        lowerUrl.includes('/user/voucher');
      
      if (isCentral) {
        coupons.push({
          marketplace: 'shopee',
          type: 'pagina_cupons',
          code: null,
          couponLabel: 'Cupom de Desconto Shopee',
          redemptionUrl: url,
          confidence: 0.90,
          status: 'candidate',
          dedupeKey: generateDedupeKey({ type: 'pagina_cupons', redemptionUrl: url })
        });
      }
    }
  }

  return Array.from(new Map(coupons.map(c => [c.dedupeKey, c])).values());
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
    const standalonePattern = /(?:⚡|🔥|🎟️)?\s*\*?([A-Z0-9]{8,15})\*?/i;
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

