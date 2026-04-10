// src/lib/marketplaces/BaseAdapter.ts
// Classe abstrata que define o contrato para cada adaptador de marketplace.
import { UserMarketplaceConnection } from '@/types/marketplace';

export interface ProductMetadata {
  name: string;
  originalPrice: number;
  currentPrice: number;
  discountPercent: number;
  imageUrl: string;
  marketplace: string;
  metadata_failed?: boolean;
  commissionRate?: number;
  commissionValue?: number;
  
  // Identificação e Links Oficiais
  itemId?: string | number;
  shopId?: string | number;
  shopName?: string;
  productLink?: string;
  offerLink?: string;
  productCatIds?: number[];
  
  // Detalhes extras
  shortLink?: string;
  
  // ─── Auditoria e Detalhamento de Preço (Fase 1 Pro) ──────────────────────
  
  // Campos Brutos (conforme retornados pela API)
  rawPrice?: string;
  rawPriceMin?: string;
  rawPriceMax?: string;
  rawCommission?: string;
  rawCommissionRate?: string;
  rawSellerCommissionRate?: string;
  rawShopeeCommissionRate?: string;

  // Campos Factuais Normalizados
  currentPriceFactual: number;
  currentPriceSource: 'api.priceMin' | 'api.price' | 'fallback';
  commissionValueFactual: number;
  commissionSource: 'api.commission' | 'calculated' | 'fallback';
  
  // Detalhes de Comissão Granular
  sellerCommissionRate?: number;
  shopeeCommissionRate?: number;
  
  // Campos de Estimativa (Opcionais)
  estimatedPixPrice?: number | null;
  estimatedPixSource?: 'heuristic.pix_0_92' | null;

  // Timestamps
  fetchedAt?: string;
}

export interface AffiliateResult {
  originalUrl: string;
  cleanUrl: string;
  affiliateUrl: string;
  metadata: ProductMetadata | null;
}

export abstract class MarketplaceAdapter {
  /**
   * Nome do marketplace (ex: 'Shopee', 'Mercado Livre')
   */
  abstract readonly name: string;

  /**
   * Verifica se o adapter é capaz de processar essa URL.
   */
  abstract canHandle(url: string): boolean;

  /**
   * Limpa a URL removendo tracking params, resolve short-links, etc.
   */
  abstract cleanUrl(url: string): Promise<string>;

  /**
   * Busca metadados do produto (nome, preço, imagem).
   * Retorna null se não conseguir obter.
   */
  abstract fetchMetadata(url: string, connection?: UserMarketplaceConnection): Promise<ProductMetadata | null>;

  /**
   * Gera o link de afiliado a partir da URL limpa.
   */
  abstract generateAffiliateLink(cleanUrl: string, connection?: UserMarketplaceConnection, metadata?: ProductMetadata | null): Promise<string>;

  /**
   * Método de conveniência que executa o pipeline completo:
   * cleanUrl → fetchMetadata → generateAffiliateLink
   */
  async process(rawUrl: string, connection?: UserMarketplaceConnection): Promise<AffiliateResult> {
    const cleanedUrl = await this.cleanUrl(rawUrl);
    const metadata = await this.fetchMetadata(cleanedUrl, connection);
    const affiliateUrl = await this.generateAffiliateLink(cleanedUrl, connection, metadata);

    return {
      originalUrl: rawUrl,
      cleanUrl: cleanedUrl,
      affiliateUrl,
      metadata
    };
  }
}
