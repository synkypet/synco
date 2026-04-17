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
  metadata_error?: string;
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
  installments?: string | null;

  // Timestamps
  fetchedAt?: string;
}

export interface AffiliateResult {
  originalUrl: string;
  cleanUrl: string;
  affiliateUrl: string;
  metadata: ProductMetadata | null;
  
  // ─── Novos campos de Auditoria e Reafiliação (Fase 1) ──────────────────────
  incoming_url: string;
  resolved_url?: string;
  canonical_url: string;
  generated_affiliate_url?: string;
  redirect_chain?: string[];
  reaffiliation_status: 'not_needed' | 'resolved' | 'canonicalized' | 'reaffiliated' | 'blocked' | 'failed';
  reaffiliation_error?: string;
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
   * @deprecated Usar preProcessIncomingLink para fluxos novos.
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
   * Realiza o pré-processamento completo do link:
   * Classify -> Resolve -> Canonicalize -> Re-affiliate
   * 
   * Implementação default para compatibilidade.
   */
  async preProcessIncomingLink(url: string, connection?: UserMarketplaceConnection): Promise<Partial<AffiliateResult>> {
    const cleanedUrl = await this.cleanUrl(url);
    const affiliateUrl = await this.generateAffiliateLink(cleanedUrl, connection);
    
    return {
      incoming_url: url,
      canonical_url: cleanedUrl,
      affiliateUrl,
      reaffiliation_status: 'not_needed'
    };
  }

  /**
   * Método de conveniência que executa o pipeline completo:
   * preProcessIncomingLink → fetchMetadata (Enrichment)
   */
  async process(rawUrl: string, connection?: UserMarketplaceConnection): Promise<AffiliateResult> {
    // 1. Pré-processamento (Classify, Resolve, Canonicalize, Re-affiliate)
    const preResult = await this.preProcessIncomingLink(rawUrl, connection);
    
    // 2. Hard Block: Se o pré-processamento falhar ou for bloqueado, para aqui.
    if (preResult.reaffiliation_status === 'blocked' || preResult.reaffiliation_status === 'failed') {
      return {
        originalUrl: rawUrl,
        cleanUrl: preResult.canonical_url || rawUrl,
        affiliateUrl: preResult.generated_affiliate_url || preResult.affiliateUrl || rawUrl,
        metadata: null,
        incoming_url: rawUrl,
        canonical_url: preResult.canonical_url || rawUrl,
        reaffiliation_status: preResult.reaffiliation_status,
        reaffiliation_error: preResult.reaffiliation_error,
        ...preResult
      } as AffiliateResult;
    }

    // 3. Enrichment: Apenas se passou no pré-processamento e re-affiliate.
    // fetchMetadata NUNCA recebe o link curto original.
    const metadata = await this.fetchMetadata(preResult.canonical_url!, connection);
    
    return {
      originalUrl: rawUrl,
      cleanUrl: preResult.canonical_url!,
      affiliateUrl: preResult.generated_affiliate_url || preResult.affiliateUrl || rawUrl,
      metadata,
      incoming_url: rawUrl,
      canonical_url: preResult.canonical_url!,
      reaffiliation_status: preResult.reaffiliation_status || 'not_needed',
      ...preResult
    } as AffiliateResult;
  }
}
