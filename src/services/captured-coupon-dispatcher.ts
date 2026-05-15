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
    options: { requestId?: string; services?: { automationService?: any } } = {}
  ): Promise<CapturedCouponDispatchResult> {
    const autoService = options.services?.automationService || automationService;
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

      for (const route of routes) {
        const routeLogPrefix = `${sourceLogPrefix} [ROUTE:${route.id.substring(0,8)}]`;

        // --- 3. SYNC RULES FROM CANDIDATES ---
        // Garante que novos cupons capturados virem regras (is_selected=false por padrão)
        try {
          await automationService.syncRulesFromCandidates(source.id, route.id, source.user_id, supabase);
        } catch (syncErr: any) {
          console.error(`${routeLogPrefix} Erro ao sincronizar candidatos:`, syncErr.message);
        }

        // --- 4. FETCH ACTIVE RULES ---
        // Buscamos apenas regras selecionadas, ativas e que já venceram o agendamento
        const now = new Date();
        const { data: activeRules, error: rulesError } = await supabase
          .from('automation_coupon_rules')
          .select(`
            *,
            coupon:discovered_coupons(*),
            promo_page:discovered_promo_pages(*)
          `)
          .eq('source_id', source.id)
          .eq('route_id', route.id)
          .eq('is_selected', true)
          .eq('is_active', true)
          .or(`next_run_at.lte.${now.toISOString()},next_run_at.is.null`)
          .order('next_run_at', { ascending: true });

        if (rulesError) {
          console.error(`${routeLogPrefix} Erro ao buscar regras:`, rulesError);
          continue;
        }

        if (!activeRules || activeRules.length === 0) {
          continue;
        }

        console.log(`${routeLogPrefix} Encontradas ${activeRules.length} regras selecionadas para processamento.`);

        const config = source.config || {};
        const batchLimit = config.batchLimit || 5;
        let routeCycleCount = 0;

        for (const rule of activeRules) {
          if (routeCycleCount >= batchLimit) break;

          const itemType = rule.item_type;
          const coupon = rule.coupon;
          const promoPage = rule.promo_page;

          // --- 5. GUARDRAIL: PROMO LANDING PROTECTION ---
          if (itemType === 'promo_landing') {
            console.log(`${routeLogPrefix} [RULE:${rule.id}] Pulo: promo_landing requer opt-in explícito e guardrail dedicado.`);
            // Marcamos como processado para não travar o loop de agendamento se estiver selecionado
            const nextRunAt = new Date(Date.now() + (rule.interval_minutes || 60) * 60000);
            await autoService.updateCouponRule(rule.id, { 
              next_run_at: nextRunAt.toISOString(),
              updated_at: new Date().toISOString()
            }, supabase);
            continue;
          }

          if (itemType === 'coupon' && !coupon) {
            console.warn(`${routeLogPrefix} [RULE:${rule.id}] Regra de cupom sem o cupom descoberto.`);
            continue;
          }

          // --- 6. DETERMINISTIC CYCLE KEY (BUCKET-BASED) ---
          // A cycle_key é baseada no cupom, destino e no bucket de tempo do intervalo.
          // Isso garante que se o mesmo cupom for disparado por rotas diferentes
          // para o mesmo destino no mesmo ciclo, eles batam no mesmo bucket e ocorra o dedupe.
          const intervalMinutes = rule.interval_minutes || 60;
          const intervalMs = intervalMinutes * 60 * 1000;
          const anchorTs = new Date(rule.next_run_at || now).getTime();
          // Bucketing: Truncamos o horário do agendamento para o início do intervalo
          const bucketTs = Math.floor(anchorTs / intervalMs) * intervalMs;
          
          // Chave: coupon + target + bucket (Global Cycle Dedupe)
          const cycleKey = `coupon:${coupon.id}:target:${route.target_id}:due:${bucketTs}`;

          // --- 7. DEDUPE ---
          // 7.1 Dedupe por Rota + Ciclo (Recorrência Segura)
          const isCycleDuplicate = await autoService.checkCouponDispatch(
            source.user_id,
            coupon.id,
            route.id,
            route.target_id,
            cycleKey,
            supabase
          );

          if (isCycleDuplicate) {
            totalSkippedByDedupe++;
            continue;
          }

          // 7.2 Dedupe Global por Destino (Opcional, mas mantido para segurança inicial)
          // Na recorrência, talvez o usuário QUEIRA reenviar o mesmo cupom mesmo que outra automação tenha enviado.
          // Mas por enquanto mantemos a política de não floodar o mesmo destino com o mesmo cupom.
          const isGlobalDuplicate = await autoService.checkGlobalTargetCouponDispatch(
            source.user_id,
            coupon.id,
            route.target_id,
            supabase
          );

          if (isGlobalDuplicate) {
            totalSkippedByGlobalTargetDedupe++;
            // Registrar como pulado para este ciclo
            await autoService.registerCouponDispatch({
              user_id: source.user_id,
              coupon_id: coupon.id,
              route_id: route.id,
              target_id: route.target_id,
              status: 'skipped',
              cycle_key: cycleKey,
              dedupe_key: `global_dedupe:${source.user_id}:${coupon.id}:${route.target_id}`
            }, supabase);
            
            // Avançar o agendamento da regra para o próximo ciclo
            const nextRunAt = new Date(Date.now() + (rule.interval_minutes || 60) * 60000);
            await autoService.updateCouponRule(rule.id, { 
              next_run_at: nextRunAt.toISOString()
            }, supabase);
            continue;
          }
          
          totalCouponsProcessed++;

          // --- 8. NORMALIZATION & RE-AFFILIATION ---
          try {
            const norm = normalizeShopeeCouponForMessage(coupon);
            let finalAffiliateLink = '';
            
            if (norm.effectiveLink) {
              const preResult = await shopeeAdapter.preProcessIncomingLink(norm.effectiveLink, shopeeConn);
              if (preResult.reaffiliation_status === 'reaffiliated' || preResult.reaffiliation_status === 'canonicalized' || preResult.reaffiliation_status === 'resolved') {
                finalAffiliateLink = preResult.generated_affiliate_url || preResult.affiliateUrl || '';
              } else {
                console.warn(`${routeLogPrefix} [SKIP] Falha na reafiliação do cupom ${coupon.id}: ${preResult.reaffiliation_error}`);
                continue;
              }
            }

            if (!finalAffiliateLink && !norm.code) {
              console.warn(`${routeLogPrefix} [SKIP] Cupom ${coupon.id} sem link de resgate e sem código.`);
              continue;
            }

            // --- 9. RENDER TEMPLATE ---
            const couponContext = {
              product_name: norm.discountLine.replace(/^💸\s*/, '') || 'Cupom Shopee',
              affiliate_link: finalAffiliateLink,
              coupon_code: norm.code,
              coupon_code_line: norm.code ? `🎟️ *Código:* ${norm.code}` : '',
              coupon_discount_line: norm.discountLine,
              coupon_link: finalAffiliateLink,
              coupon_link_line: finalAffiliateLink ? `🔗 *Resgate aqui:*\n${finalAffiliateLink}` : '',
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
              console.warn(`${routeLogPrefix} [SKIP] Template resultou em mensagem vazia para cupom ${coupon.id}`);
              continue;
            }

            // --- 10. CREATE CAMPAIGN ---
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
                couponRuleId: rule.id,
                couponId: coupon.id,
                cycleKey: cycleKey,
                dispatchOrigin: 'captured_coupon_dispatch'
              },
              items: [{
                product_name: norm.code ? `Cupom Shopee ${norm.code}` : (norm.discountLine.replace(/^💸\s*/, '') || 'Cupom Shopee'),
                custom_text: messageText,
                affiliate_url: finalAffiliateLink,
                offer_type: 'coupon_offer',
                eligibility_status: 'eligible',
                eligibility_reasons: []
              }]
            }, supabase);

            let sendJobId: string | null = null;
            let jobStatus: any = 'queued';
            
            const { data: jobs } = await supabase
              .from('send_jobs')
              .select('id, status')
              .eq('campaign_id', campaign.id)
              .limit(1);
            
            if (jobs && jobs.length > 0) {
              sendJobId = jobs[0].id;
              jobStatus = jobs[0].status;
            }

            totalCreated++;
            routeCycleCount++;

            // --- 11. REGISTER DISPATCH & UPDATE RULE ---
            await autoService.registerCouponDispatch({
              user_id: source.user_id,
              coupon_id: coupon.id,
              route_id: route.id,
              target_id: route.target_id,
              campaign_id: campaign.id,
              send_job_id: sendJobId,
              status: jobStatus === 'completed' || jobStatus === 'sent' ? 'sent' : 'queued',
              sent_at: jobStatus === 'completed' || jobStatus === 'sent' ? new Date().toISOString() : null,
              cycle_key: cycleKey,
              dedupe_key: `rule:${rule.id}:cycle:${cycleKey}:target:${route.target_id}`
            }, supabase);

            // Atualizar o agendamento da regra: next_run = now + interval
            const nextRunAt = new Date(Date.now() + (rule.interval_minutes || 60) * 60000);
            await autoService.updateCouponRule(rule.id, { 
              last_sent_at: new Date().toISOString(),
              next_run_at: nextRunAt.toISOString()
            }, supabase);

            console.log(`${routeLogPrefix} [SUCCESS] Campanha ${campaign.id} criada para cupom ${coupon.id} (Ciclo: ${cycleKey})`);

          } catch (err: any) {
            console.error(`${routeLogPrefix} [ERROR] Erro ao processar cupom ${coupon.id}:`, err.message);
            // Registrar falha para este ciclo
            await autoService.registerCouponDispatch({
              user_id: source.user_id,
              coupon_id: coupon.id,
              route_id: route.id,
              target_id: route.target_id,
              status: 'failed',
              cycle_key: cycleKey,
              dedupe_key: `rule:${rule.id}:cycle:${cycleKey}:fail`
            }, supabase);
            
            // Mesmo em caso de erro, avançamos o agendamento para não travar a fila
            const nextRunAt = new Date(Date.now() + (rule.interval_minutes || 60) * 60000);
            await autoService.updateCouponRule(rule.id, { 
              next_run_at: nextRunAt.toISOString()
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
