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
  // Detalhamento de preço SYNCO
  pixPrice?: number;
  promoPrice?: number;
  hasPixDiscount?: boolean;
  pixDiscountPercent?: number;
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
  abstract generateAffiliateLink(cleanUrl: string, connection?: UserMarketplaceConnection): Promise<string>;

  /**
   * Método de conveniência que executa o pipeline completo:
   * cleanUrl → fetchMetadata → generateAffiliateLink
   */
  async process(rawUrl: string, connection?: UserMarketplaceConnection): Promise<AffiliateResult> {
    const cleanedUrl = await this.cleanUrl(rawUrl);
    const metadata = await this.fetchMetadata(cleanedUrl, connection);
    const affiliateUrl = await this.generateAffiliateLink(cleanedUrl, connection);

    return {
      originalUrl: rawUrl,
      cleanUrl: cleanedUrl,
      affiliateUrl,
      metadata
    };
  }
}
