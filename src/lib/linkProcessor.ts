// src/lib/linkProcessor.ts
// Processador de links real — usa adaptadores de marketplace em vez de mocks.

import { MarketplaceAdapter, AffiliateResult } from './marketplaces/BaseAdapter';
import { ShopeeAdapter } from './marketplaces/ShopeeAdapter';

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
  const title = factual.title;
  const priceFactual = factual.priceFormatted ? `💰 *${factual.priceFormatted}*` : '';
  
  // Heurística de exibição de Pix na copy (apenas se existir e for menor que o factual)
  let pixLine = '';
  if (factual.estimatedPixPrice && factual.currentPriceFactual && factual.estimatedPixPrice < factual.currentPriceFactual) {
    const pixFormatted = `R$ ${factual.estimatedPixPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    pixLine = `\n🎯 *No Pix:* ${pixFormatted}`;
  }

  const store = factual.shopName ? `🏪 *Loja:* ${factual.shopName}` : '';
  const link = factual.finalLinkToSend;

  const baseLines = [
    `🔥 *OFERTA DETECTADA*`,
    '',
    `*${title}*`,
    priceFactual,
    pixLine,
    store,
    '',
    '🛒 *Garanta no link abaixo:*',
    link,
    '',
    `#oferta #promoção #${factual.marketplace.toLowerCase()}`
  ].filter(line => line !== '');

  if (tone === 'promocional' || tone === 'vendedor') {
    return [
      '🚨 *PROMOÇÃO IMPERDÍVEL* 🚨',
      '',
      `*${title}*`,
      priceFactual ? `✅ *Apenas:* ${factual.priceFormatted}` : '',
      pixLine ? `👉 *${pixLine.trim()}*` : '',
      store,
      '',
      '🛒 *Aproveite agora:*',
      link,
      '',
      '⚠️ _Estoque limitado!_'
    ].filter(line => line !== '').join('\n');
  }

  return baseLines.join('\n');
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
