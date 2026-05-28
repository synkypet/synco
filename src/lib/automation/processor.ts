import { automationService } from '@/services/supabase/automation-service';
import { AutomationRoute } from '@/types/automation';
import { marketplaceService } from '@/services/supabase/marketplace-service';
import { processLinks, ProductSnapshot } from '@/lib/linkProcessor';
import { campaignService } from '@/services/supabase/campaign-service';
import { productService } from '@/services/supabase/product-service';
import { createAdminClient } from '@/lib/supabase/admin';
import { fillTemplate } from './template-engine';
import { SupabaseClient } from '@supabase/supabase-js';
import { Marketplace, UserMarketplaceConnection } from '@/types/marketplace';
import { extractShopeeCoupons } from '@/lib/marketplaces/shopee/coupon-extractor';
import { parseShopeeOfferContext } from '@/lib/marketplaces/shopee/offer-parser';
import { shopeeCouponService } from '@/services/supabase/shopee-coupon-service';
import { shopeePromoPageService } from '@/services/supabase/shopee-promo-page-service';

export interface InboundPayload {
  userId: string;
  channelId: string;
  externalGroupId: string;
  messageId: string;
  body: string;
  isFromMe: boolean;
}

/**
 * Filtros de Automação (Fase 2)
 */
function applyFilters(snapshot: ProductSnapshot, originalBody: string, filters?: AutomationRoute['filters']): boolean {
  if (!filters) return true;

  const factual = snapshot.factual;
  const productTitle = (factual.title || "").toLowerCase();
  const shopName = (factual.shopName || "").toLowerCase();
  const category = (factual as any).category ? (factual as any).category.toLowerCase() : "";
  const messageBody = originalBody.toLowerCase();

  // 1. Filtro de Preço Mínimo
  if (filters.min_price && factual.currentPriceFactual && factual.currentPriceFactual < filters.min_price) {
    console.log(`[FILTER] Price too low: ${factual.currentPriceFactual} < ${filters.min_price}`);
    return false;
  }

  // 2. Filtro de Comissão Mínima
  if (filters.min_commission_rate && factual.commissionRate && (factual.commissionRate * 100) < filters.min_commission_rate) {
    console.log(`[FILTER] Commission too low: ${factual.commissionRate * 100}% < ${filters.min_commission_rate}%`);
    return false;
  }

  // 3. Blacklist de Keywords (Título, Loja, Categoria e Texto Original)
  if (filters.keywords_blacklist && filters.keywords_blacklist.length > 0) {
    const hasBlacklisted = filters.keywords_blacklist.some((word: string) => {
      const w = word.toLowerCase().trim();
      return productTitle.includes(w) || shopName.includes(w) || category.includes(w) || messageBody.includes(w);
    });
    if (hasBlacklisted) {
      console.log(`[FILTER] Blacklisted keyword found`);
      return false;
    }
  }

  // 4. Whitelist de Keywords
  if (filters.keywords_whitelist && filters.keywords_whitelist.length > 0) {
    const hasWhitelisted = filters.keywords_whitelist.some((word: string) => {
      const w = word.toLowerCase().trim();
      return productTitle.includes(w) || shopName.includes(w) || category.includes(w) || messageBody.includes(w);
    });
    if (!hasWhitelisted) {
      console.log(`[FILTER] No whitelisted keyword found`);
      return false;
    }
  }

  return true;
}

/**
 * Extrai links da Shopee de um texto.
 */
function extractShopeeLinks(text: string): string[] {
  // Regex mais restrita: deve começar com http e ser um domínio Shopee direto, não um parâmetro
  const shopeeRegex = /(?:^|\s)(https?:\/\/(?:[a-zA-Z0-9-]+\.)?(?:shopee\.com\.br|shope\.ee|br\.shp\.ee)\/[^\s]+)/gi;
  const matches = [];
  let match;
  while ((match = shopeeRegex.exec(text)) !== null) {
    let url = match[1].trim();
    url = url.replace(/[.,)\]]+$/, '');
    matches.push(url);
  }
  return [...new Set(matches)];
}

/**
 * Extrai links do Mercado Livre de um texto.
 */
function extractMercadoLivreLinks(text: string): string[] {
  // Domínios permitidos: mercadolivre.com.br, www.mercadolivre.com.br, produto.mercadolivre.com.br, meli.la, e /social/ dentro de mercadolivre
  const mlRegex = /(?:^|\s)(https?:\/\/(?:[a-zA-Z0-9-]+\.)?(?:mercadolivre\.com\.br|meli\.la)\/[^\s]+)/gi;
  const matches = [];
  let match;
  while ((match = mlRegex.exec(text)) !== null) {
    let url = match[1].trim();
    // Limpar pontuação final que pode vir grudada na URL em mensagens
    url = url.replace(/[.,)\]]+$/, '');
    matches.push(url);
  }
  return [...new Set(matches)];
}

/**
 * Normaliza uma URL da Shopee.
 */
function normalizeShopeeUrl(url: string): string {
  try {
    const u = new URL(url);
    u.search = ''; 
    return u.toString().toLowerCase();
  } catch {
    return url.toLowerCase();
  }
}

function isCompleteForAutomation(snapshot: ProductSnapshot): boolean {
  const factual = snapshot.factual;

  const title = factual.title || '';
  const image = factual.image || '';
  const price = Number(factual.currentPriceFactual ?? factual.price ?? 0);
  const finalLink = factual.finalLinkToSend || factual.affiliateLink || '';

  const titleOk =
    title.trim().length >= 4 &&
    title !== 'Produto Mercado Livre' &&
    !title.toLowerCase().includes('produto Mercado Livre');

  const hardFailed =
    factual.reaffiliation_status === 'failed' ||
    factual.reaffiliation_status === 'blocked' ||
    factual.shortGenerationStatus === 'no_session' ||
    factual.shortGenerationStatus === 'fallback';

  return Boolean(
    titleOk &&
    image &&
    image.length > 5 &&
    price > 0 &&
    finalLink &&
    factual.price_unavailable !== true &&
    factual.quality === 'complete' &&
    factual.priceSource !== 'fallback' &&
    factual.imageSource !== 'fallback' &&
    factual.titleSource !== 'url_slug_fallback' &&
    !hardFailed
  );
}

export async function processInboundAutomation(payload: InboundPayload, client?: SupabaseClient) {
  const { userId, channelId, externalGroupId, body, isFromMe, messageId } = payload;
  const userTag = `[USER:${userId?.substring(0, 8)}]`;
  const logPrefix = `[PROCESSOR] ${userTag} [MSG:${messageId?.substring(0, 6)}] [GRP:${externalGroupId?.substring(0, 6)}]`;

  try {
    console.log(`${logPrefix} >>> INICIANDO PROCESSAMENTO E2E...`);

    const supabase: SupabaseClient = client || createAdminClient();

    // Camada 0: Dedupe de Mensagem (Evita duplo processamento de eventos do provedor)
    console.log(`${logPrefix} [STEP] Verificando duplicidade de mensagem...`);
    const isMessageDuplicate = await automationService.checkAndMarkMessageDedupe(channelId, messageId, supabase);
    console.log(`${logPrefix} [STEP] ✓ Duplicidade: ${isMessageDuplicate}`);
    
    if (isMessageDuplicate) {
      console.log(`${logPrefix} [SKIP] Motivo: Mensagem já processada (Message-Level Dedupe).`);
      return { skipped: 'msg_dedupe', details: { channelId, messageId } };
    }

    console.log(`${logPrefix} Data:`, { userId, channelId, externalGroupId, isFromMe, bodyPreview: body?.substring(0, 50) });

    if (isFromMe) {
      console.log(`${logPrefix} [SKIP] Motivo: Mensagem enviada pelo próprio número (Self-sent).`);
      return { skipped: 'self_sent', reason: 'isFromMe is true' };
    }
    
    console.log(`${logPrefix} [STEP] Buscando fonte em 'automation_sources'...`, { userId, channelId, externalGroupId });
    const source = await automationService.getSourceByExternalId(userId, channelId, externalGroupId, supabase);
    
    if (!source) {
      console.warn(`${logPrefix} [SKIP] Motivo: Nenhuma fonte ATIVA encontrada para este conjunto.`);
      
      // Log de Observabilidade: Ajuda o usuário a entender por que o disparo não ocorreu
      await automationService.logEvent({
        source_id: '00000000-0000-0000-0000-000000000000', // ID nulo literal para logs sem fonte
        user_id: userId,
        status: 'filtered',
        event_type: 'source_not_found',
        details: { 
          channelId, 
          externalGroupId, 
          reason: 'Mensagem ignorada: Nenhuma automação ativa configurada para este grupo de origem.'
        }
      }, supabase);

      return { skipped: 'not_a_source', details: { userId, channelId, externalGroupId } };
    }

    console.log(`${logPrefix} [STEP] ✓ Fonte ID: ${source.id} ("${source.name}")`);

    // Camada 1: Validação de Status do Canal (Resiliente a desync de campos)
    const channel = await automationService.getChannelById(channelId, supabase);
    const channelConfig = (channel?.config as any) || {};
    const effectiveStatus = channelConfig.wasender_status || channelConfig.status;

    if (!channel || effectiveStatus !== 'connected') {
      console.warn(`${logPrefix} [SKIP] Motivo: Canal ${channelId} não está conectado (Status: ${effectiveStatus}).`);
      
      await automationService.logEvent({
        source_id: source.id,
        user_id: userId,
        status: 'filtered',
        event_type: 'channel_not_connected',
        details: { 
          channelId, 
          status: effectiveStatus,
          reason: 'O canal do WhatsApp não está conectado. Verifique o status na barra superior.'
        }
      }, supabase);

      return { skipped: 'channel_not_connected', channelId };
    }

    // ─── NOVO MOTOR DE CUPONS E LINKS (FASE 4) ───
    console.log(`${logPrefix} [STEP] Executando extrator de cupons Shopee e classificação de links...`);
    const context = parseShopeeOfferContext(body);
    const detectedCoupons = extractShopeeCoupons(body); // Mantém compatibilidade com a struct original
    
    // --- PERSISTÊNCIA DE CUPONS (FASE 2C.1) ---
    const couponAffiliateMap: Record<string, {
      code: string | null;
      originalRedemptionUrl: string | null;
      affiliateRedemptionUrl: string | null;
    }> = {};

    if (detectedCoupons.length > 0) {
      console.log(`${logPrefix} [STEP] Persistindo ${detectedCoupons.length} cupons candidatos...`);
      for (const coupon of detectedCoupons) {
        try {
          const result = await shopeeCouponService.persistCandidate(userId, coupon, {
            sourceId: source.id,
            sourceUrl: coupon.redemptionUrl || undefined,
            rawText: body
          }, supabase);

          let affiliateUrl = null;
          if (result && result.redemptionUrl && result.redemptionUrl !== coupon.redemptionUrl) {
            affiliateUrl = result.redemptionUrl;
          } else if (result && result.redemption_url && result.redemption_url !== coupon.redemptionUrl) {
            affiliateUrl = result.redemption_url;
          }

          if (coupon.code) {
             couponAffiliateMap[coupon.code] = {
               code: coupon.code,
               originalRedemptionUrl: coupon.redemptionUrl,
               affiliateRedemptionUrl: affiliateUrl
             };
          } else if (coupon.redemptionUrl) {
             couponAffiliateMap[coupon.redemptionUrl] = {
               code: null,
               originalRedemptionUrl: coupon.redemptionUrl,
               affiliateRedemptionUrl: affiliateUrl
             };
          }
        } catch (err) {
          console.error(`${logPrefix} [ERROR] Falha ao persistir cupom:`, err);
        }
      }
    }

    // Detecção robusta de links Shopee e Mercado Livre
    console.log(`${logPrefix} [STEP] Extraindo links do texto...`);
    let shopeeLinks = extractShopeeLinks(body);
    const mercadoLivreLinks = extractMercadoLivreLinks(body);

    // --- FILTRAGEM DE LINKS COMPLEMENTARES (FASE 4) ---
    // Removemos explicitamente links que a inteligência central classificou como 'voucher'.
    // Mantemos os que foram classificados como 'product'.
    let skippedVoucherLinks = 0;
    if (context.links.length > 0) {
      const voucherUrls = new Set(context.links.filter(l => l.role === 'voucher').map(l => l.url));
      const initialCount = shopeeLinks.length;
      shopeeLinks = shopeeLinks.filter(url => !voucherUrls.has(url));
      skippedVoucherLinks = initialCount - shopeeLinks.length;
      console.log(`[SHOPEE-LINK-FILTER] productLinks=${shopeeLinks.length} voucherLinks=${voucherUrls.size} skippedVoucherLinks=${skippedVoucherLinks}`);
    }

    const links = [...shopeeLinks, ...mercadoLivreLinks];
    
    // Se não há links nem cupons de código, então paramos
    if (links.length === 0 && detectedCoupons.filter(c => c.type === 'codigo').length === 0) {
      console.log(`${logPrefix} [SKIP] Motivo: Nenhum link de afiliado ou código de cupom identificado.`);
      return { skipped: 'no_affiliate_content', bodyPreview: body?.substring(0, 50) };
    }

    console.log(`${logPrefix} [STEP] ✓ Identificados ${shopeeLinks.length} links Shopee, ${mercadoLivreLinks.length} links ML e ${detectedCoupons.length} cupons.`);

    const connections = await marketplaceService.getEnrichedConnections(userId, supabase);
    console.log(`${logPrefix} [STEP] ✓ Conexões recuperadas. Buscando rotas de destino ativas para Source ${source.id}...`);
    
    const routes = await automationService.getRoutesBySourceId(source.id, supabase);
    
    if (routes.length === 0) {
      console.warn(`${logPrefix} [SKIP] Motivo: Nenhuma ROTA DE DESTINO ativa configurada para esta fonte.`);
      await automationService.logEvent({
        source_id: source.id,
        user_id: userId,
        status: 'filtered',
        event_type: 'no_routes_configured',
        details: { 
          channelId, 
          externalGroupId, 
          sourceId: source.id,
          reason: 'A automação está ativa mas não possui destinos (grupos ou listas) vinculados.'
        }
      }, supabase);
      return { skipped: 'no_routes_configured', sourceId: source.id };
    }

    console.log(`${logPrefix} [STEP] ✓ Encontradas ${routes.length} rotas de destino.`);

    const results = [];
    const adminEntry = supabase;

    // Buscar IDs remotos dos destinos para o Anti-loop
    console.log(`${logPrefix} [STEP] Resolvendo destinos da rota...`);
    const { data: routeDestinations } = await adminEntry
      .from('groups')
      .select('id, remote_id')
      .in('id', routes.map(r => r.target_id));

    console.log(`${logPrefix} [STEP] Iniciando iteração sobre os links...`);

    for (const rawUrl of links) {
      const isShopee = shopeeLinks.includes(rawUrl);
      const isML = mercadoLivreLinks.includes(rawUrl);
      const normalized = isShopee ? normalizeShopeeUrl(rawUrl) : rawUrl;
      
      console.log(`${logPrefix} [ITEM] Processando link: ${rawUrl}`);
      
      if (isML) {
        let inputKind = 'direct';
        if (rawUrl.includes('meli.la')) inputKind = 'meli_short';
        else if (rawUrl.includes('/social/')) inputKind = 'social';
        
        console.log(`[GROUP-MONITOR-LINK] marketplace=Mercado Livre inputKind=${inputKind}`);
        console.log(`[ML-GROUP-MONITOR] userIdPrefix=${userId.substring(0,8)} hasUserId=true`);
        console.log(`[ML-GROUP-MONITOR] detected=true count=1`);
      }
      
      try {
        console.log(`${logPrefix} [ITEM] Convertendo link e buscando metadados...`);
        
        if (isML) {
          console.log(`[ML-GROUP-MONITOR] processlinks_start`);
        }
        
        const snapshots = await processLinks(
          [rawUrl], 
          connections, 
          'auto', 
          userId, 
          supabase, 
          body,
          undefined,
          couponAffiliateMap
        );
        const snapshot = snapshots?.[0];

        if (!snapshot) {
          console.error(`${logPrefix} [ITEM] [ERROR] Falha ao capturar metadados do produto (Snapshot nulo).`);
          await automationService.logEvent({
            source_id: source.id,
            user_id: userId,
            status: 'error',
            event_type: 'fetch_failed',
            details: { url: normalized, messageId }
          }, supabase);
          continue;
        }

        if (isML) {
          console.log(`[ML-GROUP-MONITOR] processlinks_done hasSnapshot=true`);
          
          if (!isCompleteForAutomation(snapshot)) {
            console.warn(`${logPrefix} [ML-GROUP-MONITOR] blocked=true reason=incomplete_metadata`);
            
            await automationService.logEvent({
              source_id: source.id,
              user_id: userId,
              status: 'filtered',
              event_type: 'operational_lock',
              details: { 
                url: normalized, 
                status: snapshot.factual?.eligibility?.status || 'incomplete', 
                error: 'Oferta com metadados incompletos ou inválidos (Mercado Livre Quality Gate)', 
                messageId 
              }
            }, supabase);

            continue;
          }
          console.log(`[ML-GROUP-MONITOR] passed=true`);
          console.log(`[ML-GROUP-MONITOR] processed=true eligibility=${snapshot.factual.eligibility?.status || 'none'}`);
          if (snapshot.factual.reaffiliation_status === 'reaffiliated') {
            console.log(`[ML-GROUP-MONITOR] reaffiliate_success=true`);
          }
        }

        // --- GUARDIÃO OPERACIONAL (FRENTE 1 & 2) ---
        // A regra agora não depende apenas da afiliação, mas do contrato estrutural do linkProcessor
        const isEligible = snapshot.factual.eligibility?.isEligible;
        const eligibilityStatus = snapshot.factual.eligibility?.status;
        const reasons = snapshot.factual.eligibility?.reasons?.join(' | ') || 'Desconhecido';
        
        if (!isEligible) {
          console.warn(`${logPrefix} [ITEM] [HARD-LOCK] Bloqueado! Status: ${eligibilityStatus} | Motivos: ${reasons}`);
          await automationService.logEvent({
            source_id: source.id,
            user_id: userId,
            status: 'filtered',
            event_type: 'operational_lock',
            details: { url: normalized, status: eligibilityStatus, error: reasons, messageId }
          }, supabase);
          continue;
        }

        console.log(`${logPrefix} [ITEM] ✓ Produto: "${snapshot.factual.title}" | Preço: ${snapshot.factual.currentPriceFactual}`);

        // --- GUARDIÃO ANTES DE PERSISTIR PRODUTO (FASE 2) ---
        const offerType = snapshot.factual.eligibility?.offer_type;
        const isVoucherWallet = snapshot.factual.canonical_url?.includes('/user/voucher-wallet') || 
                                snapshot.factual.title?.toLowerCase() === 'user/voucher wallet' ||
                                (snapshot.factual.currentPriceFactual === 0 && (offerType === 'coupon_offer' || offerType === 'promo_landing'));

        if (offerType === 'coupon_offer' || offerType === 'promo_landing' || isVoucherWallet) {
          console.log(`${logPrefix} [SHOPEE-VOUCHER-SKIP] ignored_standalone_voucher_link=true reason=voucher_wallet_before_product_persist type=${offerType}`);
          
          // --- PERSISTÊNCIA DE PROMO LANDINGS ---
          if (offerType === 'promo_landing' && snapshot.factual.landing_type) {
            console.log(`${logPrefix} [ITEM] [STEP] Persistindo promo landing candidata: ${snapshot.factual.landing_type}`);
            try {
              await shopeePromoPageService.persistCandidate(userId, {
                landingType: snapshot.factual.landing_type,
                title: snapshot.factual.title,
                rawUrl: rawUrl,
                canonicalUrl: snapshot.factual.canonical_url,
                confidence: 1.0, 
                sourceId: source.id,
                sourceUrl: rawUrl,
                rawText: body
              }, supabase);
            } catch (err) {
              console.error(`${logPrefix} [ITEM] [ERROR] Falha ao persistir promo landing:`, err);
            }
          }
          continue; // Não salva em products nem envia automático
        }

        // --- ENRIQUECIMENTO DE DADOS (Estilo Radar) ---
        const commissionRate = snapshot.factual.commissionRate || 0;
        const currentPrice = snapshot.factual.currentPriceFactual || 0;
        const originalPrice = (snapshot.factual.originalPrice && snapshot.factual.originalPrice > currentPrice) 
          ? snapshot.factual.originalPrice 
          : null;
        
        let discountPercent = 0;
        if (originalPrice && originalPrice > currentPrice) {
          discountPercent = Math.round((1 - (currentPrice / originalPrice)) * 100);
        }

        const opportunityScore = Math.min(100, Math.round((discountPercent * 0.4) + (commissionRate * 100 * 0.6)));

        // --- UPSERT DO PRODUTO (Garante ID para o Log) ---
        let productId: string | undefined;
        try {
          const insertedProduct = await productService.upsertFromAutomation({
            name: snapshot.factual.title,
            marketplace: snapshot.factual.marketplace || 'Shopee',
            original_url: snapshot.factual.originalUrl || rawUrl,
            image_url: snapshot.factual.image || undefined,
            current_price: currentPrice,
            original_price: originalPrice ?? undefined, 
            discount_percent: (discountPercent > 0) ? Math.round(discountPercent) : undefined,
            commission_percent: Math.round(commissionRate * 100),
            commission_value: snapshot.factual.commissionValueFactual || 0,
            opportunity_score: opportunityScore,
            is_favorite: false,
            already_sent: false,
            free_shipping: false,
            official_store: false,
          }, supabase);
          productId = insertedProduct?.id;
          console.log(`${logPrefix} [ITEM] ✓ Produto vinculado (ID: ${productId}).`);
        } catch (dbErr) {
          console.error(`${logPrefix} [ITEM] Falha ao vincular produto:`, dbErr);
        }

        // Processar cada rota individualmente
        for (const route of routes) {
          console.log(`${logPrefix} [ITEM] -> Avaliando Rota: ${route.id} (Destino: ${route.target_id})`);
          
          const destInfo = routeDestinations?.find(d => d.id === route.target_id);
          if (destInfo?.remote_id === externalGroupId) {
            console.log(`${logPrefix} [ITEM] [ANTI-LOOP] Ignorado: Destino é o mesmo da Origem.`);
            await automationService.logEvent({
              source_id: source.id,
              user_id: userId,
              status: 'filtered',
              event_type: 'anti_loop',
              details: { url: normalized, targetId: route.target_id, messageId, productId }
            }, supabase);
            continue;
          }

          if (!applyFilters(snapshot, body, route.filters)) {
            console.log(`${logPrefix} [ITEM] [FILTERED] Ignorado: Rejeitado pelas regras da rota.`);
            await automationService.logEvent({
              source_id: source.id,
              user_id: userId,
              status: 'filtered',
              event_type: 'rule_rejected',
              details: { url: normalized, targetId: route.target_id, filters: route.filters, messageId, productId }
            }, supabase);
            continue;
          }

          // --- TRAVA DE SEGURANÇA (FASE 2G) ---
          // Promo landings e Cupons nunca são enviados automaticamente pelo Monitor/Radar.
          // Como já pulamos esses tipos antes, esse bloco atua apenas como sanity check adicional.
          if (snapshot.factual.eligibility.offer_type === 'promo_landing' || snapshot.factual.eligibility.offer_type === 'coupon_offer') {
            console.log(`${logPrefix} [ITEM] [SAFE-SKIP] Bloqueado: ${snapshot.factual.eligibility.offer_type} exige revisão manual no Radar.`);
            continue;
          }

          const finalMessage = route.template_config?.body 
            ? fillTemplate(route.template_config.body, snapshot.factual, source.name)
            : snapshot.copy.messageText;

          const campaignDto = {
            name: `AUTO: ${snapshot.factual.title.substring(0, 30)}...`,
            items: [{
              product_id: undefined, 
              product_name: snapshot.factual.title,
              custom_text: finalMessage,
              affiliate_url: snapshot.factual.finalLinkToSend,
              image_url: snapshot.factual.image,
              external_product_id: snapshot.factual.itemId?.toString(),
              installments: snapshot.factual.installments,
              
              // Elegibilidade Operacional Definitiva (Fase 2)
              eligibility_status: snapshot.factual.eligibility.status,
              eligibility_reasons: snapshot.factual.eligibility.reasons,
              reaffiliation_status: snapshot.factual.reaffiliation_status,
              reaffiliation_error: snapshot.factual.reaffiliation_error,
              offer_type: snapshot.factual.eligibility.offer_type
            }],
            destinations: [{
              type: route.target_type,
              id: route.target_id
            }],
            origin: 'monitor' as 'monitor'
          };

          console.log(`${logPrefix} [ITEM] [STEP] Criando campanha via campaignService...`);
          const campaign = await campaignService.create(userId, campaignDto, supabase);

          console.log(`${logPrefix} [ITEM] [SUCCESS] ★ Campanha #${campaign.id} criada.`);
          
          // Log de Despacho Detalhado (O que gera os cards ricos no UI)
          await automationService.logEvent({
            source_id: source.id,
            user_id: userId,
            status: 'processed',
            event_type: 'radar_dispatch',
            details: { 
              url: normalized, 
              productId, 
              routeId: route.id, 
              factualPrice: currentPrice,
              messageId
            }
          }, supabase);

          // Log Técnico de Criação de Job
          await automationService.logEvent({
            source_id: source.id,
            user_id: userId,
            status: 'processed',
            event_type: 'job_created',
            details: { url: normalized, productId, targetId: route.target_id, targetType: route.target_type, campaignId: campaign.id, messageId }
          }, supabase);

          results.push({ url: normalized, routeId: route.id, campaignId: campaign.id });
        }

        // --- PERSISTÊNCIA DE PROMO LANDINGS (FASE 2G.1A) ---
        // (Lógica movida para cima, antes do upsert do produto)

      } catch (err: any) {
        console.error(`${logPrefix} [ITEM] [EXCEPTION] Erro crítico no processamento do item:`, err);
        await automationService.logEvent({
          source_id: source.id,
          user_id: userId,
          status: 'error',
          event_type: 'processing_exception',
          details: { 
            url: normalized, 
            error: err.message || 'Erro desconhecido',
            stack: err.stack?.substring(0, 200)
          }
        }, supabase);
      }
    }

    console.log(`${logPrefix} >>> FINALIZADO. Itens processados: ${results.length}`);
    return { processed: results.length, details: results };

  } catch (error: any) {
    console.error(`${logPrefix} [CRITICAL-EXCEPTION] Falha fatal no processInboundAutomation:`, error);
    throw error;
  }
}
