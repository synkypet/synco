// src/lib/marketplaces/ShopeeAdapter.ts
// Adapter Shopee Pro — Fase 1: Auditoria e Normalização Factual.

import { MarketplaceAdapter, ProductMetadata } from './BaseAdapter';
import { UserMarketplaceConnection } from '@/types/marketplace';
import { ShopeeAffiliateClient } from '@/lib/shopee-affiliate/client';

export class ShopeeAdapter extends MarketplaceAdapter {
  readonly name = 'Shopee';

  canHandle(url: string): boolean {
    const lower = url.toLowerCase();
    return lower.includes('shopee.com.br') || lower.includes('shope.ee');
  }

  // ─── Limpeza e Resolução de URL ────────────────────────────────────────

  async cleanUrl(url: string): Promise<string> {
    let resolvedUrl = url;

    if (url.includes('shope.ee')) {
      try {
        const res = await fetch(url, { method: 'HEAD', redirect: 'follow' });
        resolvedUrl = res.url || url;
      } catch {
        resolvedUrl = url;
      }
    }

    try {
      const parsed = new URL(resolvedUrl);
      const paramsToRemove = ['sp_atk', 'xptdk', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];
      paramsToRemove.forEach(p => parsed.searchParams.delete(p));
      return parsed.toString();
    } catch {
      return resolvedUrl;
    }
  }

  // ─── Helpers de Extração e Normalização ────────────────────────────────

  private extractIds(url: string) {
    const match = url.match(/-i\.(\d+)\.(\d+)/) || url.match(/\/product\/(\d+)\/(\d+)/);
    return {
      shopId: match ? match[1] : null,
      itemId: match ? match[2] : null
    };
  }

  private extractKeyword(url: string): string {
    try {
      const parsed = new URL(url);
      const pathname = decodeURIComponent(parsed.pathname);
      return pathname
        .replace(/^\/+/, "")
        .replace(/-i\.\d+\.\d+.*$/, "")
        .replace(/[-_]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    } catch {
      return "";
    }
  }

  private scoreNode(node: any, target: { shopId?: string | null; itemId?: string | null; keyword?: string }): number {
    let score = 0;
    if (String(node.itemId) === String(target.itemId)) score += 100;
    if (String(node.shopId) === String(target.shopId)) score += 80;
    const normalize = (t: string) => t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
    const nodeName = normalize(node.productName || "");
    const targetKey = normalize(target.keyword || "");
    if (nodeName === targetKey) score += 60;
    if (nodeName.includes(targetKey) && targetKey.length > 5) score += 40;
    const words = targetKey.split(" ").filter(w => w.length > 3);
    words.forEach(w => { if (nodeName.includes(w)) score += 4; });
    return score;
  }

  /**
   * Normaliza valores de preço/comissão tratando a escala da Shopee (micros vs direto).
   */
  private normalizeValue(val: any): number {
    const num = parseFloat(String(val || "0"));
    if (isNaN(num)) return 0;
    // Se o valor for maior que 50000, assumimos escala de micros (divisão por 10^5)
    return num > 50000 ? num / 100000 : num;
  }

  // ─── Captura de Metadados Pro ──────────────────────────────────────────

  async fetchMetadata(url: string, connection?: UserMarketplaceConnection): Promise<ProductMetadata | null> {
    const { shopId, itemId } = this.extractIds(url);
    const keyword = this.extractKeyword(url);
    const nameFallback = keyword ? keyword.charAt(0).toUpperCase() + keyword.slice(1) : 'Produto Shopee';

    const hasCredentials = connection?.shopee_app_id && connection?.shopee_app_secret;
    if (!hasCredentials) return this.fallback(nameFallback);

    try {
      const client = new ShopeeAffiliateClient({
        appId: connection!.shopee_app_id!,
        secret: connection!.shopee_app_secret!
      });

      const [exactNodes, keywordNodes] = await Promise.all([
        (shopId && itemId) ? client.searchProducts({ shopId, itemId, limit: 5 }).catch(() => []) : Promise.resolve([]),
        keyword ? client.searchProducts({ keyword, sortType: 1, limit: 10 }).catch(() => []) : Promise.resolve([])
      ]);

      const allNodes = [...exactNodes, ...keywordNodes];
      if (allNodes.length === 0) return this.fallback(nameFallback);

      const ranked = allNodes
        .map(node => ({
          node,
          score: this.scoreNode(node, { shopId, itemId, keyword })
        }))
        .sort((a, b) => b.score - a.score);

      const winner = ranked[0].node;
      
      // ─── Auditoria e Decisão de Preço ──────────────────────────────────
      
      // Captura de Brutos
      const rawPrice = winner.price || "0";
      const rawPriceMin = winner.priceMin || rawPrice;
      const rawPriceMax = winner.priceMax || rawPrice;
      const rawCommission = String(winner.commission || "0");
      const rawCommissionRate = String(winner.commissionRate || "0");

      // Valores Normalizados
      const normPrice = this.normalizeValue(rawPrice);
      const normPriceMin = this.normalizeValue(rawPriceMin);
      
      // Decisão do Preço Factual
      let currentPriceFactual = normPriceMin || normPrice;
      let currentPriceSource: 'api.priceMin' | 'api.price' | 'fallback' = normPriceMin ? 'api.priceMin' : 'api.price';

      // Decisão da Comissão Factual
      let commissionValueFactual = this.normalizeValue(rawCommission);
      let commissionSource: 'api.commission' | 'calculated' | 'fallback' = 'api.commission';

      if (commissionValueFactual === 0 && rawCommissionRate !== "0") {
        commissionValueFactual = currentPriceFactual * parseFloat(rawCommissionRate);
        commissionSource = 'calculated';
      }

      // Heurística Pix (Opcional e Marcadamente Estimada)
      const estimatedPixPrice = currentPriceFactual * 0.92;
      const estimatedPixSource = 'heuristic.pix_0_92';

      console.log('--- [SHOPEE PRO AUDIT] ---');
      console.log(`Vencedor: ${winner.productName}`);
      console.log(`Price Factual: ${currentPriceFactual} (Source: ${currentPriceSource})`);
      console.log(`Pix Estimado: ${estimatedPixPrice}`);
      console.log(`Commission Factual: ${commissionValueFactual} (Source: ${commissionSource})`);
      console.log('--------------------------');

      return {
        name: winner.productName || nameFallback,
        /**
         * NOTA TÉCNICA: O campo originalPrice (GraphQL) não existe no node productOfferV2.
         * Inferimos o preço original usando priceMax (Fonte Factual API).
         * Se o produto tiver variação/grade, priceMax representará o teto da oferta.
         */
        originalPrice: this.normalizeValue(winner.priceMax) || currentPriceFactual,
        currentPrice: currentPriceFactual,
        discountPercent: parseFloat(winner.priceDiscountRate || "0"),
        imageUrl: winner.imageUrl || '',
        marketplace: 'Shopee',
        shopName: winner.shopName || 'Shopee',
        
        // Novos Campos de Auditoria Fase 1
        rawPrice,
        rawPriceMin: String(rawPriceMin || "0"),
        rawPriceMax: String(rawPriceMax || "0"),
        rawCommission,
        rawCommissionRate,
        rawSellerCommissionRate: String(winner.sellerCommissionRate || "0"),
        rawShopeeCommissionRate: String(winner.shopeeCommissionRate || "0"),

        currentPriceFactual,
        currentPriceSource,
        commissionValueFactual,
        commissionSource,

        sellerCommissionRate: parseFloat(String(winner.sellerCommissionRate || "0")),
        shopeeCommissionRate: parseFloat(String(winner.shopeeCommissionRate || "0")),
        
        estimatedPixPrice,
        estimatedPixSource,

        commissionRate: parseFloat(String(rawCommissionRate)),
        commissionValue: commissionValueFactual,
        
        itemId: String(winner.itemId || itemId || ''),
        shopId: String(winner.shopId || shopId || ''),
        productLink: winner.productLink,
        offerLink: winner.offerLink,
        fetchedAt: new Date().toISOString()
      };

    } catch (error: any) {
      console.error('[SHOPEE ADAPTER] Erro:', error.message);
      return this.fallback(nameFallback);
    }
  }

  async generateAffiliateLink(cleanUrl: string, connection?: UserMarketplaceConnection): Promise<string> {
    if (!connection?.shopee_app_id || !connection?.shopee_app_secret) return cleanUrl;
    try {
      const client = new ShopeeAffiliateClient({
        appId: connection.shopee_app_id,
        secret: connection.shopee_app_secret
      });
      return await client.generateShortLink(cleanUrl);
    } catch (error: any) {
      console.error('[SHOPEE ADAPTER] Erro ao gerar link:', error.message);
      return cleanUrl;
    }
  }

  private fallback(name: string): ProductMetadata {
    return {
      name,
      originalPrice: 0,
      currentPrice: 0,
      currentPriceFactual: 0,
      currentPriceSource: 'fallback',
      commissionValueFactual: 0,
      commissionSource: 'fallback',
      discountPercent: 0,
      imageUrl: '',
      marketplace: 'Shopee',
      metadata_failed: true
    };
  }
}
