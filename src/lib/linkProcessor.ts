// src/lib/linkProcessor.ts
// Processador de links real — usa adaptadores de marketplace em vez de mocks.

import { MarketplaceAdapter, AffiliateResult } from './marketplaces/BaseAdapter';
import { ShopeeAdapter } from './marketplaces/ShopeeAdapter';
import { refineOfferCopy } from './ai/refiner';
import { templateService } from '@/services/supabase/template-service';
import { SupabaseClient } from '@supabase/supabase-js';
import { extractShopeeCoupons } from './marketplaces/shopee/coupon-extractor';
import { ShopeeCoupon } from '@/types/shopee-coupon';
import { formatShopeeCouponMessage } from './marketplaces/shopee/coupon-formatter';

export type Marketplace = 'Shopee' | 'Amazon' | 'Mercado Livre' | 'Magalu' | 'Unknown';

export type OfferType = 'product_offer' | 'coupon_offer' | 'product_with_coupon' | 'promo_landing';

export interface Eligibility {
  isEligible: boolean;
  status: 'eligible' | 'warning' | 'ineligible';
  reasons: string[];
  offer_type: OfferType;
}

export interface FactualData {
  originalUrl: string;
  cleanUrl: string;
  marketplace: Marketplace;
  itemId?: string | number;
  shopId?: string | number;
  shopName?: string;
  title: string;
  image?: string | null;
  installments?: string | null;
  
  // Preços Factuais (API)
  price?: number | null; 
  priceFormatted?: string | null;
  originalPrice?: number | null;
  originalPriceFormatted?: string | null;
  currentPriceFactual?: number;
  currentPriceSource?: string;
  
  // Comissões Factuais (API)
  commissionValueFactual?: number;
  commissionSource?: string;
  commissionValueFormatted?: string | null;
  commissionRate?: number | null;
  commissionRatePercent?: string | null;
  
  // Estimativas (Opcionais)
  estimatedPixPrice?: number | null;
  estimatedPixPriceFormatted?: string | null;
  estimatedPixSource?: string | null;
  pixDisplayEligible: boolean;

  affiliateLink?: string | null;
  shortLink?: string | null;
  productLink?: string | null;
  offerLink?: string | null;
  finalLinkToSend: string;
  fetchedAt: string;

  // ─── Rastreabilidade e Reafiliação (Fase 1) ──────────────────────────────
  incoming_url: string;
  resolved_url?: string;
  canonical_url: string;
  generated_affiliate_url?: string;
  redirect_chain?: string[];
  reaffiliation_status: string;
  reaffiliation_error?: string;

  // Elegibilidade Operacional
  eligibility: Eligibility;

  // Metadados de Cupom (Fase 2B)
  coupons?: ShopeeCoupon[];

  // Metadados de Landing Page (Fase 2F)
  landing_type?: 'super_ofertas' | string | null;

  // Fonte de Texto Original (Fase 2H.1B)
  source_text?: string;

  // Extra (Fase 2H.1B)
  extraCouponLink?: string;
}

export interface GeneratedCopy {
  messageText: string;
  toneUsed: string;
  generatedAt: string;
}

export interface ProductSnapshot {
  id: string; // ID operacional do SYNCO
  factual: FactualData;
  copy: GeneratedCopy;
  metadata: {
    source: 'api' | 'fallback';
    isFrozen: boolean;
  };
}

// ─── Registry de Adapters ──────────────────────────────────────────────────
const adapters: MarketplaceAdapter[] = [
  new ShopeeAdapter(),
];

/**
 * Detecta o marketplace de uma URL.
 */
export function detectMarketplace(url: string): Marketplace {
  // 0. Extrair URL se houver texto ao redor
  const urlMatch = url.match(/https?:\/\/[^\s]+/);
  const target = urlMatch ? urlMatch[0] : url;

  try {
    const hostname = new URL(target).hostname.toLowerCase();
    
    if (hostname === 's.shopee.com.br' || hostname === 'shopee.com.br' || hostname.endsWith('.shopee.com.br')) return 'Shopee';
    if (hostname === 'shope.ee' || hostname.endsWith('.shope.ee')) return 'Shopee';
    if (hostname === 'br.shp.ee' || hostname.endsWith('.br.shp.ee')) return 'Shopee';
    
    if (hostname === 'amazon.com.br' || hostname.endsWith('.amazon.com.br')) return 'Amazon';
    if (hostname === 'mercadolivre.com.br' || hostname.endsWith('.mercadolivre.com.br')) return 'Mercado Livre';
    if (hostname === 'magazineluiza.com.br' || hostname.endsWith('.magazineluiza.com.br') || hostname === 'magalu.com' || hostname.endsWith('.magalu.com')) return 'Magalu';
  } catch {
    // Fallback para URLs malformadas ou sem protocolo
    const lower = target.toLowerCase();
    if (lower.includes('shopee.com.br') || lower.includes('shope.ee') || lower.includes('br.shp.ee')) return 'Shopee';
  }
  return 'Unknown';
}

function findAdapter(url: string): MarketplaceAdapter | null {
  const urlMatch = url.match(/https?:\/\/[^\s]+/);
  const target = urlMatch ? urlMatch[0] : url;
  return adapters.find(adapter => adapter.canHandle(target)) || null;
}

/**
 * Classifica a oferta com base em heurísticas de texto e links.
 */
export function classifyOffer(text: string, factual: Partial<FactualData>): { type: OfferType; reasons: string[]; coupons?: ShopeeCoupon[] } {
  const content = (text + ' ' + (factual.title || '')).toLowerCase();
  const reasons: string[] = [];

  // 1. Uso do novo extrator Shopee (Fase 2B)
  // Analisamos o texto original E a URL canônica (caso já tenha sido resolvida)
  const shopeeCoupons = extractShopeeCoupons(text);
  
  // Refinamento: Se não extraiu do texto mas a URL canônica é claramente um cupom/promo
  if (shopeeCoupons.length === 0 && factual.canonical_url && factual.canonical_url.startsWith('http')) {
    const lowerUrl = factual.canonical_url.toLowerCase();
    const isCentral = lowerUrl.includes('/m/cupom-de-desconto') || lowerUrl.includes('cupom');
    
    if (isCentral) {
      shopeeCoupons.push({
        marketplace: 'shopee',
        type: 'pagina_cupons',
        code: null,
        couponLabel: 'Cupom de Desconto Shopee',
        redemptionUrl: factual.canonical_url,
        confidence: 0.80,
        status: 'candidate',
        dedupeKey: `shopee:coupon:url:${factual.canonical_url}`
      });
    }
  }

  if (shopeeCoupons.length > 0) {
    const isCurrentLinkARedemptionUrl = shopeeCoupons.some(c => c.redemptionUrl && (factual.originalUrl === c.redemptionUrl || factual.originalUrl?.includes(c.redemptionUrl) || factual.canonical_url === c.redemptionUrl));
    const hasProductData = !!(factual.title && factual.price && factual.price > 0 && !factual.title.toLowerCase().includes('sem título') && !factual.title.toLowerCase().includes('produto shopee'));

    let type: OfferType = 'product_offer';
    
    // Ajustar título factual para cupons (evitar slugs técnicos em logs/preview)
    const isLanding = shopeeCoupons.some(c => c.type === 'pagina_cupons');
    if (isLanding && (!factual.title || factual.title.includes('M/') || factual.title.includes('Produto Shopee'))) {
      factual.title = 'Cupons Shopee Liberados';
    } else if (shopeeCoupons.some(c => c.type === 'codigo') && !hasProductData) {
      factual.title = `Cupom: ${shopeeCoupons.find(c => c.type === 'codigo')?.code}`;
    }

    if (isCurrentLinkARedemptionUrl) {
      type = hasProductData ? 'product_with_coupon' : 'coupon_offer';
      reasons.push(`Link atual identificado como resgate de cupom`);
    } else if (shopeeCoupons.some(c => c.type === 'codigo')) {
      type = hasProductData ? 'product_with_coupon' : 'coupon_offer';
      reasons.push(`Código de cupom detectado no texto da mensagem`);
    } else {
      // Se detectou qualquer cupom e não é um produto forte, tratamos como oferta de cupom
      type = hasProductData ? 'product_with_coupon' : 'coupon_offer';
      reasons.push(`Cupom detectado no conteúdo`);
    }

    return { type, reasons, coupons: shopeeCoupons };
  }

  // 1.1 Detecção de Landing Pages (Fase 2F.1)
  if (factual.canonical_url && factual.canonical_url.startsWith('http')) {
    const lowerUrl = factual.canonical_url.toLowerCase();
    
    if (lowerUrl.includes('/m/super-ofertas')) {
      factual.title = 'Acesso VIP Shopee: Super Ofertas';
      factual.landing_type = 'super_ofertas';
      return { 
        type: 'promo_landing', 
        reasons: ['Landing page de Super Ofertas Shopee detectada'] 
      };
    }
  }

  // 2. Heurísticas Legadas (Fallback/Outros Marketplaces)
  const couponKeywords = ['cupom', 'off', 'resgate', 'copie e cole', 'link carrinho', 'mínimo', '🎟', 'voucher'];
  const hasCouponKeywords = couponKeywords.some(k => content.includes(k));
  
  const isWeakProduct = !factual.title || factual.title.includes('sem título') || !factual.price || factual.price <= 0;

  if (hasCouponKeywords && isWeakProduct) {
    return { type: 'coupon_offer', reasons: ['Oferta de cupom detectada (fallback)'] };
  }

  const mixedKeywords = ['com cupom', 'aplique o cupom', 'resgate aqui', 'usar cupom', 'preço com cupom'];
  const hasMixedKeywords = mixedKeywords.some(k => content.includes(k));
  
  if (hasMixedKeywords && !isWeakProduct) {
    return { type: 'product_with_coupon', reasons: ['Oferta de produto com cupom detectada (fallback)'] };
  }

  return { type: 'product_offer', reasons: [] };
}

/**
 * Valida a elegibilidade operacional de uma oferta com base em regras críticas.
 */
export function validateEligibility(factual: FactualData, offerType: OfferType = 'product_offer'): Eligibility {
  const reasons: string[] = [];
  let status: 'eligible' | 'warning' | 'ineligible' = 'eligible';

  // ─── EVOLUÇÃO: CUPONS (FASE 2B) ───
  if (offerType !== 'product_offer' && offerType !== 'promo_landing') {
    reasons.push(`Oferta de ${offerType === 'coupon_offer' ? 'cupom' : 'produto com cupom'} identificada como candidato (Aguardando Fase 2C)`);
    status = 'warning'; // Em vez de ineligible, marcamos como warning para passar no fluxo
  }

  if (offerType === 'promo_landing') {
    reasons.push('Página promocional Shopee detectada (Aguardando Fase 2F.1B para envio)');
    status = 'warning';
  }

  // 1. Erros Críticos de Afiliação
  if (factual.reaffiliation_status === 'blocked') {
    reasons.push('Afiliação Bloqueada: Item proibido ou erro de conta');
    status = 'ineligible';
  } else if (factual.reaffiliation_status === 'failed') {
    reasons.push(`Falha de Afiliação: ${factual.reaffiliation_error || 'Erro desconhecido'}`);
    status = 'ineligible';
  }

  // 2. Metadados Essenciais (Regra SYNCO: Sem Título, Sem Preço ou Sem Imagem = Quebrado para produtos)
  if (offerType === 'product_offer') {
    if (!factual.title || factual.title === 'Produto sem título' || factual.title === 'PRODUTO BLOQUEADO') {
      reasons.push('Título ausente ou inválido');
      status = 'ineligible';
    }

    if (!factual.price || factual.price <= 0) {
      reasons.push('Preço factual indisponível ou inválido');
      status = 'ineligible';
    }
  }

  if (!factual.image && offerType === 'product_offer') {
    reasons.push('Imagem ausente (obrigatória no SYNCO para produtos)');
    status = 'ineligible';
  }

  // 3. Avisos (Warnings)
  if (status === 'eligible') {
     if (!factual.commissionValueFactual || factual.commissionValueFactual <= 0) {
       reasons.push('Comissão não detectada');
       status = 'warning';
     }
  }

  return {
    isEligible: status !== 'ineligible',
    status,
    reasons,
    offer_type: offerType
  };
}

import { formatShopeeProductMessage } from './marketplaces/shopee/product-message-formatter';

/**
 * Construtor central de mensagens baseadas no snapshot factual.
 * INTEGRAÇÃO FASE 2H.1A: Usa o motor de confiança Shopee.
 */
export function buildMessageFromSnapshot(factual: FactualData): string {
  if (factual.marketplace === 'Shopee') {
    return formatShopeeProductMessage(factual, factual.source_text || factual.incoming_url);
  }

  // Fallback para outros marketplaces (Amazon, ML, etc - a implementar conforme Fase 3)
  const title = factual.title;
  const emoji = '🛍️';
  const priceCurrentFormatted = factual.priceFormatted;
  const priceOriginalFormatted = factual.originalPriceFormatted;
  const showOriginal = !!(factual.originalPrice && priceOriginalFormatted && factual.price && factual.originalPrice > factual.price);

  let priceLines = '';
  if (showOriginal) {
    priceLines += `~De: ${priceOriginalFormatted}~\n`;
  }
  if (priceCurrentFormatted) {
    priceLines += `🔥 Por: ${priceCurrentFormatted}`;
  } else {
    priceLines += `🔥 Por: Preço sob consulta`;
  }

  return [
    `${emoji} ${title}`,
    '',
    priceLines,
    '',
    '📦 Compre aqui:',
    factual.finalLinkToSend,
    '',
    '⚠️ Promoção sujeita a alteração a qualquer momento.'
  ].join('\n').trim();
}

/**
 * Agregador que transforma metadados brutos em um Snapshot Confiável.
 */
export function buildProductSnapshot(opts: {
  id: string;
  originalUrl: string;
  metadata: any;
  affiliateUrl: string;
  tone: string;
  templatedMessage?: string;
  sourceText?: string;
  reaffiliation?: {
    incoming_url: string;
    resolved_url?: string;
    canonical_url: string;
    generated_affiliate_url?: string;
    redirect_chain?: string[];
    reaffiliation_status: string;
    reaffiliation_error?: string;
  }
}): ProductSnapshot {
  const { id, originalUrl, metadata, affiliateUrl, tone, reaffiliation, sourceText } = opts;
  
  const price = metadata.currentPriceFactual || metadata.currentPrice || null;
  const originalPrice = metadata.originalPrice || null;
  const commissionValue = metadata.commissionValueFactual || metadata.commissionValue || null;
  const estimatedPix = metadata.estimatedPixPrice || null;
  const commissionRate = typeof metadata.commissionRate === 'number' ? metadata.commissionRate : null;
  
  const formatBRL = (val: number | null) => val !== null ? `R$ ${val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : null;

  const factual: FactualData = {
    originalUrl,
    cleanUrl: metadata.productLink || originalUrl,
    marketplace: metadata.marketplace || 'Unknown',
    itemId: metadata.itemId,
    shopId: metadata.shopId,
    shopName: metadata.shopName,
    title: metadata.name || (reaffiliation?.reaffiliation_status === 'blocked' || reaffiliation?.reaffiliation_status === 'failed' ? 'PRODUTO BLOQUEADO' : 'Produto sem título'),
    image: metadata.imageUrl || null,
    installments: metadata.installments || null,
    
    // Auditoria Factual (Pro)
    price,
    priceFormatted: formatBRL(price),
    originalPrice,
    originalPriceFormatted: formatBRL(originalPrice),
    currentPriceFactual: metadata.currentPriceFactual,
    currentPriceSource: metadata.currentPriceSource,
    
    commissionValueFactual: metadata.commissionValueFactual,
    commissionSource: metadata.commissionSource,
    commissionValueFormatted: formatBRL(commissionValue),
    
    // Estimativa
    estimatedPixPrice: estimatedPix,
    estimatedPixPriceFormatted: formatBRL(estimatedPix),
    estimatedPixSource: metadata.estimatedPixSource,
    pixDisplayEligible: !!estimatedPix && !!metadata.estimatedPixSource && metadata.estimatedPixSource.startsWith('api'),

    commissionRate,
    commissionRatePercent: commissionRate !== null ? `${(commissionRate * 100).toFixed(2)}%` : null,
    affiliateLink: reaffiliation?.generated_affiliate_url || affiliateUrl,
    shortLink: (reaffiliation?.generated_affiliate_url || affiliateUrl).includes('s.shopee') || (reaffiliation?.generated_affiliate_url || affiliateUrl).includes('shope.ee') ? (reaffiliation?.generated_affiliate_url || affiliateUrl) : null,
    productLink: metadata.productLink || null,
    offerLink: metadata.offerLink || null,
    finalLinkToSend: reaffiliation?.generated_affiliate_url || affiliateUrl,
    fetchedAt: metadata.fetchedAt || new Date().toISOString(),

    // Rastreabilidade (Fase 1)
    incoming_url: reaffiliation?.incoming_url || originalUrl,
    resolved_url: reaffiliation?.resolved_url,
    canonical_url: reaffiliation?.canonical_url || originalUrl,
    generated_affiliate_url: reaffiliation?.generated_affiliate_url,
    redirect_chain: reaffiliation?.redirect_chain || [],
    reaffiliation_status: reaffiliation?.reaffiliation_status || 'not_needed',
    reaffiliation_error: reaffiliation?.reaffiliation_error,

    // Inicializar temporário para permitir validação
    eligibility: { isEligible: true, status: 'eligible', reasons: [], offer_type: 'product_offer' },
    
    // Metadados de Cupom (Fase 2B)
    coupons: metadata.coupons || [],

    // Fonte de Texto Original (Fase 2H.1B)
    source_text: sourceText,
    extraCouponLink: metadata.extraCouponLink
  };

  // 2. Classificar Oferta (Heurísticas)
  const classification = classifyOffer(originalUrl, factual);
  
  if (classification.coupons && classification.coupons.length > 0) {
    factual.coupons = classification.coupons;
  }
 
  // 3. Aplicar Validação Real
  factual.eligibility = validateEligibility(factual, classification.type);

  // 4. Gerar Texto da Mensagem (Determinístico ou Templated)
  let messageText = opts.templatedMessage || buildMessageFromSnapshot(factual);
  
  // Refinamento: Se for oferta de cupom Shopee, usar formatador especializado
  // FASE 2E.1A: Forçamos o uso do formatador especializado para cupons, ignorando templates de DB que possam estar desatualizados
  if (classification.type === 'coupon_offer' && factual.coupons && factual.coupons.length > 0) {
    const bestCoupon = factual.coupons.find(c => c.redemptionUrl && originalUrl.includes(c.redemptionUrl)) || factual.coupons[0];
    const couponToFormat = {
      ...bestCoupon,
      redemptionUrl: factual.finalLinkToSend // Usar o link (re)afiliado se existir
    };
    messageText = formatShopeeCouponMessage(couponToFormat);
  } else if (classification.type === 'promo_landing') {
    // FASE 2F.1: Formatação especializada para landing pages
    const pseudoCoupon: ShopeeCoupon = {
      marketplace: 'shopee',
      type: 'pagina_cupons', // Reusar o motor se possível ou estender
      code: null,
      couponLabel: factual.landing_type === 'super_ofertas' ? 'SUPER_OFERTAS' : 'Página Promocional',
      redemptionUrl: factual.finalLinkToSend,
      confidence: 1.0,
      status: 'valid',
      dedupeKey: `shopee:landing:${factual.landing_type}:${factual.finalLinkToSend}`
    };
    messageText = formatShopeeCouponMessage(pseudoCoupon);
  }

  return {
    id,
    factual,
    copy: {
      messageText,
      toneUsed: opts.templatedMessage ? 'templated' : 'deterministic',
      generatedAt: new Date().toISOString()
    },
    metadata: {
      source: (metadata.metadata_failed || factual.reaffiliation_status === 'blocked') ? 'fallback' : 'api',
      isFrozen: true
    }
  };
}

/**
 * Processa uma lista de links usando os adapters reais.
 */
export async function processLinks(
  links: string[], 
  userConnections: any[] = [], 
  tone: string = 'auto',
  userId?: string,
  supabase?: SupabaseClient,
  sourceText?: string
): Promise<ProductSnapshot[]> {
  const validLinks = links.filter(link => link.trim().length > 0);
  const results: ProductSnapshot[] = [];

  for (const link of validLinks) {
    const id = `proc_${Date.now()}_${results.length}`;
    
    // Extração de URL para processamento (suporta texto com link)
    const urlMatch = link.match(/https?:\/\/[^\s]+/);
    const targetUrl = urlMatch ? urlMatch[0] : link;

    const marketplace = detectMarketplace(targetUrl);
    const adapter = findAdapter(targetUrl);
    
    let metadata = null;
    let preResult = null;
    let connection = null;

    try {
      if (adapter) {
        // Encontrar conexão do usuário para este marketplace
        const dbMarketplaceName = marketplace.toLowerCase().trim();
        connection = userConnections.find(c => {
          const connName = (c.marketplace_name || "").toLowerCase().trim();
          return connName === dbMarketplaceName || connName.includes(dbMarketplaceName);
        });

        // A. Pré-processamento (Fase 1: Reafiliação)
        preResult = await adapter.preProcessIncomingLink(targetUrl, connection);
        
        // B. Enrichment (Metadata) - Somente se não estiver bloqueado/falhado
        const canEnrich = preResult.reaffiliation_status !== 'blocked' && preResult.reaffiliation_status !== 'failed';
        if (canEnrich) {
            const finalTargetUrl = preResult.canonical_url || targetUrl;
            metadata = await adapter.fetchMetadata(finalTargetUrl, connection);
            
            // C. Validação de Metadados (Metadata Guardrail)
            // Somente falha se NÃO for um cupom identificado (pelo texto ou pela URL canônica)
            const isCoupon = (extractShopeeCoupons(link).length > 0) || 
                             (preResult.canonical_url?.toLowerCase().includes('/m/')) ||
                             (preResult.canonical_url?.toLowerCase().includes('cupom'));

            if (metadata?.metadata_failed && !isCoupon) {
                console.warn(`[LINK-PROCESSOR] Meta Guardrail: Falha de qualidade para ${targetUrl}: ${metadata.metadata_error}`);
                preResult.reaffiliation_status = 'failed';
                preResult.reaffiliation_error = metadata.metadata_error || 'Metadados insuficientes';
            }
        }
      }

      // 2. Construção do Snapshot inicial (Factual/Deterministico)
      const price = metadata?.currentPriceFactual || metadata?.currentPrice || null;
      const formatBRL = (val: number | null) => val !== null ? `R$ ${val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : null;
      
      const factualForClassification: any = {
        title: metadata?.name || 'Produto sem título',
        price: price
      };

      const classification = classifyOffer(link, factualForClassification);
      
      // 1.5. Resolve Template (Randomized)
      let templatedMessage = undefined;
      if (supabase && metadata) {
        const category = classification.type === 'coupon_offer' 
          ? 'coupon' 
          : classification.type === 'product_with_coupon' || classification.type === 'product_offer'
            ? 'product'
            : 'campaign';

        const originalPriceVal = metadata.originalPrice || null;
        const currentPriceVal = price;
        
        let filterName = undefined;
        if (category === 'product') {
          const hasDiscount = originalPriceVal && currentPriceVal && originalPriceVal > currentPriceVal;
          filterName = hasDiscount ? 'Produto com Desconto' : 'Produto Simples';
        }

        const variables = {
          titulo: metadata.name || 'Produto',
          link: preResult?.generated_affiliate_url || link,
          preco: formatBRL(currentPriceVal)?.replace('R$ ', '') || undefined,
          preco_original: formatBRL(originalPriceVal)?.replace('R$ ', '') || undefined,
          desconto: (metadata.commissionRate !== null && metadata.commissionRate !== undefined) ? (metadata.commissionRate * 100).toFixed(0) : undefined,
          loja: marketplace,
          // Variáveis extras para cupons (se houver metadados específicos no futuro, por enquanto usamos do metadata se houver)
          valor: metadata.couponValue || undefined,
          minimo: metadata.minSpend || undefined,
          frete_minimo: metadata.freeShippingMinSpend || 19, // Exemplo Shopee
          codigo: metadata.couponCode || undefined
        };

        const resolved = await templateService.resolveTemplate(supabase, category, variables, userId, filterName);
        if (resolved) {
          templatedMessage = resolved;
        }
      }

      const snapshot = buildProductSnapshot({
        id,
        originalUrl: link,
        metadata: metadata || {},
        affiliateUrl: preResult?.generated_affiliate_url || targetUrl,
        tone,
        templatedMessage,
        sourceText,
        reaffiliation: {
          incoming_url: targetUrl,
          resolved_url: preResult?.resolved_url,
          canonical_url: preResult?.canonical_url || targetUrl,
          generated_affiliate_url: preResult?.generated_affiliate_url,
          redirect_chain: preResult?.redirect_chain,
          reaffiliation_status: preResult?.reaffiliation_status || 'not_needed',
          reaffiliation_error: preResult?.reaffiliation_error
        }
      });

      // 3. Status Final e Logs (Sem IA)
      if (snapshot.factual.reaffiliation_status === 'blocked' || snapshot.factual.reaffiliation_status === 'failed') {
          console.warn(`[LINK-PROCESSOR] Item parado/falhou: ${snapshot.factual.reaffiliation_error}`);
          snapshot.copy.messageText = `⚠️ ITEM PARADO: ${snapshot.factual.reaffiliation_error || 'Falha na validação factual'}`;
      } else {
          console.log(`[LINK-PROCESSOR] Processado com sucesso (Determinístico): ${snapshot.factual.title}`);
      }

      results.push(snapshot);

    } catch (error: any) {
      console.error(`linkProcessor: Critical failure processing ${link}:`, error.message);
      results.push(buildProductSnapshot({
        id,
        originalUrl: link,
        metadata: { name: `Original ${marketplace}`, metadata_failed: true },
        affiliateUrl: link,
        tone,
        reaffiliation: {
            incoming_url: link,
            canonical_url: link,
            reaffiliation_status: 'not_needed'
        }
      }));
    }
  }
  return results;
}
