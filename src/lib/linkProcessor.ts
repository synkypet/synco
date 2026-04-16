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
 */
export function buildMessageFromSnapshot(factual: FactualData, tone: string): string {
  const title = factual.title.toUpperCase();
  const priceOriginal = factual.originalPriceFormatted ? `De: ~~${factual.originalPriceFormatted}~~` : '';
  
  const pixPrice = factual.estimatedPixPriceFormatted;
  const priceFactual = factual.priceFormatted;

  let mainPriceLine = '';
  if (pixPrice) {
    mainPriceLine = `🔥Por: *${pixPrice} NO PIX*`;
  } else if (priceFactual) {
    mainPriceLine = `🔥Por: *${priceFactual}*`;
  }

  const installmentsLine = factual.installments ? `💳 ou *${factual.installments} - sem juros*` : '';
  const link = factual.finalLinkToSend;

  const lines = [
    `🛍️ *${title}*`,
    '',
    priceOriginal,
    mainPriceLine,
    installmentsLine,
    '',
    '👉 *Compre aqui:*',
    link,
    '',
    '⚠️ Promoção sujeita a alteração a qualquer momento.'
  ].filter(line => line !== '');

  return lines.join('\n');
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
}): ProductSnapshot {
  const { id, originalUrl, metadata, affiliateUrl, tone } = opts;
  
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
    title: metadata.name || 'Produto sem título',
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
    affiliateLink: affiliateUrl,
    shortLink: affiliateUrl.includes('s.shopee') || affiliateUrl.includes('shope.ee') ? affiliateUrl : null,
    productLink: metadata.productLink || null,
    offerLink: metadata.offerLink || null,
    finalLinkToSend: affiliateUrl,
    fetchedAt: metadata.fetchedAt || new Date().toISOString()
  };

  return {
    id,
    factual,
    copy: {
      messageText: buildMessageFromSnapshot(factual, tone),
      toneUsed: tone,
      generatedAt: new Date().toISOString()
    },
    metadata: {
      source: metadata.metadata_failed ? 'fallback' : 'api',
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
          metadata: result.metadata,
          affiliateUrl: result.affiliateUrl,
          tone
        });

        // ─── Refinamento por IA (Se disponível) ────────────────────────────────
        try {
          const refinedCopy = await refineOfferCopy({
            productName: snapshot.factual.title,
            price: snapshot.factual.priceFormatted,
            originalPrice: snapshot.factual.originalPriceFormatted,
            pixPrice: snapshot.factual.estimatedPixPriceFormatted,
            installments: snapshot.factual.installments,
            link: snapshot.factual.finalLinkToSend,
            highlights: [] 
          });
          snapshot.copy.messageText = refinedCopy;
          snapshot.copy.toneUsed = 'ai-refined';
        } catch (aiError) {
          console.error(`linkProcessor: AI Refinement failed for ${link}:`, aiError);
          // Mantém a copy determinística do buildProductSnapshot
        }

        results.push(snapshot);
      } catch (error) {
        console.error(`linkProcessor: Failed to process ${link}:`, error);
        results.push(buildProductSnapshot({
          id,
          originalUrl: link,
          metadata: { name: `Produto ${marketplace} (Tracking)`, metadata_failed: true },
          affiliateUrl: link,
          tone
        }));
      }
    } else {
      results.push(buildProductSnapshot({
        id,
        originalUrl: link,
        metadata: { name: `Original ${marketplace}`, metadata_failed: true },
        affiliateUrl: link,
        tone
      }));
    }
  }
  return results;
}
