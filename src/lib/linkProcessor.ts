// src/lib/linkProcessor.ts
// Processador de links real — usa adaptadores de marketplace em vez de mocks.

import { MarketplaceAdapter, AffiliateResult } from './marketplaces/BaseAdapter';
import { ShopeeAdapter } from './marketplaces/ShopeeAdapter';

export type Marketplace = 'Shopee' | 'Amazon' | 'Mercado Livre' | 'Magalu' | 'Unknown';

export interface ProcessedProduct {
  id: string;
  name: string;
  marketplace: Marketplace;
  originalPrice: number;
  currentPrice: number;
  discountPercent: number;
  imageUrl: string;
  originalUrl: string;
  affiliateUrl: string;
  metadata_failed?: boolean;
  commissionRate?: number;
  commissionValue?: number;
  pixPrice?: number;
  promoPrice?: number;
  hasPixDiscount?: boolean;
  pixDiscountPercent?: number;
}

// ─── Registry de Adapters ──────────────────────────────────────────────────
// Novos adapters devem ser instanciados e adicionados aqui.
const adapters: MarketplaceAdapter[] = [
  new ShopeeAdapter(),
  // new MercadoLivreAdapter(),  // TODO: Fase 2
  // new AmazonAdapter(),        // TODO: Fase 3
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

/**
 * Encontra o adapter adequado para uma URL.
 */
function findAdapter(url: string): MarketplaceAdapter | null {
  return adapters.find(adapter => adapter.canHandle(url)) || null;
}

/**
 * Processa uma lista de links usando os adapters reais e injeta as conexões cacheadas.
 * Para marketplaces sem adapter implementado, retorna dados básicos com fallback.
 */
export async function processLinks(links: string[], userConnections: any[] = []): Promise<ProcessedProduct[]> {
  const validLinks = links.filter(link => link.trim().length > 0);
  const results: ProcessedProduct[] = [];

  for (const link of validLinks) {
    const id = `proc_${Date.now()}_${results.length}`;
    const marketplace = detectMarketplace(link);
    const adapter = findAdapter(link);

    if (adapter) {
      // ─── Processamento Real via Adapter ────────────────────────────────
      try {
        const dbMarketplaceName = marketplace.toLowerCase().replace(' ', '');
        const connection = userConnections.find(c => c.marketplace_name?.toLowerCase().replace(' ', '') === dbMarketplaceName);
        
        const result: AffiliateResult = await adapter.process(link, connection);

        results.push({
          id,
          name: result.metadata?.name || `Produto ${marketplace}`,
          marketplace,
          originalPrice: result.metadata?.originalPrice || 0,
          currentPrice: result.metadata?.currentPrice || 0,
          discountPercent: result.metadata?.discountPercent || 0,
          imageUrl: result.metadata?.imageUrl || '',
          originalUrl: link,
          affiliateUrl: result.affiliateUrl,
          metadata_failed: result.metadata?.metadata_failed || !result.metadata,
          commissionRate: result.metadata?.commissionRate,
          commissionValue: result.metadata?.commissionValue,
          pixPrice: result.metadata?.pixPrice,
          promoPrice: result.metadata?.promoPrice,
          hasPixDiscount: result.metadata?.hasPixDiscount,
          pixDiscountPercent: result.metadata?.pixDiscountPercent
        });
      } catch (error) {
        console.error(`linkProcessor: Failed to process ${link}:`, error);
        // Fallback: retornar dados mínimos
        results.push({
          id,
          name: `Produto ${marketplace} (Tracking Aplicado)`,
          marketplace,
          originalPrice: 0,
          currentPrice: 0,
          discountPercent: 0,
          imageUrl: '',
          originalUrl: link,
          affiliateUrl: link,
          metadata_failed: true
        });
      }
    } else {
      // ─── Sem Adapter — Retorna dados básicos ───────────────────────────
      results.push({
        id,
        name: `Original ${marketplace}`,
        marketplace,
        originalPrice: 0,
        currentPrice: 0,
        discountPercent: 0,
        imageUrl: '',
        originalUrl: link,
        affiliateUrl: link,
        metadata_failed: true
      });
    }
  }

  return results;
}
