// src/lib/linkProcessor.ts
// Processador de links real — usa adaptadores de marketplace em vez de mocks.

import { MarketplaceAdapter, AffiliateResult } from './marketplaces/BaseAdapter';
import { ShopeeAdapter } from './marketplaces/ShopeeAdapter';
import { refineOfferCopy } from './ai/refiner';

export type Marketplace = 'Shopee' | 'Amazon' | 'Mercado Livre' | 'Magalu' | 'Unknown';

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
  const lower = url.toLowerCase();
  
  // Priorizar subdomínios específicos de redirecionamento Shopee
  if (lower.includes('s.shopee.com.br')) return 'Shopee';
  
  if (lower.includes('shopee.com.br') || lower.includes('shope.ee')) return 'Shopee';
  if (lower.includes('amazon.com.br')) return 'Amazon';
  if (lower.includes('mercadolivre.com.br')) return 'Mercado Livre';
  if (lower.includes('magazineluiza.com.br') || lower.includes('magalu.com')) return 'Magalu';
  return 'Unknown';
}

function findAdapter(url: string): MarketplaceAdapter | null {
  return adapters.find(adapter => adapter.canHandle(url)) || null;
}

/**
 * Construtor central de mensagens baseadas no snapshot factual.
 * FOCADO EM PREÇO FACTUAL COM ESTIMATIVA PIX OPCIONAL.
 * Padroniza o visual do WhatsApp para automação e envio rápido.
 */
export function buildMessageFromSnapshot(factual: FactualData, blurb?: string): string {
  // 1. Título
  const title = factual.title;
  const emoji = '🛍️'; // Emoji padrão de oferta

  // 2. Preços (Padronização obrigatória)
  const pixPrice = factual.estimatedPixPriceFormatted;
  const priceFactual = factual.priceFormatted;

  let mainPriceLine = '';
  if (pixPrice) {
    mainPriceLine = `🔥 Por: *${pixPrice} no Pix*`;
  } else if (priceFactual) {
    mainPriceLine = `🔥 Por: *${priceFactual}*`;
  }

  // 3. Parcelamento
  const installmentsLine = factual.installments ? `💳 ou *${factual.installments} sem juros*` : '';
  
  // 4. Link & CTA
  const link = factual.finalLinkToSend;

  // 5. Blurb/IA Fallback
  const finalBlurb = blurb || 'Oportunidade para garantir seu produto! Confira os detalhes dessa oferta.';

  // 6. Montagem Final (Respeitando linhas em branco e respiro visual)
  const lines = [
    `${emoji} ${title}`,
    '',
    finalBlurb,
    '',
    mainPriceLine,
    installmentsLine,
    '',
    '🛒 Compre aqui:',
    link,
    '',
    '⚠️ Promoção sujeita a alteração a qualquer momento.'
  ].filter(line => line !== null);

  // Garantir que não existam 3+ quebras de linha seguidas
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
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
  const { id, originalUrl, metadata, affiliateUrl, tone, reaffiliation } = opts;
  
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
    title: metadata.name || (reaffiliation?.reaffiliation_status === 'blocked' ? 'PRODUTO BLOQUEADO' : 'Produto sem título'),
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
    reaffiliation_error: reaffiliation?.reaffiliation_error
  };

  return {
    id,
    factual,
    copy: {
      messageText: buildMessageFromSnapshot(factual),
      toneUsed: 'deterministic',
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
  tone: string = 'auto'
): Promise<ProductSnapshot[]> {
  const validLinks = links.filter(link => link.trim().length > 0);
  const results: ProductSnapshot[] = [];

  for (const link of validLinks) {
    const id = `proc_${Date.now()}_${results.length}`;
    const marketplace = detectMarketplace(link);
    const adapter = findAdapter(link);

    if (adapter) {
      try {
        const dbMarketplaceName = marketplace.toLowerCase().trim();
        const connection = userConnections.find(c => {
          const connName = (c.marketplace_name || "").toLowerCase().trim();
          return connName === dbMarketplaceName || connName.includes(dbMarketplaceName);
        });

        const result: AffiliateResult = await adapter.process(link, connection);

        const snapshot = buildProductSnapshot({
          id,
          originalUrl: link,
          metadata: result.metadata || { 
            name: result.reaffiliation_status === 'blocked' ? 'PRODUTO BLOQUEADO' : `Produto ${marketplace} (Tracking)`,
            metadata_failed: true 
          },
          affiliateUrl: result.affiliateUrl,
          tone,
          reaffiliation: {
            incoming_url: result.incoming_url,
            resolved_url: result.resolved_url,
            canonical_url: result.canonical_url,
            generated_affiliate_url: result.generated_affiliate_url,
            redirect_chain: result.redirect_chain,
            reaffiliation_status: result.reaffiliation_status,
            reaffiliation_error: result.reaffiliation_error
          }
        });

        // ─── Refinamento por IA (Apenas se NÃO estiver bloqueado) ─────────────
        if (snapshot.factual.reaffiliation_status !== 'blocked' && snapshot.factual.reaffiliation_status !== 'failed') {
          try {
            const refinedBlurb = await refineOfferCopy({
              productName: snapshot.factual.title,
              price: snapshot.factual.priceFormatted,
              originalPrice: snapshot.factual.originalPriceFormatted,
              pixPrice: snapshot.factual.estimatedPixPriceFormatted,
              installments: snapshot.factual.installments,
              link: snapshot.factual.finalLinkToSend,
              highlights: [] 
            });
            
            // RE-CONSTRUIR a mensagem final usando o blurb refinado
            snapshot.copy.messageText = buildMessageFromSnapshot(snapshot.factual, refinedBlurb);
            snapshot.copy.toneUsed = 'ai-refined';
          } catch (aiError) {
            console.error(`linkProcessor: AI Refinement failed for ${link}:`, aiError);
            // O messageText já contém o fallback determinístico do buildProductSnapshot
          }
        } else {
          console.warn(`linkProcessor: Skipping AI Refinement for ${link} because it is BLOCKED or FAILED.`);
          snapshot.copy.messageText = `⚠️ Item Bloqueado: ${snapshot.factual.reaffiliation_error || 'Falha na reaffiliação'}`;
        }

        results.push(snapshot);
      } catch (error) {
        console.error(`linkProcessor: Failed to process ${link}:`, error);
        results.push(buildProductSnapshot({
          id,
          originalUrl: link,
          metadata: { name: `Erro no Processamento: ${marketplace}`, metadata_failed: true },
          affiliateUrl: link,
          tone,
          reaffiliation: {
            incoming_url: link,
            canonical_url: link,
            reaffiliation_status: 'failed',
            reaffiliation_error: error instanceof Error ? error.message : String(error)
          }
        }));
      }
    } else {
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
