// src/lib/linkProcessor.ts
// Processador de links real — usa adaptadores de marketplace em vez de mocks.

import { MarketplaceAdapter, AffiliateResult } from './marketplaces/BaseAdapter';
import { ShopeeAdapter } from './marketplaces/ShopeeAdapter';
import { refineOfferCopy } from './ai/refiner';
import { templateService } from '@/services/supabase/template-service';
import { SupabaseClient } from '@supabase/supabase-js';
import { extractShopeeCoupons } from './marketplaces/shopee/coupon-extractor';
import { ShopeeCoupon, ShopeeCouponType, ShopeeCouponStatus } from '@/types/shopee-coupon';
import { formatShopeeCouponMessage } from './marketplaces/shopee/coupon-formatter';
import { classifyShopeeContentForCoupon } from './marketplaces/shopee/coupon-classifier';
import { buildSmartContext, renderSmartTemplate, DEFAULT_TEMPLATES, resolveAndRenderTemplate } from './templates/universal-template-engine';
import { CouponPayload } from '@/types/coupon-payload';

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
  discountPercent?: number | null;

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
  price_unavailable?: boolean;
  
  // Status da geração do link curto
  shortGenerationStatus?: 'success' | 'fallback' | 'no_session' | 'skipped';
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

import { MercadoLivreAdapter } from './marketplaces/MercadoLivreAdapter';

// ─── Registry de Adapters ──────────────────────────────────────────────────
const adapters: MarketplaceAdapter[] = [
  new ShopeeAdapter(),
  new MercadoLivreAdapter(),
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
    if (hostname === 'mercadolivre.com.br' || hostname.endsWith('.mercadolivre.com.br') || hostname === 'mercadolibre.com' || hostname.endsWith('.mercadolibre.com') || hostname === 'meli.com' || hostname.endsWith('.meli.com') || hostname === 'mercadol.in' || hostname.endsWith('.mercadol.in')) return 'Mercado Livre';
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

  // 1. Uso do novo classificador unificado (Fase 2H)
  const shopeeClassification = classifyShopeeContentForCoupon(text, {
    title: factual.title,
    canonical_url: factual.canonical_url
  });

  if (shopeeClassification.classification === 'verified_coupon' || 
      shopeeClassification.classification === 'product_with_coupon' ||
      shopeeClassification.classification === 'promo_landing') {
    
    const type: OfferType = shopeeClassification.classification === 'verified_coupon' 
      ? 'coupon_offer' 
      : shopeeClassification.classification === 'product_with_coupon' 
        ? 'product_with_coupon' 
        : 'promo_landing';

    // Recuperar cupons para metadados
    let shopeeCoupons = extractShopeeCoupons(text);

    // Se for página oficial de cupons, gerar cupom sintético com tipo pagina_cupons
    const isCouponPage = text.toLowerCase().includes('/m/cupom-de-desconto') || 
                         (factual.canonical_url && factual.canonical_url.toLowerCase().includes('/m/cupom-de-desconto'));
    
    if (isCouponPage && shopeeCoupons.length === 0) {
      shopeeCoupons = [{
        marketplace: 'shopee',
        type: 'pagina_cupons',
        code: null,
        couponLabel: 'Cupons Shopee Liberados',
        redemptionUrl: factual.canonical_url || text,
        confidence: 1,
        status: 'valid',
        dedupeKey: `pagina_cupons_${factual.canonical_url || text}`
      }];
    }
    
    // Ajustar título factual se necessário
    if (type === 'coupon_offer' && (!factual.title || factual.title.includes('M/') || factual.title.includes('Produto Shopee') || factual.title === 'Produto sem título')) {
      if (shopeeCoupons.length > 0 && shopeeCoupons[0].code) {
        factual.title = `Cupom: ${shopeeCoupons[0].code}`;
      } else {
        factual.title = 'Cupons Shopee Liberados';
      }
    } else if (type === 'promo_landing' && (!factual.title || !factual.title.includes('Super Ofertas'))) {
      factual.title = 'Acesso VIP Shopee: Super Ofertas';
      factual.landing_type = 'super_ofertas';
    }

    return { 
      type, 
      reasons: shopeeClassification.reasons, 
      coupons: shopeeCoupons 
    };
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
  const couponKeywords = ['cupom', 'resgate', 'copie e cole', 'link carrinho', 'mínimo', '🎟', 'voucher'];
  const hasOffKeyword = /\boff\b/i.test(content);
  const hasCouponKeywords = couponKeywords.some(k => content.includes(k)) || hasOffKeyword;
  
  const isMercadoLivre = factual.marketplace === 'Mercado Livre';
  const isWeakProduct = !factual.title || factual.title.includes('sem título') || 
    ((!factual.price || factual.price <= 0) && !isMercadoLivre);

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
  } else if (
    factual.reaffiliation_status === 'canonicalized' &&
    factual.marketplace === 'Mercado Livre'
  ) {
    reasons.push('Afiliação inválida: link do Mercado Livre sem parâmetros de rastreio');
    status = 'ineligible';
  }

  if (
    factual.finalLinkToSend &&
    factual.canonical_url &&
    factual.finalLinkToSend === factual.canonical_url &&
    factual.marketplace === 'Mercado Livre'
  ) {
    reasons.push('Afiliação inválida: link final idêntico ao canônico');
    status = 'ineligible';
  }

  // 2. Metadados Essenciais (Regra SYNCO: Sem Título, Sem Preço ou Sem Imagem = Quebrado para produtos)
  if (offerType === 'product_offer') {
    if (!factual.title || factual.title === 'Produto sem título' || factual.title === 'PRODUTO BLOQUEADO') {
      reasons.push('Título ausente ou inválido');
      status = 'ineligible';
    }

    const isShopee = factual.marketplace === 'Shopee';
    const hasValidPrice = typeof factual.price === 'number' && factual.price > 0 && !isNaN(factual.price);
    
    if (!hasValidPrice && factual.marketplace !== 'Mercado Livre') {
      reasons.push('Preço factual indisponível ou inválido (Obrigatório para Shopee)');
      status = 'ineligible';
    }

  }

  if (!factual.image && offerType === 'product_offer' && factual.marketplace !== 'Mercado Livre') {
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
    // FASE 2I.2: Bloqueio de item sem preço. Não gerar "Preço sob consulta".
    priceLines += `⚠️ Preço não disponível`;
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
    shortGenerationStatus?: 'success' | 'fallback' | 'no_session' | 'skipped';
  };
  templateMetadata?: {
    isSystemDefault: boolean;
  };
}): ProductSnapshot {
  const { id, originalUrl, metadata, affiliateUrl, tone, reaffiliation, sourceText, templateMetadata } = opts;
  
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
    priceFormatted: metadata.price_unavailable ? null : formatBRL(price),
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
    // TODO: shortLink não é populado para links meli.la (meli.la vai em
    // finalLinkToSend). Avaliar se templates ML precisam do campo shortLink.
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
    extraCouponLink: metadata.extraCouponLink,
    discountPercent: metadata.discountPercent,
    price_unavailable: metadata.price_unavailable || false,
    shortGenerationStatus: reaffiliation?.shortGenerationStatus
  };

  // 2. Classificar Oferta (Heurísticas)
  const classification = classifyOffer(originalUrl, factual);
  
  if (classification.coupons && classification.coupons.length > 0) {
    factual.coupons = classification.coupons;
  }
 
  // 3. Aplicar Validação Real
  factual.eligibility = validateEligibility(factual, classification.type);

  // 4. Gerar Texto da Mensagem (Determinístico ou Templated)
  // FASE 2I.1: Integração com o Motor de Templates Universal
  const isShopee = factual.marketplace === 'Shopee';
  let messageText = '';

  
  if (isShopee && !opts.templatedMessage) {
    // Se não veio com template já renderizado (ex: do processLinks), renderizamos agora
    // Nota: Aqui não temos o SupabaseClient facilmente disponível se vier de um contexto legado sem ele.
    // Mas buildProductSnapshot é chamado por processLinks que JÁ faz a resolução se tiver supabase.
    const context = buildSmartContext(factual);
    if (classification.type === 'coupon_offer') {
      messageText = renderSmartTemplate(DEFAULT_TEMPLATES.shopee_coupon, context);
    } else if (classification.type === 'promo_landing') {
      messageText = renderSmartTemplate(DEFAULT_TEMPLATES.shopee_promo, context);
    } else if (context.coupon_block) {
      messageText = renderSmartTemplate(DEFAULT_TEMPLATES.shopee_product_premium, context);
    } else {
      messageText = renderSmartTemplate(DEFAULT_TEMPLATES.shopee_product, context);
    }
  } else {
    messageText = opts.templatedMessage || buildMessageFromSnapshot(factual);
  }

  // Se a mensagem gerada for vazia ou contiver o marcador de erro, garantimos que o item seja marcado como ineligível
  if (!messageText || messageText.includes('[PRODUCT_PRICE_UNAVAILABLE]') || messageText.includes('ITEM INVÁLIDO')) {
    factual.eligibility.isEligible = false;
    if (!factual.eligibility.reasons.includes('product_price_unavailable')) {
      factual.eligibility.reasons.push('product_price_unavailable');
    }
    factual.eligibility.status = 'ineligible';
    messageText = ''; // Limpa para evitar envio de lixo
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
  sourceText?: string,
  coupons?: any[]
): Promise<ProductSnapshot[]> {
  const validLinks = links.filter(link => link.trim().length > 0);
  const results: ProductSnapshot[] = [];

  for (let i = 0; i < validLinks.length; i++) {
    const link = validLinks[i];
    const id = `proc_${Date.now()}_${results.length}`;
    
    // Extração de URL para processamento (suporta texto com link)
    const urlMatch = link.match(/https?:\/\/[^\s]+/);
    const targetUrl = urlMatch ? urlMatch[0] : link;

    const marketplace = detectMarketplace(targetUrl);
    const adapter = findAdapter(targetUrl);
    
    let existingCoupon = null;

    // Helper para gerar snapshot a partir de cupom existente no banco
    const buildSnapshotFromExisting = async (coupon: any) => {
      const primaryUrl = coupon.redemption_url || coupon.affiliate_url || coupon.source_url || link;
      const couponsObj: ShopeeCoupon[] = [{
        marketplace: 'shopee',
        code: coupon.code || null,
        type: coupon.coupon_type as ShopeeCouponType,
        couponLabel: coupon.coupon_label || null,
        redemptionUrl: primaryUrl,
        confidence: coupon.confidence || 1,
        status: (coupon.status || 'valid') as ShopeeCouponStatus,
        dedupeKey: coupon.dedupe_key
      }];

      const factual: FactualData = {
        originalUrl: link,
        cleanUrl: primaryUrl,
        marketplace: 'Shopee',
        title: coupon.coupon_label || 'Cupom Shopee',
        image: null,
        
        price: 0,
        priceFormatted: null,
        originalPrice: null,
        originalPriceFormatted: null,
        currentPriceFactual: 0,
        currentPriceSource: 'fallback',
        
        commissionValueFactual: 0,
        commissionSource: 'fallback',
        commissionValueFormatted: null,
        commissionRate: null,
        commissionRatePercent: null,
        
        pixDisplayEligible: false,
        affiliateLink: primaryUrl,
        shortLink: primaryUrl,
        finalLinkToSend: primaryUrl,
        fetchedAt: new Date().toISOString(),
        
        incoming_url: targetUrl,
        resolved_url: coupon.resolved_url || targetUrl,
        canonical_url: coupon.canonical_url || targetUrl,
        generated_affiliate_url: primaryUrl,
        reaffiliation_status: 'reaffiliated',
        
        eligibility: {
          isEligible: true,
          status: 'eligible',
          reasons: [],
          offer_type: 'coupon_offer'
        },
        
        coupons: couponsObj
      };

      const context = buildSmartContext(factual);
      const fallbackTemplate = DEFAULT_TEMPLATES.shopee_coupon;
      let messageText = renderSmartTemplate(fallbackTemplate, context);

      if (supabase) {
        try {
          const { templateService: tService } = await import('@/services/supabase/template-service');
          const { content } = await tService.resolveEffectiveTemplate(supabase, userId, 'shopee_coupon');
          if (content) {
            messageText = renderSmartTemplate(content, context);
          }
        } catch (e) {
          console.error('[LINK-PROCESSOR] Erro ao carregar template para cupom existente:', e);
        }
      }

      return {
        id,
        factual,
        copy: {
          messageText,
          toneUsed: 'templated',
          generatedAt: new Date().toISOString()
        },
        metadata: {
          source: 'api' as const,
          isFrozen: true
        }
      };
    };

    // Helper para gerar snapshot a partir de página de promoção existente no banco
    const buildSnapshotFromPromoPage = async (page: any) => {
      const primaryUrl = page.canonical_url || page.raw_url || page.source_url || link;
      const couponsObj: ShopeeCoupon[] = [{
        marketplace: 'shopee',
        code: null,
        type: 'pagina_oferta' as ShopeeCouponType,
        couponLabel: page.title || 'Página de Ofertas',
        redemptionUrl: primaryUrl,
        confidence: page.confidence || 1,
        status: (page.status || 'valid') as ShopeeCouponStatus,
        dedupeKey: page.dedupe_key
      }];

      const factual: FactualData = {
        originalUrl: link,
        cleanUrl: primaryUrl,
        marketplace: 'Shopee',
        title: page.title || 'Página de Ofertas',
        image: null,
        
        price: 0,
        priceFormatted: null,
        originalPrice: null,
        originalPriceFormatted: null,
        currentPriceFactual: 0,
        currentPriceSource: 'fallback',
        
        commissionValueFactual: 0,
        commissionSource: 'fallback',
        commissionValueFormatted: null,
        commissionRate: null,
        commissionRatePercent: null,
        
        pixDisplayEligible: false,
        affiliateLink: primaryUrl,
        shortLink: primaryUrl,
        finalLinkToSend: primaryUrl,
        fetchedAt: new Date().toISOString(),
        
        incoming_url: targetUrl,
        resolved_url: page.raw_url || targetUrl,
        canonical_url: page.canonical_url || targetUrl,
        generated_affiliate_url: primaryUrl,
        reaffiliation_status: 'reaffiliated',
        
        eligibility: {
          isEligible: true,
          status: 'eligible',
          reasons: [],
          offer_type: 'promo_landing'
        },
        
        coupons: couponsObj
      };

      const context = buildSmartContext(factual);
      const fallbackTemplate = DEFAULT_TEMPLATES.shopee_coupon;
      let messageText = renderSmartTemplate(fallbackTemplate, context);

      if (supabase) {
        try {
          const { templateService: tService } = await import('@/services/supabase/template-service');
          const { content } = await tService.resolveEffectiveTemplate(supabase, userId, 'shopee_coupon');
          if (content) {
            messageText = renderSmartTemplate(content, context);
          }
        } catch (e) {
          console.error('[LINK-PROCESSOR] Erro ao carregar template para página promocional existente:', e);
        }
      }

      return {
        id,
        factual,
        copy: {
          messageText,
          toneUsed: 'templated',
          generatedAt: new Date().toISOString()
        },
        metadata: {
          source: 'api' as const,
          isFrozen: true
        }
      };
    };

    let matchStrategy: 'explicit_coupon_id' | 'exact_redemption_url' | 'exact_source_url' | 'explicit_code' | 'no_match' = 'no_match';
    let finalCouponId = null;
    let finalCouponCode = null;
    let finalCouponRedemptionUrl = null;

    // A. Procurar match explícito de cupom vindo do payload do frontend por correspondência de índice
    let matchedPayloadCoupon = null;
    if (coupons && Array.isArray(coupons) && i < coupons.length) {
      matchedPayloadCoupon = coupons[i];
    }

    const explicitCouponId = matchedPayloadCoupon?.couponId || matchedPayloadCoupon?.id;

    if (explicitCouponId && supabase && userId) {
      try {
        const isPromoType = matchedPayloadCoupon?.couponType === 'pagina_oferta';
        let dbPromoPage = null;
        let dbCoupon = null;

        if (isPromoType) {
          const { data, error } = await supabase
            .from('discovered_promo_pages')
            .select('*')
            .eq('id', explicitCouponId)
            .eq('user_id', userId)
            .maybeSingle();
          if (!error && data) dbPromoPage = data;
        } else {
          // Primeiro tenta discovered_coupons
          const { data, error } = await supabase
            .from('discovered_coupons')
            .select('*')
            .eq('id', explicitCouponId)
            .eq('user_id', userId)
            .maybeSingle();
          if (!error && data) {
            dbCoupon = data;
          } else {
            // Se não achou na de cupons, tenta na de promo_pages como fallback
            const { data: pageData, error: pageError } = await supabase
              .from('discovered_promo_pages')
              .select('*')
              .eq('id', explicitCouponId)
              .eq('user_id', userId)
              .maybeSingle();
            if (!pageError && pageData) dbPromoPage = pageData;
          }
        }

        console.log('[DEBUG-COUPON-LOOKUP]', {
          couponId: explicitCouponId,
          userId,
          foundCoupon: !!dbCoupon,
          foundPromoPage: !!dbPromoPage,
          couponType: dbCoupon?.coupon_type || 'pagina_oferta'
        });

        if (dbCoupon) {
          existingCoupon = dbCoupon;
          matchStrategy = 'explicit_coupon_id';
          finalCouponId = dbCoupon.id;
          finalCouponCode = dbCoupon.code;
          finalCouponRedemptionUrl = dbCoupon.redemption_url;

          // Gerar snapshot diretamente do cupom existente no banco
          const snapshot = await buildSnapshotFromExisting(dbCoupon);

          console.log('[LINK-PROCESSOR-AUDIT]', {
            receivedCouponId: explicitCouponId,
            receivedInputUrl: targetUrl,
            selectedCouponId: dbCoupon.id,
            selectedCouponCode: dbCoupon.code || null,
            selectedCouponLabel: dbCoupon.coupon_label || null,
            selectedCouponRedemptionUrl: dbCoupon.redemption_url || null,
            matchStrategy: 'explicit_coupon_id'
          });

          results.push(snapshot);
          continue; // HARD-STOP: impede qualquer fallback
        } else if (dbPromoPage) {
          matchStrategy = 'explicit_coupon_id';
          finalCouponId = dbPromoPage.id;
          finalCouponCode = null;
          finalCouponRedemptionUrl = dbPromoPage.canonical_url || dbPromoPage.raw_url;

          // Gerar snapshot diretamente da página promocional existente no banco
          const snapshot = await buildSnapshotFromPromoPage(dbPromoPage);

          console.log('[LINK-PROCESSOR-AUDIT]', {
            receivedPromoPageId: explicitCouponId,
            receivedInputUrl: targetUrl,
            selectedPromoPageId: dbPromoPage.id,
            selectedPromoPageTitle: dbPromoPage.title || null,
            selectedPromoPageUrl: dbPromoPage.canonical_url || dbPromoPage.raw_url || null,
            matchStrategy: 'explicit_coupon_id'
          });

          results.push(snapshot);
          continue; // HARD-STOP: impede qualquer fallback
        } else {
          console.warn(`[LINK-PROCESSOR] Item com ID ${explicitCouponId} não encontrado no banco. Abortando com erro coupon_id_not_found.`);
          
          const failedSnapshot: ProductSnapshot = {
            id,
            factual: {
              originalUrl: link,
              cleanUrl: link,
              marketplace: 'Shopee',
              title: 'Cupom Não Encontrado',
              image: null,
              price: 0,
              priceFormatted: null,
              originalPrice: null,
              originalPriceFormatted: null,
              currentPriceFactual: 0,
              currentPriceSource: 'fallback',
              commissionValueFactual: 0,
              commissionSource: 'fallback',
              commissionValueFormatted: null,
              commissionRate: null,
              commissionRatePercent: null,
              pixDisplayEligible: false,
              affiliateLink: link,
              shortLink: link,
              finalLinkToSend: link,
              fetchedAt: new Date().toISOString(),
              incoming_url: targetUrl,
              resolved_url: targetUrl,
              canonical_url: targetUrl,
              generated_affiliate_url: link,
              reaffiliation_status: 'failed',
              reaffiliation_error: `Item com ID "${explicitCouponId}" não encontrado no banco de dados.`,
              eligibility: {
                isEligible: false,
                status: 'ineligible',
                reasons: ['coupon_id_not_found'],
                offer_type: 'coupon_offer'
              },
              coupons: []
            },
            copy: {
              messageText: `⚠️ ERRO: Item não encontrado (ID: ${explicitCouponId})`,
              toneUsed: 'deterministic',
              generatedAt: new Date().toISOString()
            },
            metadata: {
              source: 'fallback',
              isFrozen: true
            }
          };

          results.push(failedSnapshot);
          continue; // HARD-STOP: impede qualquer fallback
        }
      } catch (err) {
        console.error('[LINK-PROCESSOR] Erro crítico ao buscar por couponId explícito:', err);
      }
    }

    const isGenericLanding = (url: string) => {
      const lower = url.toLowerCase();
      return lower.includes('/m/envio-rapido') || 
             lower.endsWith('/m/') ||
             lower.endsWith('/events/');
    };

    // 1. Checagem inicial por URL de entrada (apenas se NÃO for landing page genérica e não tiver match explícito por ID)
    if (!existingCoupon && supabase && userId && marketplace === 'Shopee' && !isGenericLanding(targetUrl)) {
      try {
        const { data } = await supabase
          .from('discovered_coupons')
          .select('*')
          .eq('user_id', userId)
          .or(`source_url.eq.${targetUrl},redemption_url.eq.${targetUrl}`);
        if (data && data.length > 0) {
          const possibleCoupon = data[0];
          // Só aceita o match se a URL salva no banco não for uma landing page genérica compartilhada
          const savedUrlIsGeneric = (possibleCoupon.redemption_url && isGenericLanding(possibleCoupon.redemption_url)) ||
                                    (possibleCoupon.source_url && isGenericLanding(possibleCoupon.source_url));
          if (!savedUrlIsGeneric) {
            existingCoupon = possibleCoupon;
            matchStrategy = targetUrl === existingCoupon.redemption_url ? 'exact_redemption_url' : 'exact_source_url';
            finalCouponId = existingCoupon.id;
            finalCouponCode = existingCoupon.code;
            finalCouponRedemptionUrl = existingCoupon.redemption_url;
          }
        }
      } catch (err) {
        console.error('[LINK-PROCESSOR] Erro ao buscar cupom existente por URL de entrada:', err);
      }
    }

    // Checagem por código de cupom explícito na URL/texto (se não encontrado e não genérico)
    if (!existingCoupon && supabase && userId && marketplace === 'Shopee') {
      const shopeeCodes = extractShopeeCoupons(link);
      if (shopeeCodes.length > 0) {
        const firstCode = shopeeCodes[0].code;
        try {
          const { data } = await supabase
            .from('discovered_coupons')
            .select('*')
            .eq('user_id', userId)
            .eq('code', firstCode)
            .eq('status', 'valid')
            .limit(1);
          if (data && data.length > 0) {
            existingCoupon = data[0];
            matchStrategy = 'explicit_code';
            finalCouponId = existingCoupon.id;
            finalCouponCode = existingCoupon.code;
            finalCouponRedemptionUrl = existingCoupon.redemption_url;
          }
        } catch (err) {
          console.error('[LINK-PROCESSOR] Erro ao buscar por code explícito:', err);
        }
      }
    }

    console.log('[LINK-PROCESSOR-AUDIT]', {
      receivedCouponId: matchedPayloadCoupon?.couponId || null,
      receivedInputUrl: targetUrl,
      selectedCouponId: finalCouponId,
      selectedCouponCode: finalCouponCode,
      selectedCouponLabel: existingCoupon?.coupon_label || null,
      selectedCouponRedemptionUrl: finalCouponRedemptionUrl,
      matchStrategy: matchStrategy
    });

    if (existingCoupon) {
      results.push(await buildSnapshotFromExisting(existingCoupon));
      continue;
    }

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

        // 2. Checagem após a resolução (com as URLs resolvidas / canônicas)
        const isGenericLanding = (url: string) => {
          const lower = url.toLowerCase();
          return lower.includes('/m/envio-rapido') || 
                 lower.endsWith('/m/') ||
                 lower.endsWith('/events/');
        };

        if (supabase && userId && preResult) {
          try {
            const urlsToSearch = [];
            if (preResult.canonical_url && !isGenericLanding(preResult.canonical_url)) {
              urlsToSearch.push(`canonical_url.eq.${preResult.canonical_url}`, `source_url.eq.${preResult.canonical_url}`, `redemption_url.eq.${preResult.canonical_url}`);
            }
            if (preResult.resolved_url && !isGenericLanding(preResult.resolved_url)) {
              urlsToSearch.push(`canonical_url.eq.${preResult.resolved_url}`, `source_url.eq.${preResult.resolved_url}`, `redemption_url.eq.${preResult.resolved_url}`);
            }
            
            if (urlsToSearch.length > 0) {
              const { data } = await supabase
                .from('discovered_coupons')
                .select('*')
                .eq('user_id', userId)
                .or(urlsToSearch.join(','));
              if (data && data.length > 0) {
                const possibleCoupon = data[0];
                const savedUrlIsGeneric = (possibleCoupon.redemption_url && isGenericLanding(possibleCoupon.redemption_url)) ||
                                          (possibleCoupon.source_url && isGenericLanding(possibleCoupon.source_url));
                if (!savedUrlIsGeneric) {
                  existingCoupon = possibleCoupon;
                  matchStrategy = 'exact_redemption_url';
                  finalCouponId = existingCoupon.id;
                  finalCouponCode = existingCoupon.code;
                  finalCouponRedemptionUrl = existingCoupon.redemption_url;
                  
                  console.log('[LINK-PROCESSOR-AUDIT]', {
                    receivedCouponId: matchedPayloadCoupon?.couponId || null,
                    receivedInputUrl: targetUrl,
                    selectedCouponId: finalCouponId,
                    selectedCouponCode: finalCouponCode,
                    selectedCouponLabel: existingCoupon?.coupon_label || null,
                    selectedCouponRedemptionUrl: finalCouponRedemptionUrl,
                    matchStrategy: matchStrategy
                  });
                }
              }
            }
          } catch (err) {
            console.error('[LINK-PROCESSOR] Erro ao buscar cupom existente após resolução:', err);
          }
        }

        if (existingCoupon) {
          results.push(await buildSnapshotFromExisting(existingCoupon));
          continue;
        }
        
        // B. Enrichment (Metadata) - Somente se não estiver bloqueado/falhado
        const canEnrich = preResult.reaffiliation_status !== 'blocked' && preResult.reaffiliation_status !== 'failed';
        if (canEnrich) {
            const metadataTargetUrl =
              marketplace === 'Mercado Livre'
                ? (preResult.resolved_url || targetUrl)
                : (preResult.canonical_url || targetUrl);
            metadata = await adapter.fetchMetadata(metadataTargetUrl, connection);
            
            // C. Validação de Metadados (Metadata Guardrail)
            // Somente falha se NÃO for um cupom identificado (pelo texto ou pela URL canônica)
            // E se NÃO houver um link afiliado válido já gerado (ex: meli.la)
            const isCoupon = (extractShopeeCoupons(link).length > 0) || 
                             (preResult.canonical_url?.toLowerCase().includes('/m/')) ||
                             (preResult.canonical_url?.toLowerCase().includes('cupom'));

            const hasValidAffiliateLink = !!preResult.generated_affiliate_url && 
                                          preResult.generated_affiliate_url !== preResult.canonical_url;

            if (metadata?.metadata_failed && !isCoupon) {
                if (hasValidAffiliateLink) {
                    // Tem meli.la/link afiliado válido — não bloquear, apenas avisar
                    console.warn(`[LINK-PROCESSOR] Meta Guardrail: metadados fracos para ${targetUrl}, mas link afiliado válido — continuando`);
                } else {
                    console.warn(`[LINK-PROCESSOR] Meta Guardrail: Falha de qualidade para ${targetUrl}: ${metadata.metadata_error}`);
                    preResult.reaffiliation_status = 'failed';
                    preResult.reaffiliation_error = metadata.metadata_error || 'Metadados insuficientes';
                }
            }
        }
      }

      // 2. Construção do Snapshot inicial (Factual/Deterministico)
      const price = metadata?.currentPriceFactual || metadata?.currentPrice || null;
      const formatBRL = (val: number | null) => val !== null ? `R$ ${val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : null;
      
      const factualForClassification: any = {
        title: metadata?.name || 'Produto sem título',
        price: price,
        canonical_url: preResult?.canonical_url || targetUrl
      };

      const classification = classifyOffer(link, factualForClassification);
      
      let templatedMessage = undefined;
      let templateMetadata = undefined;
      if (supabase && metadata) {
        // Criar um objeto factual mínimo para a resolução de template
        const partialFactual: any = {
          marketplace: marketplace,
          eligibility: { offer_type: classification.type },
          title: metadata.name,
          price: price,
          originalPrice: metadata?.originalPrice,
          discountPercent: metadata?.discountPercent,
          currentPriceFactual: metadata?.currentPriceFactual,
          currentPriceSource: metadata?.currentPriceSource,
          finalLinkToSend: preResult?.generated_affiliate_url || targetUrl,
          source_text: sourceText
        };
        const { content, isSystem } = await resolveAndRenderTemplate(supabase, partialFactual, userId);
        templatedMessage = content;
        templateMetadata = { isSystemDefault: isSystem };
      }



      const snapshot = buildProductSnapshot({
        id,
        originalUrl: link,
        metadata: metadata || {},
        affiliateUrl: preResult?.generated_affiliate_url || targetUrl,
        tone,
        templatedMessage,
        templateMetadata,
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
