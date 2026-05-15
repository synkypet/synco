import { SupabaseClient } from '@supabase/supabase-js';
import { automationService } from '@/services/supabase/automation-service';
import { marketplaceService } from '@/services/supabase/marketplace-service';
import { ShopeeAdapter } from '@/lib/marketplaces/ShopeeAdapter';
import { campaignService } from '@/services/supabase/campaign-service';
import { triggerWorker } from '@/lib/worker/trigger';
import { resolveUserAccess } from '@/services/supabase/access-service';
import { renderSmartTemplate, DEFAULT_TEMPLATES } from '@/lib/templates/universal-template-engine';
import { normalizeShopeeCouponForMessage } from '@/lib/marketplaces/shopee/coupon-extractor';

export interface CapturedCouponDispatchResult {
  jobsCreated: number;
  sourcesProcessed: number;
  couponsProcessed: number;
  skippedByDedupe: number;
  skippedByGlobalTargetDedupe: number;
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
    const { data: sources, error: sourcesError } = await supabase
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

    if (sourcesError) {
      console.error(`${logPrefix} Erro ao buscar fontes:`, sourcesError);
      return { jobsCreated: 0, sourcesProcessed: 0, couponsProcessed: 0, skippedByDedupe: 0, skippedByGlobalTargetDedupe: 0 };
    }

    if (!sources || sources.length === 0) {
      console.log(`${logPrefix} Nenhuma automação de cupons capturados ativa encontrada.`);
      return { 
        jobsCreated: 0, 
        sourcesProcessed: 0,
        couponsProcessed: 0,
        skippedByDedupe: 0,
        skippedByGlobalTargetDedupe: 0
      };
    }

    console.log(`${logPrefix} Automações ativas encontradas: ${sources.length}`);

    let totalCreated = 0;
    let totalCouponsProcessed = 0;
    let totalSkippedByDedupe = 0;
    let totalSkippedByGlobalTargetDedupe = 0;
    const userAccessCache = new Map<string, any>();
    const userConnectionsCache = new Map<string, any[]>();
    const shopeeAdapter = new ShopeeAdapter();

    for (const source of sources) {
      const userTag = `[USER:${source.user_id.substring(0,8)}]`;
      const sourceLogPrefix = `${logPrefix} ${userTag}`;

      const routes = (source.automation_routes || []).filter((r: any) => r.is_active);
      if (routes.length === 0) {
        console.log(`${sourceLogPrefix} [SOURCE:${source.id}] Sem rotas ativas configuradas.`);
        continue;
      }

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
      
      console.log(`${sourceLogPrefix} Encontrados ${capturedCoupons.length} cupons candidatos.`);

      const config = source.config || {};
      const batchLimit = config.batchLimit || 5;
      let userCycleCount = 0;

      for (const coupon of capturedCoupons) {
        if (userCycleCount >= batchLimit) break;

        for (const route of routes) {
          if (userCycleCount >= batchLimit) break;

          // --- 4. DEDUPE ---
          // 4.1 Dedupe por Rota (Permanente)
          const isRouteDuplicate = await automationService.checkCouponDispatch(
            source.user_id,
            coupon.id,
            route.id,
            route.target_id,
            supabase
          );

          if (isRouteDuplicate) {
            totalSkippedByDedupe++;
            continue;
          }

          // 4.2 Dedupe Global por Destino (Evita duplicidade entre diferentes automações)
          const isGlobalDuplicate = await automationService.checkGlobalTargetCouponDispatch(
            source.user_id,
            coupon.id,
            route.target_id,
            supabase
          );

          if (isGlobalDuplicate) {
            totalSkippedByGlobalTargetDedupe++;
            // Registrar como pulado por dedupe global para evitar re-processamento por esta rota
            await automationService.registerCouponDispatch({
              user_id: source.user_id,
              coupon_id: coupon.id,
              route_id: route.id,
              target_id: route.target_id,
              status: 'skipped',
              dedupe_key: `global_dedupe:${source.user_id}:${coupon.id}:${route.target_id}`
            }, supabase);
            continue;
          }
          
          totalCouponsProcessed++;

          // --- 5. NORMALIZATION & RE-AFFILIATION ---
          try {
            // Normalizar dados do cupom (extrair código do label, limpar lixo)
            const norm = normalizeShopeeCouponForMessage(coupon);
            
            let finalAffiliateLink = '';
            
            if (norm.effectiveLink) {
              const preResult = await shopeeAdapter.preProcessIncomingLink(norm.effectiveLink, shopeeConn);
              
              if (preResult.reaffiliation_status === 'reaffiliated' || preResult.reaffiliation_status === 'canonicalized' || preResult.reaffiliation_status === 'resolved') {
                finalAffiliateLink = preResult.generated_affiliate_url || preResult.affiliateUrl || '';
              } else {
                console.warn(`${sourceLogPrefix} [SKIP] Falha na reafiliação do cupom ${coupon.id}: ${preResult.reaffiliation_error}`);
                continue;
              }
            }

            // Se não tem link de resgate e nem código, o cupom é inválido para envio
            if (!finalAffiliateLink && !norm.code) {
              console.warn(`${sourceLogPrefix} [SKIP] Cupom ${coupon.id} sem link de resgate e sem código.`);
              continue;
            }

            // --- 6. RENDER TEMPLATE ---
            // Construímos um contexto simplificado para o cupom usando os dados normalizados
            const couponContext = {
              product_name: norm.discountLine || 'Cupom Shopee',
              affiliate_link: finalAffiliateLink,
              coupon_code: norm.code,
              coupon_discount_line: norm.discountLine,
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

            if (!messageText) {
              console.warn(`${sourceLogPrefix} [SKIP] Template resultou em mensagem vazia para cupom ${coupon.id}`);
              continue;
            }

            // --- 7. CREATE CAMPAIGN ---
            const campaign = await campaignService.create(source.user_id, {
              name: `Automação: ${source.name}`,
              origin: 'automation_coupon',
              destinations: [{
                type: route.target_type,
                id: route.target_id
              }],
              metadata: {
                automationCouponSend: true,
                confirmedAutomationRoute: true,
                automationSourceId: source.id,
                automationRouteId: route.id,
                couponId: coupon.id,
                dispatchOrigin: 'captured_coupon_dispatch',
                // Guardar dados do cupom no metadata global para facilitar rastreio se necessário
                coupon_label: norm.discountLine,
                coupon_code: norm.code
              },
              items: [{
                product_name: norm.discountLine || 'Cupom Shopee',
                custom_text: messageText,
                affiliate_url: finalAffiliateLink,
                offer_type: 'coupon_offer',
                eligibility_status: 'eligible',
                eligibility_reasons: []
              }]
            }, supabase);

            totalCreated++;
            userCycleCount++;

            // Registrar sucesso na tabela de deduplicação
            await automationService.registerCouponDispatch({
              user_id: source.user_id,
              coupon_id: coupon.id,
              route_id: route.id,
              target_id: route.target_id,
              campaign_id: campaign.id,
              status: 'queued',
              dedupe_key: `user:${source.user_id}:coupon:${coupon.id}:route:${route.id}:target:${route.target_id}`
            }, supabase);

            console.log(`${sourceLogPrefix} [SUCCESS] Campanha ${campaign.id} criada para cupom ${coupon.id}`);

          } catch (err: any) {
            console.error(`${sourceLogPrefix} [ERROR] Erro ao processar cupom ${coupon.id}:`, err.message);
            // Registrar falha para evitar retry infinito no mesmo ciclo
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

    console.log(`${logPrefix} Ciclo finalizado. Total de campanhas criadas: ${totalCreated} | Processados: ${totalCouponsProcessed} | Dedupe Rota: ${totalSkippedByDedupe} | Dedupe Global: ${totalSkippedByGlobalTargetDedupe}`);
    
    return { 
      jobsCreated: totalCreated,
      sourcesProcessed: sources.length,
      couponsProcessed: totalCouponsProcessed,
      skippedByDedupe: totalSkippedByDedupe,
      skippedByGlobalTargetDedupe: totalSkippedByGlobalTargetDedupe
    };
  }
};
