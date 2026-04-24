// src/lib/marketplaces/ShopeeAdapter.ts
// Adapter Shopee Pro — Fase 1: Auditoria e Normalização Factual.

import { MarketplaceAdapter, ProductMetadata, AffiliateResult } from './BaseAdapter';
import { UserMarketplaceConnection } from '@/types/marketplace';
import { ShopeeAffiliateClient } from '@/lib/shopee-affiliate/client';
import { getCategoryName } from './shopee/categories';
import { cleanProductName } from './shopee/cleaner';
import { isBrazilFriendlyProduct } from '@/lib/filters/brazil-friendly';

export class ShopeeAdapter extends MarketplaceAdapter {
  readonly name = 'Shopee';

  canHandle(url: string): boolean {
    const lower = url.toLowerCase();
    return lower.includes('shopee.com.br') || lower.includes('shope.ee') || lower.includes('br.shp.ee');
  }

  // ─── Pré-processamento Explícito (Fase 1) ──────────────────────────────

  /**
   * Realiza o pré-processamento completo do link Shopee:
   * classify -> resolve -> canonicalize -> re-affiliate
   */
  async preProcessIncomingLink(url: string, connection?: UserMarketplaceConnection): Promise<Partial<AffiliateResult>> {
    const requestId = Math.random().toString(36).substring(7);

    // A. Classificar o link
    const isShortS = url.includes('s.shopee.com.br');
    const isShortMobile = url.includes('br.shp.ee');
    const isShortLegacy = url.includes('shope.ee');

    // shope.ee legacy continua bloqueado por enquanto (raro)
    if (isShortLegacy) {
      console.warn(`[SHOPEE-PREPROCESS] [${requestId}] Bloqueado: Link legacy shope.ee detectado.`);
      return {
        incoming_url: url,
        reaffiliation_status: 'blocked',
        reaffiliation_error: 'Links shope.ee não são suportados nesta fase.'
      };
    }

    let resolvedUrl = url;
    let redirectChain: string[] = [url];
    let status: 'not_needed' | 'resolved' | 'canonicalized' | 'reaffiliated' | 'blocked' | 'failed' = 'not_needed';

    // B. Resolver o short link (s.shopee ou br.shp.ee)
    if (isShortS || isShortMobile) {
      const typeLabel = isShortS ? 'S.SHOPEE' : 'BR.SHP.EE (MOBILE)';
      console.log(`[SHOPEE-PREPROCESS] [${requestId}] [${typeLabel}] Detectado. Iniciando resolução de URL...`);
      try {
        const resolution = await this.resolveShopeeShortLink(url);
        resolvedUrl = resolution.resolvedUrl;
        redirectChain = resolution.chain;
        status = 'resolved';
        console.log(`[SHOPEE-PREPROCESS] [${requestId}] [${typeLabel}] Resolvido com sucesso para: ${resolvedUrl}`);
      } catch (error: any) {
        console.error(`[SHOPEE-PREPROCESS] [${requestId}] [${typeLabel}] Falha na resolução:`, error.message);
        return {
          incoming_url: url,
          reaffiliation_status: 'failed',
          reaffiliation_error: `Falha ao resolver link curto (${typeLabel}): ${error.message}`,
          redirect_chain: redirectChain
        };
      }
    }

    // C. Canonicalizar a URL final
    const canonicalUrl = await this.canonicalizeShopeeUrl(resolvedUrl);
    if (status === 'resolved') status = 'canonicalized';
    console.log(`[SHOPEE-PREPROCESS] [${requestId}] Canônico: ${canonicalUrl}`);

    // --- CLASSIFICAÇÃO DE TIPO DE LINK (FRENTE 2) ---
    // Valida se o link resultante é de fato um produto enriquecível ou uma página institucional/promo
    const { shopId, itemId } = this.extractIds(canonicalUrl);
    const isProduct = !!(shopId && itemId);

    if (!isProduct) {
      console.warn(`[SHOPEE-PREPROCESS] [${requestId}] Bloqueado: Link não é de produto.`);

      let reason = 'Link Shopee não é produto (capa/promo/categoria)';
      const lowerUrl = canonicalUrl.toLowerCase();

      if (lowerUrl.includes('/cart')) {
        reason = 'Link Shopee não é produto (carrinho)';
      } else if (lowerUrl.includes('/voucher-wallet') || lowerUrl.includes('/user/voucher')) {
        reason = 'Link Shopee não é produto (cupom)';
      } else if (lowerUrl.includes('/m/')) {
        reason = 'Link Shopee não é produto (landing promocional)';
      } else if (lowerUrl.includes('/events/')) {
        reason = 'Link Shopee não é produto (evento promocional)';
      }

      return {
        incoming_url: url,
        resolved_url: resolvedUrl,
        canonical_url: canonicalUrl,
        redirect_chain: redirectChain,
        reaffiliation_status: 'blocked',
        reaffiliation_error: reason
      };
    }

    // D. Gerar novo link afiliado (Re-afiliação)
    if (!connection?.shopee_app_id || !connection?.shopee_app_secret) {
      console.warn(`[SHOPEE-PREPROCESS] [${requestId}] Bloqueado: Usuário não possui credenciais Shopee configuradas.`);
      return {
        incoming_url: url,
        resolved_url: resolvedUrl,
        canonical_url: canonicalUrl,
        redirect_chain: redirectChain,
        reaffiliation_status: 'blocked',
        reaffiliation_error: 'Credenciais de afiliado Shopee ausentes para este usuário.'
      };
    }

    try {
      console.log(`[SHOPEE-PREPROCESS] [${requestId}] Gerando novo link de afiliado...`);
      const generatedLink = await this.generateAffiliateLink(canonicalUrl, connection);

      // Validação de segurança: o adaptador não pode retornar o link original se as credenciais existem
      if (!generatedLink || generatedLink === canonicalUrl) {
        throw new Error('Falha técnica na geração do link de afiliado pela API');
      }

      console.log(`[SHOPEE-PREPROCESS] [${requestId}] Sucesso: ${generatedLink}`);
      return {
        incoming_url: url,
        resolved_url: resolvedUrl,
        canonical_url: canonicalUrl,
        generated_affiliate_url: generatedLink,
        redirect_chain: redirectChain,
        reaffiliation_status: 'reaffiliated'
      };
    } catch (error: any) {
      console.error(`[SHOPEE-PREPROCESS] [${requestId}] Erro na reafiliação:`, error.message);
      return {
        incoming_url: url,
        resolved_url: resolvedUrl,
        canonical_url: canonicalUrl,
        redirect_chain: redirectChain,
        reaffiliation_status: 'blocked',
        reaffiliation_error: `Falha na reafiliação: ${error.message}`
      };
    }
  }

  /**
   * Segue redirects manualmente para capturar a cadeia de redirecionamento.
   * Implementa timeout de 5s e 1 retry controlado.
   */
  private async resolveShopeeShortLink(url: string, maxRedirects = 10): Promise<{ resolvedUrl: string, chain: string[] }> {
    let currentUrl = url;
    const chain = [url];
    let redirects = 0;
    const MAX_RETRIES = 1;
    const TIMEOUT_MS = 5000;

    while (redirects < maxRedirects) {
      let attempts = 0;
      let success = false;
      let lastError: any = null;

      while (attempts <= MAX_RETRIES && !success) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

        try {
          const res = await fetch(currentUrl, {
            method: 'GET',
            redirect: 'manual',
            signal: controller.signal
          });

          clearTimeout(timeout);
          success = true;

          // Redirect status codes: 301, 302, 303, 307, 308
          if (res.status >= 300 && res.status < 400) {
            const location = res.headers.get('location');
            if (location) {
              const nextUrl = new URL(location, currentUrl).toString();
              if (chain.includes(nextUrl)) break; // Evita loop infinito
              currentUrl = nextUrl;
              chain.push(currentUrl);
              redirects++;
              continue;
            }
          }
          // Se não for redirect, saímos do loop de redirects
          return { resolvedUrl: currentUrl, chain };

        } catch (error: any) {
          clearTimeout(timeout);
          attempts++;
          lastError = error;

          const isTimeout = error.name === 'AbortError';
          const errorType = isTimeout ? 'TIMEOUT' : 'NETWORK_ERROR';

          console.warn(`[SHOPEE-RESOLVE] [ATTEMPT:${attempts}] ${errorType} para ${currentUrl}: ${error.message}`);

          if (attempts <= MAX_RETRIES) {
            console.log(`[SHOPEE-RESOLVE] Tentando novamente (${attempts}/${MAX_RETRIES})...`);
            // Pequeno delay antes do retry
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        }
      }

      if (!success) {
        const finalErrorType = lastError?.name === 'AbortError' ? 'TIMEOUT_PERMANENT' : 'FETCH_EXCEPTION';
        throw new Error(`${finalErrorType}: ${lastError?.message || 'Erro desconhecido'}`);
      }
    }

    return { resolvedUrl: currentUrl, chain };
  }

  /**
   * Limpa a URL e normaliza o formato Shopee.
   */
  private async canonicalizeShopeeUrl(url: string): Promise<string> {
    try {
      // 1. Tentar extrair IDs primeiro para canonicalização agressiva
      const { shopId, itemId } = this.extractIds(url);

      if (shopId && itemId) {
        // Formato universal e mais robusto para enrichment e persistência
        return `https://shopee.com.br/product/${shopId}/${itemId}`;
      }

      const parsed = new URL(url);

      // Remover parâmetros de rastreamento comuns
      const paramsToRemove = ['sp_atk', 'xptdk', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'smtt'];
      paramsToRemove.forEach(p => parsed.searchParams.delete(p));

      // Limpeza de ancoras e fragmentos desnecessários
      parsed.hash = '';

      return parsed.toString();
    } catch {
      return url;
    }
  }

  /**
   * Legado para compatibilidade se algo ainda chamar diretamente
   */
  async cleanUrl(url: string): Promise<string> {
    const pre = await this.preProcessIncomingLink(url);
    return pre.canonical_url || url;
  }

  // ─── Helpers de Extração e Normalização ────────────────────────────────

  private extractIds(url: string) {
    // 1. Padrão slug-i.shopId.itemId
    const legacyMatch = url.match(/-i\.(\d+)\.(\d+)/);
    if (legacyMatch) return { shopId: legacyMatch[1], itemId: legacyMatch[2] };

    // 2. Padrão /product/shopId/itemId
    const productMatch = url.match(/\/product\/(\d+)\/(\d+)/);
    if (productMatch) return { shopId: productMatch[1], itemId: productMatch[2] };

    // 3. Padrão /{slug}/{shopId}/{itemId} (Comum em redirects de short links)
    const slugIdMatch = url.match(/\/([^\/?]+)\/(\d+)\/(\d+)/);
    if (slugIdMatch) return { shopId: slugIdMatch[2], itemId: slugIdMatch[3] };

    return { shopId: null, itemId: null };
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
   * Normaliza valores de preço/comissão tratando a escala da Shopee (micros vs cents).
   * @deprecated Usar lógica baseada em nó para maior precisão (Fase 2)
   */
  private normalizeValue(val: any): number {
    const num = parseFloat(String(val || "0"));
    if (isNaN(num)) return 0;
    // Heurística legada (mantida para compatibilidade em fetchMetadata individual)
    return num > 50000 ? num / 100000 : num;
  }

  /**
   * Detecta a escala mais provável (1, 100 ou 100.000) baseada nos valores do nó.
   */
  private detectBestScale(node: any): 1 | 100 | 100000 {
    const rawPriceStr = String(node.priceMin || node.price || "0");
    const rawPrice = parseFloat(rawPriceStr);
    if (rawPrice === 0) return 100000;

    // 1. Se o valor bruto já contém ponto decimal (ex: 16.2), assumimos Escala 1 (Já em Reais)
    if (rawPriceStr.includes('.')) {
      if (rawPrice < 20000) return 1;
    }

    // 2. Se for um valor inteiro pequeno (ex: 16, 49), provavelmente é Escala 1
    if (rawPrice < 1000) return 1;

    // 3. Diferenciação entre Cents (100) e Micros (100.000)
    const asCents = rawPrice / 100;
    const asMicros = rawPrice / 100000;

    // Se em escala de centavos o preço for "humano" (< 5000) 
    // e em escala de micros for irrisório (< 0.50), escala é 100.
    if (asCents < 5000 && asMicros < 0.5) return 100;
    
    // Default oficial da Shopee para a maioria dos casos é micros
    return 100000;
  }

  // ─── Captura de Metadados Pro ──────────────────────────────────────────

  async fetchMetadata(url: string, connection?: UserMarketplaceConnection): Promise<ProductMetadata | null> {
    const { shopId, itemId } = this.extractIds(url);
    const keyword = this.extractKeyword(url);
    const nameFallback = keyword ? keyword.charAt(0).toUpperCase() + keyword.slice(1) : 'Produto Shopee';

    const hasCredentials = connection?.shopee_app_id && connection?.shopee_app_secret;
    if (!hasCredentials) return this.fallback(nameFallback, 'Missing credentials');

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
      if (allNodes.length === 0) return this.fallback(nameFallback, 'No nodes found in API');

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

      // Heurística Parcelamento (Se preço > 50, assume 3x para o template)
      const installmentsVal = currentPriceFactual / 3;
      const installments = currentPriceFactual > 50
        ? `3x de R$ ${installmentsVal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
        : null;

      // Validação de qualidade mínima (Hard Guardrail)
      const hasImage = !!winner.imageUrl && winner.imageUrl.length > 10;
      const hasRealTitle = !!winner.productName && winner.productName.length > 5 && winner.productName !== nameFallback;
      const isGoodMatch = ranked[0].score >= 80; // Pelo menos itemId ou shopId bateram

      if (!hasImage || !hasRealTitle || !isGoodMatch) {
        console.warn(`[SHOPEE ADAPTER] Metadata insuficiente para ${url}. Image: ${hasImage}, Title: ${hasRealTitle}, Score: ${ranked[0].score}`);
        return this.fallback(winner.productName || nameFallback, 'Insufficient quality');
      }

      console.log('--- [SHOPEE PRO AUDIT] ---');
      console.log(`Item auditado: ${winner.productName}`);
      console.log(`Price Factual: ${currentPriceFactual} (Source: ${currentPriceSource})`);
      console.log(`Pix Estimado: ${estimatedPixPrice}`);
      console.log(`Parcelas (Heurística): ${installments}`);
      console.log(`Commission Factual: ${commissionValueFactual} (Source: ${commissionSource})`);
      console.log('--------------------------');

      const cleanTitle = cleanProductName(winner.productName || nameFallback);

      return {
        name: cleanTitle,
        originalPrice: this.normalizeValue(winner.priceMax) || currentPriceFactual,
        currentPrice: currentPriceFactual,
        discountPercent: parseFloat(winner.priceDiscountRate || "0"),
        imageUrl: winner.imageUrl || '',
        installments,
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
      return this.fallback(nameFallback, error.message);
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

  /**
   * Descoberta ativa de produtos por estratégia (sortType).
   * 1: Top Sales, 3: Hot, 5: Recommendation
   */
  async discoverProducts(options: { 
    limit?: number; 
    sortType?: number;
    listType?: number;
    keyword?: string;
    minPrice?: number;
    maxPrice?: number;
    minCommission?: number;
    page?: number;
    connection: UserMarketplaceConnection 
  }): Promise<ProductMetadata[]> {
    const { 
      limit = 20, 
      sortType = 1,   // 1 = Específico/relevância (alinhado com referência)
      listType = 0,   // 0 = Padrão, 1 = Promoção (alinhado com referência)
      keyword, 
      minPrice, 
      maxPrice, 
      minCommission,
      page = 1,
      connection 
    } = options;

    if (!connection.shopee_app_id || !connection.shopee_app_secret) {
      throw new Error('Connection missing App ID or Secret');
    }

    try {
      const client = new ShopeeAffiliateClient({
        appId: connection.shopee_app_id,
        secret: connection.shopee_app_secret
      });

      // Busca com parâmetros nativos da Shopee (alinhado com referência)
      const nodes = await client.searchProducts({ 
        limit: Math.max(limit, 50), 
        sortType,
        listType,
        keyword,
        page
      });

      // Log resumido apenas do volume
      if (nodes.length > 0) {
        console.log(`[SHOPEE-DISCOVERY] Obtidos ${nodes.length} nós brutos da API.`);
      }

      return nodes
        .map(node => {
          const scale = this.detectBestScale(node);
          const normalize = (v: any) => {
            const num = parseFloat(String(v || "0")) / scale;
            return Math.round(num * 100) / 100; // Normaliza para 2 casas decimais
          };

          const factualPrice = normalize(node.priceMin || node.price);
          const rawCommRate = node.commissionRate !== undefined && node.commissionRate !== null 
            ? parseFloat(String(node.commissionRate)) 
            : undefined;
          
          const commissionAmt = rawCommRate ? factualPrice * rawCommRate : 0;
          const cleanTitle = cleanProductName(node.productName);
          
          const canonicalUrl = node.offerLink || node.productLink || 
            (node.shopId && node.itemId 
              ? `https://shopee.com.br/product/${node.shopId}/${node.itemId}` 
              : '');
          
          const brResult = isBrazilFriendlyProduct({ name: cleanTitle });
          
          return {
            name: cleanTitle,
            originalPrice: normalize(node.priceMax) || factualPrice,
            currentPrice: factualPrice,
            currentPriceFactual: factualPrice,
            currentPriceSource: 'api.price' as const,
            commissionValueFactual: commissionAmt,
            commissionSource: 'api.commission' as const,
            discountPercent: node.priceDiscountRate ? parseFloat(node.priceDiscountRate) : 0,
            imageUrl: node.imageUrl || '',
            marketplace: 'Shopee' as const,
            shopName: node.shopName || 'Shopee',
            shopId: String(node.shopId || ''),
            shopType: node.shopType || '',
            sales: node.sales ? parseInt(String(node.sales)) : 0,
            ratingStar: node.ratingStar ? parseFloat(String(node.ratingStar)) : 0,
            category: getCategoryName(node.productCatIds || []),
            itemId: String(node.itemId || ''),
            commissionRate: rawCommRate,
            productLink: canonicalUrl,
            offerLink: node.offerLink,
            fetchedAt: new Date().toISOString(),
            brazil_friendly: brResult.decision,

            // Metadados de Auditoria v2
            price_scale_used: scale,
            rawPrice: String(node.price || ''),
            rawPriceMin: String(node.priceMin || ''),
            rawPriceMax: String(node.priceMax || ''),
            rawOriginalPrice: String(node.originalPrice || ''),
            rawCommission: String(node.commission || ''),
            rawCommissionRate: String(node.commissionRate || '')
          };
        })
        .filter(p => {
          // FASE 2: Integridade técnica mínima (os únicos que excluem)
          const hasTitle = !!p.name && p.name.length > 3;
          const hasImage = !!p.imageUrl && p.imageUrl.length > 10;
          const hasPrice = p.currentPrice > 0;
          const hasUrl = !!p.productLink;
          const hasCommission = (p.commissionRate || 0) > 0;

          return hasTitle && hasImage && hasPrice && hasUrl && hasCommission;
        })
        .slice(0, limit);
    } catch (error: any) {
      console.error(`[SHOPEE-DISCOVERY] Error:`, error.message);
      return [];
    }
  }

  private fallback(name: string, reason?: string): ProductMetadata {
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
      metadata_failed: true,
      metadata_error: reason
    };
  }
}
