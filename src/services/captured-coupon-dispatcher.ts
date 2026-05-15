import { SupabaseClient } from '@supabase/supabase-js';
import { automationService } from '@/services/supabase/automation-service';
import { marketplaceService } from '@/services/supabase/marketplace-service';
import { ShopeeAdapter } from '@/lib/marketplaces/ShopeeAdapter';
import { campaignService } from '@/services/supabase/campaign-service';
import { triggerWorker } from '@/lib/worker/trigger';
import { resolveUserAccess } from '@/services/supabase/access-service';
import { buildSmartContext, renderSmartTemplate, DEFAULT_TEMPLATES } from '@/lib/templates/universal-template-engine';

export interface CapturedCouponDispatchResult {
  jobsCreated: number;
}

export const capturedCouponDispatcher = {
  /**
   * Distribui cupons capturados (discovered_coupons) via automação específica.
   */
  async executeDispatch(
    supabase: SupabaseClient,
    options: { requestId?: string } = {}
  ): Promise<CapturedCouponDispatchResult> {
    const rid = options.requestId || Math.random().toString(36).substring(7);
    const logPrefix = `[CAPTURED-COUPON-DISPATCHER] [${rid}]`;

    console.log(`${logPrefix} Iniciando ciclo de despacho de cupons capturados...`);

    // 1. Buscar todas as fontes de "Cupons Capturados" ativas
    const { data: sources } = await supabase
      .from('automation_sources')
      .select(`
        *,
        automation_routes (
          id,
          target_type,
          target_id,
          filters,
          template_id,
          template_config,
          is_active
        )
      `)
      .eq('source_type', 'captured_coupons_shopee')
      .eq('is_active', true);

    if (!sources || sources.length === 0) {
      console.log(`${logPrefix} Nenhuma automação de cupons capturados ativa encontrada.`);
      return { jobsCreated: 0 };
    }

    let totalCreated = 0;
    const userAccessCache = new Map<string, any>();
    const userConnectionsCache = new Map<string, any[]>();
    const shopeeAdapter = new ShopeeAdapter();

    for (const source of sources) {
      const userTag = `[USER:${source.user_id.substring(0,8)}]`;
      const sourceLogPrefix = `${logPrefix} ${userTag}`;

      const routes = (source.automation_routes || []).filter((r: any) => r.is_active);
      if (routes.length === 0) continue;

      // --- 1. BILLING & ACCESS ---
      let access = userAccessCache.get(source.user_id);
      if (!access) {
        access = await resolveUserAccess(source.user_id, supabase);
        userAccessCache.set(source.user_id, access);
      }
      if (!access.isOperative) {
        console.warn(`${sourceLogPrefix} [SKIP] Usuário não operativo.`);
        continue;
      }

      // --- 2. SHOPEE CREDENTIALS ---
      let connections = userConnectionsCache.get(source.user_id);
      if (!connections) {
        connections = await marketplaceService.getEnrichedConnections(source.user_id, supabase);
        userConnectionsCache.set(source.user_id, connections);
      }
      const shopeeConn = connections.find(c => c.marketplace_name === 'Shopee');
      if (!shopeeConn || !shopeeConn.shopee_app_id || !shopeeConn.shopee_app_secret) {
        console.warn(`${sourceLogPrefix} [SKIP] Shopee não configurada.`);
        continue;
      }

      // --- 3. FETCH CAPTURED COUPONS ---
      // Pegamos os cupons capturados recentemente (ex: últimas 48h) que estão em estado 'candidate' ou 'valid'
      const { data: capturedCoupons } = await supabase
        .from('discovered_coupons')
        .select('*')
        .eq('user_id', source.user_id)
        .in('status', ['candidate', 'valid'])
        .gte('last_seen_at', new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString())
        .order('last_seen_at', { ascending: false });

      if (!capturedCoupons || capturedCoupons.length === 0) {
        console.log(`${sourceLogPrefix} Nenhum cupom capturado recente encontrado.`);
        continue;
      }

      const config = source.config || {};
      const batchLimit = config.batchLimit || 5;
      let userCycleCount = 0;

      for (const coupon of capturedCoupons) {
        if (userCycleCount >= batchLimit) break;

        for (const route of routes) {
          if (userCycleCount >= batchLimit) break;

          // --- 4. DEDUPE ---
          const isDuplicate = await automationService.checkCouponDispatch(
            source.user_id,
            coupon.id,
            route.id,
            route.target_id,
            supabase
          );

          if (isDuplicate) continue;

          // --- 5. RE-AFFILIATION & VALIDATION ---
          try {
            let finalAffiliateLink = '';
            
            if (coupon.redemption_url) {
              const preResult = await shopeeAdapter.preProcessIncomingLink(coupon.redemption_url, shopeeConn);
              
              if (preResult.reaffiliation_status === 'reaffiliated' || preResult.reaffiliation_status === 'canonicalized' || preResult.reaffiliation_status === 'resolved') {
                finalAffiliateLink = preResult.generated_affiliate_url || preResult.affiliateUrl || '';
              } else {
                console.warn(`${sourceLogPrefix} [SKIP] Falha na reafiliação do cupom ${coupon.id}: ${preResult.reaffiliation_error}`);
                continue;
              }
            }

            // Se não tem link de resgate e nem código, o cupom é inválido para envio
            if (!finalAffiliateLink && !coupon.code) {
              console.warn(`${sourceLogPrefix} [SKIP] Cupom ${coupon.id} sem link de resgate e sem código.`);
              continue;
            }

            // --- 6. RENDER TEMPLATE ---
            // Construímos um contexto simplificado para o cupom
            const couponContext = {
              product_name: coupon.coupon_label || 'Cupom Shopee',
              affiliate_link: finalAffiliateLink,
              coupon_code: coupon.code,
              coupon_discount_line: coupon.coupon_label ? `⚡ *${coupon.coupon_label}*` : '',
              coupon_link: finalAffiliateLink,
              smart_price_block: '',
              original_price_line: '',
              current_price_line: '',
              coupon_block: '',
              disclaimer: '',
              marketplace: 'Shopee',
              offer_type: 'coupon_offer' as any
            };

            const templateBody = route.template_config?.body || DEFAULT_TEMPLATES.shopee_coupon;
            const messageText = renderSmartTemplate(templateBody, couponContext as any);

            // --- 7. CREATE CAMPAIGN ---
            const campaignData = {
              name: `AUTO-CUPOM: ${coupon.coupon_label?.substring(0, 30) || coupon.code || 'Capturado'}`,
              origin: 'automation_coupon' as any,
              metadata: {
                automationCouponSend: true,
                confirmedAutomationRoute: true,
                automationSourceId: source.id,
                automationRouteId: route.id,
                couponId: coupon.id,
                dispatchOrigin: 'captured_coupon_automation'
              },
              destinations: [{
                type: route.target_type,
                id: route.target_id
              }],
              items: [{
                product_name: coupon.coupon_label || 'Cupom Shopee',
                custom_text: messageText,
                image_url: null, // Cupons capturados geralmente não têm imagem robusta fácil
                affiliate_url: finalAffiliateLink,
                eligibility_status: 'eligible' as const,
                eligibility_reasons: ['automation_authorized_coupon']
              }]
            };

            const campaign = await campaignService.create(source.user_id, campaignData, supabase);

            // --- 8. REGISTER HISTORY ---
            await automationService.registerCouponDispatch({
              user_id: source.user_id,
              coupon_id: coupon.id,
              route_id: route.id,
              target_id: route.target_id,
              campaign_id: campaign.id,
              status: 'sent',
              dedupe_key: `user:${source.user_id}:coupon:${coupon.id}:route:${route.id}:target:${route.target_id}`
            }, supabase);

            await automationService.logEvent({
              source_id: source.id,
              user_id: source.user_id,
              status: 'processed',
              event_type: 'captured_coupon_dispatch',
              details: { 
                campaignId: campaign.id,
                couponId: coupon.id,
                routeId: route.id
              }
            }, supabase);

            totalCreated++;
            userCycleCount++;
            console.log(`${sourceLogPrefix} [DISPATCHED] Cupom capturado "${coupon.code || coupon.coupon_label}" enviado para ${route.target_id}`);

          } catch (err: any) {
            console.error(`${sourceLogPrefix} Erro no ciclo de despacho do cupom ${coupon.id}:`, err.message);
            
            // Registrar falha para evitar loop infinito em erros persistentes
            await automationService.registerCouponDispatch({
              user_id: source.user_id,
              coupon_id: coupon.id,
              route_id: route.id,
              target_id: route.target_id,
              status: 'failed',
              dedupe_key: `user:${source.user_id}:coupon:${coupon.id}:route:${route.id}:target:${route.target_id}`
            }, supabase);
          }
        }
      }
    }

    if (totalCreated > 0) {
      await triggerWorker({ requestId: rid });
    }

    console.log(`${logPrefix} Ciclo finalizado. Total de campanhas de cupons capturados criadas: ${totalCreated}`);
    return { jobsCreated: totalCreated };
  }
};
